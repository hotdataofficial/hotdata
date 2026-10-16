import { db } from "@/server/db";
import { isAdapterReady } from "@/server/providers/registry";
import { publicPlan, type PublicCatalog } from "@/lib/public-catalog";
export async function readPublicCatalog(): Promise<PublicCatalog> {
  const [networks, rows] = await Promise.all([
    db.network.findMany({ where: { active: true, deletedAt: null }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    db.plan.findMany({ where: { active: true, deletedAt: null, network: { active: true, deletedAt: null } }, select: { id: true, networkId: true, name: true, type: true, sizeMb: true, validityDays: true, customerPriceKobo: true, mappings: { where: { active: true, provider: { active: true, deletedAt: null } }, select: { provider: { select: { adapter: true } } } } }, orderBy: [{ sizeMb: "asc" }, { validityDays: "asc" }, { code: "asc" }], take: 1000 }),
  ]);
  return { networks, plans: rows.map(row => publicPlan(row, isAdapterReady)), updatedAt: new Date().toISOString() };
}
