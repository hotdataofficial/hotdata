import type { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireActor } from "./sessions";
import { HttpError } from "../security/http";
export function hasRole(role: Role, allowed: readonly Role[]) { return allowed.includes(role); }
export async function requireRole(req: NextRequest, allowed: readonly Role[]) {
  const actor = await requireActor(req);
  if (!hasRole(actor.role, allowed)) throw new HttpError(403, "You do not have access to this action.");
  return actor;
}
export const adminRoles: readonly Role[] = ["ADMIN", "SUPER_ADMIN"];
export const agentRoles: readonly Role[] = ["AGENT"];
