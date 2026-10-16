-- Initial Hotdata schema. Client-generated cuid IDs and @updatedAt timestamps are supplied by Prisma.

CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'AGENT', 'ADMIN', 'SUPER_ADMIN');

CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED');

CREATE TYPE "TransactionType" AS ENUM ('DATA', 'AIRTIME', 'TRANSFER', 'WITHDRAWAL', 'AGENT_UPGRADE');

CREATE TYPE "LedgerType" AS ENUM ('FUNDING', 'PURCHASE', 'REFUND', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'REFERRAL', 'FEE');

CREATE TYPE "PlanType" AS ENUM ('SME', 'GIFTING', 'CORPORATE_GIFTING', 'DIRECT');

CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET');

CREATE TYPE "FundingStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'REJECTED');

CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "emailVerifiedAt" TIMESTAMP(3),
  "phoneVerifiedAt" TIMESTAMP(3),
  "consentAt" TIMESTAMP(3) NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "pinHash" TEXT,
  "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
  "pinLockedUntil" TIMESTAMP(3),
  "loginFailedAttempts" INTEGER NOT NULL DEFAULT 0,
  "loginLockedUntil" TIMESTAMP(3),
  "authVersion" INTEGER NOT NULL DEFAULT 0,
  "referralCode" TEXT NOT NULL,
  "referredById" TEXT,
  "deletionRequestedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Wallet" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "balanceKobo" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "walletId" TEXT NOT NULL,
  "type" "LedgerType" NOT NULL,
  "amountKobo" BIGINT NOT NULL,
  "balanceBeforeKobo" BIGINT NOT NULL,
  "balanceAfterKobo" BIGINT NOT NULL,
  "reference" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "transactionId" TEXT,
  "fundingTransactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "phone" TEXT NOT NULL,
  "planId" TEXT,
  "amountKobo" BIGINT NOT NULL,
  "costKobo" BIGINT NOT NULL,
  "profitKobo" BIGINT NOT NULL,
  "failureReason" TEXT,
  "completedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Network" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Plan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "networkId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PlanType" NOT NULL,
  "sizeMb" INTEGER NOT NULL,
  "validityDays" INTEGER NOT NULL,
  "costKobo" BIGINT NOT NULL,
  "customerPriceKobo" BIGINT NOT NULL,
  "agentPriceKobo" BIGINT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Provider" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "adapter" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "credentialsEncrypted" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "lowBalanceThresholdKobo" BIGINT NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "ProviderPlanMap" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerPlanCode" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "ProviderAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "requestRedacted" JSONB,
  "responseRedacted" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "FundingTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "gateway" TEXT NOT NULL,
  "gatewayReference" TEXT,
  "amountKobo" BIGINT NOT NULL,
  "feeKobo" BIGINT NOT NULL DEFAULT 0,
  "status" "FundingStatus" NOT NULL DEFAULT 'PENDING',
  "proofObjectKey" TEXT,
  "reviewedById" TEXT,
  "reviewReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "VirtualAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "gateway" TEXT NOT NULL,
  "gatewayAccountId" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Beneficiary" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "networkCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ReferralEarning" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "referrerId" TEXT NOT NULL,
  "refereeId" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "amountKobo" BIGINT NOT NULL,
  "reference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ApiKey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "ipWhitelist" TEXT[],
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Setting" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "refreshHash" TEXT NOT NULL,
  "authVersion" INTEGER NOT NULL,
  "userAgent" TEXT NOT NULL,
  "ipHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "OtpCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "OutboxEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");

CREATE UNIQUE INDEX "User_phone_key" ON "User" ("phone");

CREATE UNIQUE INDEX "User_referralCode_key" ON "User" ("referralCode");

CREATE INDEX "User_status_createdAt_idx" ON "User" ("status", "createdAt");

CREATE INDEX "User_referredById_idx" ON "User" ("referredById");

CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet" ("userId");

CREATE UNIQUE INDEX "LedgerEntry_reference_key" ON "LedgerEntry" ("reference");

CREATE INDEX "LedgerEntry_walletId_createdAt_idx" ON "LedgerEntry" ("walletId", "createdAt");

CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction" ("reference");

CREATE UNIQUE INDEX "Transaction_userId_idempotencyKey_key" ON "Transaction" ("userId", "idempotencyKey");

CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction" ("userId", "createdAt");

CREATE INDEX "Transaction_status_createdAt_idx" ON "Transaction" ("status", "createdAt");

CREATE INDEX "Transaction_phone_idx" ON "Transaction" ("phone");

CREATE UNIQUE INDEX "Network_code_key" ON "Network" ("code");

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan" ("code");

CREATE INDEX "Plan_networkId_active_idx" ON "Plan" ("networkId", "active");

