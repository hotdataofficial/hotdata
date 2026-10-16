import { db } from "@/server/db";
import { requireRole, adminRoles } from "@/server/auth/rbac";
import { fundingReviewSchema } from "@/lib/validation/wallet";
import { reviewFunding } from "@/server/services/manual-funding";
import { endpoint, checkCsrf, body, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
export const runtime = "nodejs";
export const GET = endpoint(async req => {
  const actor = await requireRole(req, adminRoles); await rateLimit("admin-funding-read", actor.id, 60, 60);
  const requests = await db.fundingTransaction.findMany({ where: { status: "PENDING", OR: [{ gateway: "manual" }, { reviewRequired: true }] }, take: 50, orderBy: { createdAt: "asc" }, select: { id: true, reference: true, userId: true, amountKobo: true, feeKobo: true, gateway: true, createdAt: true } });
  await db.auditLog.create({data:{actorId:actor.id,action:"ADMIN_VIEW_FUNDING",entityType:"AdminView"}});
  return json({ requests: requests.map(row => ({ ...row, amountKobo: row.amountKobo.toString(), feeKobo: row.feeKobo.toString(), proofUrl: row.gateway === "manual" ? "/api/wallet/proof?fundingId=" + row.id : null })) });
});
export const POST = endpoint(async req => {
  checkCsrf(req); const actor = await requireRole(req, adminRoles);
  await rateLimit("admin-funding", actor.id, 30, 60);
  const input = await body(req, fundingReviewSchema);
  return json(await reviewFunding(actor.id, input.fundingId, input.decision, input.reason, input.bankReference));
});
