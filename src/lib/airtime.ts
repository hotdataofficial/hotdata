import { z } from "zod";
import { phoneSchema, pinSchema } from "./validation/auth";

export const airtimeNetworks = ["MTN", "AIRTEL", "GLO", "9MOBILE"] as const;
export const airtimeMinKobo = 10000n;
export const airtimeMaxKobo = 1000000n;
export const airtimeAmount = z.string().regex(/^[1-9]\d{0,6}$/).refine(value => {
  if (!/^[1-9]\d{0,6}$/.test(value)) return false;
  const amount = BigInt(value);
  return amount >= airtimeMinKobo && amount <= airtimeMaxKobo && amount % 100n === 0n;
}, "Choose a whole-naira amount from ₦100 to ₦10,000.");
export const savedAirtimeSchema = z.object({
  networkCode: z.enum(airtimeNetworks), phone: phoneSchema, amountKobo: airtimeAmount,
  idempotencyKey: z.uuid(),
}).strict();
export const airtimePurchaseSchema = savedAirtimeSchema.extend({ pin: pinSchema }).strict();
export type SavedAirtime = z.infer<typeof savedAirtimeSchema>;
export const airtimeSnapshotSchema = z.object({
  name: z.string(), type: z.literal("AIRTIME"), networkCode: z.enum(airtimeNetworks),
  sizeMb: z.literal(0), validityDays: z.literal(0), providerId: z.string().min(1).max(64),
  faceValueKobo: airtimeAmount,
});
