import { lockAdmin } from "../auth/admin-transaction";
import { db } from "../db";
import { moveMoney } from "./wallet";
import { HttpError } from "../security/http";
export async function adjustWallet(actorId: string, userId: string, amount: bigint, direction: "CREDIT" | "DEBIT", reason: string, key: string) {
  if (amount <= 0n) throw new HttpError(400, "Use a positive amount.");
  return db.$transaction(async tx => {
    const actor = await lockAdmin(tx, actorId);
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const target = await tx.user.findUnique({where:{id:userId}});
    if (!target || target.deletedAt) throw new HttpError(404,"Account not found.");
    if (actor.role !== "SUPER_ADMIN" && ["ADMIN","SUPER_ADMIN"].includes(target.role)) throw new HttpError(403,"Super admin required for staff wallets.");
    const entry = await moveMoney(tx, userId, direction === "CREDIT" ? amount : -amount, direction === "CREDIT" ? "ADMIN_CREDIT" : "ADMIN_DEBIT", "admin:" + actorId + ":" + key, reason);
    await tx.auditLog.upsert({ where: { id: entry.id }, update: {}, create: { id: entry.id, actorId, action: "WALLET_" + direction, entityType: "Wallet", entityId: entry.walletId, metadata: { amountKobo: amount.toString(), reason } } });
    return { reference: entry.reference, balanceKobo: entry.balanceAfterKobo.toString() };
  });
}
