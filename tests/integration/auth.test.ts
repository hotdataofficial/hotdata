import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "../../src/server/db";
import { hashSecret, codeDigest } from "../../src/server/security/crypto";
import { login, verifyPinInTransaction, resetPassword, verifyContact, revokeSession } from "../../src/server/auth/accounts";
import { requireRole } from "../../src/server/auth/rbac";
import { decode, requireActor, rotateSession } from "../../src/server/auth/sessions";
const enabled = process.env.RUN_DB_TESTS === "true";
const ids: string[] = [];
const req = (cookie = "") => new NextRequest("http://localhost:3000", { headers: { cookie, "user-agent": "integration-test" } });
async function account() {
  const suffix = randomBytes(6).toString("hex");
  const user = await db.user.create({ data: { fullName: "Integration User", email: suffix + "@example.com", phone: "+234" + Date.now().toString().slice(-10), passwordHash: await hashSecret("integration-password"), pinHash: await hashSecret("0123"), consentAt: new Date(), consentVersion: "test", referralCode: suffix, wallet: { create: {} } } });
  ids.push(user.id); return user;
}
describe.skipIf(!enabled)("database auth invariants (dedicated test database only)", () => {
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL || "");
    if (url.pathname !== "/hotdata_test") throw new Error("Use the dedicated hotdata_test database for integration tests.");
  });
  afterAll(async () => {
    for (const id of ids) {
      await db.wallet.deleteMany({ where: { userId: id } });
      await db.user.delete({ where: { id } });
    }
    await db.$disconnect();
  });
  it("commits failed logins and blocks a correct password after five failures", async () => {
    const user = await account();
    for (let i = 0; i < 5; i++) await expect(login(user.email, "wrong", req())).rejects.toMatchObject({ status: 401 });
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.loginFailedAttempts).toBe(5); expect(stored.loginLockedUntil).not.toBeNull();
    await expect(login(user.email, "integration-password", req())).rejects.toMatchObject({ status: 401 });
  });
  it("serializes concurrent wrong PINs and persists lockout", async () => {
    const user = await account();
    const results = await Promise.all(Array.from({ length: 5 }, () => db.$transaction(tx => verifyPinInTransaction(tx, user.id, "9999"), { timeout: 15000 })));
    expect(results.every(result => !result.ok)).toBe(true);
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.pinFailedAttempts).toBe(5);
    const correct = await db.$transaction(tx => verifyPinInTransaction(tx, user.id, "0123")); expect(correct.ok).toBe(false);
  });
  it("rotates refresh JWTs and revokes a session on old-token replay", async () => {
    const user = await account(); const tokens = await login(user.email, "integration-password", req());
    const rotated = await rotateSession(req("hotdata_refresh=" + tokens.refresh)); expect(rotated.refresh).not.toBe(tokens.refresh);
    await expect(rotateSession(req("hotdata_refresh=" + tokens.refresh))).rejects.toMatchObject({ status: 401 });
    await expect(requireActor(req("hotdata_access=" + rotated.access))).rejects.toMatchObject({ status: 401 });
  });
  it("enforces roles and ownership during remote logout", async () => {
    const user = await account(); const other = await account();
    const tokens = await login(user.email, "integration-password", req());
    const sessionId = (await decode(tokens.access, "access")).sessionId;
    await expect(requireRole(req("hotdata_access=" + tokens.access), ["ADMIN", "SUPER_ADMIN"])).rejects.toMatchObject({ status: 403 });
    await revokeSession(other.id, sessionId);
    expect((await requireActor(req("hotdata_access=" + tokens.access))).id).toBe(user.id);
    await revokeSession(user.id, sessionId);
    await expect(requireActor(req("hotdata_access=" + tokens.access))).rejects.toMatchObject({ status: 401 });
  });
  it("consumes reset codes once and invalidates existing access cookies", async () => {
    const user = await account(); const tokens = await login(user.email, "integration-password", req());
    await db.otpCode.create({ data: { userId: user.id, purpose: "PASSWORD_RESET", codeHash: codeDigest(user.id, "PASSWORD_RESET", "123456"), expiresAt: new Date(Date.now() + 60000) } });
    await resetPassword(user.email, "123456", "replacement-password");
    await expect(requireActor(req("hotdata_access=" + tokens.access))).rejects.toMatchObject({ status: 401 });
    await expect(resetPassword(user.email, "123456", "another-password")).rejects.toMatchObject({ status: 400 });
  });
  it("locks an OTP after five wrong codes and validates token purpose", async () => {
    const user = await account();
    await db.otpCode.create({ data: { userId: user.id, purpose: "EMAIL_VERIFICATION", codeHash: codeDigest(user.id, "EMAIL_VERIFICATION", "123456"), expiresAt: new Date(Date.now() + 60000) } });
    for (let i = 0; i < 5; i++) await expect(verifyContact(user.id, "EMAIL_VERIFICATION", "000000")).rejects.toMatchObject({ status: 400 });
    await expect(verifyContact(user.id, "EMAIL_VERIFICATION", "123456")).rejects.toMatchObject({ status: 400 });
    const tokens = await login(user.email, "integration-password", req());
    await expect(decode(tokens.access, "refresh")).rejects.toMatchObject({ status: 401 });
  });
});
