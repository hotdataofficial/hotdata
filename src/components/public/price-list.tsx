"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { formatKobo } from "@/lib/money";
import { planSize, publicPlanType, type PublicCatalog } from "@/lib/public-catalog";
const catalogSchema = z.object({ networks: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })), plans: z.array(z.object({ id: z.string(), networkId: z.string(), name: z.string(), type: z.enum(["SME", "GIFTING", "CORPORATE_GIFTING", "DIRECT"]), sizeMb: z.number().int().positive(), validityDays: z.number().int().positive(), priceKobo: z.string().regex(/^\d+$/), available: z.boolean() })), updatedAt: z.iso.datetime() });
export function PriceList({ compact = false }: { compact?: boolean }) {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null), [network, setNetwork] = useState(""), [type, setType] = useState(""), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const request = useRef(0);
  async function load() {
    const current = ++request.current; setLoading(true); setError("");
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/public/plans", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      if (!response.ok) throw Error(response.status === 429 ? "Prices are busy. Please retry in a minute." : "We couldn’t load current prices. Please try again.");
      const next = catalogSchema.parse(await response.json());
      if (current === request.current) { setCatalog(next); setNetwork(previous => next.networks.some(n => n.id === previous) ? previous : next.networks.find(n => n.code === "MTN")?.id || next.networks[0]?.id || ""); }
    } catch (problem) { if (current === request.current) { setCatalog(null); setError(problem instanceof Error && problem.name !== "AbortError" && !(problem instanceof z.ZodError) ? problem.message : "Prices are temporarily unavailable. Please retry."); } }
    finally { clearTimeout(timer); if (current === request.current) setLoading(false); }
  }
  useEffect(() => { void load(); return () => { request.current++; }; }, []);
  const rows = catalog?.plans.filter(p => p.networkId === network && (!type || p.type === type)) || [];
  const shown = compact ? rows.slice(0, 6) : rows;
  return <div aria-busy={loading}>
    <div className="flex flex-wrap items-end justify-between gap-4"><div role="group" aria-label="Choose network" className="flex flex-wrap gap-2">{catalog?.networks.map(n => <button key={n.id} type="button" aria-pressed={network === n.id} onClick={() => { setNetwork(n.id); setType(""); }} className={"min-h-11 rounded-button border px-5 text-sm font-semibold " + (network === n.id ? "border-brand-dark bg-brand-dark text-white" : "border-line bg-white text-ink")}>{n.name}</button>)}</div><div className="flex items-end gap-3"><label className="text-sm font-medium">Plan type<select value={type} onChange={e => setType(e.target.value)} disabled={!catalog?.networks.length || loading} className="customer-input mt-1 block"><option value="">All types</option>{["SME", "GIFTING", "CORPORATE_GIFTING", "DIRECT"].filter(t => catalog?.plans.some(p => p.networkId === network && p.type === t)).map(t => <option key={t} value={t}>{publicPlanType(t)}</option>)}</select></label><button type="button" disabled={loading} onClick={() => void load()} className="min-h-11 rounded-button border border-line bg-white px-4 text-sm font-semibold disabled:opacity-50">Refresh</button></div></div>
    <p className="mt-4 text-sm text-muted">Customer prices in naira. Your confirmed price is checked again before purchase.</p>
    {loading ? <div role="status" className="mt-6 grid gap-4 sm:grid-cols-3">{[0, 1, 2].map(n => <div key={n} className="h-44 animate-pulse rounded-card bg-brand-tint" />)}<span className="sr-only">Loading current prices</span></div> : error ? <div role="alert" className="mt-6 rounded-card border border-line bg-white p-6"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-4 min-h-11 font-semibold text-brand-dark">Try again →</button></div> : shown.length === 0 ? <div className="mt-6 rounded-card border border-line p-8"><h3 className="font-semibold">{catalog?.networks.length ? "No plans match these filters." : "Our data plans are coming soon."}</h3><p className="mt-2 text-sm text-muted">{catalog?.networks.length ? "Choose another network or plan type to see available options." : "We’re preparing the catalogue. Prices will appear here when plans are ready."}</p></div> : <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map(p => <article key={p.id} className="rounded-card border border-line bg-white p-6 shadow-card"><p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">{publicPlanType(p.type)}</p><h3 className="mt-3 text-3xl font-bold">{planSize(p.sizeMb)}</h3><p className="mt-1 text-sm text-muted">{p.validityDays} {p.validityDays === 1 ? "day" : "days"} · {p.name}</p><p className="mt-5 text-2xl font-bold">{formatKobo(p.priceKobo)}</p>{p.available ? <Link href={"/buy-data?planId=" + encodeURIComponent(p.id)} className="mt-5 flex min-h-11 items-center justify-center rounded-button bg-brand-dark px-4 font-semibold text-white">Choose plan →</Link> : <p className="mt-5 flex min-h-11 items-center rounded-button bg-brand-tint px-3 text-sm font-semibold text-brand-deep">Not available for purchase</p>}</article>)}</div>}
    {catalog && !loading && <p className="mt-4 text-xs text-muted">Checked {new Date(catalog.updatedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })} (Lagos time). Availability can change.</p>}
    {compact && rows.length > 6 && <Link href="/pricing" className="mt-6 inline-flex min-h-11 items-center font-semibold text-brand-dark">See every plan →</Link>}
  </div>;
}
