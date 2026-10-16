export type VerifiedPayment = { reference: string; status: string; amountKobo: bigint; currency: string; email: string; customerCode: string; channel: string; receiverAccount?: string; domain: "test" | "live" };
export type VirtualAccountResult = { gatewayAccountId: string; customerCode: string; accountNumber: string; accountName: string; bankName: string; providerSlug: string };
export interface PaymentGateway {
  readonly name: string;
  initialize(input: { reference: string; email: string; amountKobo: bigint; callbackUrl: string }): Promise<{ checkoutUrl: string }>;
  verify(reference: string): Promise<VerifiedPayment>;
  createVirtualAccount(input: { email: string; fullName: string; phone: string }): Promise<VirtualAccountResult>;
  verifyWebhook(rawBody: string, signature: string): boolean;
}
