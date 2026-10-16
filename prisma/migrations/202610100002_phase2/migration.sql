ALTER TABLE "User" ADD COLUMN "virtualAccountConsentAt" TIMESTAMP(3);
ALTER TABLE "FundingTransaction" ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "requestHash" TEXT, ADD COLUMN "checkoutUrl" TEXT, ADD COLUMN "payerEmail" TEXT, ADD COLUMN "reviewRequired" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "FundingTransaction_userId_idempotencyKey_key" ON "FundingTransaction"("userId", "idempotencyKey");
-- Phase 1 never provisioned accounts; refuse to invent missing customer ownership.
ALTER TABLE "VirtualAccount" ADD COLUMN "gatewayCustomerCode" TEXT NOT NULL, ADD COLUMN "providerSlug" TEXT NOT NULL;
CREATE UNIQUE INDEX "VirtualAccount_gateway_gatewayCustomerCode_key" ON "VirtualAccount"("gateway", "gatewayCustomerCode");
CREATE UNIQUE INDEX "VirtualAccount_gateway_accountNumber_key" ON "VirtualAccount"("gateway", "accountNumber");
CREATE UNIQUE INDEX "VirtualAccount_userId_gateway_key" ON "VirtualAccount"("userId", "gateway");
-- Every wallet balance update must be backed by a ledger entry in the same transaction.
CREATE FUNCTION hotdata_require_wallet_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."balanceKobo" <> OLD."balanceKobo" AND NOT EXISTS (
    SELECT 1 FROM "LedgerEntry" WHERE "walletId" = NEW.id
      AND "balanceBeforeKobo" = OLD."balanceKobo" AND "balanceAfterKobo" = NEW."balanceKobo"
      AND xmin::text::bigint = (txid_current() % 4294967296)
  ) THEN RAISE EXCEPTION 'Wallet balance update requires a matching ledger entry'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER wallet_ledger_required AFTER UPDATE ON "Wallet" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hotdata_require_wallet_ledger();

CREATE FUNCTION hotdata_zero_initial_wallet() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."balanceKobo" <> 0 THEN RAISE EXCEPTION 'Wallets must start at zero'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER wallet_zero_initial_balance BEFORE INSERT ON "Wallet" FOR EACH ROW EXECUTE FUNCTION hotdata_zero_initial_wallet();

CREATE UNIQUE INDEX "FundingTransaction_proofObjectKey_key" ON "FundingTransaction"("proofObjectKey");
