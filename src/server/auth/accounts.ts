import type { NextRequest } from "next/server";
import { Prisma, type OtpPurpose } from "@prisma/client";
import type { z } from "zod";
import { registerSchema, normalizeNigerianPhone } from "@/lib/validation/auth";
import { db } from "../db";
import { codeDigest, hashSecret, otpCode, randomToken, safeEqual, verifySecret } from "../security/crypto";
import { HttpError } from "../security/http";
import { disabledSms, sendEmail } from "../notifications/delivery";
import { createSession } from "./sessions";
export async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt || user.status !== "ACTIVE") throw new HttpError(401, "Please sign in again.");
  return user;
}
export async function register(input: z.infer<typeof registerSchema>) {
  const referredBy = input.referralCode ? await db.user.findUnique({ where: { referralCode: input.referralCode } }) : null;
  if (input.referralCode && (!referredBy || referredBy.deletedAt || referredBy.status !== "ACTIVE")) throw new HttpError(400, "That referral code is not valid.");
  const user = await db.user.create({ data: {
    fullName: input.fullName, email: input.email, phone: input.phone,
    passwordHash: await hashSecret(input.password), consentAt: new Date(), consentVersion: "2026-10-10-v1",
    referralCode: randomToken().slice(0, 12), referredById: referredBy?.id,
    wallet: { create: {} },
  } });
  // Registration persists even when delivery is unavailable; the user can resend.
  let verificationSent = false;
  try { await issueCode(user.id, "EMAIL_VERIFICATION"); verificationSent = true; }
  catch { console.warn(JSON.stringify({ event: "verification_delivery_failed", userId: user.id })); }
  return { id: user.id, verificationSent };
}
let dummyHash: Promise<string> | undefined;
export async function login(identifier: string, password: string, req: NextRequest) {
  let where: Prisma.UserWhereUniqueInput;
  if (identifier.includes("@")) where = { email: identifier.toLowerCase() };
  else { try { where = { phone: normalizeNigerianPhone(identifier) }; } catch { where = { email: "invalid@invalid.invalid" }; } }
  const candidate = await db.user.findUnique({ where });
  if (!candidate) {
    // Match expensive password verification work without revealing account existence.
    dummyHash ??= hashSecret(randomToken()); await verifySecret(await dummyHash, password);
    throw new HttpError(401, "Unable to sign in. Check your details or try again later.");
  }
  const result = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${candidate.id} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: candidate.id } });
    if (user.deletedAt || user.status !== "ACTIVE" || (user.loginLockedUntil && user.loginLockedUntil > new Date())) return null;
    const valid = await verifySecret(user.passwordHash, password);
    if (!valid) {
      const failures = user.loginLockedUntil ? 1 : user.loginFailedAttempts + 1;
      await tx.user.update({ where: { id: user.id }, data: { loginFailedAttempts: failures, loginLockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60000) : null } });
      return null;
    }
    await tx.user.update({ where: { id: user.id }, data: { loginFailedAttempts: 0, loginLockedUntil: null } });
    return createSession(tx, user, req);
  }, { timeout: 15000 });
  if (!result) throw new HttpError(401, "Unable to sign in. Check your details or try again later.");
  return result;
}
export async function issueCode(userId: string, purpose: OtpPurpose) {
  if (purpose === "PHONE_VERIFICATION") await disabledSms.sendOtp("", "");
  const code = otpCode();
  const result = await db.$transaction(async tx => {
    const user = await lockUser(tx, userId);
    if ((purpose === "EMAIL_VERIFICATION" && user.emailVerifiedAt) || (purpose === "PHONE_VERIFICATION" && user.phoneVerifiedAt)) throw new HttpError(409, "This contact is already verified.");
    const previous = await tx.otpCode.findFirst({ where: { userId, purpose }, orderBy: { createdAt: "desc" } });
    if (previous && previous.createdAt > new Date(Date.now() - 60000)) throw new HttpError(429, "Wait a minute before requesting another code.");
    await tx.otpCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
    const otp = await tx.otpCode.create({ data: { userId, purpose, codeHash: codeDigest(userId, purpose, code), expiresAt: new Date(Date.now() + 10 * 60000) } });
    return { user, otp };
  });
  try {
    await sendEmail(result.user.email, purpose === "PASSWORD_RESET" ? "Reset your Hotdata password" : "Verify your Hotdata email", "Your Hotdata code is " + code + ". It expires in 10 minutes. If you did not request it, ignore this message.");
  } catch (error) {
    await db.otpCode.update({ where: { id: result.otp.id }, data: { consumedAt: new Date() } });
    throw error;
  }
}
// Caller holds the User lock. Return failure rather than throwing so attempts persist.
async function consumeCode(tx: Prisma.TransactionClient, userId: string, purpose: OtpPurpose, code: string) {
  const otp = await tx.otpCode.findFirst({ where: { userId, purpose, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt <= new Date() || otp.attempts >= 5) return false;
  const matches = safeEqual(otp.codeHash, codeDigest(userId, purpose, code));
  await tx.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 }, consumedAt: matches || otp.attempts >= 4 ? new Date() : null } });
  return matches;
}
export async function verifyContact(userId: string, purpose: "EMAIL_VERIFICATION" | "PHONE_VERIFICATION", code: string) {
  const result = await db.$transaction(async tx => {
    await lockUser(tx, userId);
    if (!await consumeCode(tx, userId, purpose, code)) return false;
    await tx.user.update({ where: { id: userId }, data: purpose === "EMAIL_VERIFICATION" ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() } });
    return true;
  });
  if (!result) throw new HttpError(400, "The code is invalid or expired.");
}
export async function forgotPassword(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (user && !user.deletedAt && user.status === "ACTIVE") {
    try { await issueCode(user.id, "PASSWORD_RESET"); }
    catch { console.warn(JSON.stringify({ event: "reset_delivery_unavailable" })); }
  }
}
async function replacePassword(tx: Prisma.TransactionClient, userId: string, passwordHash: string) {
  await tx.user.update({ where: { id: userId }, data: { passwordHash, authVersion: { increment: 1 }, loginFailedAttempts: 0, loginLockedUntil: null } });
  await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await tx.otpCode.updateMany({ where: { userId, purpose: "PASSWORD_RESET", consumedAt: null }, data: { consumedAt: new Date() } });
}
export async function resetPassword(email: string, code: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  const passwordHash = await hashSecret(password);
  const valid = user && await db.$transaction(async tx => {
    await lockUser(tx, user.id);
    if (!await consumeCode(tx, user.id, "PASSWORD_RESET", code)) return false;
    await replacePassword(tx, user.id, passwordHash);
    return true;
  });
  if (!valid) throw new HttpError(400, "The code is invalid or expired.");
}
export async function changePassword(userId: string, currentPassword: string, password: string) {
  const passwordHash = await hashSecret(password);
  await db.$transaction(async tx => {
    const user = await lockUser(tx, userId);
    if (!await verifySecret(user.passwordHash, currentPassword)) throw new HttpError(400, "The current password is incorrect.");
    await replacePassword(tx, userId, passwordHash);
  });
}
export async function verifyPinInTransaction(tx: Prisma.TransactionClient, userId: string, pin: string) {
  const user = await lockUser(tx, userId);
  if (!user.pinHash) return { ok: false as const, error: "Set a transaction PIN first." };
  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) return { ok: false as const, error: "PIN locked. Try again in 15 minutes." };
  if (!await verifySecret(user.pinHash, pin)) {
    const failures = user.pinLockedUntil ? 1 : user.pinFailedAttempts + 1;
    await tx.user.update({ where: { id: userId }, data: { pinFailedAttempts: failures, pinLockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60000) : null } });
    return { ok: false as const, error: "Incorrect PIN. Five failed attempts lock the PIN for 15 minutes." };
  }
  await tx.user.update({ where: { id: userId }, data: { pinFailedAttempts: 0, pinLockedUntil: null } });
  return { ok: true as const };
}
export async function setPin(userId: string, password: string, pin: string, currentPin?: string) {
  const hash = await hashSecret(pin);
  const result = await db.$transaction(async tx => {
    const user = await lockUser(tx, userId);
    if (!await verifySecret(user.passwordHash, password)) return { ok: false as const, error: "The password is incorrect." };
    if (user.pinHash) {
      if (!currentPin) return { ok: false as const, error: "Enter your current PIN." };
      const verified = await verifyPinInTransaction(tx, userId, currentPin);
      if (!verified.ok) return verified;
    }
    await tx.user.update({ where: { id: userId }, data: { pinHash: hash, pinFailedAttempts: 0, pinLockedUntil: null } });
    return { ok: true as const };
  });
  if (!result.ok) throw new HttpError(400, result.error);
}
export async function revokeSession(userId: string, sessionId: string) {
  await db.$transaction(async tx => {
    await lockUser(tx, userId);
    await tx.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  });
}
