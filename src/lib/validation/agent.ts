import { z } from "zod";
import { phoneSchema, pinSchema } from "./auth";
export const apiKeySchema=z.object({name:z.string().trim().min(2).max(60),ipWhitelist:z.array(z.union([z.ipv4(),z.ipv6()])).max(10).default([]),callbackUrl:z.union([z.url().max(300).refine(value=>{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==="443");},"Use a public HTTPS URL on port 443, without credentials or a fragment."),z.literal("")]).default(""),pin:pinSchema}).strict();
export const revokeKeySchema=z.object({id:z.string().min(1).max(64)}).strict();
export const bulkRowSchema=z.object({planId:z.string().min(1).max(64),phone:phoneSchema,expectedPriceKobo:z.string().regex(/^[1-9]\d{0,14}$/).optional()}).strict();
export const bulkQuoteSchema=z.object({rows:z.array(bulkRowSchema).min(1).max(50)}).strict();
export const bulkPurchaseSchema=z.object({rows:z.array(bulkRowSchema.extend({expectedPriceKobo:z.string().regex(/^[1-9]\d{0,14}$/)})).min(1).max(50),pin:pinSchema,idempotencyKey:z.uuid()}).strict();
export const upgradeSchema=z.discriminatedUnion("action",[z.object({action:z.literal("request"),reason:z.string().trim().min(10).max(500)}).strict(),z.object({action:z.literal("pay"),pin:pinSchema,expectedFeeKobo:z.string().regex(/^[1-9]\d{0,14}$/),idempotencyKey:z.uuid()}).strict()]);
