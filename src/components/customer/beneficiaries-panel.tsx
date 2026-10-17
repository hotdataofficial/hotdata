"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/customer-client";
import { beneficiarySchema } from "@/lib/validation/customer";
import { ErrorMessage, CustomerLoading } from "./shared";
type Beneficiary = { id: string; name: string; phone: string; networkCode: string | null };
export function BeneficiariesPanel() {
  const [items, setItems] = useState<Beneficiary[]>([]), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [network, setNetwork] = useState("");
  async function load() { try { setItems((await apiRequest<{ beneficiaries: Beneficiary[] }>("/api/beneficiaries")).beneficiaries); setLoaded(true); } catch (e) { setError(e instanceof Error ? e.message : "Try again."); } }
  useEffect(() => { void load(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
    try { const input = beneficiarySchema.parse({ name, phone, networkCode: network || undefined }); await apiRequest("/api/beneficiaries", input, "POST"); setName(""); setPhone(""); setNetwork(""); setMessage("Beneficiary saved."); await load(); }
    catch (e) { const v = e as { issues?: { message: string }[]; message?: string }; setError(v.issues?.[0]?.message || v.message || "Try again."); } finally { setBusy(false); }
  }
  async function remove(b: Beneficiary) {
    if (busy || !window.confirm("Remove " + b.name + " from your saved recipients?")) return;
    setBusy(true); setError(""); try { await apiRequest("/api/beneficiaries", { id: b.id }, "DELETE"); await load(); setMessage("Beneficiary removed."); } catch (e) { setError(e instanceof Error ? e.message : "Try again."); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Your everyday people.</h1><p className="mt-2 text-muted">Save recipients for a quicker next purchase.</p></div><ErrorMessage message={error} />{message && <p role="status" className="rounded-card bg-brand-tint p-4 text-sm text-brand-deep">{message}</p>}
    <form onSubmit={save} className="grid gap-4 rounded-card border border-line bg-canvas p-5 sm:grid-cols-2"><h2 className="text-lg font-semibold sm:col-span-2">Save or update a beneficiary</h2><label className="text-sm">Name<input required className="customer-input mt-2" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} autoComplete="off" /></label><label className="text-sm">Phone number<input required className="customer-input mt-2" value={phone} onChange={e => setPhone(e.target.value)} type="tel" maxLength={24} /></label><label className="text-sm">Network (optional)<select className="customer-input mt-2" value={network} onChange={e => setNetwork(e.target.value)}><option value="">Ask each time</option>{["MTN", "AIRTEL", "GLO", "9MOBILE"].map(n => <option key={n}>{n}</option>)}</select></label><Button type="submit" disabled={busy} className="self-end">{busy ? "Saving…" : "Save beneficiary"}</Button><p className="text-xs text-muted sm:col-span-2">Saving an existing phone number updates its name and network. Up to 100 recipients.</p></form>
    {!loaded && !error ? <CustomerLoading /> : <section className="rounded-card border border-line bg-canvas p-5"><h2 className="mb-3 text-lg font-semibold">Saved recipients ({items.length})</h2>{!items.length ? <p className="py-5 text-sm text-muted">No beneficiaries yet. Save your first recipient above.</p> : <ul className="divide-y divide-line">{items.map(b => <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong className="block">{b.name}</strong><span className="text-sm text-muted">{b.phone} {b.networkCode && "· " + b.networkCode}</span></div><div className="flex flex-wrap gap-2"><Button asChild><Link href={"/buy-data?" + new URLSearchParams({ phone: b.phone, ...(b.networkCode ? { network: b.networkCode } : {}) })}>Buy data</Link></Button><Button asChild variant="outline"><Link href={"/buy-airtime?" + new URLSearchParams({ phone: b.phone, ...(b.networkCode ? { network: b.networkCode } : {}) })}>Buy airtime</Link></Button><Button variant="outline" disabled={busy} onClick={() => { setName(b.name); setPhone(b.phone); setNetwork(b.networkCode || ""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button><Button variant="outline" disabled={busy} onClick={() => remove(b)}>Remove</Button></div></li>)}</ul>}{error && !loaded && <Button onClick={load}>Try again</Button>}</section>}
  </div>;
}
