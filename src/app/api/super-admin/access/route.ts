import { requireRole } from "@/server/auth/rbac";
import { endpoint, json } from "@/server/security/http";
export const runtime = "nodejs";
export const GET = endpoint(async req => {
  const actor = await requireRole(req, ["SUPER_ADMIN"]);
  return json({ role: actor.role, message: "Super admin access confirmed." });
});
