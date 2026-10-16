import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formatKobo, parseNaira, fundingFee } from "../../src/lib/money";
import { verifyPaystackSignature } from "../../src/server/payments/paystack";
import { MonnifyGateway } from "../../src/server/payments/monnify";
import { fundingReviewSchema } from "../../src/lib/validation/wallet";
describe("funding security and money", () => {
  it("parses naira without floating point or silent rounding", () => {
    expect(parseNaira("1234.01")).toBe(123401n); expect(parseNaira("0.1")).toBe(10n);
    expect(() => parseNaira("1.005")).toThrow(); expect(() => parseNaira("1e6")).toThrow();
    expect(formatKobo("123401")).toBe("₦1,234.01");
    expect(formatKobo(900719925474099301n)).toBe("₦9,007,199,254,740,993.01");
  });
  it("rounds fractional percentage fees upward and rejects excessive fees", () => {
    expect(fundingFee(101n, 0n, 100)).toBe(2n);
    expect(fundingFee(100000n, 500n, 150)).toBe(2000n);
    expect(() => fundingFee(100n, 100n, 0)).toThrow();
  });
  it("authenticates the exact raw payload and rejects altered bodies", () => {
    const raw = '{"event":"charge.success","data":{"reference":"HD-test"}}';
    const signature = createHmac("sha512", "test-only-key").update(raw).digest("hex");
    expect(verifyPaystackSignature(raw, signature, "test-only-key")).toBe(true);
    expect(verifyPaystackSignature(raw + " ", signature, "test-only-key")).toBe(false);
    expect(verifyPaystackSignature(raw, "invalid", "test-only-key")).toBe(false);
    expect(verifyPaystackSignature(raw, signature, "wrong-key")).toBe(false);
  });
  it("requires approval confirmation and keeps gateway stubs unavailable", async () => {
    expect(fundingReviewSchema.safeParse({ fundingId: "id", decision: "APPROVE", reason: "Verified receipt" }).success).toBe(false);
    expect(fundingReviewSchema.safeParse({ fundingId: "id", decision: "REJECT", reason: "No payment received" }).success).toBe(true);
    await expect(new MonnifyGateway().verify()).rejects.toMatchObject({ status: 503 });
  });
});
