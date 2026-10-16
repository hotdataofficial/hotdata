import type { LedgerType, Prisma } from "@prisma/client";
import { HttpError } from "../security/http";
export async function lockWallet(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new HttpError(409, "Wallet not found. Contact support.");
  return wallet;
}
export async function moveMoney(tx: Prisma.TransactionClient, userId: string, amountKobo: bigint, type: LedgerType, reference: string, description: string, links: { fundingTransactionId?: string; transactionId?: string } = {}) {
  if (amountKobo === 0n) throw new HttpError(400, "Amount must be nonzero.");
  const wallet = await lockWallet(tx, userId);
  const existing = await tx.ledgerEntry.findUnique({ where: { reference } });
  if (existing) {
    if (existing.walletId !== wallet.id || existing.amountKobo !== amountKobo || existing.type !== type || existing.description !== description || existing.fundingTransactionId !== (links.fundingTransactionId || null) || existing.transactionId !== (links.transactionId || null)) throw new HttpError(409, "Reference conflicts with an earlier operation.");
    return existing;
  }
  const next = wallet.balanceKobo + amountKobo;
  if (next < 0n) throw new HttpError(400, "Insufficient wallet balance.");
  // Insert first; the deferred database trigger also protects direct balance updates.
  const entry = await tx.ledgerEntry.create({ data: { walletId: wallet.id, type, amountKobo, balanceBeforeKobo: wallet.balanceKobo, balanceAfterKobo: next, reference, description, ...links } });
  await tx.wallet.update({ where: { id: wallet.id }, data: { balanceKobo: next } });
  return entry;
}
