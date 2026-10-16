import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/server/auth/sessions";
import { endpoint, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { ownReceipt } from "@/server/services/customer-records";
import { receiptPdf } from "@/server/receipts/pdf";
export const runtime = "nodejs";
export async function GET(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  return endpoint(async req => {
    const actor = await requireActor(req); await rateLimit("receipts", actor.id, 60, 60);
    const receipt = await ownReceipt(actor.id, reference);
    if (req.nextUrl.searchParams.get("format") === "pdf") return new NextResponse(new Uint8Array(receiptPdf(receipt)).buffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="hotdata-' + receipt.reference.replace(/[^a-zA-Z0-9_-]/g, "") + '.pdf"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    return json({ receipt });
  })(req);
}
