import { describe, it, expect, vi } from "vitest";
import { sessionReturn } from "../../src/lib/session-return";
import { apiInput } from "../../src/lib/api-input";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), verify: vi.fn(), updateMany: vi.fn() }));
vi.mock("../../src/server/db", () => ({ db: { fundingTransaction: { findMany: mocks.findMany, updateMany: mocks.updateMany } } }));
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
    mocks.findMany.mockResolvedValue([{ id: "one", userId: "u1", reference: "r1" }, { id: "two", userId: "u2", reference: "r2" }]);
    mocks.verify.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce({ status: "SUCCESSFUL", credited: true });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {}), info = vi.spyOn(console, "info").mockImplementation(() => {});
    await reconcilePendingFunding();
    expect(mocks.verify.mock.calls).toEqual([["u1", "r1"], ["u2", "r2"]]);
    expect(recoverableFundingWhere()).toMatchObject({ status: "PENDING", reviewRequired: false, checkoutUrl: { not: null } });
    expect(mocks.findMany.mock.calls[0][0].take).toBe(5);
    expect(mocks.findMany.mock.calls[0][0].orderBy).toEqual([{ updatedAt: "asc" }, { id: "asc" }]);
    expect(mocks.updateMany.mock.calls.map(([v]) => v.where)).toEqual([{id:"one",status:"PENDING"},{id:"two",status:"PENDING"}]);
    expect(info).toHaveBeenCalledWith("HOTDATA_FUNDING_RECOVERY", JSON.stringify({ checked: 2, confirmed: 1 }));
    warn.mockRestore(); info.mockRestore();
  });
  it("rotates unpaid links behind older unchecked payments instead of starving them", async () => {
    mocks.findMany.mockClear(); mocks.verify.mockReset(); mocks.updateMany.mockReset();
    const rows = Array.from({length:7},(_,i)=>({id:String(i),userId:"u",reference:"r"+i,checked:i}));
    mocks.findMany.mockImplementation(async()=>rows.toSorted((a,b)=>a.checked-b.checked).slice(0,5));
    mocks.verify.mockResolvedValue({status:"PENDING",credited:false});
    let tick=10;
    mocks.updateMany.mockImplementation(async input=>{rows.find(r=>r.id===input.where.id)!.checked=tick++; return {count:1};});
    const info=vi.spyOn(console,"info").mockImplementation(()=>{});
    await reconcilePendingFunding(); await reconcilePendingFunding();
    expect(new Set(mocks.verify.mock.calls.map(([,ref])=>ref)).size).toBe(7);
    expect(mocks.verify.mock.calls.slice(5,7).map(([,ref])=>ref)).toEqual(["r5","r6"]);
    info.mockRestore();
  });
});
