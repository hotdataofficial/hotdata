import { z } from "zod";
import { phoneSchema } from "./auth";
export const beneficiarySchema = z.object({ name: z.string().trim().min(2).max(80), phone: phoneSchema, networkCode: z.enum(["MTN", "AIRTEL", "GLO", "9MOBILE"]).optional() }).strict();
export const historyQuerySchema = z.object({
  purchaseType: z.enum(["DATA", "AIRTIME"]).optional(),
  status: z.enum(["PENDING", "SUCCESSFUL", "FAILED"]).optional(),
  network: z.enum(["MTN", "AIRTEL", "GLO", "9MOBILE"]).optional(),
  search: z.string().trim().max(100).default(""),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cursor: z.string().min(1).max(64).optional(),
}).refine(v => !v.from || !v.to || v.from <= v.to, "The start date must come before the end date.");
export const savedPurchaseSchema = z.object({ planId: z.string().min(1).max(64), phone: phoneSchema, idempotencyKey: z.uuid(), quotedPriceKobo: z.string().regex(/^[1-9]\d{0,14}$/).optional(), planName: z.string().max(100).optional(), networkCode: z.string().max(40).optional(), planType: z.string().max(40).optional() }).strict();
export type SavedPurchase = z.infer<typeof savedPurchaseSchema>;
