import { publicAdminSettings } from "@/server/services/admin-settings";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireActor } from "@/server/auth/sessions";
import { lockUser } from "@/server/auth/accounts";
import { body, checkCsrf, endpoint, HttpError, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { purchaseHistory } from "@/server/services/customer-records";
import { historyQuerySchema } from "@/lib/validation/customer";
import { scheduleVercelWork } from "@/server/jobs/netlify-trigger";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ action: string }> };
export async function GET(req: NextRequest, context: Context) {
  const { action } = await context.params;
  return endpoint(async req => {
    const actor = await requireActor(req); await rateLimit("customer-read", actor.id, 120, 60);
    if (action === "history" || action === "dashboard") await scheduleVercelWork();
    if (action === "history") return json(await purchaseHistory(actor.id, historyQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))));
    if (action === "dashboard") {
      const [user, wallet, accounts, recent, unread, beneficiaries] = await Promise.all([
        db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { fullName: true, email: true, phone: true, role: true, referralCode: true, emailVerifiedAt: true } }),
        db.wallet.findUniqueOrThrow({ where: { userId: actor.id }, select: { balanceKobo: true } }),
        db.virtualAccount.findMany({ where: { userId: actor.id, active: true }, select: { accountNumber: true, accountName: true, bankName: true } }),
        purchaseHistory(actor.id, { search: "" }),
        db.notification.count({ where: { userId: actor.id, readAt: null } }),
        db.beneficiary.count({ where: { userId: actor.id } }),
      ]);
      return json({ user: { ...user, emailVerified: !!user.emailVerifiedAt, emailVerifiedAt: undefined, hasPin: !!actor.pinHash }, balanceKobo: wallet.balanceKobo.toString(), accounts, recent: recent.transactions.slice(0, 5), unreadNotifications: unread, beneficiaryCount: beneficiaries });
    }
    if (action === "support") {const settings=await publicAdminSettings();return json({email:settings.supportEmail||null,whatsapp:settings.supportWhatsApp||null});}
    throw new HttpError(404, "Endpoint not found.");
  })(req);
}
export async function POST(req: NextRequest, context: Context) {
  const { action } = await context.params;
  return endpoint(async req => {
    checkCsrf(req); const actor = await requireActor(req); await rateLimit("customer-write", actor.id, 10, 60);
    if (action !== "profile") throw new HttpError(404, "Endpoint not found.");
    const input = await body(req, z.object({ fullName: z.string().trim().min(2).max(100) }).strict());
    await db.$transaction(async tx => { await lockUser(tx, actor.id); await tx.user.update({ where: { id: actor.id }, data: input }); });
    return json({ ok: true });
  })(req);
}
