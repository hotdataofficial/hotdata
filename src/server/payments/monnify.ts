import { HttpError } from "../security/http";
import type { PaymentGateway, VerifiedPayment, VirtualAccountResult } from "./types";
export class MonnifyGateway implements PaymentGateway {
  readonly name = "monnify";
  async initialize(): Promise<{ checkoutUrl: string }> { throw new HttpError(503, "monnify adapter is not enabled."); }
  async verify(): Promise<VerifiedPayment> { throw new HttpError(503, "monnify adapter is not enabled."); }
  async createVirtualAccount(): Promise<VirtualAccountResult> { throw new HttpError(503, "monnify adapter is not enabled."); }
  verifyWebhook(): boolean { return false; }
}
