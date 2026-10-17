import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { airtimeNetworks, airtimeMinKobo, airtimeMaxKobo, airtimePurchaseSchema } from "@/lib/airtime";
import { formatKobo } from "@/lib/money";
import { db } from "../db";
import { lockUser, verifyPinInTransaction } from "../auth/accounts";
import { HttpError } from "../security/http";
import { isAdapterReady } from "../providers/registry";
import { wakeNetlifyWorker } from "../jobs/netlify-trigger";
import { moveMoney } from "./wallet";
import { purchaseView } from "./purchases";

type Input = z.infer<typeof airtimePurchaseSchema>;
const requestHash = (input: Input) => createHash("sha256").update(JSON.stringify({ type: "AIRTIME", networkCode: input.networkCode, phone: input.phone, amountKobo: input.amountKobo })).digest("hex");
export async function airtimeCatalog() {
  const [networks, provider] = await Promise.all([
    db.network.findMany({ where: { code: { in: [...airtimeNetworks] }, active: true, deletedAt: null }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
    db.provider.findFirst({ where: { code: "GSUBZ", adapter: "gsubz", active: true, deletedAt: null }, select: { adapter: true } }),
  ]);
  return { networks: networks.map(network => ({ ...network, available: !!provider && isAdapterReady(provider.adapter) })), minKobo: airtimeMinKobo.toString(), maxKobo: airtimeMaxKobo.toString(), wholeNairaOnly: true, pricing: "FACE_VALUE" };
}

// Called under the User lock, so separate tabs cannot overspend or bypass the shared limit.
export async function stageAirtimePurchase(tx: Prisma.TransactionClient, userId: string, input: Input, ready = isAdapterReady) {
  input = airtimePurchaseSchema.parse(input);
  const prior = await tx.transaction.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } } });
  if (prior) {
    if (prior.type !== "AIRTIME" || prior.requestHash !== requestHash(input) || prior.apiKeyId || prior.bulkBatchId) throw new HttpError(409, "Request key conflicts with an earlier purchase.");
    return prior;
  }
  const network = await tx.network.findFirst({ where: { code: input.networkCode, active: true, deletedAt: null }, select: { code: true } });
  const provider = await tx.provider.findFirst({ where: { code: "GSUBZ", adapter: "gsubz", active: true, deletedAt: null }, select: { id: true, adapter: true } });
  if (!network || !provider || !ready(provider.adapter)) throw new HttpError(503, "Airtime is temporarily unavailable for this network. Please try again later.");
  const amountKobo = BigInt(input.amountKobo);
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
  const cap = user.role === "AGENT" ? process.env.AGENT_PURCHASE_DAILY_LIMIT_KOBO || "1000000000" : process.env.PURCHASE_DAILY_LIMIT_KOBO || "100000000";
  if (!/^[1-9]\d{0,14}$/.test(cap)) throw new Error("Invalid purchase daily limit.");
  const day = new Date(Math.floor((Date.now() + 3600000) / 86400000) * 86400000 - 3600000);
  const total = await tx.transaction.aggregate({ where: { userId, type: { in: ["DATA", "AIRTIME"] }, status: { in: ["PENDING", "SUCCESSFUL"] }, createdAt: { gte: day } }, _sum: { amountKobo: true } });
  if ((total._sum.amountKobo || 0n) + amountKobo > BigInt(cap)) throw new HttpError(400, "Daily purchase limit reached.");
  // Charge face value. Until delivery reports an actual supplier debit, assume zero margin.
  const order = await tx.transaction.create({ data: {
    userId, reference: "HD-A-" + randomUUID(), type: "AIRTIME", idempotencyKey: input.idempotencyKey, requestHash: requestHash(input), phone: input.phone,
    amountKobo, costKobo: amountKobo, profitKobo: 0n,
    planSnapshot: { type: "AIRTIME", name: formatKobo(amountKobo) + " airtime", networkCode: input.networkCode, sizeMb: 0, validityDays: 0, providerId: provider.id, faceValueKobo: input.amountKobo },
  } });
  await moveMoney(tx, userId, -amountKobo, "PURCHASE", order.reference + "-DEBIT", "Airtime purchase", { transactionId: order.id });
  await tx.outboxEvent.create({ data: { kind: "VTU_PURCHASE", payload: { transactionId: order.id }, dedupeKey: "purchase:" + order.id } });
  await tx.notification.create({ data: { userId, title: "Airtime purchase processing", body: "Reference: " + order.reference + ". Hotdata is confirming delivery." } });
  return order;
}
export async function createAirtimePurchase(userId: string, input: Input, ready = isAdapterReady) {
  const result = await db.$transaction(async tx => {
    await lockUser(tx, userId);
    // Replays are read-only; a PIN is required before any new debit.
    const prior = await tx.transaction.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } } });
    if (prior) return { purchase: await stageAirtimePurchase(tx, userId, input, ready) };
    const pin = await verifyPinInTransaction(tx, userId, input.pin);
    if (!pin.ok) return { error: pin.error };
    return { purchase: await stageAirtimePurchase(tx, userId, input, ready) };
  }, { timeout: 15000 });
  if (!result.purchase) throw new HttpError(400, result.error || "Airtime purchase unavailable.");
  await wakeNetlifyWorker();
  return purchaseView(result.purchase);
}
