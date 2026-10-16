import { randomUUID, createHash } from "node:crypto";
import type { z } from "zod";
import type { Prisma, User } from "@prisma/client";
import { lockAgentKey } from "../auth/api-keys";
import { purchaseFinalEvents } from "./referrals";
import { db } from "../db";
import { HttpError } from "../security/http";
import { lockUser, verifyPinInTransaction } from "../auth/accounts";
import { moveMoney } from "./wallet";
import { purchaseSchema } from "@/lib/validation/purchases";
import { isAdapterReady, providerFactory } from "../providers/registry";
import type { ProviderFactory, ProviderResult } from "../providers/types";
export const purchaseView = (value: { id: string; reference: string; status: string; amountKobo: bigint; phone: string; refundedAt: Date | null; createdAt: Date }) => ({
  id: value.id, reference: value.reference, status: value.status, amountKobo: value.amountKobo.toString(), phone: value.phone, refundedAt: value.refundedAt, createdAt: value.createdAt,
});
export type PurchaseContext={apiKeyId?:string;bulkBatchId?:string;bulkRow?:number};
const purchaseHash=(input:z.infer<typeof purchaseSchema>)=>createHash("sha256").update(JSON.stringify({planId:input.planId,phone:input.phone})).digest("hex");
async function priorPurchase(tx:Prisma.TransactionClient,userId:string,input:z.infer<typeof purchaseSchema>,context:PurchaseContext){const prior=await tx.transaction.findUnique({where:{userId_idempotencyKey:{userId,idempotencyKey:input.idempotencyKey}}});if(prior&&(prior.type!=="DATA"||prior.requestHash!==purchaseHash(input)||(prior.apiKeyId||null)!==(context.apiKeyId||null)||(prior.bulkBatchId||null)!==(context.bulkBatchId||null)))throw new HttpError(409,"Request key conflicts with an earlier purchase.");return prior;}
// Internal entry point: callers hold the User lock and have verified one PIN authorisation.
export async function stageDataPurchase(tx:Prisma.TransactionClient,user:User,input:z.infer<typeof purchaseSchema>,ready=isAdapterReady,context:PurchaseContext={}){const userId=user.id,hash=purchaseHash(input);if((context.apiKeyId||context.bulkBatchId)&&user.role!=="AGENT")throw new HttpError(403,"Agent tier required.");const prior=await priorPurchase(tx,userId,input,context);if(prior)return prior;
    const plan = await tx.plan.findFirst({ where: { id: input.planId, active: true, deletedAt: null, network: { active: true, deletedAt: null } }, include: { network: true, mappings: { where: { active: true, provider: { active: true, deletedAt: null } }, include: { provider: true } } } });
    if (!plan || !plan.mappings.some(m => ready(m.provider.adapter))) throw new HttpError(503, "This plan is not available yet.");
    const amountKobo = user.role === "AGENT" ? plan.agentPriceKobo : plan.customerPriceKobo;
    if (input.expectedPriceKobo && BigInt(input.expectedPriceKobo) !== amountKobo) throw new HttpError(409, "The plan price changed. Refresh the catalog and review the new price.");
    if (amountKobo <= 0n || amountKobo < plan.costKobo) throw new HttpError(503, "Plan pricing is unavailable.");
    const capText = user.role === "AGENT" ? process.env.AGENT_PURCHASE_DAILY_LIMIT_KOBO || "1000000000" : process.env.PURCHASE_DAILY_LIMIT_KOBO || "100000000";
    if (!/^[1-9]\d{0,14}$/.test(capText)) throw new Error("Invalid purchase daily limit.");
    const lagos = Date.now() + 3600000, day = new Date(Math.floor(lagos / 86400000) * 86400000 - 3600000);
    const total = await tx.transaction.aggregate({ where: { userId, type: "DATA", status: { in: ["PENDING", "SUCCESSFUL"] }, createdAt: { gte: day } }, _sum: { amountKobo: true } });
    if ((total._sum.amountKobo || 0n) + amountKobo > BigInt(capText)) throw new HttpError(400, "Daily purchase limit reached.");
    const purchase = await tx.transaction.create({ data: { userId, reference: "HD-D-" + randomUUID(), idempotencyKey: input.idempotencyKey, requestHash: hash, type: "DATA", apiKeyId: context.apiKeyId, bulkBatchId: context.bulkBatchId, bulkRow: context.bulkRow, phone: input.phone, planId: plan.id, planSnapshot: { name: plan.name, networkCode: plan.network.code, type: plan.type, sizeMb: plan.sizeMb, validityDays: plan.validityDays }, amountKobo, costKobo: plan.costKobo, profitKobo: amountKobo - plan.costKobo } });
    await moveMoney(tx, userId, -amountKobo, "PURCHASE", purchase.reference + "-DEBIT", "Data purchase", { transactionId: purchase.id });
    await tx.outboxEvent.create({ data: { kind: "VTU_PURCHASE", payload: { transactionId: purchase.id }, dedupeKey: "purchase:" + purchase.id } });
    await tx.notification.create({ data: { userId, title: "Data purchase processing", body: "Reference: " + purchase.reference + ". Delivery is awaiting provider confirmation." } });

return purchase;}
export async function createPurchase(userId:string,input:z.infer<typeof purchaseSchema>,ready=isAdapterReady,context:PurchaseContext={}){const result=await db.$transaction(async tx=>{const user=await lockUser(tx,userId);if(context.apiKeyId)await lockAgentKey(tx,userId,context.apiKeyId);const prior=await priorPurchase(tx,userId,input,context);if(prior)return {purchase:prior};const pin=await verifyPinInTransaction(tx,userId,input.pin);if(!pin.ok)return {error:pin.error};return {purchase:await stageDataPurchase(tx,user,input,ready,context)};},{timeout:15000});if(!result.purchase)throw new HttpError(400,result.error||"Purchase unavailable.");return purchaseView(result.purchase);}

