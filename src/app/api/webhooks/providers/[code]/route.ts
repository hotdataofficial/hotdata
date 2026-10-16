import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { decryptCredentials } from "@/server/providers/credentials";
import { requestBytes } from "@/server/security/request-bytes";
import { endpoint, HttpError, json } from "@/server/security/http";
export const runtime = "nodejs";
// Hotdata callback contract: HMAC-SHA256(raw bytes), x-hotdata-signature.
// A provider-specific adapter must translate its documented callback contract.
export async function POST(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  return endpoint(async req => {
    const provider = await db.provider.findUnique({ where: { code } });
    if (!provider?.credentialsEncrypted || provider.deletedAt) throw new HttpError(401, "Invalid callback.");
    const secret = decryptCredentials(provider.credentialsEncrypted).callbackSecret;
    const signature = req.headers.get("x-hotdata-signature") || "";
    const bytes = await requestBytes(req, 16384);
    if (!secret || secret.length < 32 || !/^[a-f0-9]{64}$/i.test(signature)) throw new HttpError(401, "Invalid callback.");
    const expected = createHmac("sha256", secret).update(bytes).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new HttpError(401, "Invalid callback.");
    let payload: unknown; try { payload = JSON.parse(bytes.toString("utf8")); } catch { throw new HttpError(400, "Invalid callback."); }
    const input = z.object({ reference: z.string().min(1).max(100) }).parse(payload);
    const attempt = await db.providerAttempt.findFirst({ where: { providerId: provider.id, reference: input.reference } });
    if (attempt) {
      const key = "callback:" + attempt.id + ":" + Math.floor(Date.now() / 60000);
      await db.outboxEvent.upsert({ where: { dedupeKey: key }, create: { kind: "VTU_PURCHASE", payload: { transactionId: attempt.transactionId }, dedupeKey: key }, update: {} });
    }
    // Callback status is never trusted. A worker independently requeries.
    return json({ received: true });
  })(req);
}
