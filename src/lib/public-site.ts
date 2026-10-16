import { z } from "zod";
const optionalText = z.string().trim().max(300).default("");
const schema = z.object({
  APP_URL: z.url().default("http://localhost:3000"),
  PUBLIC_SITE_LIVE: z.enum(["true", "false"]).default("false"),
  PUBLIC_INDEXABLE: z.enum(["true", "false"]).default("false"),
  LEGAL_PUBLISHED: z.enum(["true", "false"]).default("false"),
  BUSINESS_LEGAL_NAME: optionalText, BUSINESS_REGISTRATION_NUMBER: optionalText, BUSINESS_ADDRESS: optionalText,
  SUPPORT_EMAIL: z.union([z.email(), z.literal("")]).default(""),
  SUPPORT_WHATSAPP: z.string().regex(/^(?:\+?\d{10,15})?$/).default(""),
  PRIVACY_EMAIL: z.union([z.email(), z.literal("")]).default(""),
  SUPPORT_HOURS: optionalText,
  PUBLIC_TESTIMONIALS_JSON: z.string().max(10000).default("[]"),
});
const quoteSchema = z.array(z.object({ name: z.string().trim().min(1).max(80), quote: z.string().trim().min(1).max(300), context: z.string().trim().max(80).optional() }).strict()).max(6);
export function publicSite(env: Record<string, string | undefined> = process.env) {
  const settings = schema.parse(env);
  const url = new URL(settings.APP_URL);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("APP_URL must be an HTTP origin without credentials.");
  const legalReady = settings.LEGAL_PUBLISHED === "true" && Boolean(settings.BUSINESS_LEGAL_NAME && settings.BUSINESS_ADDRESS && settings.SUPPORT_EMAIL && settings.PRIVACY_EMAIL);
  if (settings.LEGAL_PUBLISHED === "true" && !legalReady) throw new Error("Published policies require business identity, address, support email and privacy email.");
  if (settings.PUBLIC_SITE_LIVE === "true" && !legalReady) throw new Error("Review and configure legal policies before public launch.");
  const live = settings.PUBLIC_SITE_LIVE === "true";
  const indexable = settings.PUBLIC_INDEXABLE === "true" && live && url.protocol === "https:";
  let testimonials: z.infer<typeof quoteSchema> = [];
  try { testimonials = quoteSchema.parse(JSON.parse(settings.PUBLIC_TESTIMONIALS_JSON)); } catch { /* Invalid quotes are never published. */ }
  return { origin: url.origin, live, indexable, legalReady, legalName: settings.BUSINESS_LEGAL_NAME || "Hotdata (operator details pending)", registration: settings.BUSINESS_REGISTRATION_NUMBER, address: settings.BUSINESS_ADDRESS, email: settings.SUPPORT_EMAIL, privacyEmail: settings.PRIVACY_EMAIL || settings.SUPPORT_EMAIL, whatsapp: settings.SUPPORT_WHATSAPP.replace(/^\+/, ""), hours: settings.SUPPORT_HOURS, testimonials };
}
export const publicPaths = ["/", "/pricing", "/contact", "/terms", "/privacy", "/refunds", "/api-docs"];
