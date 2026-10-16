import { NextRequest } from "next/server";
import { z } from "zod";
import { lockAdmin } from "@/server/auth/admin-transaction";
import { db } from "@/server/db";
import { requireRole } from "@/server/auth/rbac";
import { body, checkCsrf, endpoint, HttpError, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { encryptCredentials } from "@/server/providers/credentials";
import { isAdapterReady, supportedAdapters } from "@/server/providers/registry";
export const runtime = "nodejs";
export const GET = endpoint(async (req: NextRequest) => {
  const actor = await requireRole(req, ["SUPER_ADMIN"]); await rateLimit("providers-read", actor.id, 60, 60);
  const providers = await db.provider.findMany({ where: { deletedAt: null }, select: { id: true, code: true, name: true, adapter: true, baseUrl: true, priority: true, active: true, lowBalanceThresholdKobo: true } });
  await db.auditLog.create({data:{actorId:actor.id,action:"ADMIN_VIEW_PROVIDERS",entityType:"AdminView"}});
  return json({ providers: providers.map(p => ({ ...p, ready: isAdapterReady(p.adapter), lowBalanceThresholdKobo: p.lowBalanceThresholdKobo.toString() })) });
});
export const POST = endpoint(async (req: NextRequest) => {
  checkCsrf(req); const actor = await requireRole(req, ["SUPER_ADMIN"]); await rateLimit("providers-write", actor.id, 10, 60);
  const input = await body(req, z.object({ id: z.string().min(1).max(64).optional(), code: z.string().regex(/^[A-Z0-9_-]{1,40}$/), name: z.string().trim().min(2).max(100), adapter: z.enum(supportedAdapters), baseUrl: z.url().max(300).refine(v => new URL(v).protocol === "https:", "HTTPS required"), priority: z.number().int().min(0).max(1000), active: z.boolean(), lowBalanceThresholdKobo: z.string().regex(/^[0-9]{1,15}$/), credentials: z.record(z.string().min(1).max(50), z.string().min(1).max(2000)).optional() }).strict());
  if (input.active && !isAdapterReady(input.adapter)) throw new HttpError(503, "Adapter is a disabled template. Configure and verify it before activation.");
  const { id, credentials, ...fields } = input;
  await db.$transaction(async tx => {
    await lockAdmin(tx, actor.id, true);
    if (id) { const prior = await tx.provider.findUniqueOrThrow({ where: { id } }); if ((credentials || fields.adapter !== prior.adapter || fields.baseUrl !== prior.baseUrl) && await tx.providerAttempt.count({ where: { providerId: id, status: "PENDING" } })) throw new HttpError(409, "Resolve pending attempts before replacing query credentials, adapter or URL."); }
    const data = { ...fields, lowBalanceThresholdKobo: BigInt(fields.lowBalanceThresholdKobo), ...(credentials ? { credentialsEncrypted: encryptCredentials(credentials) } : {}) };
    const provider = id ? await tx.provider.update({ where: { id }, data }) : await tx.provider.create({ data });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "PROVIDER_UPDATE", entityType: "Provider", entityId: provider.id, metadata: { code: provider.code, credentialsChanged: !!credentials } } });
  });
  return json({ ok: true });
});
