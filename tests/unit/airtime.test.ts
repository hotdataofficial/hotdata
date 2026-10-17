import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ transaction: vi.fn(), money: vi.fn(), pin: vi.fn(), lock: vi.fn(), wake: vi.fn(), final: vi.fn() }));
vi.mock("../../src/server/db", () => ({ db: { $transaction: m.transaction } }));
vi.mock("../../src/server/services/wallet", () => ({ moveMoney: m.money }));
vi.mock("../../src/server/auth/accounts", () => ({ lockUser: m.lock, verifyPinInTransaction: m.pin }));
vi.mock("../../src/server/jobs/netlify-trigger", () => ({ wakeNetlifyWorker: m.wake }));
vi.mock("../../src/server/services/referrals", () => ({ purchaseFinalEvents: m.final }));
import { airtimePurchaseSchema, savedAirtimeSchema } from "../../src/lib/airtime";
import { stageAirtimePurchase, createAirtimePurchase } from "../../src/server/services/airtime";
import { processPurchase } from "../../src/server/services/purchases";
import { GsubzProvider } from "../../src/server/providers/gsubz";
const input = { networkCode: "MTN" as const, phone: "+2348031234567", amountKobo: "50000", pin: "1234", idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const provider = { id: "supplier", code: "GSUBZ", adapter: "gsubz", baseUrl: "https://api.gsubz.com", credentialsEncrypted: null, active: true, priority: 1 };
function stageFixture() {
  return {
    transaction: { findUnique: vi.fn().mockResolvedValue(null), aggregate: vi.fn().mockResolvedValue({ _sum: { amountKobo: 0n } }), create: vi.fn().mockImplementation(async ({ data }) => ({ id: "order", status: "PENDING", refundedAt: null, createdAt: new Date(), ...data })) },
    network: { findFirst: vi.fn().mockResolvedValue({ code: "MTN" }) }, provider: { findFirst: vi.fn().mockResolvedValue(provider) },
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: "CUSTOMER", email: "fixture@example.test" }) },
    outboxEvent: { create: vi.fn() }, notification: { create: vi.fn() },
  };
}
beforeEach(() => { vi.resetAllMocks(); m.pin.mockResolvedValue({ ok: true }); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const asTx = (tx: unknown) => tx as Prisma.TransactionClient;

describe("airtime input and durable staging", () => {
  it("accepts supported networks, normalizes phones and enforces whole-naira limits", () => {
    expect(airtimePurchaseSchema.parse({ ...input, phone: "08031234567" }).phone).toBe(input.phone);
    for (const amountKobo of ["10000", "1000000"]) expect(airtimePurchaseSchema.safeParse({ ...input, amountKobo }).success).toBe(true);
    for (const amountKobo of ["0", "9900", "10001", "1000100", "-10000", "1e5", "10000.0"]) expect(airtimePurchaseSchema.safeParse({ ...input, amountKobo }).success).toBe(false);
    expect(airtimePurchaseSchema.safeParse({ ...input, networkCode: "OTHER" }).success).toBe(false);
    expect(airtimePurchaseSchema.safeParse({ ...input, costKobo: "1" }).success).toBe(false);
    expect(savedAirtimeSchema.safeParse(input).success).toBe(false); // PINs must never persist.
  });
  it("stages one face-value debit and outbox event without inventing profit", async () => {
    const tx = stageFixture(), order = await stageAirtimePurchase(asTx(tx), "user", input, () => true);
    expect(order).toMatchObject({ type: "AIRTIME", amountKobo: 50000n, costKobo: 50000n, profitKobo: 0n, planSnapshot: { networkCode: "MTN", faceValueKobo: "50000", providerId: "supplier" } });
    expect(order.reference).toMatch(/^HD-A-/);
    expect(m.money).toHaveBeenCalledExactlyOnceWith(tx, "user", -50000n, "PURCHASE", order.reference + "-DEBIT", "Airtime purchase", { transactionId: "order" });
    expect(tx.outboxEvent.create).toHaveBeenCalledExactlyOnceWith({ data: { kind: "VTU_PURCHASE", payload: { transactionId: "order" }, dedupeKey: "purchase:order" } });
  });
  it("returns an identical retry without a second debit, even after availability changes", async () => {
    const tx = stageFixture(), first = await stageAirtimePurchase(asTx(tx), "user", input, () => true);
    tx.transaction.findUnique.mockResolvedValue(first); tx.provider.findFirst.mockResolvedValue(null);
    expect(await stageAirtimePurchase(asTx(tx), "user", input, () => false)).toBe(first);
    expect(m.money).toHaveBeenCalledTimes(1); expect(tx.transaction.create).toHaveBeenCalledTimes(1);
    for (const changed of [{ amountKobo: "60000" }, { networkCode: "GLO" as const }, { phone: "+2348031234568" }]) await expect(stageAirtimePurchase(asTx(tx), "user", { ...input, ...changed }, () => true)).rejects.toMatchObject({ status: 409 });
    tx.transaction.findUnique.mockResolvedValue({ ...first, type: "DATA" });
    await expect(stageAirtimePurchase(asTx(tx), "user", input, () => true)).rejects.toMatchObject({ status: 409 });
  });
  it("checks network, supplier availability and the combined data/airtime daily limit", async () => {
    const tx = stageFixture(); tx.network.findFirst.mockResolvedValue(null);
    await expect(stageAirtimePurchase(asTx(tx), "user", input, () => true)).rejects.toMatchObject({ status: 503 });
    tx.network.findFirst.mockResolvedValue({ code: "MTN" });
    await expect(stageAirtimePurchase(asTx(tx), "user", input, () => false)).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("PURCHASE_DAILY_LIMIT_KOBO", "100000"); tx.transaction.aggregate.mockResolvedValue({ _sum: { amountKobo: 60000n } });
    await expect(stageAirtimePurchase(asTx(tx), "user", input, () => true)).rejects.toMatchObject({ status: 400 });
    expect(tx.transaction.aggregate.mock.calls.at(-1)?.[0].where.type).toEqual({ in: ["DATA", "AIRTIME"] });
    expect(m.money).not.toHaveBeenCalled(); expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
  it("requires a correct PIN for a new debit, and never queues delivery after insufficient funds", async () => {
    const tx = stageFixture(); m.transaction.mockImplementation(fn => fn(tx)); m.pin.mockResolvedValue({ ok: false, error: "Incorrect PIN." });
    await expect(createAirtimePurchase("user", input, () => true)).rejects.toMatchObject({ status: 400 });
    expect(m.lock).toHaveBeenCalledWith(tx, "user"); expect(tx.transaction.create).not.toHaveBeenCalled();
    m.pin.mockResolvedValue({ ok: true }); m.money.mockRejectedValue(new Error("Insufficient wallet balance."));
    await expect(createAirtimePurchase("user", input, () => true)).rejects.toThrow("Insufficient wallet balance.");
    expect(tx.outboxEvent.create).not.toHaveBeenCalled(); expect(m.wake).not.toHaveBeenCalled();
  });
});

describe("airtime supplier contract (mocked, no real purchases)", () => {
  function enable() { vi.stubEnv("GSUBZ_API_KEY", "fixture"); vi.stubEnv("GSUBZ_ALLOW_LIVE", "true"); vi.stubEnv("KORAPAY_ALLOW_LIVE", "true"); }
  it.each([["MTN", "mtn"], ["AIRTEL", "airtel"], ["GLO", "glo"], ["9MOBILE", "etisalat"]])("sends %s with its exact service ID, whole-naira amount and stable reference", async (networkCode, serviceID) => {
    enable(); const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "successful", code: 200, transactionID: "123", amountPaid: "485" }))); vi.stubGlobal("fetch", send);
    expect(await new GsubzProvider().buyAirtime({ reference: "HD-P-stable", phone: input.phone, networkCode, amountKobo: 50000n })).toMatchObject({ status: "SUCCESSFUL", costKobo: "48500", providerTransactionId: "123" });
    const fields = send.mock.calls[0][1].body as URLSearchParams;
    expect(Object.fromEntries(fields)).toEqual({ serviceID, phone: "08031234567", amount: "500", requestID: "HD-P-stable", api: "fixture" });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("never submits invalid amounts or networks, and respects live-mode guards", async () => {
    enable(); const send = vi.fn(); vi.stubGlobal("fetch", send);
    for (const amountKobo of [9900n, 10001n, 1000100n]) expect(await new GsubzProvider().buyAirtime({ reference: "r", phone: input.phone, networkCode: "MTN", amountKobo })).toMatchObject({ status: "FAILED" });
    expect(await new GsubzProvider().buyAirtime({ reference: "r", phone: input.phone, networkCode: "unknown", amountKobo: 10000n })).toMatchObject({ status: "FAILED" });
    vi.stubEnv("GSUBZ_ALLOW_LIVE", "false");
    await expect(new GsubzProvider().buyAirtime({ reference: "r", phone: input.phone, networkCode: "MTN", amountKobo: 10000n })).rejects.toMatchObject({ status: 503 });
    expect(send).not.toHaveBeenCalled();
  });
  it("keeps interrupted requests uncertain and preserves definitive uncharged rejections", async () => {
    enable(); const send = vi.fn().mockRejectedValue(new Error("timeout")); vi.stubGlobal("fetch", send);
    const order = { reference: "r", phone: input.phone, networkCode: "MTN", amountKobo: 50000n };
    expect(await new GsubzProvider().buyAirtime(order)).toMatchObject({ status: "UNKNOWN" });
    send.mockResolvedValue(new Response(JSON.stringify({ status: "failed", code: 400, description: "INSUFFICIENT_BALANCE" })));
    expect(await new GsubzProvider().buyAirtime(order)).toMatchObject({ status: "FAILED", code: "INSUFFICIENT_BALANCE" });
  });
});

describe("airtime delivery settlement", () => {
  function deliveryFixture() {
    const order = { id: "order", userId: "user", reference: "HD-A-fixture", type: "AIRTIME", status: "PENDING", phone: input.phone, planId: null, plan: null, amountKobo: 50000n, costKobo: 50000n, profitKobo: 0n, processingToken: null, processingUntil: null, planSnapshot: { name: "₦500 airtime", type: "AIRTIME", networkCode: "MTN", sizeMb: 0, validityDays: 0, providerId: "supplier", faceValueKobo: "50000" }, attempts: [] as Record<string, unknown>[] };
    const tx = {
      $queryRaw: vi.fn(), provider: { findFirst: vi.fn().mockResolvedValue(provider) },
      transaction: { findUnique: vi.fn(async () => structuredClone(order)), findUniqueOrThrow: vi.fn(async () => structuredClone(order)), update: vi.fn(async ({ data }) => Object.assign(order, data)) },
      providerAttempt: { create: vi.fn(async ({ data }) => { const attempt = { id: "attempt", status: "PENDING", provider, ...data }; order.attempts.push(attempt); return attempt; }), update: vi.fn(async ({ data }) => Object.assign(order.attempts[0], data)) },
      notification: { create: vi.fn() }, outboxEvent: { create: vi.fn() }, user: { findUniqueOrThrow: vi.fn(async () => ({ email: "fixture@example.test" })) },
    };
    m.transaction.mockImplementation(fn => fn(tx));
    return { order, tx };
  }
  it("sends airtime once, requeries an unknown result, then records actual cost and profit", async () => {
    const { order, tx } = deliveryFixture();
    const adapter = { buyData: vi.fn(), buyAirtime: vi.fn(async () => ({ status: "UNKNOWN" as const, code: "TIMEOUT" })), checkStatus: vi.fn(async () => ({ status: "SUCCESSFUL" as const, code: "OK", costKobo: "48500", providerTransactionId: "123" })), getBalance: vi.fn(), getPlans: vi.fn() };
    await processPurchase("order", () => adapter, () => true);
    expect(order.status).toBe("PENDING"); expect(m.money).not.toHaveBeenCalled();
    await processPurchase("order", () => adapter, () => true); await processPurchase("order", () => adapter, () => true);
    expect(adapter.buyAirtime).toHaveBeenCalledTimes(1); expect(adapter.buyData).not.toHaveBeenCalled(); expect(adapter.checkStatus).toHaveBeenCalledExactlyOnceWith(order.attempts[0].reference, undefined);
    expect(order).toMatchObject({ status: "SUCCESSFUL", costKobo: 48500n, profitKobo: 1500n });
    expect(tx.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ title: "Airtime delivered" }) });
  });
  it("refunds a confirmed failure once and does not resend it", async () => {
    const { order } = deliveryFixture();
    const adapter = { buyData: vi.fn(), buyAirtime: vi.fn(async () => ({ status: "FAILED" as const, code: "REJECTED" })), checkStatus: vi.fn(), getBalance: vi.fn(), getPlans: vi.fn() };
    await processPurchase("order", () => adapter, () => true); await processPurchase("order", () => adapter, () => true);
    expect(order.status).toBe("FAILED"); expect(m.money).toHaveBeenCalledTimes(1);
    expect(m.money.mock.calls[0].slice(1, 6)).toEqual(["user", 50000n, "REFUND", "HD-A-fixture-REFUND", "Airtime purchase refund"]);
    expect(adapter.buyAirtime).toHaveBeenCalledTimes(1);
  });
});
