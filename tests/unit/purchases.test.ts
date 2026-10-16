import { describe, expect, it } from "vitest";
import { markedUp, parseCsv, csvCell } from "../../src/server/services/pricing";
import { encryptCredentials, decryptCredentials } from "../../src/server/providers/credentials";
import { purchaseSchema, planSchema } from "../../src/lib/validation/purchases";
describe("purchase validation and pricing", () => {
  it("uses integer kobo with upward percentage rounding", () => {
    expect(markedUp(25001n, "PERCENT", 1250n)).toBe(28127n);
    expect(markedUp(25000n, "FIXED", 5000n)).toBe(30000n);
    expect(() => markedUp(1n, "FIXED", -1n)).toThrow();
  });
  it("rejects forged prices and normalizes phones", () => {
    const order = { planId: "p", phone: "08012345678", pin: "1234", idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    expect(purchaseSchema.parse(order).phone).toBe("+2348012345678");
    expect(purchaseSchema.safeParse({ ...order, amountKobo: "1" }).success).toBe(false);
  });
  it("rejects below-cost selling prices", () => {
    expect(planSchema.safeParse({ networkId: "n", code: "P", name: "Test", type: "SME", sizeMb: 1024, validityDays: 30, costKobo: "30000", customerPriceKobo: "29999", agentPriceKobo: "30000", active: true }).success).toBe(false);
  });
  it("round-trips CSV quoting and prevents spreadsheet formula execution", () => {
    expect(parseCsv('code,name\nP,"A, ""B"""\n')).toEqual([["code", "name"], ["P", 'A, "B"']]);
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(() => parseCsv('"unfinished')).toThrow();
  });
  it("authenticates encrypted credentials and uses fresh IVs", () => {
    const old = process.env.PROVIDER_ENCRYPTION_KEY;
    process.env.PROVIDER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      const a = encryptCredentials({ token: "secret" }), b = encryptCredentials({ token: "secret" });
      expect(a).not.toBe(b); expect(a).not.toContain("secret");
      expect(decryptCredentials(a)).toEqual({ token: "secret" });
      const parts = a.split("."); parts[3] = Buffer.alloc(16).toString("base64");
      expect(() => decryptCredentials(parts.join("."))).toThrow();
    } finally { if (old === undefined) delete process.env.PROVIDER_ENCRYPTION_KEY; else process.env.PROVIDER_ENCRYPTION_KEY = old; }
  });
});
