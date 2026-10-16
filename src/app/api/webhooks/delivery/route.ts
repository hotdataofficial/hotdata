import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { decryptCredentials } from "@/server/providers/credentials";
import { parseGsubzEvent, validGsubzSignature } from "@/server/providers/gsubz-webhook";
import { requestBytes } from "@/server/security/request-bytes";
import { endpoint, HttpError, json } from "@/server/security/http";
import { wakeNetlifyWorker } from "@/server/jobs/netlify-trigger";
export const runtime = "nodejs";

export const POST = endpoint(async (req: NextRequest) => {
  const provider = await db.provider.findUnique({ where: { code: "GSUBZ" } });
  if (!provider?.credentialsEncrypted || provider.deletedAt) throw new HttpError(401, "Invalid callback.");
  const secret = decryptCredentials(provider.credentialsEncrypted).gsubzWebhookSecret || process.env.GSUBZ_WEBHOOK_SECRET || "";
  const bytes = await requestBytes(req, 65536);
  if (!validGsubzSignature(bytes, req.headers, secret)) throw new HttpError(401, "Invalid callback.");
  let event: ReturnType<typeof parseGsubzEvent>;
  try { event = parseGsubzEvent(bytes, req.headers); } catch { throw new HttpError(400, "Invalid callback."); }
  const queued = await db.$transaction(async tx => {
    const receipt = await tx.outboxEvent.createMany({ data: [{
      kind: "PROVIDER_WEBHOOK_RECEIPT", dedupeKey: `delivery:${provider.id}:${event.eventId}`,
      payload: { providerId: provider.id, event: event.event, eventId: event.eventId }, deliveredAt: new Date(),
    }], skipDuplicates: true });
    if (!receipt.count || event.event === "webhook.test" || !event.references.length) return false;
    const attempts = await tx.providerAttempt.findMany({ where: {
      providerId: provider.id, reference: { in: event.references }, status: "PENDING",
      transaction: { type: "DATA", status: "PENDING", refundedAt: null },
    }, select: { id: true, transactionId: true } });
    for (const attempt of attempts) await tx.outboxEvent.create({ data: {
      kind: "VTU_PURCHASE", dedupeKey: `delivery-check:${event.eventId}:${attempt.id}`,
      payload: { transactionId: attempt.transactionId },
    } });
    return attempts.length > 0;
  });
  // Durable outbox survives a failed wake-up; scheduled recovery handles it.
  // Never credit, refund, resend a purchase, or trust delivery status from a callback.
  if (queued) await wakeNetlifyWorker();
  return json({ received: true });
});
