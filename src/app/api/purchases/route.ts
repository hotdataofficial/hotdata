import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireActor } from "@/server/auth/sessions";
import { body, checkCsrf, clientIp, endpoint, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { purchaseSchema } from "@/lib/validation/purchases";
import { createPurchase, purchaseView } from "@/server/services/purchases";
export const runtime = "nodejs";
export const POST = endpoint(async (req: NextRequest) => {
  checkCsrf(req); await rateLimit("purchase-ip", clientIp(req), 60, 60);
  const actor = await requireActor(req); await rateLimit("purchase-user", actor.id, 20, 60);
  return json(await createPurchase(actor.id, await body(req, purchaseSchema)), 202);
});
export const GET = endpoint(async (req: NextRequest) => {
  const actor = await requireActor(req); await rateLimit("purchase-read", actor.id, 120, 60);
  const reference = req.nextUrl.searchParams.get("reference");
  const rows = await db.transaction.findMany({ where: { userId: actor.id, type: { in: ["DATA", "AIRTIME"] }, ...(reference ? { reference: reference.slice(0, 100) } : {}) }, orderBy: { createdAt: "desc" }, take: 50 });
  return json({ purchases: rows.map(purchaseView) });
});
