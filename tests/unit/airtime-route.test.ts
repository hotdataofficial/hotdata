import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ actor: vi.fn(), limit: vi.fn(), catalog: vi.fn(), purchase: vi.fn(), maintenance: vi.fn() }));
vi.mock("../../src/server/config", () => ({ config: () => ({ APP_URL: "https://hotdata.example", CORS_ALLOWED_ORIGINS: "", TRUST_PROXY: "false" }) }));
vi.mock("../../src/server/auth/sessions", () => ({ requireActor: m.actor }));
vi.mock("../../src/server/security/rate-limit", () => ({ rateLimit: m.limit }));
vi.mock("../../src/server/services/airtime", () => ({ airtimeCatalog: m.catalog, createAirtimePurchase: m.purchase }));
vi.mock("../../src/server/services/admin-settings", () => ({ maintenanceEnabled: m.maintenance }));
import { HttpError } from "../../src/server/security/http";
import { GET, POST } from "../../src/app/api/airtime/route";
const input = { networkCode: "MTN", phone: "08031234567", amountKobo: "10000", pin: "1234", idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
function request(validCsrf = true, payload: unknown = input) {
  return new NextRequest("https://hotdata.example/api/airtime", { method: "POST", headers: { origin: "https://hotdata.example", "content-type": "application/json", ...(validCsrf ? { cookie: "hotdata_csrf=fixture", "x-csrf-token": "fixture" } : {}) }, body: JSON.stringify(payload) });
}
beforeEach(() => { vi.resetAllMocks(); m.actor.mockResolvedValue({ id: "user" }); m.maintenance.mockResolvedValue(false); m.purchase.mockResolvedValue({ reference: "HD-A-fixture" }); });
it("requires authentication before exposing the airtime catalog", async () => {
  m.actor.mockRejectedValue(new HttpError(401, "Sign in required."));
  expect((await GET(new NextRequest("https://hotdata.example/api/airtime"))).status).toBe(401); expect(m.catalog).not.toHaveBeenCalled();
});
it("blocks missing CSRF protection and forged pricing fields", async () => {
  expect((await POST(request(false))).status).toBe(403);
  expect((await POST(request(true, { ...input, costKobo: "1" }))).status).toBe(400);
  expect(m.purchase).not.toHaveBeenCalled();
});
it("honors the global maintenance pause before creating an airtime order", async () => {
  m.maintenance.mockResolvedValue(true);
  expect((await POST(request())).status).toBe(503); expect(m.purchase).not.toHaveBeenCalled();
});
it("normalizes and authorizes a valid request without caching financial responses", async () => {
  const response = await POST(request()); expect(response.status).toBe(202); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(m.purchase).toHaveBeenCalledExactlyOnceWith("user", { ...input, phone: "+2348031234567" });
  expect(m.limit).toHaveBeenCalledWith("purchase-user", "user", 20, 60);
});
