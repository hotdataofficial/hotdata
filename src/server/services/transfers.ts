import { createHash, randomUUID } from "node:crypto";
import { db } from "../db";
import { lockUser, verifyPinInTransaction } from "../auth/accounts";
import { normalizeNigerianPhone } from "@/lib/validation/auth";
import { HttpError } from "../security/http";
import { fundingSettings } from "./funding-settings";
import { lockWallet, moveMoney } from "./wallet";
export async function transferWallet(userId: string, recipientPhone: string, amountKobo: bigint, pin: string, idempotencyKey: string) {
  const recipient = await db.user.findUnique({ where: { phone: normalizeNigerianPhone(recipientPhone) } });
  if (!recipient || recipient.id === userId) throw new HttpError(400, "Choose another active Hotdata account.");
  const hash = createHash("sha256").update(recipient.id + ":" + amountKobo).digest("hex");
  const result = await db.$transaction(async tx => {
    const settings = await fundingSettings(tx);
    if (!settings.transfersEnabled) throw new HttpError(403, "Wallet transfers are currently unavailable.");
    if (amountKobo <= 0n || amountKobo > settings.maximum) throw new HttpError(400, "Transfer amount is outside the limits.");
    for (const id of [userId, recipient.id].sort()) await lockUser(tx, id);
    const sender = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    
    const prior = await tx.transaction.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (prior) { if (prior.type !== "TRANSFER" || prior.requestHash !== hash) throw new HttpError(409, "This request key conflicts with an earlier transfer."); return { ok: true as const, reference: prior.reference }; }
    const capValue = sender.role === "AGENT" ? process.env.AGENT_DAILY_TRANSFER_KOBO || "500000000" : process.env.CUSTOMER_DAILY_TRANSFER_KOBO || "100000000";
    if (!/^[1-9]\d{0,14}$/.test(capValue)) throw new HttpError(503, "Transfer limits need administrator attention.");
    const dayStart = new Date(Math.floor((Date.now() + 3600000) / 86400000) * 86400000 - 3600000);
    const daily = await tx.transaction.aggregate({ where: { userId, type: "TRANSFER", status: "SUCCESSFUL", createdAt: { gte: dayStart } }, _sum: { amountKobo: true } });
    if ((daily._sum.amountKobo || 0n) + amountKobo > BigInt(capValue)) throw new HttpError(429, "This transfer would exceed your daily limit.");
    const verified = await verifyPinInTransaction(tx, userId, pin);
    if (!verified.ok) return verified;
    // Lock both wallets in the same order for opposing concurrent transfers.
    for (const id of [userId, recipient.id].sort()) await lockWallet(tx, id);
    const reference = "HD-T-" + randomUUID();
    const transaction = await tx.transaction.create({ data: { userId, reference, idempotencyKey, requestHash: hash, type: "TRANSFER", status: "SUCCESSFUL", phone: recipient.phone, amountKobo, costKobo: amountKobo, profitKobo: 0n, completedAt: new Date() } });
    await moveMoney(tx, userId, -amountKobo, "TRANSFER_OUT", reference + ":out", "Wallet transfer", { transactionId: transaction.id });
    await moveMoney(tx, recipient.id, amountKobo, "TRANSFER_IN", reference + ":in", "Wallet transfer", { transactionId: transaction.id });
    await tx.notification.createMany({ data: [{ userId, title: "Transfer sent", body: "Reference: " + reference }, { userId: recipient.id, title: "Transfer received", body: "Reference: " + reference }] });
    return { ok: true as const, reference };
  }, { timeout: 15000 });
  if (!result.ok) throw new HttpError(400, result.error);
  return { reference: result.reference };
}
