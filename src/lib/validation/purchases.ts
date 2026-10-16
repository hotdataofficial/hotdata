import { z } from "zod";
import { phoneSchema, pinSchema } from "./auth";
export const purchaseSchema = z.object({ planId: z.string().min(1).max(64), phone: phoneSchema, pin: pinSchema, expectedPriceKobo: z.string().regex(/^[1-9]\d{0,14}$/).optional(), idempotencyKey: z.uuid() }).strict();
export const planSchema = z.object({
  id: z.string().min(1).max(64).optional(), networkId: z.string().min(1).max(64),
  code: z.string().regex(/^[A-Z0-9_-]{1,64}$/), name: z.string().trim().min(2).max(100),
  type: z.enum(["SME", "GIFTING", "CORPORATE_GIFTING", "DIRECT"]),
  sizeMb: z.number().int().positive().max(1000000), validityDays: z.number().int().positive().max(365),
  costKobo: z.string().regex(/^[1-9]\d{0,14}$/), customerPriceKobo: z.string().regex(/^[1-9]\d{0,14}$/),
  agentPriceKobo: z.string().regex(/^[1-9]\d{0,14}$/), active: z.boolean(),
}).strict().refine(v => BigInt(v.customerPriceKobo) >= BigInt(v.costKobo) && BigInt(v.agentPriceKobo) >= BigInt(v.costKobo), "Selling prices must cover cost.");
export const mappingSchema = z.object({ planId: z.string().min(1).max(64), providerId: z.string().min(1).max(64), providerPlanCode: z.string().trim().min(1).max(100), active: z.boolean() }).strict();
