import { z } from "zod";
import { pinSchema } from "./auth";
export const koboSchema = z.string().regex(/^[1-9]\d{0,14}$/, "Enter a positive integer amount in kobo.");
export const fundingSchema = z.object({ amountKobo: koboSchema, idempotencyKey: z.string().uuid() });
export const virtualAccountSchema = z.object({ consent: z.literal(true) });
export const manualFundingSchema = fundingSchema.extend({ proofToken: z.string().min(20).max(2000) });
export const fundingReviewSchema = z.object({ fundingId: z.string().min(1).max(64), decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().trim().min(5).max(500), confirmedReceipt: z.boolean().default(false), bankReference: z.string().trim().min(6).max(100).optional() }).refine(input => input.decision !== "APPROVE" || input.confirmedReceipt, { message: "Confirm receipt of the actual funds before approval.", path: ["confirmedReceipt"] });
export const transferSchema = z.object({ recipientPhone: z.string().min(10).max(24), amountKobo: koboSchema, pin: pinSchema, idempotencyKey: z.string().uuid() });
export const adjustmentSchema = z.object({ userId: z.string().min(1).max(64), amountKobo: koboSchema, direction: z.enum(["CREDIT", "DEBIT"]), reason: z.string().trim().min(5).max(500), idempotencyKey: z.string().uuid() });
