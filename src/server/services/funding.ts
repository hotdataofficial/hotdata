import { referralQualification } from "./referrals";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { config } from "../config";
import { lockUser } from "../auth/accounts";
import { HttpError } from "../security/http";
import { moveMoney } from "./wallet";
import { fundingSettings, validateFundingAmount } from "./funding-settings";
import { fundingFee, formatKobo } from "@/lib/money";
import { paymentGateway } from "../payments";
import type { PaymentGateway, VerifiedPayment } from "../payments/types";
export async function fundingNotification(tx: Prisma.TransactionClient, input: { id: string; userId: string; email: string; amountKobo: bigint; feeKobo: bigint; reference: string }) {
  await referralQualification(tx,input.userId,"FIRST_FUNDING",input.id);
  await tx.notification.create({ data: { userId: input.userId, title: "Wallet funded", body: "Your wallet received " + formatKobo(input.amountKobo - input.feeKobo) + ". Reference: " + input.reference } });
  await tx.outboxEvent.create({ data: { kind: "EMAIL_FUNDING", dedupeKey: "funding-email:" + input.id, payload: { email: input.email, amountKobo: input.amountKobo.toString(), feeKobo: input.feeKobo.toString(), reference: input.reference } } });
}
export async function initializeFunding(userId: string, amountKobo: bigint, idempotencyKey: string, gateway: PaymentGateway = paymentGateway()) {
  const settings = await fundingSettings(); const feeKobo = validateFundingAmount(amountKobo, settings);
  const requestHash = createHash("sha256").update(gateway.name + ":" + amountKobo).digest("hex");
  const funding = await db.$transaction(async tx => {
    const user = await lockUser(tx, userId);
    
    const prior = await tx.fundingTransaction.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (prior) { if (prior.requestHash !== requestHash) throw new HttpError(409, "This request key was already used for another amount."); return prior; }
    return tx.fundingTransaction.create({ data: { userId, reference: "HD-F-" + randomUUID(), gateway: gateway.name, gatewayReference: null, idempotencyKey, requestHash, payerEmail: user.email, amountKobo, feeKobo } });
  });
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "FundingTransaction" WHERE id = ${funding.id} FOR UPDATE`;
    const row = await tx.fundingTransaction.findUniqueOrThrow({ where: { id: funding.id } });
    if (row.status === "SUCCESSFUL") return { reference: row.reference, checkoutUrl: null, status: row.status };
    if (row.status !== "PENDING") throw new HttpError(409, "This funding request is no longer pending.");
    if (row.checkoutUrl) return { reference: row.reference, checkoutUrl: row.checkoutUrl, status: row.status };
    const result = await gateway.initialize({ reference: row.reference, email: row.payerEmail!, amountKobo: row.amountKobo, callbackUrl: config().APP_URL + "/wallet?reference=" + encodeURIComponent(row.reference) });
    await tx.fundingTransaction.update({ where: { id: row.id }, data: { checkoutUrl: result.checkoutUrl } });
    return { reference: row.reference, checkoutUrl: result.checkoutUrl, status: row.status };
  }, { timeout: 15000 });
}
export async function provisionVirtualAccount(userId: string, gateway: PaymentGateway = paymentGateway()) {
  // Persist explicit consent before transmitting customer details to the gateway.
  await db.$transaction(async tx => {
    const user = await lockUser(tx, userId);
    
    await tx.user.update({ where: { id: userId }, data: { virtualAccountConsentAt: new Date() } });
  });
  return db.$transaction(async tx => {
    const user = await lockUser(tx, userId);
    
    const existing = await tx.virtualAccount.findUnique({ where: { userId_gateway: { userId, gateway: gateway.name } } });
    if (existing?.active) return existing;
    if (existing) throw new HttpError(409, "Your bank account is inactive. Contact support.");
    await tx.user.update({ where: { id: userId }, data: { virtualAccountConsentAt: new Date() } });
    const account = await gateway.createVirtualAccount({ email: user.email, fullName: user.fullName, phone: user.phone });
    return tx.virtualAccount.create({ data: { userId, gateway: gateway.name, gatewayAccountId: account.gatewayAccountId, gatewayCustomerCode: account.customerCode, providerSlug: account.providerSlug, accountNumber: account.accountNumber, accountName: account.accountName, bankName: account.bankName } });
  }, { timeout: 40000 });
}
export async function settleVerifiedPayment(payment: VerifiedPayment, gatewayName = "paystack") {
  if (payment.status !== "success") return { status: "PENDING", credited: false };
  if (payment.currency !== "NGN" || payment.amountKobo <= 0n) throw new HttpError(409, "Unsupported payment currency or amount.");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${gatewayName + ":" + payment.reference}, 0))`;
    let row = await tx.fundingTransaction.findFirst({ where: { OR: [{ gateway: gatewayName, gatewayReference: payment.reference }, { gateway: gatewayName, reference: payment.reference }] } });
    if (!row) {
      if (payment.channel !== "dedicated_nuban") throw new HttpError(409, "Unknown funding reference.");
      const account = await tx.virtualAccount.findUnique({ where: { gateway_gatewayCustomerCode: { gateway: gatewayName, gatewayCustomerCode: payment.customerCode } }, include: { user: true } });
      if (!account || !account.active || (payment.receiverAccount && payment.receiverAccount !== account.accountNumber)) throw new HttpError(409, "Virtual account ownership could not be verified.");
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${account.userId} FOR UPDATE`;
      const settings = await fundingSettings(tx);
      let feeKobo = 0n; let reviewRequired = payment.amountKobo < settings.minimum || payment.amountKobo > settings.maximum || account.user.status !== "ACTIVE" || !!account.user.deletedAt;
      try { feeKobo = fundingFee(payment.amountKobo, settings.flat, settings.bps); } catch { reviewRequired = true; }
      row = await tx.fundingTransaction.create({ data: { userId: account.userId, gateway: gatewayName, gatewayReference: payment.reference, reference: "HD-DVA-" + randomUUID(), payerEmail: payment.email, amountKobo: payment.amountKobo, feeKobo, reviewRequired } });
    }
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${row.userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "FundingTransaction" WHERE id = ${row.id} FOR UPDATE`;
    row = await tx.fundingTransaction.findUniqueOrThrow({ where: { id: row.id } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: row.userId } });
    if (row.amountKobo !== payment.amountKobo || row.payerEmail !== payment.email || row.gateway !== gatewayName) throw new HttpError(409, "Verified payment does not match the funding request.");
    if (row.status === "SUCCESSFUL") return { status: row.status, credited: false };
    if (row.status !== "PENDING") throw new HttpError(409, "Funding status requires administrator review.");
    const needsReview = row.reviewRequired || user.status !== "ACTIVE" || !!user.deletedAt;
    if (needsReview) {
      await tx.fundingTransaction.update({ where: { id: row.id }, data: { reviewRequired: true, gatewayReference: payment.reference } });
      return { status: "UNDER_REVIEW", credited: false };
    }
    await moveMoney(tx, row.userId, row.amountKobo, "FUNDING", "funding:" + row.id, "Wallet funding", { fundingTransactionId: row.id });
    if (row.feeKobo > 0n) await moveMoney(tx, row.userId, -row.feeKobo, "FEE", "funding-fee:" + row.id, "Funding fee", { fundingTransactionId: row.id });
    await tx.fundingTransaction.update({ where: { id: row.id }, data: { status: "SUCCESSFUL", gatewayReference: payment.reference } });
    await fundingNotification(tx, { ...row, email: user.email });
    return { status: "SUCCESSFUL", credited: true };
  }, { timeout: 15000 });
}
export async function verifyOwnFunding(userId: string, reference: string) {
  const row = await db.fundingTransaction.findUnique({ where: { reference } });
  if (!row || row.userId !== userId || !["paystack", "korapay"].includes(row.gateway)) throw new HttpError(404, "Funding request not found.");
  const payment = await paymentGateway(row.gateway).verify(row.gatewayReference || row.reference);
  return settleVerifiedPayment(payment, row.gateway);
}
