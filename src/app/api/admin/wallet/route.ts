import { requireRole, adminRoles } from "@/server/auth/rbac";
import { adjustmentSchema } from "@/lib/validation/wallet";
import { adjustWallet } from "@/server/services/wallet-adjustment";
import { endpoint, checkCsrf, body, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
export const runtime = "nodejs";
export const POST = endpoint(async req => {
  checkCsrf(req); const actor = await requireRole(req, adminRoles);
  await rateLimit("admin-wallet", actor.id, 20, 60);
  const input = await body(req, adjustmentSchema);
  return json(await adjustWallet(actor.id, input.userId, BigInt(input.amountKobo), input.direction, input.reason, input.idempotencyKey));
});
