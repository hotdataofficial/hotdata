import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireActor } from "@/server/auth/sessions";
import { endpoint, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { isAdapterReady } from "@/server/providers/registry";
export const runtime = "nodejs";
export const GET = endpoint(async (req: NextRequest) => {
  const actor = await requireActor(req); await rateLimit("catalog", actor.id, 120, 60);
  const networks = await db.network.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } });
  const rows = await db.plan.findMany({ where: { active: true, deletedAt: null, network: { active: true, deletedAt: null } }, include: { mappings: { where: { active: true, provider: { active: true, deletedAt: null } }, include: { provider: true } } }, orderBy: [{ sizeMb: "asc" }, { code: "asc" }] });
  return json({ networks, plans: rows.map(p => ({ id: p.id, networkId: p.networkId, name: p.name, type: p.type, sizeMb: p.sizeMb, validityDays: p.validityDays, priceKobo: (actor.role === "AGENT" ? p.agentPriceKobo : p.customerPriceKobo).toString(), available: p.mappings.some(m => isAdapterReady(m.provider.adapter)) })) });
});
