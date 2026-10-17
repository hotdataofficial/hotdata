import { purchaseFinalEvents } from "./referrals";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { lockAdmin } from "../auth/admin-transaction";
import { providerFactory } from "../providers/registry";
import type { ProviderFactory, ProviderResult } from "../providers/types";
import { moveMoney } from "./wallet";
import { HttpError } from "../security/http";
import { refundableEvidence } from "@/lib/admin";
async function bounded<T>(value: Promise<T>): Promise<T> { let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([value, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new HttpError(409, "Provider result remains uncertain.")), 10000); })]); } finally { clearTimeout(timer); } }
export async function adminRequery(actorId: string, id: string, reason: string) { return db.$transaction(async tx => { await lockAdmin(tx, actorId); const order = await tx.transaction.findUnique({ where: { id } }); if (!order || !["DATA", "AIRTIME"].includes(order.type)) throw new HttpError(404, "Purchase not found."); if (order.status !== "PENDING") throw new HttpError(409, "This purchase is already final."); const event = await tx.outboxEvent.create({ data: { kind: "VTU_PURCHASE", dedupeKey: "admin-requery:" + randomUUID(), payload: { transactionId: id } } }); await tx.auditLog.create({ data: { actorId, action: "TRANSACTION_REQUERY", entityType: "Transaction", entityId: id, metadata: { reason, outboxId: event.id } } }); return { queued: true }; }); }
export async function adminFinalize(actorId: string, id: string, attemptId: string, desired: "SUCCESSFUL" | "FAILED", reason: string, factory: ProviderFactory = providerFactory) {
  const attempt = await db.providerAttempt.findFirst({ where: { id: attemptId, transactionId: id }, include: { provider: true } }); if (!attempt) throw new HttpError(404, "Provider attempt not found.");
  let result: ProviderResult; try { result = await bounded(factory(attempt.provider).checkStatus(attempt.reference)); } catch { throw new HttpError(409, "Provider confirmation is unavailable. Keep the purchase pending."); }
  if (result.status !== desired || !["SUCCESSFUL", "FAILED"].includes(result.status)) throw new HttpError(409, "The provider did not confirm the requested final outcome.");
  return db.$transaction(async tx => {
    await lockAdmin(tx, actorId, true);
    const target = await tx.transaction.findUnique({ where: { id } }); if (!target || !["DATA", "AIRTIME"].includes(target.type)) throw new HttpError(404, "Purchase not found.");
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${target.userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Transaction" WHERE id = ${id} FOR UPDATE`;
    const order = await tx.transaction.findUniqueOrThrow({ where: { id }, include: { attempts: true } });
    if (order.status === desired) return { status: order.status, replayed: true };
    if (order.status !== "PENDING" || order.processingUntil && order.processingUntil > new Date()) throw new HttpError(409, "The purchase is final or currently being processed.");
    const selected = order.attempts.find(a => a.id === attemptId); if (!selected || selected.reference !== attempt.reference || selected.providerId !== attempt.providerId) throw new HttpError(409, "Provider evidence changed. Refresh first.");
    if (selected.status !== "PENDING") throw new HttpError(409, "Historical final evidence cannot be overwritten.");
    const statuses = order.attempts.map(a => ({ status: a.id === attemptId ? desired : a.status }));
    if (desired === "FAILED" && !refundableEvidence(statuses) || desired === "SUCCESSFUL" && order.attempts.some(a => a.id !== attemptId && a.status !== "FAILED")) throw new HttpError(409, "Other attempts remain uncertain or successful. Investigate before finalising.");
    const code = /^[A-Z0-9_-]{1,64}$/.test(result.code) ? result.code : "REDACTED";
    await tx.providerAttempt.update({ where: { id: attemptId }, data: { status: desired, responseRedacted: { status: desired, code, verifiedByAdmin: true } } });
    if (desired === "FAILED") await moveMoney(tx, order.userId, order.amountKobo, "REFUND", order.reference + "-REFUND", (order.type === "AIRTIME" ? "Airtime" : "Data") + " purchase refund", { transactionId: id });
    await tx.transaction.update({ where: { id }, data: { status: desired, completedAt: new Date(), refundedAt: desired === "FAILED" ? new Date() : null, failureReason: desired === "FAILED" ? code : null, profitKobo: desired === "FAILED" ? 0n : order.profitKobo, processingUntil: null, processingToken: null } });
    await purchaseFinalEvents(tx,order.id);
    await tx.notification.create({ data: { userId: order.userId, title: (order.type === "AIRTIME" ? "Airtime" : "Data") + (desired === "FAILED" ? " purchase refunded" : " delivered"), body: "Reference: " + order.reference } });
    const owner = await tx.user.findUniqueOrThrow({ where: { id: order.userId }, select: { email: true } });
    await tx.outboxEvent.upsert({ where: { dedupeKey: "purchase-email:" + id }, update: {}, create: { kind: "EMAIL_PURCHASE", dedupeKey: "purchase-email:" + id, payload: { email: owner.email, reference: order.reference, amountKobo: order.amountKobo.toString(), purchaseType: order.type, status: desired, refunded: desired === "FAILED" } } });
    await tx.auditLog.create({ data: { actorId, action: "TRANSACTION_CONFIRMED_" + desired, entityType: "Transaction", entityId: id, metadata: { reason, providerReference: attempt.reference, code } } });
    return { status: desired };
  }, { timeout: 15000 });
}
