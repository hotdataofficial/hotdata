import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, randomInt } from "node:crypto";
import { db } from "../../src/server/db";
import { hashSecret } from "../../src/server/security/crypto";
import { moveMoney } from "../../src/server/services/wallet";
import { createPurchase } from "../../src/server/services/purchases";
import { ownReceipt, purchaseHistory } from "../../src/server/services/customer-records";
const ready = () => true;
async function fixture() {
  const key = randomUUID();
  const user = await db.user.create({ data: { fullName: "Customer Test", email: key + "@example.com", phone: "+23480" + randomInt(10000000, 100000000), passwordHash: await hashSecret(key), pinHash: await hashSecret("1234"), emailVerifiedAt: new Date(), consentAt: new Date(), consentVersion: "test", referralCode: key, wallet: { create: {} } } });
  await db.$transaction(tx => moveMoney(tx, user.id, 100000n, "ADMIN_CREDIT", key, "Test funding"));
  const network = await db.network.create({ data: { code: key, name: "Test" } });
  const provider = await db.provider.create({ data: { code: key, name: "Test", adapter: "integration-fake", active: true, baseUrl: "https://invalid.invalid" } });
  const plan = await db.plan.create({ data: { code: key, networkId: network.id, name: "Original 1 GB", type: "SME", sizeMb: 1024, validityDays: 30, costKobo: 25000n, customerPriceKobo: 30000n, agentPriceKobo: 28000n, mappings: { create: { providerId: provider.id, providerPlanCode: "test" } } } });
  return { user, plan, input: { planId: plan.id, phone: "+2348012345678", pin: "1234", idempotencyKey: randomUUID(), expectedPriceKobo: "30000" } };
}
describe.skipIf(process.env.RUN_DB_TESTS !== "true")("customer records (hotdata_test only)", () => {
  beforeAll(() => { if (new URL(process.env.DATABASE_URL || "").pathname !== "/hotdata_test") throw new Error("Use hotdata_test."); });
  afterAll(() => db.$disconnect());
  it("refuses changed quotes without a debit", async () => {
    const f = await fixture();
    await db.plan.update({ where: { id: f.plan.id }, data: { customerPriceKobo: 40000n } });
    await expect(createPurchase(f.user.id, f.input, ready)).rejects.toMatchObject({ status: 409 });
    expect((await db.wallet.findUniqueOrThrow({ where: { userId: f.user.id } })).balanceKobo).toBe(100000n);
    expect(await db.transaction.count({ where: { userId: f.user.id } })).toBe(0);
  });
  it("keeps historical bundle details and rejects another owner's receipt", async () => {
    const f = await fixture(), stranger = await fixture();
    const order = await createPurchase(f.user.id, f.input, ready);
    await db.plan.update({ where: { id: f.plan.id }, data: { name: "Changed plan", sizeMb: 2048 } });
    const receipt = await ownReceipt(f.user.id, order.reference);
    expect(receipt.plan?.name).toBe("Original 1 GB"); expect(receipt.plan?.sizeMb).toBe(1024); expect(receipt.historicalSnapshot).toBe(true);
    await expect(ownReceipt(stranger.user.id, order.reference)).rejects.toMatchObject({ status: 404 });
    expect((await purchaseHistory(stranger.user.id, { search: order.reference })).transactions).toHaveLength(0);
    await expect(purchaseHistory(stranger.user.id, { search: "", cursor: order.id })).rejects.toMatchObject({ status: 400 });
  });
});
