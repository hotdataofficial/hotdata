import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ provider: vi.fn(), transaction: vi.fn(), receipt: vi.fn(), attempts: vi.fn(), queue: vi.fn(), wake: vi.fn() }));
vi.mock("../../src/server/db", () => ({ db: { provider: { findUnique: m.provider }, $transaction: m.transaction } }));
vi.mock("../../src/server/providers/credentials", () => ({ decryptCredentials: () => ({ gsubzWebhookSecret: "test-signing-secret" }) }));
vi.mock("../../src/server/jobs/netlify-trigger", () => ({ wakeNetlifyWorker: m.wake }));
import { POST } from "../../src/app/api/webhooks/delivery/route";
beforeEach(() => {
  vi.resetAllMocks();
  m.provider.mockResolvedValue({ id: "supplier", credentialsEncrypted: "private", active: false });
  m.receipt.mockResolvedValue({ count: 1 }); m.attempts.mockResolvedValue([{ id: "attempt", transactionId: "order" }]);
  m.transaction.mockImplementation(async fn => fn({ outboxEvent: { createMany: m.receipt, create: m.queue }, providerAttempt: { findMany: m.attempts } }));
});
function request(event = "data.updated", reference = "HD-P-example", valid = true) {
  const body = JSON.stringify({ event, eventId: "evt_example", createdAt: new Date().toISOString(), data: { reference, status: "SUCCESSFUL" } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  return new NextRequest("https://example.com/api/webhooks/delivery", { method: "POST", body, headers: {
    "content-type": "application/json", "x-gsubz-event": event, "x-gsubz-delivery": "evt_example", "x-gsubz-timestamp": timestamp,
    "x-gsubz-signature": "sha256=" + createHmac("sha256", valid ? "test-signing-secret" : "forged").update(timestamp + "." + body).digest("hex"),
  } });
}
it("rejects forged events before any receipt or queue writes", async () => {
  expect((await POST(request("data.updated", "HD-P-example", false))).status).toBe(401);
  expect(m.transaction).not.toHaveBeenCalled();
});
it("acknowledges a signed test without touching purchases", async () => {
  expect((await POST(request("webhook.test"))).status).toBe(200);
  expect(m.receipt).toHaveBeenCalledOnce(); expect(m.attempts).not.toHaveBeenCalled(); expect(m.wake).not.toHaveBeenCalled();
});
it("ignores a duplicate without requeuing work", async () => {
  m.receipt.mockResolvedValue({ count: 0 });
  expect((await POST(request())).status).toBe(200);
  expect(m.queue).not.toHaveBeenCalled(); expect(m.wake).not.toHaveBeenCalled();
});
it("queues only a status check for existing unrefunded pending data or airtime attempts", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(m.attempts.mock.calls[0][0].where).toMatchObject({ providerId: "supplier", status: "PENDING", transaction: { type: { in: ["DATA", "AIRTIME"] }, status: "PENDING", refundedAt: null } });
  expect(m.queue).toHaveBeenCalledOnce(); expect(m.wake).toHaveBeenCalledOnce();
});
it("does not enqueue unknown or finalized references", async () => {
  m.attempts.mockResolvedValue([]);
  expect((await POST(request())).status).toBe(200);
  expect(m.queue).not.toHaveBeenCalled(); expect(m.wake).not.toHaveBeenCalled();
});
