"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { apiRequest, apiResponse } from "@/lib/customer-client";
import { lagosDate, displayPlanType, type Receipt } from "@/lib/customer";
import { formatKobo } from "@/lib/money";
import { StatusBadge, ErrorMessage } from "./shared";
export function ReceiptPanel({ initial }: { initial: Receipt }) {
  const [receipt, setReceipt] = useState(initial), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [checking, setChecking] = useState(false);
  const url = "/api/receipts/" + encodeURIComponent(receipt.reference);
  async function refresh() {
    if (checking) return; setChecking(true); setError("");
    try { setReceipt((await apiRequest<{ receipt: Receipt }>(url)).receipt); } catch (e) { setError(e instanceof Error ? e.message : "Try again."); } finally { setChecking(false); }
  }
  useEffect(() => {
    if (receipt.status !== "PENDING") return;
    let active = true, running = false, passes = 0;
    const timer = setInterval(async () => {
      if (document.hidden || running || passes >= 30) return;
      running = true; passes++;
      try { const result = await apiRequest<{ receipt: Receipt }>(url); if (active) setReceipt(result.receipt); }
      catch { /* Keep the last confirmed state; manual refresh exposes any error. */ }
      finally { running = false; }
    }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [receipt.status, url]);
  async function exportReceipt(kind: "image" | "share" | "pdf") {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try {
      const { receiptImage, downloadBlob } = await import("@/lib/receipt-image");
      const filename = "hotdata-" + receipt.reference;
      if (kind === "pdf") {
        const response = await apiResponse(url + "?format=pdf");
        if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Unable to export PDF."); }
        downloadBlob(await response.blob(), filename + ".pdf"); setMessage("PDF downloaded.");
      } else {
        const blob = await receiptImage(receipt), file = new File([blob], filename + ".png", { type: "image/png" });
        if (kind === "share" && navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: "Hotdata receipt" }); setMessage("Receipt shared."); }
          catch (e) { if (e instanceof Error && e.name === "AbortError") return; downloadBlob(blob, filename + ".png"); setMessage("Sharing was unavailable. Receipt image downloaded instead."); }
        } else { downloadBlob(blob, filename + ".png"); setMessage("Receipt image downloaded."); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Export was unavailable."); } finally { setBusy(false); }
  }
  const buyAgain = "/buy-data?" + new URLSearchParams({ phone: receipt.phone, ...(receipt.planId ? { planId: receipt.planId } : {}), ...(receipt.plan ? { network: receipt.plan.networkCode } : {}) });
  return <div className="mx-auto max-w-2xl space-y-5"><Link href="/history" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark">← Back to history</Link><ErrorMessage message={error} />{message && <p role="status" className="rounded-card bg-brand-tint p-4 text-sm text-brand-deep">{message}</p>}
    <article className="overflow-hidden rounded-card border border-line bg-canvas shadow-card"><header className="bg-brand-deep p-7 text-canvas"><h1 className="text-2xl font-bold">Your data receipt.</h1><p className="mt-2 text-sm text-brand-accent">One purchase. One reference.</p></header><div className="space-y-6 p-6 sm:p-8"><StatusBadge status={receipt.status} refundedAt={receipt.refundedAt} /><p className="text-4xl font-bold">{formatKobo(receipt.amountKobo)}</p><dl className="grid gap-5 text-sm sm:grid-cols-2">
      <div><dt className="text-muted">Bundle</dt><dd className="mt-1 font-semibold">{receipt.plan ? receipt.plan.networkCode + " · " + receipt.plan.name : "Data purchase"}</dd></div><div><dt className="text-muted">Plan type & validity</dt><dd className="mt-1">{receipt.plan ? displayPlanType(receipt.plan.type) + " · " + receipt.plan.validityDays + " days" : "Unavailable"}</dd></div><div><dt className="text-muted">Recipient</dt><dd className="mt-1 font-semibold">{receipt.phone}</dd></div><div><dt className="text-muted">Created (Lagos time)</dt><dd className="mt-1">{lagosDate(receipt.createdAt)}</dd></div><div className="sm:col-span-2"><dt className="text-muted">Reference</dt><dd className="mt-1 break-all font-mono text-xs">{receipt.reference}</dd></div>{receipt.completedAt && <div><dt className="text-muted">Completed</dt><dd className="mt-1">{lagosDate(receipt.completedAt)}</dd></div>}{receipt.refundedAt && <div><dt className="text-muted">Refunded</dt><dd className="mt-1">{lagosDate(receipt.refundedAt)}</dd></div>}
    </dl>{receipt.status === "PENDING" && <p className="rounded-button bg-amber-50 p-4 text-sm leading-6 text-amber-900">Processing. Hotdata is confirming delivery. Please avoid buying again while this purchase is pending. This page checks for updates for up to five minutes.</p>}{receipt.refundedAt && <p className="rounded-button bg-brand-tint p-4 text-sm text-brand-deep">The purchase could not be completed, and your wallet debit was refunded.</p>}{!receipt.historicalSnapshot && <p className="text-xs text-muted">This older record has no saved plan snapshot. Its plan details reflect the current catalog.</p>}<Button variant="outline" onClick={refresh} disabled={checking}>{checking ? "Checking…" : "Check latest status"}</Button></div></article>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Button variant="outline" disabled={busy} onClick={() => exportReceipt("image")}>Download image</Button><Button variant="outline" disabled={busy} onClick={() => exportReceipt("pdf")}>Download PDF</Button><Button variant="outline" disabled={busy} onClick={() => exportReceipt("share")}>Share image</Button></div>
    <p className="text-xs leading-5 text-muted">Downloads include the recipient number and reference. Share only with people you intend to receive these details. The receipt page itself stays private to your account.</p>
    {receipt.status !== "PENDING" && <Button asChild className="w-full"><Link href={buyAgain}>Buy again</Link></Button>}<Link href="/support" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark">Need help with this purchase? Contact support →</Link>
  </div>;
}
