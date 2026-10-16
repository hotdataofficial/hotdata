import { z } from "zod";
import { KorapayGateway } from "@/server/payments/korapay";
import { settleVerifiedPayment } from "@/server/services/funding";
import { endpoint, HttpError, json } from "@/server/security/http";
import { requestBytes } from "@/server/security/request-bytes";
export const runtime = "nodejs";
export const POST = endpoint(async req => {
  const raw = (await requestBytes(req, 65536)).toString("utf8");
  const gateway = new KorapayGateway();
  if (!gateway.verifyWebhook(raw, req.headers.get("x-korapay-signature") || "")) throw new HttpError(401, "Invalid webhook signature.");
  const event = z.object({ event: z.string(), data: z.object({ reference: z.string().min(1).max(200) }) }).parse(JSON.parse(raw));
  if (event.event !== "charge.success") return json({ received: true });
  // Credit only a matching, server-verified payment; the ledger deduplicates retries.
  const result = await settleVerifiedPayment(await gateway.verify(event.data.reference), gateway.name);
  return json({ received: true, ...result });
});
