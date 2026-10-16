"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { purchaseSchema } from "@/lib/validation/purchases";
import { savedPurchaseSchema, type SavedPurchase } from "@/lib/validation/customer";
import { apiRequest, ApiError } from "@/lib/customer-client";
import { formatKobo } from "@/lib/money";
import { guessNetwork, displayPlanType } from "@/lib/customer";
import { CustomerLoading, ErrorMessage } from "./shared";
import { useCustomerUser } from "./customer-shell";
type Plan = { id: string; networkId: string; name: string; type: string; sizeMb: number; validityDays: number; priceKobo: string; available: boolean };
type Catalog = { networks: { id: string; code: string; name: string }[]; plans: Plan[] };
type Beneficiary = { id: string; name: string; phone: string; networkCode: string | null };
const storageKey = "hotdata-purchase-draft-v1";
export function PurchasePanel() {
  const params = useSearchParams(), router = useRouter(), user = useCustomerUser();
  const [catalog, setCatalog] = useState<Catalog | null>(null), [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]), [balance, setBalance] = useState("0");
  const [phone, setPhone] = useState(params.get("phone") || ""), [network, setNetwork] = useState(params.get("network") || "MTN"), [type, setType] = useState("SME"), [planId, setPlanId] = useState(params.get("planId") || "");
  const [pin, setPin] = useState(""), [error, setError] = useState(""), [review, setReview] = useState(false), [busy, setBusy] = useState(false), [locked, setLocked] = useState(false), [storageReady, setStorageReady] = useState(false), [storageProblem, setStorageProblem] = useState(""), [manualNetwork, setManualNetwork] = useState(!!params.get("network"));
  const draft = useRef<SavedPurchase | null>(null), submitting = useRef(false), dialog = useRef<HTMLDialogElement>(null);
  async function load() {
    setError("");
    try {
      const [data, saved, summary] = await Promise.all([apiRequest<Catalog>("/api/catalog"), apiRequest<{ beneficiaries: Beneficiary[] }>("/api/beneficiaries"), apiRequest<{ wallet: { balanceKobo: string } }>("/api/wallet/summary")]);
      setCatalog(data); setBeneficiaries(saved.beneficiaries); setBalance(summary.wallet.balanceKobo);
      const selected = data.plans.find(p => p.id === (draft.current?.planId || params.get("planId")));
      if (selected) { setPlanId(selected.id); setType(selected.type); setNetwork(data.networks.find(n => n.id === selected.networkId)?.code || "MTN"); }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load plans."); }
  }
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const data = savedPurchaseSchema.parse(JSON.parse(saved)); draft.current = data;
        setPhone(data.phone); setPlanId(data.planId); if (data.networkCode) setNetwork(data.networkCode); if (data.planType) setType(data.planType); setLocked(true); setManualNetwork(true);
      }
      sessionStorage.setItem("hotdata-storage-check", "1"); sessionStorage.removeItem("hotdata-storage-check"); setStorageReady(true);
    } catch { setStorageProblem("Your saved request could not be recovered. Check history before starting another purchase. Enable session storage to make safe retries."); }
    void load();
    // Only initialise once. Restored drafts take priority over buy-again links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (review && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!review && dialog.current?.open) dialog.current.close();
  }, [review]);
  const networkId = catalog?.networks.find(n => n.code === network)?.id;
  const plans = catalog?.plans.filter(p => p.networkId === networkId && p.type === type) || [];
  const types = Array.from(new Set(catalog?.plans.filter(p => p.networkId === networkId).map(p => p.type) || []));
  const livePlan = catalog?.plans.find(p => p.id === planId);
  const plan = livePlan || (locked && draft.current ? { id: draft.current.planId, name: draft.current.planName || "Saved data purchase", priceKobo: draft.current.quotedPriceKobo || "0", available: false } : undefined);
  function phoneChanged(value: string) { setPhone(value); if (!manualNetwork) { const guess = guessNetwork(value); if (guess) { setNetwork(guess); setPlanId(""); } } }
  function chooseBeneficiary(id: string) { const b = beneficiaries.find(v => v.id === id); if (!b) return; setPhone(b.phone); setNetwork(b.networkCode || guessNetwork(b.phone) || network); setManualNetwork(true); setPlanId(""); }
  function openReview(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const parsed = purchaseSchema.safeParse({ planId, phone, pin, idempotencyKey: draft.current?.idempotencyKey || crypto.randomUUID() });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (!plan || (!locked && (!plan.available || BigInt(plan.priceKobo) > BigInt(balance)))) { setError("Choose an available plan and make sure your wallet has enough funds."); return; }
    setReview(true);
  }
  async function confirm() {
    if (submitting.current || !plan || !storageReady) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const saved = draft.current || savedPurchaseSchema.parse({ planId, phone, idempotencyKey: crypto.randomUUID(), quotedPriceKobo: plan.priceKobo, planName: plan.name, networkCode: network, planType: type });
      // Persist before any financial request. PINs are only held in component memory.
      sessionStorage.setItem(storageKey, JSON.stringify(saved)); draft.current = saved; setLocked(true);
      const input = purchaseSchema.parse({ planId: saved.planId, phone: saved.phone, idempotencyKey: saved.idempotencyKey, pin, expectedPriceKobo: saved.quotedPriceKobo });
      const result = await apiRequest<{ reference: string }>("/api/purchases", input, "POST");
      setPin(""); setReview(false);
      // Remove only after a readable response proves the stable reference exists.
      sessionStorage.removeItem(storageKey); draft.current = null;
      router.push("/receipts/" + encodeURIComponent(result.reference));
    } catch (e) {
      setReview(false); setPin("");
      if (e instanceof ApiError && [400, 403, 409, 429].includes(e.status)) {
        setError(e.message + " Your current request is retained. Re-enter your PIN to retry.");
      } else setError((e instanceof Error ? e.message : "The connection was interrupted.") + " Do not start a second purchase. Retry this same request or check history.");
    } finally { submitting.current = false; setBusy(false); }
  }
  function newRequest() {
    if (locked && !window.confirm("Check history first. If a prior request is still processing, a new request could buy data again. Start a separate purchase?")) return;
    sessionStorage.removeItem(storageKey); draft.current = null; setLocked(false); setPin(""); setError(""); setPlanId("");
  }
  if (!catalog) return <><ErrorMessage message={error || storageProblem} />{error ? <Button onClick={load} className="mt-4">Reload plans</Button> : <CustomerLoading />}</>;
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold tracking-tight">Stay connected.</h1><p className="mt-2 text-muted">Choose your network, bundle and recipient.</p><Button variant="outline" onClick={load} disabled={busy} className="mt-3">Refresh plans and balance</Button></div><ErrorMessage message={error} />
    {!user.hasPin && <p className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Set your transaction PIN before buying. <Link href="/security" className="font-semibold underline">Open security settings</Link></p>}
    {locked && <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">A saved request is ready to retry. Plan and recipient are locked to avoid changing its identity. <Link href="/history" className="font-semibold underline">Check history</Link> before starting another request.</div>}
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]"><section className="rounded-card border border-line bg-canvas p-5 sm:p-7"><form onSubmit={openReview} className="space-y-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Build your bundle</h2><span className="text-sm text-muted">Wallet {formatKobo(balance)}</span></div>
      {beneficiaries.length > 0 && <label className="block text-sm">Saved recipient<select disabled={locked || busy} onChange={e => chooseBeneficiary(e.target.value)} defaultValue="" className="customer-input mt-2"><option value="">Choose a beneficiary</option>{beneficiaries.map(b => <option key={b.id} value={b.id}>{b.name} · {b.phone}</option>)}</select></label>}
      <label className="block text-sm">Phone number<input disabled={locked || busy} value={phone} onChange={e => phoneChanged(e.target.value)} className="customer-input mt-2" type="tel" autoComplete="tel" required maxLength={24} aria-describedby="network-help" placeholder="0801 234 5678" /></label>
      <p id="network-help" className="text-xs leading-5 text-muted">Prefix detection is a suggestion. Numbers can move networks, so confirm or change the network below.</p>
      <label className="block text-sm">Network<select disabled={locked || busy} value={network} onChange={e => { setNetwork(e.target.value); setManualNetwork(true); setPlanId(""); setType("SME"); }} className="customer-input mt-2">{catalog.networks.map(n => <option key={n.id} value={n.code}>{n.name}</option>)}</select></label>
      <label className="block text-sm">Plan type<select disabled={locked || busy} value={type} onChange={e => { setType(e.target.value); setPlanId(""); }} className="customer-input mt-2">{!types.includes(type) && <option value={type}>{displayPlanType(type)} (no plans)</option>}{types.map(t => <option key={t} value={t}>{displayPlanType(t)}</option>)}</select></label>
      <fieldset disabled={locked || busy}><legend className="mb-3 text-sm">Choose a plan</legend><div className="grid gap-3 sm:grid-cols-2">{plans.map(p => <label key={p.id} className={"flex min-h-24 cursor-pointer items-start gap-3 rounded-button border p-4 " + (planId === p.id ? "border-brand-dark bg-brand-tint" : "border-line") + (!p.available ? " opacity-60" : "")}><input type="radio" name="plan" value={p.id} checked={planId === p.id} onChange={() => setPlanId(p.id)} disabled={!p.available} className="mt-1 h-4 w-4 accent-brand-dark" /><span><strong className="block text-sm">{p.name}</strong><span className="mt-1 block text-xs text-muted">{p.validityDays} days · {formatKobo(p.priceKobo)}</span>{!p.available && <span className="mt-1 block text-xs text-muted">Temporarily unavailable</span>}</span></label>)}</div>{!plans.length && <p className="rounded-button bg-slate-50 p-4 text-sm text-muted">No plans are available for this selection. Try another network or plan type.</p>}</fieldset>
      {locked && plan && <p className="rounded-button bg-brand-tint p-3 text-sm">{plan.name} · {plan.priceKobo === "0" ? "original request price" : formatKobo(plan.priceKobo)} · saved request</p>}
      <label className="block text-sm">Transaction PIN<input disabled={busy} className="customer-input mt-2" value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} required placeholder="Four-digit PIN" /></label>
      <Button type="submit" className="w-full" disabled={busy || !storageReady || !user.hasPin || !plan || (!locked && !plan.available)}>{locked ? "Review saved request" : "Review purchase →"}</Button>
      {locked && <Button variant="outline" onClick={newRequest} disabled={busy} className="w-full">Start a separate request</Button>}
    </form></section><aside className="h-fit rounded-card border border-line bg-canvas p-6"><h2 className="text-lg font-semibold">Simple from start to finish.</h2><ol className="mt-5 space-y-6 text-sm"><li><strong>1. Review your bundle</strong><p className="mt-2 leading-6 text-muted">The server checks the current plan price and your wallet.</p></li><li><strong>2. Confirm securely</strong><p className="mt-2 leading-6 text-muted">Your PIN protects the purchase. Each request has one stable reference.</p></li><li><strong>3. Track delivery</strong><p className="mt-2 leading-6 text-muted">Processing means we are waiting for confirmation. A confirmed failure is refunded automatically.</p></li></ol><Link href="/beneficiaries" className="mt-5 inline-flex min-h-11 items-center font-semibold text-brand-dark">Manage saved recipients →</Link></aside></div>
    <dialog ref={dialog} onCancel={e => { if (busy) e.preventDefault(); else setReview(false); }} onClose={() => { if (!busy) setReview(false); }} className="w-[calc(100%-32px)] max-w-md rounded-card border border-line p-6 shadow-card backdrop:bg-ink/50"><h2 className="text-xl font-semibold">Confirm your purchase</h2><dl className="my-5 space-y-3 text-sm"><div><dt className="text-muted">Bundle</dt><dd className="mt-1 font-semibold">{network} · {plan?.name}</dd></div><div><dt className="text-muted">Recipient</dt><dd className="mt-1 font-semibold">{phone}</dd></div><div><dt className="text-muted">Wallet debit</dt><dd className="mt-1 text-2xl font-bold">{plan && (plan.priceKobo === "0" ? "Original request price" : formatKobo(plan.priceKobo))}</dd></div></dl><p className="text-xs leading-5 text-muted">If the connection drops, retry this same request. A changed price is rejected before debit.</p><div className="mt-5 flex gap-3"><Button onClick={confirm} disabled={busy}>{busy ? "Submitting…" : locked ? "Retry same request" : "Confirm purchase"}</Button><Button variant="outline" onClick={() => setReview(false)} disabled={busy}>Cancel</Button></div></dialog>
  </div>;
}
