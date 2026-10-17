import { describe, expect, it } from "vitest";
import { guessNetwork, transactionLabel, selectedPlanType } from "../../src/lib/customer";
import { lagosDay, historyDates } from "../../src/lib/history-dates";
import { beneficiarySchema, savedPurchaseSchema, historyQuerySchema } from "../../src/lib/validation/customer";
import { receiptPdf } from "../../src/server/receipts/pdf";
import type { Receipt } from "../../src/lib/customer";
const receipt: Receipt = { reference: "HD-D-00000000-0000-4000-8000-000000000000", phone: "+2348012345678", amountKobo: "30000", status: "SUCCESSFUL", createdAt: "2026-10-10T09:42:00Z", completedAt: "2026-10-10T09:42:01Z", refundedAt: null, plan: { name: "1 GB", networkCode: "MTN", type: "SME", sizeMb: 1024, validityDays: 30 }, customerName: "Test", historicalSnapshot: true, planId: "test" };
describe("customer safeguards", () => {
  it("treats prefix matches as suggestions and returns no guess for unknown prefixes", () => {
    expect(guessNetwork("+2348031234567")).toBe("MTN");
    expect(guessNetwork("0802 123 4567")).toBe("AIRTEL");
    expect(guessNetwork("08051234567")).toBe("GLO");
    expect(guessNetwork("08091234567")).toBe("9MOBILE");
    expect(guessNetwork("07001234567")).toBeNull();
  });
  it("labels uncertainty and refunds honestly", () => {
    expect(transactionLabel("PENDING")).toBe("Processing");
    expect(transactionLabel("FAILED", null)).toBe("Failed");
    expect(transactionLabel("FAILED", receipt.createdAt)).toBe("Failed, refunded");
  });
  it("uses inclusive Lagos calendar days and rejects impossible dates", () => {
    expect(lagosDay("2026-10-10").toISOString()).toBe("2026-10-09T23:00:00.000Z");
    expect(historyDates("2026-10-10", "2026-10-10").lt?.toISOString()).toBe("2026-10-10T23:00:00.000Z");
    expect(() => lagosDay("2026-02-30")).toThrow();
    expect(historyQuerySchema.safeParse({ from: "2026-10-11", to: "2026-10-10" }).success).toBe(false);
  });
  it("normalizes saved recipients and refuses PINs in persistent drafts", () => {
    expect(beneficiarySchema.parse({ name: "Mum", phone: "08012345678" }).phone).toBe("+2348012345678");
    const draft = { planId: "p", phone: "08012345678", idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    expect(savedPurchaseSchema.safeParse(draft).success).toBe(true);
    expect(savedPurchaseSchema.safeParse({ ...draft, pin: "1234" }).success).toBe(false);
  });
  it("writes a PDF with accurate kobo and valid cross-reference offsets", () => {
    const bytes = receiptPdf(receipt), pdf = Buffer.from(bytes).toString("ascii");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("(NGN 300.00)");
    const xref = Number(pdf.match(/startxref\n([0-9]+)/)?.[1]); expect(pdf.slice(xref, xref + 4)).toBe("xref");
    const entries = pdf.slice(xref).split("\n").slice(3, 9);
    entries.forEach((line, index) => { const offset = Number(line.slice(0, 10)); expect(pdf.slice(offset, offset + 7)).toBe((index + 1) + " 0 obj"); });
    expect(Buffer.from(receiptPdf({ ...receipt, status: "PENDING", completedAt: null })).toString()).toContain("Awaiting confirmation");
    expect(Buffer.from(receiptPdf({ ...receipt, status: "FAILED", refundedAt: receipt.createdAt })).toString()).toContain("Failed, refunded");
  });
});

describe("network plan type selection", () => {
  it("shows direct bundles on networks without SME, including automatic phone selection", () => {
    expect(selectedPlanType(["DIRECT"], "SME")).toBe("DIRECT");
  });
  it("preserves valid choices and retains locked retry identity", () => {
    expect(selectedPlanType(["SME", "DIRECT"], "DIRECT")).toBe("DIRECT");
    expect(selectedPlanType(["DIRECT"], "SME", true)).toBe("SME");
    expect(selectedPlanType([], "SME")).toBe("SME");
  });
});
