import { z } from "zod";
const schema = z.object({
  APP_URL: z.url(), DATABASE_URL: z.string().min(1), REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(43), JWT_REFRESH_SECRET: z.string().min(43),
  JWT_ISSUER: z.string().default("hotdata"), JWT_AUDIENCE: z.string().default("hotdata-web"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(2592000),
  CORS_ALLOWED_ORIGINS: z.string().default(""),
  AUTH_CODE_SECRET: z.string().min(43), IP_HASH_SECRET: z.string().min(43),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});
let cached: z.infer<typeof schema> | undefined;
export function config() {
  if (!cached) {
    cached = schema.parse(process.env);
    if (cached.JWT_ACCESS_SECRET === cached.JWT_REFRESH_SECRET) throw new Error("JWT secrets must differ.");
    if (process.env.NODE_ENV === "production" && new URL(cached.APP_URL).protocol !== "https:") throw new Error("Production APP_URL requires HTTPS.");
  }
  return cached;
}
