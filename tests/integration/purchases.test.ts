import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, randomInt } from "node:crypto";
import { db } from "../../src/server/db";
import { hashSecret } from "../../src/server/security/crypto";
import { moveMoney } from "../../src/server/services/wallet";
import { createPurchase, processPurchase } from "../../src/server/services/purchases";
import type { ProviderFactory, ProviderResult } from "../../src/server/providers/types";
const enabled = process.env.RUN_DB_TESTS === "true";
const ready = (adapter: string) => adapter === "integration-fake";
function fake(buy: () => Promise<ProviderResult>, check: () => Promise<ProviderResult> = buy): ProviderFactory {
  return () => ({ buyData: buy, buyAirtime: buy, checkStatus: check, getBalance: async () => 100000n, getPlans: async () => [] });
}
async function fixture() {
  const id = randomUUID();
  const user = await db.user.create({ data: { fullName: "Purchase Test", email: id + "@example.com", phone: "+23480" + randomInt(10000000, 100000000), passwordHash: await hashSecret(id), pinHash: await hashSecret("1234"), emailVerifiedAt: null, consentAt: new Date(), consentVersion: "test", referralCode: id, wallet: { create: {} } } });
  await db.$transaction(tx => moveMoney(tx, user.id, 100000n, "ADMIN_CREDIT", id, "Test funds"));
  const network = await db.network.create({ data: { code: id, name: "Test" } });
  const provider = await db.provider.create({ data: { code: id, name: "Fake", adapter: "integration-fake", baseUrl: "https://invalid.invalid", active: true } });
  const plan = await db.plan.create({ data: { networkId: network.id, code: id, name: "Test 1GB", type: "SME", sizeMb: 1024, validityDays: 30, costKobo: 25000n, customerPriceKobo: 30000n, agentPriceKobo: 28000n, mappings: { create: { providerId: provider.id, providerPlanCode: "1" } } } });
  return { user, plan, provider, input: { planId: plan.id, phone: "+2348012345678", pin: "1234", idempotencyKey: randomUUID() } };
}
describe.skipIf(!enabled)("purchase engine (disposable hotdata_test only)", () => {
  beforeAll(() => { if (new URL(process.env.DATABASE_URL || "").pathname !== "/hotdata_test") throw new Error("Use hotdata_test."); });
  afterAll(() => db.$disconnect());
  it("serializes duplicate requests, snapshots price and settles once", async () => {
    const f = await fixture();
    const orders = await Promise.all([createPurchase(f.user.id, f.input, ready), createPurchase(f.user.id, f.input, ready)]);
    expect(orders[0].id).toBe(orders[1].id);
    expect((await db.wallet.findUniqueOrThrow({ where: { userId: f.user.id } })).balanceKobo).toBe(70000n);
    await db.plan.update({ where: { id: f.plan.id }, data: { customerPriceKobo: 40000n } });
    let calls = 0;
    const adapter = fake(async () => { calls++; return { status: "SUCCESSFUL", code: "OK" }; });
    await Promise.all([processPurchase(orders[0].id, adapter, ready), processPurchase(orders[0].id, adapter, ready)]);
    await processPurchase(orders[0].id, adapter, ready);
    expect(calls).toBe(1);
    expect((await db.transaction.findUniqueOrThrow({ where: { id: orders[0].id } })).amountKobo).toBe(30000n);
    await expect(createPurchase(f.user.id, { ...f.input, phone: "+2348098765432" }, ready)).rejects.toMatchObject({ status: 409 });
  });
  it("keeps timeouts pending, requeries and never resends the attempt", async () => {
    const f = await fixture(), order = await createPurchase(f.user.id, f.input, ready);
    let buys = 0, queries = 0;
    const adapter = fake(async () => { buys++; throw new Error("timeout"); }, async () => { queries++; return { status: queries === 1 ? "UNKNOWN" : "SUCCESSFUL", code: "CHECKED" }; });
    await processPurchase(order.id, adapter, ready); await processPurchase(order.id, adapter, ready);
    expect((await db.transaction.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(await db.ledgerEntry.count({ where: { transactionId: order.id, type: "REFUND" } })).toBe(0);
    await processPurchase(order.id, adapter, ready); expect(buys).toBe(1); expect(queries).toBe(2);
  });
  it("refunds a definite exhausted failure exactly once", async () => {
    const f = await fixture(), order = await createPurchase(f.user.id, f.input, ready);
    const adapter = fake(async () => ({ status: "FAILED", code: "REJECTED" }));
    await processPurchase(order.id, adapter, ready); await processPurchase(order.id, adapter, ready); await processPurchase(order.id, adapter, ready);
    expect((await db.wallet.findUniqueOrThrow({ where: { userId: f.user.id } })).balanceKobo).toBe(100000n);
    expect(await db.ledgerEntry.count({ where: { transactionId: order.id, type: "REFUND" } })).toBe(1);
  });
  it("only falls back after a definitive failure", async () => {
    const f = await fixture();
    const second = await db.provider.create({ data: { code: randomUUID(), name: "Fallback", adapter: "integration-fake", baseUrl: "https://invalid.invalid", active: true, priority: 200 } });
    await db.providerPlanMap.create({ data: { planId: f.plan.id, providerId: second.id, providerPlanCode: "second" } });
    const order = await createPurchase(f.user.id, f.input, ready);
    let calls = 0; const adapter = fake(async () => ({ status: ++calls === 1 ? "FAILED" : "SUCCESSFUL", code: "RESULT" }));
    await processPurchase(order.id, adapter, ready); await processPurchase(order.id, adapter, ready);
    expect(calls).toBe(2); expect((await db.transaction.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SUCCESSFUL");
  });
  it("recovers a persisted attempt without sending it again", async () => {
    const f = await fixture(), order = await createPurchase(f.user.id, f.input, ready);
    await db.providerAttempt.create({ data: { transactionId: order.id, providerId: f.provider.id, reference: "crash-" + randomUUID(), providerPlanCode: "1", networkCode: f.plan.networkId } });
    let buys = 0, queries = 0;
    const adapter = fake(async () => { buys++; return { status: "SUCCESSFUL", code: "OK" }; }, async () => { queries++; return { status: "UNKNOWN", code: "NOT_PROVEN" }; });
    await processPurchase(order.id, adapter, ready);
    expect(buys).toBe(0); expect(queries).toBe(1);
    expect((await db.transaction.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });
  it("prevents concurrent distinct orders from overspending", async () => {
    const f = await fixture();
    await db.$transaction(tx => moveMoney(tx, f.user.id, -70000n, "ADMIN_DEBIT", randomUUID(), "Test limit"));
    const results = await Promise.allSettled([createPurchase(f.user.id, f.input, ready), createPurchase(f.user.id, { ...f.input, idempotencyKey: randomUUID() }, ready)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.wallet.findUniqueOrThrow({ where: { userId: f.user.id } })).balanceKobo).toBe(0n);
  });
  it("persists bad PIN attempts without debiting", async () => {
    const f = await fixture();
    await expect(createPurchase(f.user.id, { ...f.input, pin: "9999" }, ready)).rejects.toMatchObject({ status: 400 });
    expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).pinFailedAttempts).toBe(1);
    expect((await db.wallet.findUniqueOrThrow({ where: { userId: f.user.id } })).balanceKobo).toBe(100000n);
  });
});
