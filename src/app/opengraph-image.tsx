import { ImageResponse } from "next/og";
import { tokens } from "@/lib/design-tokens";
export const runtime = "nodejs";
export const alt = "Hotdata: Cheap data. Instant delivery.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() { return new ImageResponse(<div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", background: tokens.colors.tint, padding: 80, color: tokens.colors.text }}><div style={{ display: "flex", color: tokens.colors.dark, fontSize: 40, fontWeight: 700 }}>Hotdata</div><div style={{ display: "flex", marginTop: 42, fontSize: 82, fontWeight: 700, letterSpacing: -3 }}>More data.</div><div style={{ display: "flex", fontSize: 82, fontWeight: 700, color: tokens.colors.dark, letterSpacing: -3 }}>More possibility.</div><div style={{ display: "flex", marginTop: 35, fontSize: 28 }}>Cheap data. Instant delivery.</div><div style={{ display: "flex", marginTop: 25, fontSize: 20 }}>MTN · Airtel · Glo · 9mobile</div></div>, size); }
