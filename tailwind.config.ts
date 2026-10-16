import type { Config } from "tailwindcss";
import { tokens } from "./src/lib/design-tokens";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      brand: { DEFAULT: tokens.colors.primary, dark: tokens.colors.dark, deep: tokens.colors.deep, tint: tokens.colors.tint, accent: tokens.colors.accent },
      canvas: tokens.colors.white, ink: tokens.colors.text, muted: tokens.colors.muted,
      line: tokens.colors.border,
      status: { success: tokens.colors.success, pending: tokens.colors.pending, failed: tokens.colors.failed, info: tokens.colors.info },
      network: tokens.colors.network,
    },
    fontFamily: { sans: [...tokens.font] },
    borderRadius: tokens.radius,
    boxShadow: tokens.shadow,
  } },
  plugins: [],
} satisfies Config;
