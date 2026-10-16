import { dispatchAgentCallbacks } from "../src/server/notifications/agent-callback-outbox";
import { dispatchReferralRewards } from "../src/server/services/referrals";
import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { z } from "zod";
import { db } from "../src/server/db";
import { processPurchase } from "../src/server/services/purchases";
import { dispatchFundingEmails } from "../src/server/notifications/funding-outbox";
import { dispatchPurchaseEmails } from "../src/server/notifications/purchase-outbox";
import { dispatchBroadcasts } from "../src/server/notifications/broadcast-outbox";
import { checkProviderBalances } from "../src/server/providers/balance-alerts";
function connection() {
  const url = new URL(process.env.REDIS_URL || "");
  if (!["redis:", "rediss:"].includes(url.protocol)) throw new Error("Invalid Redis URL.");
  return { host: url.hostname, port: Number(url.port || 6379), username: url.username ? decodeURIComponent(url.username) : undefined, password: url.password ? decodeURIComponent(url.password) : undefined, db: Number(url.pathname.slice(1) || 0), ...(url.protocol === "rediss:" ? { tls: {} } : {}), maxRetriesPerRequest: null };
}
const queue = new Queue("hotdata-purchases", { connection: connection() });
const worker = new Worker("hotdata-purchases", async job => {
  const input = z.object({ transactionId: z.string().min(1).max(64) }).parse(job.data);
  await processPurchase(input.transactionId);
}, { connection: connection(), concurrency: 5 });
worker.on("error", () => console.error("Purchase worker connection error."));
worker.on("failed", job => console.warn(JSON.stringify({ event: "purchase_job_failed", jobId: job?.id })));
queue.on("error", () => console.error("Purchase queue connection error."));
let cursor: string | undefined, ticking = false, lastBalances = 0;
async function tick() {
  if (ticking) return; ticking = true;
  try {
    // A lease makes outbox dispatch safe across worker instances.
    for (let i = 0; i < 100; i++) {
      const event = await db.$transaction(async tx => {
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "OutboxEvent" WHERE kind = 'VTU_PURCHASE' AND "deliveredAt" IS NULL AND "availableAt" <= NOW() ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
        if (!rows[0]) return null;
        return tx.outboxEvent.update({ where: { id: rows[0].id }, data: { attempts: { increment: 1 }, availableAt: new Date(Date.now() + 60000) } });
      });
      if (!event) break;
      const data = z.object({ transactionId: z.string() }).parse(event.payload);
      await queue.add("purchase", data, { jobId: "outbox-" + event.id, attempts: 5, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: { age: 86400 }, removeOnFail: { age: 604800 } });
      await db.outboxEvent.update({ where: { id: event.id }, data: { deliveredAt: new Date() } });
    }
    // Cursor cycling visits every pending order, including ones with lost queue jobs.
    const pending = await db.transaction.findMany({ where: { type: "DATA", status: "PENDING", ...(cursor ? { id: { gt: cursor } } : {}), OR: [{ processingUntil: null }, { processingUntil: { lte: new Date() } }] }, orderBy: { id: "asc" }, take: 100, select: { id: true } });
    for (const order of pending) await queue.add("reconcile", { transactionId: order.id }, { jobId: "reconcile-" + order.id + "-" + Math.floor(Date.now() / 60000), removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } });
    cursor = pending.length === 100 ? pending[99].id : undefined;
    await dispatchFundingEmails();
    await dispatchPurchaseEmails();
    await dispatchBroadcasts();
    await dispatchReferralRewards();
    await db.referralClick.deleteMany({where:{createdAt:{lt:new Date(Date.now()-30*86400000)}}});
    if (Date.now() - lastBalances > 3600000) { await checkProviderBalances(); lastBalances = Date.now(); }
  } catch { console.error("Worker maintenance failed; next pass will retry."); }
  finally { ticking = false; }
}
let callbackTicking=false;
async function callbackTick(){if(callbackTicking)return;callbackTicking=true;try{await dispatchAgentCallbacks();}catch{console.error("Callback maintenance failed; next pass will retry.");}finally{callbackTicking=false;}}
const callbackTimer=setInterval(()=>{void callbackTick();},30000);
void callbackTick();
const timer = setInterval(() => { void tick(); }, 30000);
void tick();
let closing = false;
async function close() {
  if (closing) return; closing = true; clearInterval(timer); clearInterval(callbackTimer);
  while (ticking || callbackTicking) await new Promise(resolve => setTimeout(resolve, 100));
  await worker.close(); await queue.close(); await db.$disconnect();
}
process.on("SIGTERM", () => { void close(); });
process.on("SIGINT", () => { void close(); });
