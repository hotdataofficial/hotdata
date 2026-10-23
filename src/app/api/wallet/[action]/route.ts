import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireActor } from "@/server/auth/sessions";
import { fundingSchema, virtualAccountSchema, manualFundingSchema, transferSchema } from "@/lib/validation/wallet";
import { initializeFunding, provisionVirtualAccount, verifyOwnFunding } from "@/server/services/funding";
import { requestManualFunding } from "@/server/services/manual-funding";
import { transferWallet } from "@/server/services/transfers";
import { fundingSettings } from "@/server/services/funding-settings";
import { uploadProof, readProof } from "@/server/storage/proofs";
import { body, checkCsrf, clientIp, endpoint, HttpError, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { proofStorageAvailable } from "@/lib/proof-storage";
import { requestBytes } from "@/server/security/request-bytes";
import { scheduleVercelWork } from "@/server/jobs/netlify-trigger";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ action: string }> };
const serialize = (value: unknown) => JSON.parse(JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v));
export async function GET(req: NextRequest, context: Context) {
  const { action } = await context.params;
  return endpoint(async req => {
    const actor = await requireActor(req);
    await rateLimit("wallet-read", actor.id, 120, 60);
    if (action === "summary") {
      await scheduleVercelWork();
      const wallet = await db.wallet.findUnique({ where: { userId: actor.id }, select: { balanceKobo: true, currency: true, entries: { take: 20, orderBy: { createdAt: "desc" }, select: { reference: true, type: true, amountKobo: true, balanceAfterKobo: true, description: true, createdAt: true } } } });
      const accounts = await db.virtualAccount.findMany({ where: { userId: actor.id, active: true }, select: { accountNumber: true, accountName: true, bankName: true } });
      const funding = await db.fundingTransaction.findMany({ where: { userId: actor.id }, take: 10, orderBy: { createdAt: "desc" }, select: { reference: true, amountKobo: true, feeKobo: true, status: true, gateway: true, reviewRequired: true, createdAt: true } });
      const settings = await fundingSettings();
      return json(serialize({ gateway: process.env.PAYMENT_GATEWAY || "paystack", wallet, accounts, funding, limits: { minimumKobo: settings.minimum, maximumKobo: settings.maximum, flatFeeKobo: settings.flat, feeBps: settings.bps, transfersEnabled: settings.transfersEnabled }, manualBank: proofStorageAvailable() && process.env.MANUAL_FUNDING_ACCOUNT_NUMBER ? { bankName: process.env.MANUAL_FUNDING_BANK_NAME, accountName: process.env.MANUAL_FUNDING_ACCOUNT_NAME, accountNumber: process.env.MANUAL_FUNDING_ACCOUNT_NUMBER } : null }));
    }
    if (action === "proof") {
      const id = z.string().min(1).max(64).parse(req.nextUrl.searchParams.get("fundingId"));
      const funding = await db.fundingTransaction.findUnique({ where: { id } });
      if (!funding?.proofObjectKey || (funding.userId !== actor.id && !["ADMIN", "SUPER_ADMIN"].includes(actor.role))) throw new HttpError(404, "Proof not found.");
      const bytes = await readProof(funding.proofObjectKey);
      return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=payment-proof." + funding.proofObjectKey.split(".").pop(), "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
    }
    throw new HttpError(404, "Endpoint not found.");
  })(req);
}
export async function POST(req: NextRequest, context: Context) {
  const { action } = await context.params;
  return endpoint(async req => {
    if (!["checkout", "virtual-account", "upload-proof", "manual-funding", "verify-funding", "transfer"].includes(action)) throw new HttpError(404, "Endpoint not found.");
    checkCsrf(req); await rateLimit("wallet-ip", clientIp(req), 60, 60); const actor = await requireActor(req);
    await rateLimit("wallet:" + action, actor.id, 10, 900);
    if (action === "checkout") { const input = await body(req, fundingSchema); return json(await initializeFunding(actor.id, BigInt(input.amountKobo), input.idempotencyKey)); }
    if (action === "virtual-account") {
      await body(req, virtualAccountSchema);
      const account = await provisionVirtualAccount(actor.id);
      return json({ accountNumber: account.accountNumber, accountName: account.accountName, bankName: account.bankName });
    }
    if (action === "upload-proof") {
      await rateLimit("proof-daily", actor.id, 6, 86400);
      if (!req.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new HttpError(415, "Upload a multipart form.");
      const bytes = await requestBytes(req, 5 * 1024 * 1024 + 65536);
      const copy = new Request(req.url, { method: "POST", headers: { "Content-Type": req.headers.get("content-type")! }, body: new Blob([new Uint8Array(bytes)]) });
      const file = (await copy.formData()).get("proof");
      if (!(file instanceof File)) throw new HttpError(400, "Select a payment proof file.");
      return json(await uploadProof(actor.id, file));
    }
    if (action === "manual-funding") { const input = await body(req, manualFundingSchema); return json(await requestManualFunding(actor.id, BigInt(input.amountKobo), input.idempotencyKey, input.proofToken)); }
    if (action === "verify-funding") { const input = await body(req, z.object({ reference: z.string().min(1).max(200) })); return json(await verifyOwnFunding(actor.id, input.reference)); }
    const input = await body(req, transferSchema);
    return json(await transferWallet(actor.id, input.recipientPhone, BigInt(input.amountKobo), input.pin, input.idempotencyKey));
  })(req);
}
