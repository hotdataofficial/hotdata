import { PaystackGateway } from "./paystack";
import { KorapayGateway } from "./korapay";
import { MonnifyGateway } from "./monnify";
import { FlutterwaveGateway } from "./flutterwave";
import { HttpError } from "../security/http";
import type { PaymentGateway } from "./types";
export function paymentGateway(name = process.env.PAYMENT_GATEWAY || "paystack"): PaymentGateway {
  switch (name) {
    case "korapay": return new KorapayGateway();
    case "paystack": return new PaystackGateway();
    case "monnify": return new MonnifyGateway();
    case "flutterwave": return new FlutterwaveGateway();
    default: throw new HttpError(503, "Unknown payment gateway.");
  }
}
