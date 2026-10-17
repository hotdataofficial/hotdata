import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KorapayGateway, korapayAmountKobo, verifyKorapaySignature } from "../../src/server/payments/korapay";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const key = "sk_test_fixture_only";
function response(data: unknown) { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: true, data }), { status: 200 }))); }
const charge = { reference: "HD-test", status: "success", amount: "1234.01", amount_paid: "1234.01", currency: "NGN", customer: { email: "buyer@example.com" }, payment_method: "bank_transfer" };
describe("Korapay checkout and payment verification", () => {
  it("signs only the webhook data object and rejects forged or malformed payloads", () => {
    const raw = JSON.stringify({ event: "charge.success", data: { reference: "HD-test", amount: 100 } });
    const signature = createHmac("sha256", key).update(JSON.stringify(JSON.parse(raw).data)).digest("hex");
    expect(verifyKorapaySignature(raw, signature, key)).toBe(true);
    expect(verifyKorapaySignature(raw.replace('100', '101'), signature, key)).toBe(false);
    expect(verifyKorapaySignature(raw, signature, "wrong-key")).toBe(false);
    expect(verifyKorapaySignature(raw, createHmac("sha256", key).update(raw).digest("hex"), key)).toBe(false);
    expect(verifyKorapaySignature("invalid", signature, key)).toBe(false);
    expect(verifyKorapaySignature('{"data":null}', signature, key)).toBe(false);
    expect(verifyKorapaySignature(raw, "f".repeat(63), key)).toBe(false);
  });
  it("converts major-unit amounts exactly and rejects fractional kobo", () => {
    expect(korapayAmountKobo("1234.01")).toBe(123401n);
    expect(korapayAmountKobo(100)).toBe(10000n);
    for (const value of ["1.005", "-1", "1e6", Infinity]) expect(() => korapayAmountKobo(value)).toThrow();
  });
  it("initializes hosted checkout with major units and the server webhook URL", async () => {
    vi.stubEnv("KORAPAY_SECRET_KEY", key);
    response({ reference: "HD-test", checkout_url: "https://checkout.korapay.com/HD-test/pay" });
    await expect(new KorapayGateway().initialize({ reference: "HD-test", email: "buyer@example.com", amountKobo: 123401n, callbackUrl: "https://hotdata.example/wallet?reference=HD-test" })).resolves.toEqual({ checkoutUrl: "https://checkout.korapay.com/HD-test/pay" });
    const options = vi.mocked(fetch).mock.calls[0][1]!;
    expect(JSON.parse(options.body as string)).toMatchObject({ amount: 1234.01, currency: "NGN", merchant_bears_cost: false, notification_url: "https://hotdata.example/api/webhooks/korapay" });
  });
  it("rejects an unexpected checkout host or reference", async () => {
    vi.stubEnv("KORAPAY_SECRET_KEY", key);
    for (const data of [{ reference: "HD-test", checkout_url: "https://checkout.korapay.com.attacker.example/pay" }, { reference: "other", checkout_url: "https://checkout.korapay.com/pay" }]) {
      response(data);
      await expect(new KorapayGateway().initialize({ reference: "HD-test", email: "buyer@example.com", amountKobo: 10000n, callbackUrl: "https://hotdata.example/wallet" })).rejects.toMatchObject({ status: 502 });
    }
  });
  it("queries the charge from the server and returns paid kobo", async () => {
    vi.stubEnv("KORAPAY_SECRET_KEY", key); response(charge);
    await expect(new KorapayGateway().verify("HD-test")).resolves.toMatchObject({ reference: "HD-test", amountKobo: 123401n, email: "buyer@example.com", domain: "test" });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://api.korapay.com/merchant/api/v1/charges/HD-test");
  });
  it("keeps a separately reported gateway fee out of the wallet funding amount", async () => {
    vi.stubEnv("KORAPAY_SECRET_KEY", key); response({ ...charge, fee: "18.51", merchant_bears_cost: false });
    await expect(new KorapayGateway().verify("HD-test")).resolves.toMatchObject({ amountKobo: 123401n });
  });
  it("rejects reference mismatch, underpayment and overpayment", async () => {
    vi.stubEnv("KORAPAY_SECRET_KEY", key);
    for (const data of [{ ...charge, reference: "other" }, { ...charge, amount_paid: "1200" }, { ...charge, amount_paid: "1300" }, { ...charge, transaction_status: "underpaid" }]) {
      response(data); await expect(new KorapayGateway().verify("HD-test")).rejects.toMatchObject({ status: 409 });
    }
  });
  it("blocks live keys by default and leaves dedicated accounts unavailable", async () => {
    vi.stubEnv("KORAPAY_SECRET_KEY", "sk_live_fixture_only"); vi.stubEnv("KORAPAY_ALLOW_LIVE", "false");
    await expect(new KorapayGateway().verify("HD-test")).rejects.toMatchObject({ status: 503 });
    await expect(new KorapayGateway().createVirtualAccount()).rejects.toMatchObject({ status: 503 });
  });
});

it("normalizes surrounding whitespace in a privately saved secret",()=>{vi.stubEnv("KORAPAY_SECRET_KEY","  "+key+"  ");const raw=JSON.stringify({data:{reference:"HD-test"}});const signature=createHmac("sha256",key).update(JSON.stringify(JSON.parse(raw).data)).digest("hex");expect(new KorapayGateway().verifyWebhook(raw,signature)).toBe(true);});
