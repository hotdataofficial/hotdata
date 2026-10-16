import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseGsubzEvent, validGsubzSignature } from "../../src/server/providers/gsubz-webhook";
const secret = "whsec_test_only_never_a_production_secret";
const now = 1792152000000;
const bytes = Buffer.from(JSON.stringify({ event: "webhook.test", eventId: "evt_test", createdAt: "2026-10-16T12:00:00+01:00", data: {} }));
function headers(body = bytes, timestamp = String(now / 1000)) {
  return new Headers({ "x-gsubz-event": "webhook.test", "x-gsubz-delivery": "evt_test", "x-gsubz-timestamp": timestamp,
    "x-gsubz-signature": "sha256=" + createHmac("sha256", secret).update(timestamp + ".").update(body).digest("hex") });
}
describe("signed delivery callbacks", () => {
  it("accepts the documented signature and envelope", () => {
    expect(validGsubzSignature(bytes, headers(), secret, now)).toBe(true);
    expect(parseGsubzEvent(bytes, headers())).toEqual({ event: "webhook.test", eventId: "evt_test", references: [] });
  });
  it("rejects body tampering and incorrect secrets", () => {
    expect(validGsubzSignature(Buffer.concat([bytes, Buffer.from(" ")]), headers(), secret, now)).toBe(false);
    expect(validGsubzSignature(bytes, headers(), "wrong", now)).toBe(false);
  });
  it("rejects old and future attempts even when correctly signed", () => {
    for (const delta of [-301, 301]) expect(validGsubzSignature(bytes, headers(bytes, String(now / 1000 + delta)), secret, now)).toBe(false);
  });
  it("rejects missing and malformed signature headers", () => {
    expect(validGsubzSignature(bytes, new Headers(), secret, now)).toBe(false);
    const h = headers(); h.set("x-gsubz-signature", "sha256=nope");
    expect(validGsubzSignature(bytes, h, secret, now)).toBe(false);
  });
  it("rejects mismatched event identity", () => {
    const h = headers(); h.set("x-gsubz-delivery", "evt_other");
    expect(() => parseGsubzEvent(bytes, h)).toThrow();
  });
  it("extracts only Hotdata attempt references, ignoring claimed status", () => {
    const b = Buffer.from(JSON.stringify({ event: "store.order.updated", eventId: "evt_test", createdAt: "2026-10-16T12:00:00Z", data: { status: "SUCCESSFUL", order: { reference: "HD-P-example" } } }));
    const h = headers(b); h.set("x-gsubz-event", "store.order.updated");
    expect(parseGsubzEvent(b, h).references).toEqual(["HD-P-example"]);
    expect(parseGsubzEvent(bytes, headers()).references).toEqual([]);
  });
});