CREATE UNIQUE INDEX "Provider_code_key" ON "Provider" ("code");

CREATE UNIQUE INDEX "ProviderPlanMap_planId_providerId_key" ON "ProviderPlanMap" ("planId", "providerId");

CREATE UNIQUE INDEX "ProviderAttempt_reference_key" ON "ProviderAttempt" ("reference");

CREATE INDEX "ProviderAttempt_transactionId_idx" ON "ProviderAttempt" ("transactionId");

CREATE INDEX "ProviderAttempt_status_createdAt_idx" ON "ProviderAttempt" ("status", "createdAt");

CREATE UNIQUE INDEX "FundingTransaction_reference_key" ON "FundingTransaction" ("reference");

CREATE UNIQUE INDEX "FundingTransaction_gateway_gatewayReference_key" ON "FundingTransaction" ("gateway", "gatewayReference");

CREATE INDEX "FundingTransaction_userId_createdAt_idx" ON "FundingTransaction" ("userId", "createdAt");

CREATE INDEX "FundingTransaction_status_createdAt_idx" ON "FundingTransaction" ("status", "createdAt");

CREATE UNIQUE INDEX "VirtualAccount_gateway_gatewayAccountId_key" ON "VirtualAccount" ("gateway", "gatewayAccountId");

CREATE INDEX "VirtualAccount_userId_idx" ON "VirtualAccount" ("userId");

CREATE UNIQUE INDEX "Beneficiary_userId_phone_key" ON "Beneficiary" ("userId", "phone");

CREATE UNIQUE INDEX "ReferralEarning_reference_key" ON "ReferralEarning" ("reference");

CREATE UNIQUE INDEX "ReferralEarning_refereeId_trigger_key" ON "ReferralEarning" ("refereeId", "trigger");

CREATE INDEX "ReferralEarning_referrerId_createdAt_idx" ON "ReferralEarning" ("referrerId", "createdAt");

CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey" ("keyHash");

CREATE INDEX "ApiKey_userId_idx" ON "ApiKey" ("userId");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt");

CREATE UNIQUE INDEX "SupportTicket_reference_key" ON "SupportTicket" ("reference");

CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket" ("status", "createdAt");

CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket" ("userId");

CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog" ("actorId", "createdAt");

CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog" ("entityType", "entityId");

CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session" ("refreshHash");

CREATE INDEX "Session_userId_revokedAt_idx" ON "Session" ("userId", "revokedAt");

CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");

CREATE INDEX "OtpCode_userId_purpose_createdAt_idx" ON "OtpCode" ("userId", "purpose", "createdAt");

CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode" ("expiresAt");

CREATE UNIQUE INDEX "OutboxEvent_dedupeKey_key" ON "OutboxEvent" ("dedupeKey");

CREATE INDEX "OutboxEvent_deliveredAt_availableAt_idx" ON "OutboxEvent" ("deliveredAt", "availableAt");

ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_fundingTransactionId_fkey" FOREIGN KEY ("fundingTransactionId") REFERENCES "FundingTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Plan" ADD CONSTRAINT "Plan_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderPlanMap" ADD CONSTRAINT "ProviderPlanMap_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderPlanMap" ADD CONSTRAINT "ProviderPlanMap_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderAttempt" ADD CONSTRAINT "ProviderAttempt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderAttempt" ADD CONSTRAINT "ProviderAttempt_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FundingTransaction" ADD CONSTRAINT "FundingTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralEarning" ADD CONSTRAINT "ReferralEarning_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralEarning" ADD CONSTRAINT "ReferralEarning_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Database constraints and append-only ledger protection.
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_balance_nonnegative" CHECK ("balanceKobo" >= 0), ADD CONSTRAINT "Wallet_currency_ngn" CHECK (currency = 'NGN');
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "Ledger_balances_valid" CHECK ("balanceBeforeKobo" >= 0 AND "balanceAfterKobo" >= 0 AND "balanceAfterKobo" = "balanceBeforeKobo" + "amountKobo" AND "amountKobo" <> 0);
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_prices_nonnegative" CHECK ("costKobo" >= 0 AND "customerPriceKobo" >= 0 AND "agentPriceKobo" >= 0 AND "sizeMb" > 0 AND "validityDays" > 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_money_valid" CHECK ("amountKobo" >= 0 AND "costKobo" >= 0 AND "profitKobo" = "amountKobo" - "costKobo");
ALTER TABLE "FundingTransaction" ADD CONSTRAINT "Funding_money_valid" CHECK ("amountKobo" > 0 AND "feeKobo" >= 0 AND "feeKobo" <= "amountKobo");
CREATE FUNCTION hotdata_reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable';
END;
$$;
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION hotdata_reject_ledger_mutation();

