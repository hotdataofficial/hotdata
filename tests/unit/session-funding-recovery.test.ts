import { describe, it, expect, vi } from "vitest";
import { sessionReturn } from "../../src/lib/session-return";
import { apiInput } from "../../src/lib/api-input";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), verify: vi.fn() }));
vi.mock("../../src/server/db", () => ({ db: { fundingTransaction: { findMany: mocks.findMany } } }));
vi.mock("../../src/server/services/funding", () => ({ verifyOwnFunding: mocks.verify }));
import { reconcilePendingFunding, recoverableFundingWhere } from "../../src/server/jobs/funding-recovery";
describe("session and funding recovery", () => {
  it("preserves wallet callback queries but refuses external and looping destinations", () => {
    expect(sessionReturn("/wallet?reference=HD-F-test")).toBe("/wallet?reference=HD-F-test");
    for (const path of ["https://evil.test", "//evil.test", "/\\evil.test", "/\t/evil.test", "/session-refresh?next=/wallet", "/api/auth/refresh", null]) expect(sessionReturn(path)).toBe("/dashboard");
  });
  it("sends fetch-style mutations as mutations instead of silently issuing GET", () => {
    expect(apiInput({ method: "POST", body: '{"active":true}' }, "GET")).toEqual({ method: "POST", data: { active: true } });
    expect(apiInput({ reference: "ref" }, "POST")).toEqual({ method: "POST", data: { reference: "ref" } });
    expect(() => apiInput({ method: "TRACE", body: "{}" }, "GET")).toThrow();
  });
  it("checks only initialized recent pending payments and continues after a gateway failure", async () => {
    mocks.findMany.mockResolvedValue([{ userId: "u1", reference: "r1" }, { userId: "u2", reference: "r2" }]);
    mocks.verify.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce({ status: "SUCCESSFUL", credited: true });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {}), info = vi.spyOn(console, "info").mockImplementation(() => {});
    await reconcilePendingFunding();
    expect(mocks.verify.mock.calls).toEqual([["u1", "r1"], ["u2", "r2"]]);
    expect(recoverableFundingWhere()).toMatchObject({ status: "PENDING", reviewRequired: false, checkoutUrl: { not: null } });
    expect(mocks.findMany.mock.calls[0][0].take).toBe(5);
    expect(info).toHaveBeenCalledWith("HOTDATA_FUNDING_RECOVERY", JSON.stringify({ checked: 2, confirmed: 1 }));
    warn.mockRestore(); info.mockRestore();
  });
});
