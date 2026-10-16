import { HttpError } from "../security/http";
import type { PaymentGateway, VerifiedPayment, VirtualAccountResult } from "./types";
export class FlutterwaveGateway implements PaymentGateway {
  readonly name = "flutterwave";
  async initialize(): Promise<{ checkoutUrl: string }> { throw new HttpError(503, "flutterwave adapter is not enabled."); }
  async verify(): Promise<VerifiedPayment> { throw new HttpError(503, "flutterwave adapter is not enabled."); }
  async createVirtualAccount(): Promise<VirtualAccountResult> { throw new HttpError(503, "flutterwave adapter is not enabled."); }
  verifyWebhook(): boolean { return false; }
}
