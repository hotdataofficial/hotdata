import { NextRequest } from "next/server";
import { requireActor } from "@/server/auth/sessions";
import { body, checkCsrf, clientIp, endpoint, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { airtimePurchaseSchema } from "@/lib/airtime";
import { airtimeCatalog, createAirtimePurchase } from "@/server/services/airtime";
export const runtime = "nodejs";
export const GET = endpoint(async (req: NextRequest) => {
  const actor = await requireActor(req);
  await rateLimit("airtime-read", actor.id, 120, 60);
  return json(await airtimeCatalog());
});
export const POST = endpoint(async (req: NextRequest) => {
  checkCsrf(req); await rateLimit("purchase-ip", clientIp(req), 60, 60);
  const actor = await requireActor(req); await rateLimit("purchase-user", actor.id, 20, 60);
  return json(await createAirtimePurchase(actor.id, await body(req, airtimePurchaseSchema)), 202);
});
