import { db } from "../db";
import { lockAdmin } from "../auth/admin-transaction";
import { adminMayChange } from "@/lib/admin";
import { userActionSchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { HttpError } from "../security/http";
export async function changeUser(actorId: string, input: z.infer<typeof userActionSchema>) { return db.$transaction(async tx => {
  const actor = await lockAdmin(tx, actorId);
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`;
  const target = await tx.user.findUnique({ where: { id: input.userId } }); if (!target || target.deletedAt) throw new HttpError(404, "User not found.");
  const role = input.role || target.role, status = input.status || target.status;
  if (!adminMayChange(actor.role, actor.id, target, role, status)) throw new HttpError(403, "Only super admins can manage staff, and self-demotion/suspension is blocked.");
  if (target.role === "SUPER_ADMIN" && target.status === "ACTIVE" && (role !== "SUPER_ADMIN" || status !== "ACTIVE")) { const count = await tx.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null } }); if (count <= 1) throw new HttpError(409, "Keep at least one active super admin."); }
  await tx.user.update({ where: { id: target.id }, data: { role, status, authVersion: { increment: 1 } } });
  if(target.role==="AGENT"&&(role!=="AGENT"||status!=="ACTIVE"))await tx.apiKey.updateMany({where:{userId:target.id,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await tx.auditLog.create({ data: { actorId, action: "USER_ACCESS_UPDATE", entityType: "User", entityId: target.id, metadata: { reason: input.reason, before: { role: target.role, status: target.status }, after: { role, status } } } });
  return { ok: true };
}); }
