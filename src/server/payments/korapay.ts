import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { parseNaira } from "@/lib/money";
import { HttpError } from "../security/http";
import type { PaymentGateway, VerifiedPayment, VirtualAccountResult } from "./types";

export function verifyKorapaySignature(raw: string, signature: string, secret: string) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) return false;
    const expected = createHmac("sha256", secret).update(JSON.stringify(body.data)).digest();
    return timingSafeEqual(expected, Buffer.from(signature, "hex"));
  } catch { return false; }
}

export function korapayAmountKobo(value: string | number) {
  if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) throw new HttpError(502, "Invalid payment amount.");
  try { return parseNaira(String(value)); }
  catch { throw new HttpError(502, "Invalid payment amount."); }
}

const chargeSchema = z.object({
  reference: z.string().min(1), status: z.string(),
  amount: z.union([z.string(), z.number()]), amount_paid: z.union([z.string(), z.number()]),
  amount_accepted: z.union([z.string(), z.number()]).optional(),
  fee: z.union([z.string(), z.number()]).optional(),
  currency: z.string(), customer: z.object({ email: z.email() }),
  payment_method: z.string().optional(), transaction_status: z.string().optional(),
});

export class KorapayGateway implements PaymentGateway {
  readonly name = "korapay";
  private key() {
    const key = (process.env.KORAPAY_SECRET_KEY || "").trim();
    if (!/^sk_(test|live)_[A-Za-z0-9_-]+$/.test(key)) throw new HttpError(503, "Korapay is not configured.");
    if (key.startsWith("sk_live_") && process.env.KORAPAY_ALLOW_LIVE !== "true") throw new HttpError(503, "Live Korapay payments are not enabled.");
    return key;
  }
  private async api(endpoint: string, input?: unknown): Promise<unknown> {
    const key = this.key(); let response: Response;
    try {
      response = await fetch("https://api.korapay.com/merchant/api/v1" + endpoint, {
        method: input ? "POST" : "GET", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: input ? JSON.stringify(input) : undefined, signal: AbortSignal.timeout(8000), cache: "no-store",
      });
    } catch { throw new HttpError(503, "Payment service did not confirm a result. Check again shortly."); }
    if (!response.ok) throw new HttpError(503, "Korapay could not complete this request. Check your payment configuration or try later.");
    try { return z.object({ status: z.literal(true), data: z.unknown() }).parse(await response.json()).data; }
    catch { throw new HttpError(502, "Unexpected payment service response."); }
  }
  async initialize(input: { reference: string; email: string; amountKobo: bigint; callbackUrl: string }) {
    if (input.amountKobo <= 0n || input.amountKobo > BigInt(Number.MAX_SAFE_INTEGER)) throw new HttpError(400, "Invalid funding amount.");
    const callback = new URL(input.callbackUrl);
    if (callback.protocol !== "https:" && process.env.NODE_ENV === "production") throw new HttpError(503, "Secure payment callback is required.");
    const data = z.object({ reference: z.string(), checkout_url: z.url() }).parse(await this.api("/charges/initialize", {
      reference: input.reference, amount: Number(input.amountKobo) / 100, currency: "NGN",
      customer: { email: input.email }, redirect_url: input.callbackUrl,
      notification_url: new URL("/api/webhooks/korapay", callback.origin).toString(), merchant_bears_cost: false,
    }));
    const url = new URL(data.checkout_url);
    if (data.reference !== input.reference || url.protocol !== "https:" || url.hostname !== "checkout.korapay.com" || url.username || url.password || (url.port && url.port !== "443")) throw new HttpError(502, "Unexpected Korapay checkout response.");
    return { checkoutUrl: data.checkout_url };
  }
  async verify(reference: string): Promise<VerifiedPayment> {
    const data = chargeSchema.parse(await this.api("/charges/" + encodeURIComponent(reference)));
    if (data.reference !== reference) throw new HttpError(409, "Payment reference mismatch.");
    const requested = korapayAmountKobo(data.amount), paid = korapayAmountKobo(data.amount_paid);
    const accepted = data.amount_accepted === undefined ? paid : korapayAmountKobo(data.amount_accepted);
    const fee = data.fee === undefined ? 0n : korapayAmountKobo(data.fee);
    // Checkout may collect the principal plus its processing fee from the payer.
    // Only the gateway-confirmed principal becomes wallet value; never its fee.
    const principalConfirmed = accepted === requested &&
      (paid === requested || (data.amount_accepted !== undefined && fee > 0n && paid === requested + fee));
    if (data.status === "success" && (!principalConfirmed || (data.transaction_status && data.transaction_status !== "success"))) throw new HttpError(409, "Payment amount requires review.");
    return { reference: data.reference, status: data.status, amountKobo: data.status === "success" ? requested : accepted, currency: data.currency,
      email: data.customer.email.toLowerCase(), customerCode: "", channel: data.payment_method || "checkout",
      domain: this.key().startsWith("sk_live_") ? "live" : "test" };
  }
  async createVirtualAccount(): Promise<VirtualAccountResult> {
    throw new HttpError(503, "Dedicated Korapay accounts are not configured. Use wallet checkout instead.");
  }
  verifyWebhook(rawBody: string, signature: string) { return verifyKorapaySignature(rawBody, signature, this.key()); }
}
