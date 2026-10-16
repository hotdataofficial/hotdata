import type { Prisma } from "@prisma/client";
import { HttpError } from "../security/http";
export async function lockAdmin(tx: Prisma.TransactionClient, actorId: string, superOnly = false) { await tx.$queryRaw`SELECT pg_advisory_xact_lock(24681012)`; const actor = await tx.user.findUnique({ where: { id: actorId } }); if (!actor || actor.deletedAt || actor.status !== "ACTIVE" || !(superOnly ? actor.role === "SUPER_ADMIN" : ["ADMIN", "SUPER_ADMIN"].includes(actor.role))) throw new HttpError(403, "Administrator permission changed. Sign in again."); return actor; }
