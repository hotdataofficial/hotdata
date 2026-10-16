"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/customer-client";
import { historyQuerySchema } from "@/lib/validation/customer";
import { CustomerLoading, ErrorMessage, HistoryList, type HistoryItem } from "./shared";
type History = { transactions: HistoryItem[]; nextCursor: string | null };
export function HistoryPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]), [cursor, setCursor] = useState<string | null>(null), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const filters = useRef<Record<string, string>>({}), sequence = useRef(0);
  async function load(more = false) {
    const request = ++sequence.current; setBusy(true); setError("");
    try {
      const query = new URLSearchParams(filters.current); if (more && cursor) query.set("cursor", cursor);
      const result = await apiRequest<History>("/api/customer/history?" + query);
      if (sequence.current !== request) return;
      setItems(prior => more ? [...prior, ...result.transactions] : result.transactions); setCursor(result.nextCursor); setLoaded(true);
    } catch (e) { if (sequence.current === request) setError(e instanceof Error ? e.message : "Unable to load history."); }
    finally { if (sequence.current === request) setBusy(false); }
  }
  useEffect(() => { void load(); return () => { sequence.current++; }; }, []);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const entries = Object.fromEntries(new FormData(e.currentTarget)); const input = Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== ""));
    const parsed = historyQuerySchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    filters.current = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => !!value)) as Record<string, string>;
    void load();
  }
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Your connections, recorded.</h1><p className="mt-2 text-muted">Search data purchases by phone, reference, network or date.</p></div>
    <form onSubmit={submit} className="grid gap-4 rounded-card border border-line bg-canvas p-5 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm sm:col-span-2 lg:col-span-1">Phone or reference<input className="customer-input mt-2" name="search" maxLength={100} placeholder="0801… or HD-D-…" /></label>
      <label className="text-sm">Status<select name="status" className="customer-input mt-2"><option value="">All statuses</option><option value="PENDING">Processing</option><option value="SUCCESSFUL">Successful</option><option value="FAILED">Failed</option></select></label>
      <label className="text-sm">Network<select name="network" className="customer-input mt-2"><option value="">All networks</option>{["MTN", "AIRTEL", "GLO", "9MOBILE"].map(n => <option key={n}>{n}</option>)}</select></label>
      <label className="text-sm">From (Lagos time)<input className="customer-input mt-2" name="from" type="date" /></label><label className="text-sm">To (Lagos time)<input className="customer-input mt-2" name="to" type="date" /></label>
      <Button type="submit" disabled={busy} className="self-end">{busy ? "Loading…" : "Apply filters"}</Button>
    </form><ErrorMessage message={error} />
    {!loaded && !error ? <CustomerLoading /> : <section className="rounded-card border border-line bg-canvas p-5 sm:p-7"><HistoryList items={items} />{cursor && <Button variant="outline" onClick={() => load(true)} disabled={busy} className="mt-4 w-full">Load more purchases</Button>}{error && <Button variant="outline" onClick={() => load()} disabled={busy} className="mt-4">Try again</Button>}</section>}
  </div>;
}
