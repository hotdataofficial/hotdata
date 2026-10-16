import type { Metadata, Viewport } from "next";
import { PublicHeader, PublicFooter } from "@/components/customer/site-chrome";
import { publicSite } from "@/lib/public-site";
import { publicAdminSettings } from "@/server/services/admin-settings";
import "./globals.css";
import { PwaControls } from "@/components/pwa-controls";
export const viewport: Viewport = { themeColor: "#15803D", width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";
export function generateMetadata(): Metadata {
  const site = publicSite();
  return { metadataBase: new URL(site.origin), title: { default: "Hotdata — Cheap data. Instant delivery.", template: "%s | Hotdata" }, description: "Compare Nigerian mobile data plans for MTN, Airtel, Glo and 9mobile. Buy from your Hotdata wallet and keep clear receipts.", robots: { index: false, follow: false }, manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "Hotdata", statusBarStyle: "default" }, icons: { icon: "/logo.svg", apple: "/icons/icon-192.png" } };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await publicAdminSettings();
  return <html lang="en-NG"><body><a href="#main" className="sr-only z-50 bg-canvas p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a><PwaControls /><PublicHeader name={settings.siteName} logo={settings.logoUrl} /><main id="main" className="min-h-[75vh]">{children}</main><PublicFooter name={settings.siteName} /></body></html>;
}
