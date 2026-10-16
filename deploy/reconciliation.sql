-- Read-only operational checks. Use a read-only DB account. Never repair by editing balances.
-- Run in one consistent snapshot to avoid concurrent-wallet false positives.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT w.id, w."balanceKobo", COALESCE(SUM(l."amountKobo"), 0) AS "ledgerSumKobo"
FROM "Wallet" w LEFT JOIN "LedgerEntry" l ON l."walletId" = w.id
GROUP BY w.id HAVING w."balanceKobo" <> COALESCE(SUM(l."amountKobo"), 0);
SELECT id FROM "LedgerEntry"
WHERE "balanceAfterKobo" <> "balanceBeforeKobo" + "amountKobo";
SELECT id, reference, "createdAt", "updatedAt" FROM "Transaction"
WHERE type = 'DATA' AND status = 'PENDING' AND "createdAt" < NOW() - INTERVAL '15 minutes';
SELECT kind, COUNT(*) AS undelivered, MIN("createdAt") AS oldest
FROM "OutboxEvent" WHERE "deliveredAt" IS NULL GROUP BY kind;
COMMIT;
