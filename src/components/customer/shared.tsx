import Link from "next/link";
import { transactionLabel, lagosDate } from "@/lib/customer";
import { formatKobo } from "@/lib/money";
export type HistoryItem = { id: string; reference: string; phone: string; status: string; amountKobo: string; refundedAt: string | null; createdAt: string; plan: { name: string; networkCode: string; type: string; sizeMb: number; validityDays: number } | null };
export function StatusBadge({ status, refundedAt }: { status: string; refundedAt?: string | null }) {
  return <span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + (status === "SUCCESSFUL" ? "bg-brand-tint text-brand-deep" : status === "FAILED" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800")}>{transactionLabel(status, refundedAt)}</span>;
}
export function CustomerLoading() {
  return <div role="status" aria-label="Loading your account" className="space-y-6"><div className="h-10 w-2/3 animate-pulse rounded-card bg-line" /><div className="grid gap-6 md:grid-cols-2">{[1, 2, 3, 4].map(v => <div key={v} className="h-48 animate-pulse rounded-card bg-line/60" />)}</div><span className="sr-only">Loading your account…</span></div>;
}
export function ErrorMessage({ message }: { message: string }) { return message ? <p role="alert" className="rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message}</p> : null; }
export function HistoryList({ items }: { items: HistoryItem[] }) {
  if (!items.length) return <div className="rounded-card border border-dashed border-line p-8 text-center"><h2 className="font-semibold">Your next connection starts here.</h2><p className="mt-2 text-sm text-muted">Your data purchases will appear here.</p><Link href="/buy-data" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand-dark">Buy your first bundle →</Link></div>;
  return <ul className="divide-y divide-line">{items.map(t => <li key={t.id}><Link href={"/receipts/" + encodeURIComponent(t.reference)} className="flex min-h-20 flex-wrap items-center justify-between gap-3 py-5"><div className="min-w-0"><strong className="block text-sm">{t.plan?.networkCode} {t.plan?.name || "Data purchase"}</strong><span className="mt-1 block text-xs text-muted">{t.phone} · {lagosDate(t.createdAt)}</span><span className="mt-1 block break-all text-xs text-muted">{t.reference}</span></div><div className="text-right"><strong className="mb-2 block text-sm">{formatKobo(t.amountKobo)}</strong><StatusBadge status={t.status} refundedAt={t.refundedAt} /></div></Link></li>)}</ul>;
}
