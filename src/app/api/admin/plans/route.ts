import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lockAdmin } from "@/server/auth/admin-transaction";
import { db } from "@/server/db";
import { requireRole, adminRoles } from "@/server/auth/rbac";
import { body, checkCsrf, endpoint, HttpError, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { planSchema, mappingSchema } from "@/lib/validation/purchases";
import { csvCell, markedUp, parseCsv } from "@/server/services/pricing";
const serialize = (v: unknown) => JSON.parse(JSON.stringify(v, (_, x) => typeof x === "bigint" ? x.toString() : x));
const headers = ["networkId", "code", "name", "type", "sizeMb", "validityDays", "costKobo", "customerPriceKobo", "agentPriceKobo", "active"];
export const runtime = "nodejs";
export const GET = endpoint(async (req: NextRequest) => {
  const actor = await requireRole(req, adminRoles); await rateLimit("plans-admin-read", actor.id, 60, 60);
  const plans = await db.plan.findMany({ where: { deletedAt: null }, orderBy: { code: "asc" }, take: 1000 });
  await db.auditLog.create({data:{actorId:actor.id,action:"ADMIN_VIEW_PLANS",entityType:"AdminView"}});
  if (req.nextUrl.searchParams.get("format") === "csv") return new NextResponse([headers.join(","), ...plans.map(p => headers.map(h => csvCell(p[h as keyof typeof p])).join(","))].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=hotdata-plans.csv", "Cache-Control": "no-store" } });
  return json(serialize({ plans }));
});
export const POST = endpoint(async (req: NextRequest) => {
  checkCsrf(req); const actor = await requireRole(req, adminRoles); await rateLimit("plans-admin-write", actor.id, 20, 60);
  const input = await body(req, z.discriminatedUnion("action", [
    z.object({ action: z.literal("save"), plan: planSchema }),
    z.object({ action: z.literal("mapping"), mapping: mappingSchema }),
    z.object({ action: z.literal("network"), id: z.string().min(1).max(64), active: z.boolean() }),
    z.object({ action: z.literal("markup"), ids: z.array(z.string().min(1).max(64)).min(1).max(100), mode: z.enum(["FIXED", "PERCENT"]), value: z.string().regex(/^[0-9]{1,12}$/), target: z.enum(["CUSTOMER", "AGENT", "BOTH"]) }),
    z.object({ action: z.literal("import"), csv: z.string().max(6000) }),
  ]));
  await db.$transaction(async tx => {
    await lockAdmin(tx, actor.id);
    if (input.action === "save") {
      const { id, ...data } = input.plan;
      const values = { ...data, costKobo: BigInt(data.costKobo), customerPriceKobo: BigInt(data.customerPriceKobo), agentPriceKobo: BigInt(data.agentPriceKobo) };
      if (id) await tx.plan.update({ where: { id }, data: values }); else await tx.plan.create({ data: values });
    } else if (input.action === "mapping") {
      const m = input.mapping;
      await tx.providerPlanMap.upsert({ where: { planId_providerId: { planId: m.planId, providerId: m.providerId } }, create: m, update: { providerPlanCode: m.providerPlanCode, active: m.active } });
    } else if (input.action === "network") {
      await tx.network.update({ where: { id: input.id }, data: { active: input.active } });
    } else if (input.action === "markup") {
      const plans = await tx.plan.findMany({ where: { id: { in: input.ids }, deletedAt: null } });
      if (plans.length !== new Set(input.ids).size) throw new HttpError(400, "One or more plans were not found.");
      for (const plan of plans) {
        const price = markedUp(plan.costKobo, input.mode, BigInt(input.value));
        if (price > 999999999999999n) throw new HttpError(400, "Price exceeds the supported limit.");
        await tx.plan.update({ where: { id: plan.id }, data: { ...(input.target !== "AGENT" ? { customerPriceKobo: price } : {}), ...(input.target !== "CUSTOMER" ? { agentPriceKobo: price } : {}) } });
      }
    } else {
      let rows: string[][]; try { rows = parseCsv(input.csv); } catch { throw new HttpError(400, "Invalid CSV."); }
      if (!rows.length || rows[0].join(",") !== headers.join(",") || rows.length > 51) throw new HttpError(400, "Use the exported header and at most 50 rows.");
      for (const row of rows.slice(1)) {
        if (row.length !== headers.length || !["true", "false"].includes(row[9])) throw new HttpError(400, "Invalid CSV row.");
        const p = planSchema.parse({ ...Object.fromEntries(headers.map((h, i) => [h, row[i]])), sizeMb: Number(row[4]), validityDays: Number(row[5]), active: row[9] === "true" });
        const data = { ...p, costKobo: BigInt(p.costKobo), customerPriceKobo: BigInt(p.customerPriceKobo), agentPriceKobo: BigInt(p.agentPriceKobo) };
        await tx.plan.upsert({ where: { code: p.code }, create: data, update: data });
      }
    }
    await tx.auditLog.create({ data: { actorId: actor.id, action: "PLAN_" + input.action.toUpperCase(), entityType: "Plan", metadata: { action: input.action } } });
  }, { timeout: 15000 });
  return json({ ok: true });
});
