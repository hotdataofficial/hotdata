ALTER TABLE "ApiKey" ADD COLUMN "callbackUrl" TEXT, ADD COLUMN "callbackSecretEncrypted" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "apiKeyId" TEXT, ADD COLUMN "bulkBatchId" TEXT, ADD COLUMN "bulkRow" INTEGER;
CREATE TABLE "BulkBatch" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
 "totalKobo" BIGINT NOT NULL, "rowCount" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BulkBatch_pkey" PRIMARY KEY ("id"), CONSTRAINT "BulkBatch_total_check" CHECK ("totalKobo" > 0 AND "rowCount" BETWEEN 1 AND 50)
);
CREATE UNIQUE INDEX "BulkBatch_userId_idempotencyKey_key" ON "BulkBatch"("userId", "idempotencyKey");
CREATE INDEX "BulkBatch_userId_createdAt_idx" ON "BulkBatch"("userId", "createdAt");
ALTER TABLE "BulkBatch" ADD CONSTRAINT "BulkBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bulkBatchId_fkey" FOREIGN KEY ("bulkBatchId") REFERENCES "BulkBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bulk_row_check" CHECK (("bulkBatchId" IS NULL AND "bulkRow" IS NULL) OR ("bulkBatchId" IS NOT NULL AND "bulkRow" IS NOT NULL AND "bulkRow" >= 0 AND "bulkRow" < 50));
CREATE UNIQUE INDEX "Transaction_bulkBatchId_bulkRow_key" ON "Transaction"("bulkBatchId", "bulkRow");
CREATE INDEX "Transaction_apiKeyId_createdAt_idx" ON "Transaction"("apiKeyId", "createdAt");
-- Stop for operator review if legacy rewards already paid more than once per referee.
-- Never remove historical financial records to make this index pass.
CREATE UNIQUE INDEX "ReferralEarning_refereeId_key" ON "ReferralEarning"("refereeId");
CREATE TABLE "ReferralClick" (
 "id" TEXT NOT NULL, "referrerId" TEXT NOT NULL, "visitorHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReferralClick_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralClick_referrerId_visitorHash_key" ON "ReferralClick"("referrerId", "visitorHash");
CREATE INDEX "ReferralClick_referrerId_createdAt_idx" ON "ReferralClick"("referrerId", "createdAt");
ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Confirmed failed/refunded purchases retain their quoted amount/cost for history,
-- but recognise no profit. The original Phase 1 equality prevented this commit.
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_money_valid";
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_money_valid" CHECK (
 "amountKobo" >= 0 AND "costKobo" >= 0 AND
 ((status = 'FAILED' AND "profitKobo" = 0) OR (status <> 'FAILED' AND "profitKobo" = "amountKobo" - "costKobo"))
);
