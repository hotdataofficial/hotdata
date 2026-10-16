import { z } from "zod";
import { PaystackGateway } from "@/server/payments/paystack";
import { settleVerifiedPayment } from "@/server/services/funding";
import { endpoint, HttpError, json } from "@/server/security/http";
import { requestBytes } from "@/server/security/request-bytes";
export const runtime = "nodejs";
export const POST = endpoint(async req => {
  const raw = (await requestBytes(req, 65536)).toString("utf8");
  const gateway = new PaystackGateway();
  if (!gateway.verifyWebhook(raw, req.headers.get("x-paystack-signature") || "")) throw new HttpError(401, "Invalid webhook signature.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new HttpError(400, "Invalid webhook payload."); }
  const event = z.object({ event: z.string(), data: z.unknown() }).parse(parsed);
  if (event.event !== "charge.success") return json({ received: true });
  const data = z.object({ reference: z.string().min(1).max(200) }).parse(event.data);
  // Independently requery Paystack; never credit from browser amounts or webhook metadata.
  const result = await settleVerifiedPayment(await gateway.verify(data.reference), gateway.name);
  return json({ received: true, ...result });
});
