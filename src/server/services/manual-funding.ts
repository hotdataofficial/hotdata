import { randomUUID, createHash } from "node:crypto";
import { lockAdmin } from "../auth/admin-transaction";
import { db } from "../db";
import { lockUser } from "../auth/accounts";
import { HttpError } from "../security/http";
import { fundingSettings, validateFundingAmount } from "./funding-settings";
import { moveMoney } from "./wallet";
import { fundingNotification } from "./funding";
import { verifyProofToken, readProof } from "../storage/proofs";
import { PaystackGateway } from "../payments/paystack";
export async function requestManualFunding(userId: string, amountKobo: bigint, idempotencyKey: string, proofToken: string) {
  const proofObjectKey = await verifyProofToken(userId, proofToken);
  const feeKobo = validateFundingAmount(amountKobo, await fundingSettings());
  const requestHash = createHash("sha256").update("manual:" + amountKobo + ":" + proofObjectKey).digest("hex");
  return db.$transaction(async tx => {
    const user = await lockUser(tx, userId);
    
    const existing = await tx.fundingTransaction.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (existing) { if (existing.requestHash !== requestHash) throw new HttpError(409, "Request key conflicts with an earlier submission."); return { reference: existing.reference, status: existing.status }; }
    const row = await tx.fundingTransaction.create({ data: { userId, amountKobo, feeKobo, gateway: "manual", payerEmail: user.email, reference: "HD-M-" + randomUUID(), idempotencyKey, requestHash, proofObjectKey, reviewRequired: true } });
    await tx.notification.create({ data: { userId, title: "Funding proof received", body: "Your request " + row.reference + " is awaiting review. Your wallet has not been credited yet." } });
    return { reference: row.reference, status: row.status };
  });
}
export async function reviewFunding(actorId: string, fundingId: string, decision: "APPROVE" | "REJECT", reason: string, bankReference?: string) {
  const target = await db.fundingTransaction.findUnique({ where: { id: fundingId } });
  if (!target || (target.gateway !== "manual" && !target.reviewRequired && target.status === "PENDING")) throw new HttpError(404, "Funding request not found for review.");
  if (decision === "APPROVE") {
    if (target.gateway === "manual") { if (!bankReference || bankReference.trim().length < 6) throw new HttpError(400, "Enter the verified bank statement transaction reference."); if (!target.proofObjectKey) throw new HttpError(409, "Payment proof is missing."); await readProof(target.proofObjectKey); }
    else {
      const payment = await new PaystackGateway().verify(target.gatewayReference || target.reference);
      if (payment.status !== "success" || payment.currency !== "NGN" || payment.amountKobo !== target.amountKobo || payment.email !== target.payerEmail) throw new HttpError(409, "Gateway payment is not confirmed.");
    }
  }
  return db.$transaction(async tx => {
    await lockAdmin(tx, actorId);
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${target.userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "FundingTransaction" WHERE id = ${fundingId} FOR UPDATE`;
    const row = await tx.fundingTransaction.findUniqueOrThrow({ where: { id: fundingId } });
    const desired = decision === "APPROVE" ? "SUCCESSFUL" : "REJECTED";
    if (row.status === desired) { if (row.gateway === "manual" && decision === "APPROVE" && row.gatewayReference !== bankReference?.trim().toUpperCase()) throw new HttpError(409, "Bank reference differs from the earlier approval."); return { status: row.status }; }
    if (row.status !== "PENDING") throw new HttpError(409, "This request was already reviewed.");
    const user = await tx.user.findUniqueOrThrow({ where: { id: row.userId } });
    if (decision === "APPROVE") {
      await moveMoney(tx, row.userId, row.amountKobo, "FUNDING", "funding:" + row.id, "Funding approved: " + reason, { fundingTransactionId: row.id });
      if (row.feeKobo > 0n) await moveMoney(tx, row.userId, -row.feeKobo, "FEE", "funding-fee:" + row.id, "Funding fee", { fundingTransactionId: row.id });
      await fundingNotification(tx, { ...row, email: user.email });
    } else await tx.notification.create({ data: { userId: row.userId, title: "Funding request needs attention", body: reason + " Reference: " + row.reference } });
    await tx.fundingTransaction.update({ where: { id: row.id }, data: { status: desired, gatewayReference: row.gateway === "manual" && decision === "APPROVE" ? bankReference!.trim().toUpperCase() : row.gatewayReference, reviewedById: actorId, reviewReason: reason, reviewRequired: false } });
    await tx.auditLog.create({ data: { actorId, action: "FUNDING_" + decision, entityType: "FundingTransaction", entityId: row.id, metadata: { reason, amountKobo: row.amountKobo.toString() } } });
    return { status: desired };
  });
}
