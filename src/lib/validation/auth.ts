import { z } from "zod";
export function normalizeNigerianPhone(input: string): string {
  let value = input.replace(/[\s()-]/g, "");
  if (value.startsWith("+234")) value = "0" + value.slice(4);
  else if (value.startsWith("234")) value = "0" + value.slice(3);
  if (!/^0(?:70|80|81|90|91)\d{8}$/.test(value)) throw new Error("Enter a valid Nigerian mobile number.");
  return "+234" + value.slice(1);
}
export const phoneSchema = z.string().min(10).max(24).transform((input, ctx) => {
  try { return normalizeNigerianPhone(input); }
  catch { ctx.addIssue({ code: "custom", message: "Enter a valid Nigerian mobile number." }); return z.NEVER; }
});
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128);
export const pinSchema = z.string().regex(/^\d{4}$/, "Enter a four-digit PIN.");
const email = z.email().max(254).transform(value => value.toLowerCase().trim());
export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100), email, phone: phoneSchema,
  password: passwordSchema, consent: z.literal(true, { error: "Please accept the privacy consent." }),
  referralCode: z.string().trim().max(32).optional(),
});
export const loginSchema = z.object({ identifier: z.string().trim().min(3).max(254), password: z.string().min(1).max(128) });
export const forgotSchema = z.object({ email });
export const verifySchema = z.object({ purpose: z.enum(["EMAIL_VERIFICATION", "PHONE_VERIFICATION"]), code: z.string().regex(/^\d{6}$/) });
export const requestOtpSchema = verifySchema.pick({ purpose: true });
export const resetSchema = z.object({ email, code: z.string().regex(/^\d{6}$/), password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), password: passwordSchema });
export const setPinSchema = z.object({ password: z.string().min(1).max(128), pin: pinSchema, currentPin: pinSchema.optional() });
export const revokeSchema = z.object({ sessionId: z.string().min(1).max(64) });
