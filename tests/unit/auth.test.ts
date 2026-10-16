import { describe, expect, it } from "vitest";
import { normalizeNigerianPhone, registerSchema, passwordSchema, pinSchema } from "../../src/lib/validation/auth";
import { hashSecret, verifySecret, safeEqual } from "../../src/server/security/crypto";
import { hasRole } from "../../src/server/auth/rbac";
describe("account input and security", () => {
  it.each(["08012345678", "+2348012345678", "2348012345678", "0801 234 5678"])("normalizes %s", input => expect(normalizeNigerianPhone(input)).toBe("+2348012345678"));
  it.each(["08112345678", "07012345678", "09012345678", "09112345678"])("accepts Nigerian prefixes %s", input => expect(normalizeNigerianPhone(input)).toBe("+234" + input.slice(1)));
  it.each(["+18012345678", "080123", "02012345678", "080123456789"])("rejects %s", input => expect(() => normalizeNigerianPhone(input)).toThrow());
  it("requires recorded consent and a strong length", () => {
    expect(registerSchema.safeParse({ fullName: "Test User", email: "user@example.com", phone: "08012345678", password: "long-test-password", consent: false }).success).toBe(false);
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(pinSchema.safeParse("0123").success).toBe(true);
    expect(pinSchema.safeParse("12345").success).toBe(false);
  });
  it("uses salted Argon2 for password and PIN", async () => {
    const a = await hashSecret("0123"); const b = await hashSecret("0123");
    expect(a).not.toBe(b); expect(a).toContain("argon2id");
    expect(await verifySecret(a, "0123")).toBe(true); expect(await verifySecret(a, "9876")).toBe(false);
  });
  it("compares secrets and enforces exact role allowlists", () => {
    expect(safeEqual("abc", "abc")).toBe(true); expect(safeEqual("a", "ab")).toBe(false);
    expect(hasRole("CUSTOMER", ["ADMIN", "SUPER_ADMIN"])).toBe(false);
    expect(hasRole("ADMIN", ["SUPER_ADMIN"])).toBe(false);
    expect(hasRole("SUPER_ADMIN", ["ADMIN", "SUPER_ADMIN"])).toBe(true);
  });
});
