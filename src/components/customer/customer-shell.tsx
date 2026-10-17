"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { authRequest } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
export type CustomerUser = { fullName: string; email: string; phone: string; role: string; emailVerified: boolean; hasPin: boolean };
const UserContext = createContext<CustomerUser | null>(null);
export function useCustomerUser() { const user = useContext(UserContext); if (!user) throw new Error("Customer shell missing."); return user; }
const links = [
  { href: "/dashboard", label: "Overview", icon: "▦" }, { href: "/buy-data", label: "Buy data", icon: "◉" },
  { href: "/buy-airtime", label: "Buy airtime", icon: "☎" },
  { href: "/wallet", label: "My wallet", icon: "⇄" }, { href: "/history", label: "History", icon: "◷" },
  { href: "/beneficiaries", label: "Beneficiaries", icon: "♧" }, { href: "/notifications", label: "Notifications", icon: "◇" },
  { href: "/referrals", label: "Referrals", icon: "♧" }, { href: "/agent", label: "Agent workspace", icon: "↗" },
  { href: "/profile", label: "My account", icon: "○" },
];
export function CustomerShell({ user, children }: { user: CustomerUser; children: React.ReactNode }) {
  const pathname = usePathname(), router = useRouter(); const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const active = (href: string) => pathname === href || (href === "/agent" && pathname.startsWith("/agent/")) || (href === "/profile" && pathname === "/security") || (href === "/history" && pathname.startsWith("/receipts/"));
  const navLink = (link: typeof links[number], mobile = false) => <Link key={link.href} href={link.href} aria-current={active(link.href) ? "page" : undefined} className={(mobile ? "flex min-h-12 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] " : "flex min-h-12 items-center gap-3 rounded-button px-4 py-3 text-sm ") + (active(link.href) ? "bg-brand-tint font-semibold text-brand-deep" : "text-muted hover:bg-brand-tint")}><span aria-hidden="true" className="text-xl">{link.icon}</span>{mobile && link.href === "/dashboard" ? "Home" : mobile && link.href === "/profile" ? "Account" : mobile && link.href === "/buy-data" ? "Data" : mobile && link.href === "/buy-airtime" ? "Airtime" : mobile && link.href === "/wallet" ? "Wallet" : link.label}</Link>;
  async function logout() { if (busy) return; setBusy(true); try { await authRequest("logout"); router.replace("/login"); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Try again."); } finally { setBusy(false); } }
  return <UserContext.Provider value={user}><div className="min-h-screen bg-slate-50">
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-canvas p-5 lg:flex"><Link href="/dashboard" className="mb-9 mt-3"><img src="/logo.svg" alt="Hotdata" width="150" height="38" /></Link><nav aria-label="Customer navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto">{links.map(l => navLink(l))}</nav><div className="mt-auto rounded-card bg-brand-tint p-4"><strong className="text-sm">A little help goes a long way.</strong><p className="mt-2 text-xs leading-5 text-muted">Our support team is here when you need a hand.</p><Link href="/support" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark">Get help →</Link></div><Button variant="outline" onClick={logout} disabled={busy} className="mt-4">{busy ? "Signing out…" : "Sign out"}</Button></aside>
    <div className="lg:ml-60"><header className="flex min-h-20 items-center justify-between gap-3 border-b border-line bg-canvas px-4 sm:px-8"><Link href="/dashboard" className="lg:hidden"><img src="/logo.svg" alt="Hotdata" width="125" height="34" /></Link><span className="hidden text-sm text-muted lg:block">Your everyday connection.</span><div className="flex items-center gap-3">{["CUSTOMER","AGENT"].includes(user.role)&&<Link href="/agent" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark">Agents</Link>}{["ADMIN","SUPER_ADMIN"].includes(user.role)&&<Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark">Admin</Link>}<Link href="/notifications" aria-label="Open notifications" className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-xl">◇</Link><Link href="/profile" className="inline-flex min-h-11 items-center gap-3"><span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand-deep">{user.fullName.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("")}</span><span className="hidden text-sm font-semibold sm:block">{user.fullName}</span></Link></div></header><div className="mx-auto max-w-6xl px-4 py-7 pb-28 sm:px-8 lg:py-10">{error && <p role="alert" className="mb-4 text-sm text-red-800">{error}</p>}{children}</div></div>
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-canvas pb-[max(8px,env(safe-area-inset-bottom))] pt-1 lg:hidden">{links.filter(l => ["/dashboard", "/buy-data", "/buy-airtime", "/wallet", "/history", "/profile"].includes(l.href)).map(l => navLink(l, true))}</nav>
  </div></UserContext.Provider>;
}
