import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HttpError } from "../security/http";
import type { PaymentGateway, VerifiedPayment, VirtualAccountResult } from "./types";
export function verifyPaystackSignature(raw: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{128}$/i.test(signature) || !secret) return false;
  const expected = createHmac("sha512", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
const verifiedSchema = z.object({ reference: z.string(), status: z.string(), amount: z.number().int().positive().refine(Number.isSafeInteger), currency: z.string(), domain: z.enum(["test", "live"]), channel: z.string(), customer: z.object({ email: z.email(), customer_code: z.string() }), authorization: z.object({ channel: z.string().optional(), receiver_bank_account_number: z.string().optional() }).nullish() });
const accountSchema = z.object({ id: z.number().int().positive(), active: z.literal(true), currency: z.literal("NGN"), account_number: z.string().regex(/^\d{10}$/), account_name: z.string(), bank: z.object({ name: z.string(), slug: z.string() }), customer: z.object({ customer_code: z.string() }) });
export class PaystackGateway implements PaymentGateway {
  readonly name = "paystack";
  private key() { const key = process.env.PAYSTACK_SECRET_KEY || ""; if (!/^sk_(test|live)_/.test(key)) throw new HttpError(503, "Paystack is not configured."); return key; }
  private async api(endpoint: string, input?: unknown, allow404 = false): Promise<unknown> {
    let response: Response;
    try { response = await fetch("https://api.paystack.co" + endpoint, { method: input ? "POST" : "GET", headers: { Authorization: "Bearer " + this.key(), "Content-Type": "application/json" }, body: input ? JSON.stringify(input) : undefined, signal: AbortSignal.timeout(8000), cache: "no-store" }); }
    catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(503, "Payment service did not confirm a result. Try checking again shortly."); }
    if (response.status === 404 && allow404) return null;
    if (!response.ok) throw new HttpError(503, "Paystack could not complete this request. Check gateway eligibility or try again later.");
    const envelope = z.object({ status: z.literal(true), data: z.unknown() }).parse(await response.json());
    return envelope.data;
  }
  async initialize(input: { reference: string; email: string; amountKobo: bigint; callbackUrl: string }) {
    const data = z.object({ authorization_url: z.url(), reference: z.string() }).parse(await this.api("/transaction/initialize", { reference: input.reference, email: input.email, amount: input.amountKobo.toString(), currency: "NGN", callback_url: input.callbackUrl, channels: ["card", "bank_transfer"] }));
    const url = new URL(data.authorization_url);
    if (url.protocol !== "https:" || url.hostname !== "checkout.paystack.com" || data.reference !== input.reference) throw new HttpError(502, "Unexpected payment checkout response.");
    return { checkoutUrl: data.authorization_url };
  }
  async verify(reference: string): Promise<VerifiedPayment> {
    const data = verifiedSchema.parse(await this.api("/transaction/verify/" + encodeURIComponent(reference)));
    const domain = this.key().startsWith("sk_live_") ? "live" : "test";
    if (data.reference !== reference || data.domain !== domain) throw new HttpError(409, "Payment reference or environment mismatch.");
    return { reference: data.reference, status: data.status, amountKobo: BigInt(data.amount), currency: data.currency, email: data.customer.email.toLowerCase(), customerCode: data.customer.customer_code, channel: data.authorization?.channel || data.channel, receiverAccount: data.authorization?.receiver_bank_account_number, domain: data.domain };
  }
  async createVirtualAccount(input: { email: string; fullName: string; phone: string }): Promise<VirtualAccountResult> {
    const parts = input.fullName.trim().split(/\s+/);
    if (parts.length < 2) throw new HttpError(400, "A first and last name are required for your personal account.");
    const existing = await this.api("/customer/" + encodeURIComponent(input.email), undefined, true);
    const customer = z.object({ id: z.number().int(), customer_code: z.string(), email: z.email() }).parse(existing || await this.api("/customer", { email: input.email, first_name: parts[0], last_name: parts.slice(1).join(" "), phone: input.phone }));
    if (customer.email.toLowerCase() !== input.email.toLowerCase()) throw new HttpError(409, "Gateway customer ownership mismatch.");
    const accounts = z.array(accountSchema.passthrough()).parse(await this.api("/dedicated_account?customer=" + customer.id + "&active=true&perPage=100"));
    const data = accounts.find(account => account.customer.customer_code === customer.customer_code) || accountSchema.parse(await this.api("/dedicated_account", { customer: customer.customer_code, preferred_bank: process.env.PAYSTACK_DVA_BANK || undefined, first_name: parts[0], last_name: parts.slice(1).join(" "), phone: input.phone }));
    if (data.customer.customer_code !== customer.customer_code) throw new HttpError(409, "Gateway account ownership mismatch.");
    return { gatewayAccountId: String(data.id), customerCode: customer.customer_code, accountNumber: data.account_number, accountName: data.account_name, bankName: data.bank.name, providerSlug: data.bank.slug };
  }
  verifyWebhook(rawBody: string, signature: string) { return verifyPaystackSignature(rawBody, signature, this.key()); }
}
