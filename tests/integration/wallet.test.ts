import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID, randomInt } from "node:crypto";
import { db } from "../../src/server/db";
import { moveMoney } from "../../src/server/services/wallet";
import { settleVerifiedPayment } from "../../src/server/services/funding";
import { hashSecret } from "../../src/server/security/crypto";
const enabled = process.env.RUN_DB_TESTS === "true";
async function account() {
  const key = randomUUID();
  return db.user.create({ data: { fullName: "Wallet Test", email: key + "@example.com", phone: "+23480" + randomInt(10000000, 100000000), passwordHash: await hashSecret(key), emailVerifiedAt: new Date(), consentAt: new Date(), consentVersion: "integration-test", referralCode: key, wallet: { create: {} } } });
}
describe.skipIf(!enabled)("wallet invariants (hotdata_test only)", () => {
  beforeAll(() => { if (new URL(process.env.DATABASE_URL || "").pathname !== "/hotdata_test") throw new Error("Use hotdata_test for these tests."); });
  // Ledger entries intentionally remain immutable; fixtures stay in the disposable test database.
  afterAll(() => db.$disconnect());
  it("credits one ledger entry when concurrent requests replay a reference", async () => {
    const user = await account(); const reference = randomUUID();
    await Promise.all(Array.from({ length: 5 }, () => db.$transaction(tx => moveMoney(tx, user.id, 10000n, "FUNDING", reference, "Test funding"))));
    expect((await db.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceKobo).toBe(10000n);
    expect(await db.ledgerEntry.count({ where: { reference } })).toBe(1);
    await expect(db.$transaction(tx => moveMoney(tx, user.id, 20000n, "FUNDING", reference, "Test funding"))).rejects.toMatchObject({ status: 409 });
  });
  it("prevents double spending and direct balance edits", async () => {
    const user = await account();
    await db.$transaction(tx => moveMoney(tx, user.id, 10000n, "ADMIN_CREDIT", randomUUID(), "Test initial funds"));
    const attempts = await Promise.allSettled([1, 2].map(() => db.$transaction(tx => moveMoney(tx, user.id, -10000n, "PURCHASE", randomUUID(), "Test debit"))));
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await db.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceKobo).toBe(0n);
    await expect(db.wallet.update({ where: { userId: user.id }, data: { balanceKobo: 1n } })).rejects.toThrow();
    const entry = await db.ledgerEntry.findFirstOrThrow({ where: { wallet: { userId: user.id } } });
    await expect(db.ledgerEntry.update({ where: { id: entry.id }, data: { description: "Modified" } })).rejects.toThrow();
  });
  it("settles replayed verified funding exactly once with separate fee entries", async () => {
    const user = await account(); const reference = "HD-test-" + randomUUID();
    const row = await db.fundingTransaction.create({ data: { userId: user.id, reference, gateway: "paystack", payerEmail: user.email, amountKobo: 10000n, feeKobo: 500n } });
    const payment = { reference, status: "success", amountKobo: 10000n, currency: "NGN", email: user.email, customerCode: "CUS_test", channel: "card", domain: "test" as const };
    const results = await Promise.all([settleVerifiedPayment(payment), settleVerifiedPayment(payment)]);
    expect(results.filter(result => result.credited)).toHaveLength(1);
    expect((await db.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceKobo).toBe(9500n);
    expect(await db.ledgerEntry.count({ where: { fundingTransactionId: row.id } })).toBe(2);
    expect(await db.outboxEvent.count({ where: { dedupeKey: "funding-email:" + row.id } })).toBe(1);
  });
  it("does not credit a wrong amount, foreign currency or unconfirmed result", async () => {
    const user = await account(); const reference = "HD-test-" + randomUUID();
    await db.fundingTransaction.create({ data: { userId: user.id, reference, gateway: "paystack", payerEmail: user.email, amountKobo: 10000n } });
    const payment = { reference, status: "success", amountKobo: 20000n, currency: "NGN", email: user.email, customerCode: "CUS_test", channel: "card", domain: "test" as const };
    await expect(settleVerifiedPayment(payment)).rejects.toMatchObject({ status: 409 });
    await expect(settleVerifiedPayment({ ...payment, currency: "USD" })).rejects.toMatchObject({ status: 409 });
    expect((await settleVerifiedPayment({ ...payment, status: "pending" })).credited).toBe(false);
    expect((await db.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceKobo).toBe(0n);
  });
});
