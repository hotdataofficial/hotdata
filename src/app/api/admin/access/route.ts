import { requireRole, adminRoles } from "@/server/auth/rbac";
import { endpoint, json } from "@/server/security/http";
export const runtime = "nodejs";
export const GET = endpoint(async req => {
  const actor = await requireRole(req, adminRoles);
  return json({ role: actor.role, message: "Admin access confirmed." });
});
