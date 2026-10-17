import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), list: vi.fn() }));
vi.mock("../../src/server/db", () => ({ db: { transaction: { findFirst: m.find, findMany: m.list } } }));
import { ownReceipt, purchaseHistory } from "../../src/server/services/customer-records";
import { receiptPdf } from "../../src/server/receipts/pdf";
const order = {
  id: "order", type: "AIRTIME", reference: "HD-A-fixture", userId: "owner", status: "SUCCESSFUL", phone: "+2348030000001", amountKobo: 50000n,
  createdAt: new Date("2026-10-17T12:00:00Z"), completedAt: new Date("2026-10-17T12:00:01Z"), refundedAt: null, planId: null, plan: null,
  user: { fullName: "Fixture" }, planSnapshot: { type: "AIRTIME", networkCode: "MTN", name: "₦500 airtime", sizeMb: 0, validityDays: 0, providerId: "private-supplier", faceValueKobo: "50000" },
};
beforeEach(() => { vi.resetAllMocks(); m.find.mockResolvedValue(order); m.list.mockResolvedValue([order]); });
it("keeps airtime receipts private to the owner and strips supplier routing details", async () => {
  const receipt = await ownReceipt("owner", order.reference);
  expect(m.find.mock.calls[0][0].where).toEqual({ userId: "owner", reference: order.reference, type: { in: ["DATA", "AIRTIME"] } });
  expect(receipt).toMatchObject({ purchaseType: "AIRTIME", historicalSnapshot: true, amountKobo: "50000", plan: { type: "AIRTIME", networkCode: "MTN" } });
  expect(JSON.stringify(receipt)).not.toContain("private-supplier");
  m.find.mockResolvedValue(null); await expect(ownReceipt("another-user", order.reference)).rejects.toMatchObject({ status: 404 });
});
it("filters airtime history without exposing supplier snapshots", async () => {
  const history = await purchaseHistory("owner", { purchaseType: "AIRTIME", network: "MTN", search: "" });
  expect(m.list.mock.calls[0][0].where).toMatchObject({ userId: "owner", type: "AIRTIME" });
  expect(history.transactions[0]).toMatchObject({ purchaseType: "AIRTIME", reference: order.reference });
  expect(JSON.stringify(history)).not.toContain("private-supplier");
});
it("does not allow another account's history cursor", async () => {
  m.find.mockResolvedValue(null);
  await expect(purchaseHistory("owner", { search: "", cursor: "someone-elses-order" })).rejects.toMatchObject({ status: 400 });
  expect(m.list).not.toHaveBeenCalled();
});
it("exports an airtime receipt without misleading data allowance or validity", async () => {
  const pdf = Buffer.from(receiptPdf(await ownReceipt("owner", order.reference))).toString("ascii");
  expect(pdf).toContain("Airtime purchase receipt"); expect(pdf).toContain("Airtime top-up"); expect(pdf).toContain("NGN 500.00");
  expect(pdf).not.toContain("0 MB"); expect(pdf).not.toContain("0 days"); expect(pdf).not.toContain("private-supplier");
});
