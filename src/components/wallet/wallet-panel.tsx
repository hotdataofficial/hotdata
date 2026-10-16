"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatKobo, parseNaira, fundingFee } from "@/lib/money";
import { walletRequest } from "@/lib/wallet-client";
import { fundingSchema, transferSchema } from "@/lib/validation/wallet";
type Summary = {
  gateway: string;
  wallet: { balanceKobo: string; entries: { reference: string; type: string; amountKobo: string; description: string; createdAt: string }[] } | null;
  accounts: { accountNumber: string; accountName: string; bankName: string }[];
  funding: { reference: string; amountKobo: string; feeKobo: string; status: string; gateway: string; reviewRequired: boolean }[];
  limits: { minimumKobo: string; maximumKobo: string; flatFeeKobo: string; feeBps: number; transfersEnabled: boolean };
  manualBank: { accountNumber: string; accountName: string; bankName: string } | null;
};
export function WalletPanel() {
  const [summary, setSummary] = useState<Summary>(); const [amount, setAmount] = useState("2000");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false); const [proof, setProof] = useState<File>();
  const key = useRef<string | null>(null); const proofToken = useRef<string | null>(null);
  const operation = useRef<string | null>(null);
  const reload = async () => setSummary(await walletRequest("summary", undefined, "GET"));
  useEffect(() => {
    let active = true;
    async function restorePayment() {
      const reference = new URLSearchParams(window.location.search).getAll("reference").find(value => /^HD-F-[a-f0-9-]{36}$/i.test(value));
      if (reference) {
        try {
          const result = await walletRequest("verify-funding", { reference });
          if (active) setMessage(result.status === "SUCCESSFUL" ? "Payment confirmed. Your wallet is credited." : "Payment confirmation is pending. Use Check payment below to check again.");
        } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Payment confirmation is pending. Check again shortly."); }
      }
      if (active) await reload();
    }
    void restorePayment().catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  async function action(name: string, handler: () => Promise<void>) {
    if (busy) return; setBusy(true); setMessage("");
    try { await handler(); if (name !== "checkout") await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Try again shortly."); }
    finally { setBusy(false); }
  }
  function idempotency(kind: string) {
    const identity = kind + ":" + amount;
    if (operation.current !== identity) { operation.current = identity; key.current = crypto.randomUUID(); }
    return key.current!;
  }
  async function checkout() {
    const input = fundingSchema.parse({ amountKobo: parseNaira(amount).toString(), idempotencyKey: idempotency("checkout") });
    const result = await walletRequest("checkout", input);
    if (result.checkoutUrl) {
      const url = new URL(result.checkoutUrl);
      if (url.protocol !== "https:" || !["checkout.paystack.com", "checkout.korapay.com"].includes(url.hostname) || !!url.username || !!url.password || (!!url.port && url.port !== "443")) throw new Error("Unexpected checkout URL.");
      window.location.assign(url.href);
    } else { setMessage("This request was already funded."); await reload(); }
  }
  async function manual() {
    if (!proof) throw new Error("Select your payment proof.");
    if (!proofToken.current) { const form = new FormData(); form.append("proof", proof); proofToken.current = (await walletRequest("upload-proof", form)).proofToken; }
    const input = fundingSchema.parse({ amountKobo: parseNaira(amount).toString(), idempotencyKey: idempotency("manual") });
    const result = await walletRequest("manual-funding", { ...input, proofToken: proofToken.current });
    setMessage("Proof received. Reference: " + result.reference + ". Your wallet will be credited only after approval.");
  }
  let fee = "—";
  try { if (summary) fee = formatKobo(fundingFee(parseNaira(amount), BigInt(summary.limits.flatFeeKobo), summary.limits.feeBps)); } catch { /* Validation runs again before submission. */ }
  return <div className="mx-auto max-w-6xl px-5 py-10">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Your wallet, ready when you are.</h1><p className="mt-3 text-muted">Add money once. Stay connected whenever you need.</p></div><Link className="inline-flex min-h-11 items-center font-semibold text-brand-dark" href="/security">Account security</Link></div>
    {message && <p role="status" className="mt-5 rounded-card bg-brand-tint p-4 text-brand-deep">{message}</p>}
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <section className="rounded-card bg-brand-deep p-7 text-canvas"><h2 className="text-sm">Available balance</h2><p className="mt-5 text-4xl font-bold">{summary?.wallet ? formatKobo(summary.wallet.balanceKobo) : "Loading…"}</p><p className="mt-5 text-sm text-brand-accent">NGN wallet · funds update after verification</p></section>
      <section className="rounded-card border border-line p-6"><h2 className="text-lg font-semibold">Your personal bank account</h2>{summary?.accounts.map(account => <div key={account.accountNumber} className="mt-4 space-y-2"><p className="text-muted">{account.bankName} · {account.accountName}</p><p className="text-2xl font-bold tracking-wide">{account.accountNumber}</p><Button variant="outline" onClick={() => navigator.clipboard.writeText(account.accountNumber).then(() => setMessage("Account number copied.")).catch(() => setMessage("Select and copy the account number."))}>Copy account number</Button></div>)}{summary && summary.gateway === "paystack" && !summary.accounts.length && <div className="mt-4 space-y-4"><p className="text-sm text-muted">Create a personal bank account through Paystack. Eligibility and identity checks may apply.</p><label className="flex gap-3 text-sm"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="h-5 w-5" />I consent to sharing my name, email and phone with Paystack to provision this account.</label><Button disabled={busy || !consent} onClick={() => action("virtual-account", async () => { await walletRequest("virtual-account", { consent: true }); setMessage("Personal bank account created."); })}>Create personal account</Button></div>}{summary?.gateway === "korapay" && !summary.accounts.length && <p className="mt-4 text-sm text-muted">Use Korapay checkout below for card or bank-transfer funding. Dedicated accounts are not available yet.</p>}</section>
      <section className="rounded-card border border-line p-6"><h2 className="text-lg font-semibold">Fund your wallet</h2><label className="mt-5 block text-sm">Amount in naira<input value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} inputMode="decimal" className="mt-2 min-h-11 w-full rounded-button border border-line px-3" /></label><p className="my-4 text-sm text-muted">Funding fee: {fee}{summary && " · Minimum: " + formatKobo(summary.limits.minimumKobo)}</p><Button disabled={busy || !summary} onClick={() => action("checkout", checkout)}>{busy ? "Please wait…" : summary?.gateway === "korapay" ? "Continue to Korapay" : "Continue to Paystack"}</Button><Button disabled={busy} variant="outline" className="ml-3" onClick={() => { operation.current = null; key.current = null; setMessage("Ready for a new funding request."); }}>Start a new request</Button><p className="mt-3 text-xs text-muted">Card and bank transfer checkout. Returning from checkout alone does not credit your wallet.</p></section>
      <section className="rounded-card border border-line p-6"><h2 className="text-lg font-semibold">Upload payment proof</h2>{summary?.manualBank ? <><p className="my-4 text-sm text-muted">Send money to {summary.manualBank.bankName}, {summary.manualBank.accountName}, {summary.manualBank.accountNumber}. Use the amount above.</p><label className="block text-sm">Proof (PNG, JPEG or PDF, up to 5 MB)<input disabled={busy} type="file" accept="image/png,image/jpeg,application/pdf" onChange={event => { setProof(event.target.files?.[0]); proofToken.current = null; operation.current = null; }} className="my-4 block max-w-full text-sm" /></label><Button disabled={busy || !proof} variant="outline" onClick={() => action("manual", manual)}>Submit for review</Button></> : <p className="mt-4 text-sm text-muted">Manual funding is unavailable here. Please use the secure checkout option.</p>}</section>
    </div>
    {summary?.limits.transfersEnabled && <section className="mt-6 rounded-card border border-line p-6"><h2 className="text-lg font-semibold">Transfer to another Hotdata wallet</h2><form className="mt-4 grid gap-4 sm:grid-cols-3" onSubmit={event => { event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget)); void action("transfer", async () => { const identity = "transfer:" + raw.recipientPhone + ":" + raw.amount; if (operation.current !== identity) { operation.current = identity; key.current = crypto.randomUUID(); } const input = transferSchema.parse({ recipientPhone: raw.recipientPhone, amountKobo: parseNaira(String(raw.amount)).toString(), pin: raw.pin, idempotencyKey: key.current }); const result = await walletRequest("transfer", input); setMessage("Transfer sent: " + result.reference); }); }}>
      <label className="text-sm">Recipient phone<input required name="recipientPhone" type="tel" className="mt-2 min-h-11 w-full rounded-button border border-line px-3" /></label><label className="text-sm">Amount (₦)<input required name="amount" inputMode="decimal" className="mt-2 min-h-11 w-full rounded-button border border-line px-3" /></label><label className="text-sm">Transaction PIN<input required name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" className="mt-2 min-h-11 w-full rounded-button border border-line px-3" /></label><Button disabled={busy} type="submit">Send transfer</Button>
    </form></section>}
    <section className="mt-6 rounded-card border border-line p-6"><h2 className="text-lg font-semibold">Recent funding requests</h2><ul className="mt-4 divide-y divide-line">{summary?.funding.map(row => <li key={row.reference} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{formatKobo(row.amountKobo)} · {row.reviewRequired ? "Under review" : row.status === "SUCCESSFUL" ? "Successful" : row.status === "PENDING" ? "Processing" : row.status}</p><p className="break-all text-xs text-muted">{row.reference}</p></div>{["paystack", "korapay"].includes(row.gateway) && row.status === "PENDING" && <Button disabled={busy} variant="outline" onClick={() => action("verify", async () => { const result = await walletRequest("verify-funding", { reference: row.reference }); setMessage(result.credited ? "Wallet credited." : "Payment status: " + result.status); })}>Check payment</Button>}</li>)}</ul>{summary && !summary.funding.length && <p className="mt-4 text-sm text-muted">No funding requests yet. Add money above to get started.</p>}</section>
    <section className="mt-6 rounded-card border border-line p-6"><h2 className="text-lg font-semibold">Wallet activity</h2><ul className="mt-4 divide-y divide-line">{summary?.wallet?.entries.map(entry => <li key={entry.reference} className="flex flex-wrap justify-between gap-3 py-4"><div><p className="font-medium">{entry.description}</p><p className="break-all text-xs text-muted">{entry.reference}</p></div><p className="font-semibold">{formatKobo(entry.amountKobo)}</p></li>)}</ul>{summary && !summary.wallet?.entries.length && <p className="mt-4 text-sm text-muted">Your confirmed wallet activity will appear here.</p>}</section>
  </div>;
}