function safeResult(result: ProviderResult): ProviderResult {
  if (!["SUCCESSFUL", "FAILED", "UNKNOWN"].includes(result?.status)) return { status: "UNKNOWN", code: "INVALID_RESPONSE" };
  // Persist only a compact status code, never raw provider payloads or secrets.
  return { status: result.status, code: /^[A-Z0-9_-]{1,64}$/.test(result.code) ? result.code : "REDACTED", ...(result.status === "SUCCESSFUL" && result.costKobo && /^[1-9]\d{0,14}$/.test(result.costKobo) ? {costKobo:result.costKobo} : {}) };
}
async function bounded<T>(operation: Promise<T>, deadlineMs=10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Provider deadline exceeded.")), deadlineMs); })]); }
  finally { if (timer) clearTimeout(timer); }
}
export async function processPurchase(transactionId: string, factory: ProviderFactory = providerFactory, ready = isAdapterReady) {
  const token = randomUUID();
  const claimed = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Transaction" WHERE id = ${transactionId} FOR UPDATE`;
    const order = await tx.transaction.findUnique({ where: { id: transactionId }, include: { attempts: { orderBy: { createdAt: "asc" }, include: { provider: true } }, plan: { include: { network: true, mappings: { where: { active: true, provider: { active: true, deletedAt: null } }, include: { provider: true } } } } } });
    if (!order || order.type !== "DATA" || order.status !== "PENDING" || (order.processingUntil && order.processingUntil > new Date())) return null;
    const pending = order.attempts.find(a => a.status === "PENDING");
    if (order.attempts.some(a => a.status === "SUCCESSFUL")) throw new Error("Purchase state requires operator review.");
    let attempt = pending, send = false;
    if (!attempt) {
      const tried = new Set(order.attempts.map(a => a.providerId));
      const mapping = order.plan?.mappings.filter(m => !tried.has(m.providerId) && ready(m.provider.adapter)).sort((a, b) => a.provider.priority - b.provider.priority || a.providerId.localeCompare(b.providerId))[0];
      if (mapping) {
        attempt = await tx.providerAttempt.create({ data: { transactionId, providerId: mapping.providerId, reference: "HD-P-" + randomUUID(), providerPlanCode: mapping.providerPlanCode, networkCode: order.plan!.network.code, requestRedacted: { operation: "DATA" } }, include: { provider: true } });
        send = true;
      }
    }
    await tx.transaction.update({ where: { id: transactionId }, data: { processingToken: token, processingUntil: new Date(Date.now() + 120000) } });
    return { order, attempt, send };
  });
  if (!claimed) return;
  let result: ProviderResult = { status: "FAILED", code: "NO_AVAILABLE_PROVIDER" };
  if (claimed.attempt) {
    try {
      const adapter = factory(claimed.attempt.provider);
      result = safeResult(await bounded(claimed.send ? adapter.buyData({ reference: claimed.attempt.reference, phone: claimed.order.phone, providerPlanCode: claimed.attempt.providerPlanCode, networkCode: claimed.attempt.networkCode, expectedCostKobo: claimed.order.costKobo.toString() }) : adapter.checkStatus(claimed.attempt.reference), claimed.attempt.provider.adapter === "gsubz" ? 85000 : 10000));
    } catch { result = { status: "UNKNOWN", code: "PROVIDER_UNCERTAIN" }; }
  }
  await db.$transaction(async tx => {
    // Match wallet initiators' lock order: User, Transaction, Wallet.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${claimed.order.userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Transaction" WHERE id = ${transactionId} FOR UPDATE`;
    const current = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    if (current.status !== "PENDING" || current.processingToken !== token) return;
    if (claimed.attempt) await tx.providerAttempt.update({ where: { id: claimed.attempt.id }, data: { status: result.status === "UNKNOWN" ? "PENDING" : result.status, responseRedacted: { status: result.status, code: result.code } } });
    const release = { processingUntil: null, processingToken: null };
    if (result.status === "UNKNOWN") { await tx.transaction.update({ where: { id: transactionId }, data: release }); return; }
    if (result.status === "FAILED" && claimed.attempt) {
      // Commit the definite failed attempt. The next queue pass may safely try
      // another provider; an uncertain attempt never reaches this branch.
      await tx.transaction.update({ where: { id: transactionId }, data: release }); return;
    }
    if (result.status === "FAILED") {
      await moveMoney(tx, current.userId, current.amountKobo, "REFUND", current.reference + "-REFUND", "Data purchase refund", { transactionId });
    }
    await tx.transaction.update({ where: { id: transactionId }, data: { ...release, status: result.status, completedAt: new Date(), refundedAt: result.status === "FAILED" ? new Date() : null, failureReason: result.status === "FAILED" ? result.code : null, ...(result.status === "SUCCESSFUL" && result.costKobo ? {costKobo:BigInt(result.costKobo)} : {}), profitKobo: result.status === "FAILED" ? 0n : result.costKobo ? current.amountKobo-BigInt(result.costKobo) : current.profitKobo } });
    await purchaseFinalEvents(tx, current.id);
    await tx.notification.create({ data: { userId: current.userId, title: result.status === "SUCCESSFUL" ? "Data delivered" : "Data purchase refunded", body: "Reference: " + current.reference } });
    const owner = await tx.user.findUniqueOrThrow({ where: { id: current.userId }, select: { email: true } });
    await tx.outboxEvent.create({ data: { kind: "EMAIL_PURCHASE", dedupeKey: "purchase-email:" + current.id, payload: { email: owner.email, reference: current.reference, amountKobo: current.amountKobo.toString(), status: result.status, refunded: result.status === "FAILED" } } });
  }, { timeout: 15000 });
}
