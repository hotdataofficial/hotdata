import Link from "next/link";
import { publicAdminSettings } from "@/server/services/admin-settings";
import { publicSite } from "@/lib/public-site";
export async function ContactOptions({ privacy = false }: { privacy?: boolean }) {
  const settings = await publicAdminSettings(); const site = { ...publicSite(), email: settings.supportEmail, whatsapp: settings.supportWhatsApp, hours: settings.supportHours }; const email = privacy ? site.privacyEmail : site.email;
  return <div className="space-y-4">{email ? <a href={"mailto:" + email + (privacy ? "?subject=Privacy%20request" : "")} className="block min-h-11 rounded-button border border-line bg-white px-4 py-3 font-semibold text-brand-dark">{email}</a> : <p className="rounded-card bg-brand-tint p-4 text-sm">Contact details are being configured. Public service has not launched yet.</p>}{!privacy && site.whatsapp && <a href={"https://wa.me/" + site.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-button bg-brand-dark px-5 font-semibold text-white">Chat on WhatsApp ↗</a>}{!privacy && site.hours && <p className="text-sm text-muted">Support hours: {site.hours}</p>}{privacy && <Link href="/security" className="inline-flex min-h-11 items-center font-semibold text-brand-dark">Request account deletion in account security →</Link>}</div>;
}
