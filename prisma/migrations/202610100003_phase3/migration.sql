ALTER TABLE "Transaction" ADD COLUMN "processingUntil" TIMESTAMP(3), ADD COLUMN "processingToken" TEXT;
ALTER TABLE "ProviderAttempt" ADD COLUMN "providerPlanCode" TEXT NOT NULL DEFAULT '', ADD COLUMN "networkCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProviderAttempt" ALTER COLUMN "providerPlanCode" DROP DEFAULT, ALTER COLUMN "networkCode" DROP DEFAULT;
