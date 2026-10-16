export const tokens = {
  colors: {
    primary: "#16A34A", dark: "#15803D", deep: "#14532D",
    tint: "#F0FDF4", accent: "#DCFCE7", white: "#FFFFFF",
    text: "#0F172A", muted: "#64748B", border: "#E2E8F0",
    success: "#16A34A", pending: "#F59E0B", failed: "#DC2626", info: "#2563EB",
    network: { mtn: "#FFCB05", airtel: "#E60000", glo: "#008A3E", nineMobile: "#133A26" },
  },
  radius: { card: "12px", button: "10px" },
  shadow: { card: "0 8px 30px rgb(15 23 42 / 0.06)" },
  font: ["Inter", "system-ui", "sans-serif"],
} as const;
