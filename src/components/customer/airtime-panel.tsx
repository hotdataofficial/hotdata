"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { airtimePurchaseSchema, savedAirtimeSchema, type SavedAirtime } from "@/lib/airtime";
import { parseNaira, formatKobo } from "@/lib/money";
import { guessNetwork } from "@/lib/customer";
import { apiRequest, ApiError } from "@/lib/customer-client";
import { Button } from "@/components/ui/button";
import { useCustomerUser } from "./customer-shell";
import { CustomerLoading, ErrorMessage } from "./shared";

type Catalog = { networks: { code: string; name: string; available: boolean }[]; minKobo: string; maxKobo: string };
type Beneficiary = { id: string; name: string; phone: string; networkCode: string | null };
const storageKey = "hotdata-airtime-draft-v1";
export function AirtimePanel() {
  const params = useSearchParams(), router = useRouter(), user = useCustomerUser();
  const [catalog, setCatalog] = useState<Catalog | null>(null), [balance, setBalance] = useState("0"), [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [phone, setPhone] = useState(params.get("phone") || ""), [network, setNetwork] = useState(params.get("network") || "MTN"), [amount, setAmount] = useState(params.get("amount") || "100");
  const [pin, setPin] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [review, setReview] = useState<SavedAirtime | null>(null), [locked, setLocked] = useState(false), [storageReady, setStorageReady] = useState(false), [manualNetwork, setManualNetwork] = useState(!!params.get("network"));
  const draft = useRef<SavedAirtime | null>(null), submitting = useRef(false), dialog = useRef<HTMLDialogElement>(null);
  async function load() {
    setError("");
    try {
      const [data, summary, saved] = await Promise.all([
        apiRequest<Catalog>("/api/airtime"), apiRequest<{ wallet: { balanceKobo: string } }>("/api/wallet/summary"), apiRequest<{ beneficiaries: Beneficiary[] }>("/api/beneficiaries"),
      ]);
      setCatalog(data); setBalance(summary.wallet.balanceKobo); setBeneficiaries(saved.beneficiaries);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load airtime."); }
  }
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = savedAirtimeSchema.parse(JSON.parse(raw)); draft.current = saved;
        setPhone(saved.phone); setNetwork(saved.networkCode); setAmount((BigInt(saved.amountKobo) / 100n).toString()); setLocked(true); setManualNetwork(true);
      }
      sessionStorage.setItem("hotdata-airtime-storage-check", "1"); sessionStorage.removeItem("hotdata-airtime-storage-check"); setStorageReady(true);
    } catch { setError("Your saved airtime request could not be recovered. Check history before starting another purchase. Session storage is needed for safe retries."); }
    void load();
    // Restore only once. A saved request takes priority over buy-again links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (review && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!review && dialog.current?.open) dialog.current.close();
  }, [review]);
  const selectedNetwork = catalog?.networks.find(n => n.code === network);
  let amountKobo = "0";
  try { amountKobo = parseNaira(amount).toString(); } catch { /* Validated before review. */ }
  const canReview = storageReady && user.hasPin && (locked || !!selectedNetwork?.available);
  function openReview(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const parsed = airtimePurchaseSchema.safeParse({ ...(draft.current || { networkCode: network, phone, amountKobo, idempotencyKey: crypto.randomUUID() }), pin });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      setError(field === "phone" ? "Enter a valid Nigerian phone number." : field === "amountKobo" ? "Choose a whole-naira amount from ₦100 to ₦10,000." : field === "pin" ? "Enter your four-digit transaction PIN." : "Choose a supported network.");
      return;
    }
    if (!locked && (!selectedNetwork?.available || BigInt(parsed.data.amountKobo) > BigInt(balance))) { setError("Check this network is available and your wallet has enough funds."); return; }
    const { pin: ignoredPin, ...saved } = parsed.data; void ignoredPin;
    setReview(saved);
  }
  async function confirm() {
    if (submitting.current || !review || !storageReady) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const saved = draft.current || review;
      // Save identity before the financial request; never save a PIN.
      sessionStorage.setItem(storageKey, JSON.stringify(saved)); draft.current = saved; setLocked(true);
      const input = airtimePurchaseSchema.parse({ ...saved, pin });
      const result = await apiRequest<{ reference: string }>("/api/airtime", input, "POST");
      setPin(""); setReview(null); sessionStorage.removeItem(storageKey); draft.current = null;
      router.push("/receipts/" + encodeURIComponent(result.reference));
    } catch (e) {
      setPin(""); setReview(null);
      const message = e instanceof Error ? e.message : "The connection was interrupted.";
      setError(message + (e instanceof ApiError && [400, 403, 409, 429].includes(e.status) ? " Your request is retained. Re-enter your PIN to retry." : " Retry this same request or check history. Do not buy again while its result is uncertain."));
    } finally { submitting.current = false; setBusy(false); }
  }
  function newRequest() {
    if (locked && !window.confirm("Check history first. A new request could buy airtime again if the saved purchase is still processing. Start a separate purchase?")) return;
    try { sessionStorage.removeItem(storageKey); draft.current = null; setLocked(false); setPin(""); setError(""); }
    catch { setError("Unable to clear the saved request. Check browser storage settings and history."); }
  }
  if (!catalog) return <><ErrorMessage message={error} />{error ? <Button onClick={load} className="mt-4">Reload airtime</Button> : <CustomerLoading />}</>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-brand-dark">AIRTIME TOP-UP</p><h1 className="mt-2 text-3xl font-bold tracking-tight">More time to talk.</h1><p className="mt-2 text-muted">Top up your number or send airtime to someone you care about.</p></div><Link href="/buy-data" className="inline-flex min-h-11 items-center font-semibold text-brand-dark">Need data instead? →</Link></div>
    <ErrorMessage message={error} />
    {!storageReady && <p role="alert" className="rounded-card bg-amber-50 p-4 text-sm text-amber-900">Safe retries need session storage. Enable it and reload this page. Check history before making a separate purchase.</p>}
    {!user.hasPin && <p className="rounded-card bg-amber-50 p-4 text-sm text-amber-900">Set your transaction PIN before buying. <Link href="/security" className="font-semibold underline">Open security settings</Link></p>}
    {locked && <p className="rounded-card bg-amber-50 p-4 text-sm text-amber-900">Your saved airtime request is locked for safe retry. <Link href="/history" className="font-semibold underline">Check history</Link> before starting another purchase.</p>}
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      <section className="rounded-card border border-line bg-canvas p-5 sm:p-7"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Buy airtime</h2><span className="text-sm text-muted">Wallet {formatKobo(balance)}</span></div>
        <form onSubmit={openReview} className="space-y-5">
          {beneficiaries.length > 0 && <label className="block text-sm">Saved recipient<select className="customer-input mt-2" disabled={locked || busy} defaultValue="" onChange={e => { const b = beneficiaries.find(v => v.id === e.target.value); if (b) { setPhone(b.phone); setNetwork(b.networkCode || guessNetwork(b.phone) || network); setManualNetwork(true); } }}><option value="">Choose a beneficiary</option>{beneficiaries.map(b => <option key={b.id} value={b.id}>{b.name} · {b.phone}</option>)}</select></label>}
          <label className="block text-sm">Network<select className="customer-input mt-2" value={network} disabled={locked || busy} onChange={e => { setNetwork(e.target.value); setManualNetwork(true); }}>{!selectedNetwork && <option value={network}>{network} (unavailable)</option>}{catalog.networks.map(n => <option key={n.code} value={n.code}>{n.name}{!n.available ? " (temporarily unavailable)" : ""}</option>)}</select></label>
          <label className="block text-sm">Phone number<input className="customer-input mt-2" name="recipientPhone" value={phone} disabled={locked || busy} onChange={e => { setPhone(e.target.value); if (!manualNetwork) { const guess = guessNetwork(e.target.value); if (guess) setNetwork(guess); } }} type="tel" autoComplete="tel-national" maxLength={24} required placeholder="0801 234 5678" aria-describedby="airtime-network-help" /></label>
          <p id="airtime-network-help" className="text-xs leading-5 text-muted">Numbers can move networks. Confirm the network and recipient before paying.</p>
          <fieldset disabled={locked || busy}><legend className="mb-2 text-sm">Quick amount</legend><div className="grid grid-cols-3 gap-2">{[100, 200, 500, 1000, 2000, 5000].map(value => <button type="button" key={value} aria-pressed={amount === String(value)} onClick={() => setAmount(String(value))} className={"min-h-11 rounded-button border px-3 py-3 text-sm font-semibold " + (amount === String(value) ? "border-brand-dark bg-brand-tint text-brand-deep" : "border-line hover:bg-slate-50")}>₦{value.toLocaleString("en-NG")}</button>)}</div></fieldset>
          <label className="block text-sm">Amount (₦)<input className="customer-input mt-2" name="airtimeAmount" value={amount} onChange={e => setAmount(e.target.value)} type="number" inputMode="numeric" min={Number(BigInt(catalog.minKobo) / 100n)} max={Number(BigInt(catalog.maxKobo) / 100n)} step="1" disabled={locked || busy} required aria-describedby="airtime-amount-help" /></label>
          <p id="airtime-amount-help" className="text-xs leading-5 text-muted">₦100–₦10,000 in whole naira. ₦500 buys ₦500 airtime. No extra airtime purchase fee.</p>
          <label className="block text-sm">Transaction PIN<input className="customer-input mt-2" value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} type="password" name="transactionPin" autoComplete="off" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required disabled={busy} placeholder="Four-digit PIN" /></label>
          <Button type="submit" className="w-full" disabled={busy || !canReview}>{locked ? "Review saved request" : "Review airtime purchase →"}</Button>
          {locked && <Button variant="outline" className="w-full" disabled={busy} onClick={newRequest}>Start a separate request</Button>}
        </form><Button variant="outline" disabled={busy} onClick={load} className="mt-4 w-full">Refresh availability and balance</Button>
      </section>
      <aside className="h-fit rounded-card border border-line bg-canvas p-6"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-2xl text-brand-deep" aria-hidden="true">☎</div><h2 className="text-xl font-semibold">A little top-up. A longer conversation.</h2><ol className="mt-6 space-y-6 text-sm"><li><strong>1. Pick your network and amount</strong><p className="mt-2 leading-6 text-muted">Pay directly from your Hotdata wallet, for yourself or another number.</p></li><li><strong>2. Review and confirm with your PIN</strong><p className="mt-2 leading-6 text-muted">Check the number carefully. A successful airtime top-up cannot be reversed.</p></li><li><strong>3. Follow your receipt</strong><p className="mt-2 leading-6 text-muted">Processing means delivery is awaiting confirmation. Confirmed failures are refunded to your wallet automatically.</p></li></ol><Link href="/history" className="mt-5 inline-flex min-h-11 items-center font-semibold text-brand-dark">View purchase history →</Link></aside>
    </div>
    <dialog aria-labelledby="airtime-review-title" ref={dialog} onCancel={e => { if (busy) e.preventDefault(); else setReview(null); }} onClose={() => { if (!busy) setReview(null); }} className="w-[calc(100%-32px)] max-w-md rounded-card border border-line p-6 shadow-card backdrop:bg-ink/50"><h2 id="airtime-review-title" className="text-xl font-semibold">Confirm airtime purchase</h2><dl className="my-5 space-y-4 text-sm"><div><dt className="text-muted">Network</dt><dd className="mt-1 font-semibold">{catalog.networks.find(n => n.code === review?.networkCode)?.name || review?.networkCode}</dd></div><div><dt className="text-muted">Recipient</dt><dd className="mt-1 font-semibold">{review?.phone}</dd></div><div><dt className="text-muted">Airtime value / wallet debit</dt><dd className="mt-1 text-3xl font-bold">{review && formatKobo(review.amountKobo)}</dd></div></dl><p className="text-sm leading-6 text-muted">Confirm this is the correct number and network. Successful airtime top-ups cannot be reversed.</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={confirm} disabled={busy}>{busy ? "Submitting…" : locked ? "Retry same request" : "Confirm purchase"}</Button><Button variant="outline" onClick={() => setReview(null)} disabled={busy}>Cancel</Button></div></dialog>
  </div>;
}
