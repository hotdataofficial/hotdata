import { z } from "zod";
import { db } from "../db";
import { processPurchase } from "../services/purchases";
import { dispatchFundingEmails } from "../notifications/funding-outbox";
import { dispatchPurchaseEmails } from "../notifications/purchase-outbox";
import { dispatchAgentCallbacks } from "../notifications/agent-callback-outbox";
import { dispatchBroadcasts } from "../notifications/broadcast-outbox";
import { dispatchReferralRewards } from "../services/referrals";
import { checkProviderBalances } from "../providers/balance-alerts";
import { reconcilePendingFunding, recoverableFundingWhere } from "./funding-recovery";
const leaseKey = "netlify-worker:lease";
const workKinds = ["VTU_PURCHASE", "EMAIL_FUNDING", "EMAIL_PURCHASE", "AGENT_CALLBACK", "ADMIN_BROADCAST", "REFERRAL_REWARD"];
export async function hasNetlifyWork() {
  const now = new Date();
  return !!(await db.fundingTransaction.findFirst({ where: recoverableFundingWhere(), select: { id: true } }) || await db.outboxEvent.findFirst({ where: { kind: { in: workKinds }, deliveredAt: null, availableAt: { lte: now }, OR: [{kind:{notIn:["EMAIL_FUNDING","EMAIL_PURCHASE"]}},{attempts:{lt:10}}] }, select: { id: true } }) ||
    await db.transaction.findFirst({ where: { type: "DATA", status: "PENDING", updatedAt: { lte: new Date(Date.now() - 60000) }, OR: [{ processingUntil: null }, { processingUntil: { lte: now } }] }, select: { id: true } }));
}
export async function runNetlifyJobs() {
  // Database-wide lease bounds duplicate wake-ups. Purchase-level leases remain authoritative.
  await db.outboxEvent.upsert({ where: { dedupeKey: leaseKey }, create: { dedupeKey: leaseKey, kind: "WORKER_LEASE", payload: {}, availableAt: new Date(0) }, update: {} });
  const leaseUntil = new Date(Date.now() + 14 * 60000);
  const acquired = await db.outboxEvent.updateMany({ where: { dedupeKey: leaseKey, availableAt: { lte: new Date() } }, data: { availableAt: leaseUntil, attempts: { increment: 1 } } });
  if (!acquired.count) return;
  const deadline = Date.now() + 8 * 60000;
  const visited = new Set<string>();
  try {
    await reconcilePendingFunding();
    for (let count = 0; count < 40 && Date.now() < deadline; count++) {
      const event = await db.$transaction(async tx => {
        // Static SQL only; no external strings or identifiers are interpolated.
        const rows = await tx.$queryRawUnsafe<{ id: string }[]>('SELECT id FROM "OutboxEvent" WHERE kind = \'VTU_PURCHASE\' AND "deliveredAt" IS NULL AND "availableAt" <= NOW() ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1');
        if (!rows[0]) return null;
        return tx.outboxEvent.update({ where: { id: rows[0].id }, data: { attempts: { increment: 1 }, availableAt: new Date(Date.now() + 180000) } });
      });
      if (!event) break;
      const input = z.object({ transactionId: z.string().min(1).max(64) }).parse(event.payload);
      await processPurchase(input.transactionId);
      visited.add(input.transactionId);
      await db.outboxEvent.update({ where: { id: event.id }, data: { deliveredAt: new Date() } });
    }
    // Query uncertain attempts by their original reference. Never resend or refund UNKNOWN.
    const pending = await db.transaction.findMany({ where: { type: "DATA", status: "PENDING", id: { notIn: [...visited] }, updatedAt: { lte: new Date(Date.now() - 60000) }, OR: [{ processingUntil: null }, { processingUntil: { lte: new Date() } }] }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: 20, select: { id: true } });
    for (const order of pending) {
      if (Date.now() >= deadline) break;
      await processPurchase(order.id);
    }
    for (const task of [() => dispatchFundingEmails(2), () => dispatchPurchaseEmails(2), () => dispatchAgentCallbacks(2), dispatchBroadcasts, dispatchReferralRewards]) {
      if (Date.now() >= deadline) break;
      try { await task(); } catch { console.warn("Background maintenance will retry."); }
    }
    const hour = new Date().toISOString().slice(0, 13);
    const hourly = await db.outboxEvent.upsert({ where: { dedupeKey: "netlify-hourly:" + hour }, create: { kind: "WORKER_HOURLY", dedupeKey: "netlify-hourly:" + hour, payload: {} }, update: {} });
    if (!hourly.deliveredAt && Date.now() < deadline) {
      await checkProviderBalances();
      await db.referralClick.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400000) } } });
      await db.outboxEvent.update({ where: { id: hourly.id }, data: { deliveredAt: new Date() } });
    }
  } finally {
    await db.outboxEvent.updateMany({ where: { dedupeKey: leaseKey, availableAt: leaseUntil }, data: { availableAt: new Date() } });
  }
}
