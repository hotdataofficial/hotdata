import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// https://app.gsubz.com/api_doc/ — sign timestamp + '.' + the original bytes.
export function validGsubzSignature(bytes: Buffer, headers: Headers, secret: string, now = Date.now()) {
  const timestamp = headers.get("x-gsubz-timestamp") || "";
  const signature = headers.get("x-gsubz-signature") || "";
  if (!secret || !/^\d{10,11}$/.test(timestamp) || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(timestamp + ".").update(bytes).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

const envelope = z.object({
  event: z.string().min(1).max(100),
  eventId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  createdAt: z.string().datetime({ offset: true }),
  data: z.record(z.string(), z.unknown()),
});
export function parseGsubzEvent(bytes: Buffer, headers: Headers) {
  const input = envelope.parse(JSON.parse(bytes.toString("utf8")));
  if (headers.get("x-gsubz-delivery") !== input.eventId || headers.get("x-gsubz-event") !== input.event) throw new Error("Event header mismatch");
  const order = input.data.order;
  const nested = typeof order === "object" && order !== null ? order as Record<string, unknown> : {};
  // A signed reference is only a hint to requery an EXISTING pending attempt.
  // Documented store events do not establish data-delivery success.
  const references = [input.data.requestID, input.data.reference, nested.requestID, nested.reference]
    .filter((value): value is string => typeof value === "string" && /^HD-P-[A-Za-z0-9-]{1,80}$/.test(value));
  return { event: input.event, eventId: input.eventId, references: [...new Set(references)] };
}
