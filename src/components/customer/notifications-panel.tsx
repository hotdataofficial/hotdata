"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/customer-client";
import { lagosDate } from "@/lib/customer";
import { ErrorMessage, CustomerLoading } from "./shared";
type Notification = { id: string; title: string; body: string; readAt: string | null; createdAt: string };
export function NotificationsPanel() {
  const [items, setItems] = useState<Notification[]>([]), [cursor, setCursor] = useState<string | null>(null), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function load(more = false) {
    setBusy(true); setError("");
    try { const result = await apiRequest<{ notifications: Notification[]; nextCursor: string | null }>("/api/notifications" + (more && cursor ? "?cursor=" + encodeURIComponent(cursor) : "")); setItems(prior => more ? [...prior, ...result.notifications] : result.notifications); setCursor(result.nextCursor); setLoaded(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Try again."); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function mark(ids: string[]) {
    if (busy || !ids.length) return; setBusy(true); setError("");
    try { await apiRequest("/api/notifications", { ids: ids.slice(0, 100) }, "POST"); const marked = new Set(ids.slice(0, 100)); setItems(prior => prior.map(n => marked.has(n.id) ? { ...n, readAt: new Date().toISOString() } : n)); }
    catch (e) { setError(e instanceof Error ? e.message : "Try again."); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">You’re in the loop.</h1><p className="mt-2 text-muted">Wallet and purchase updates in one place.</p></div><Button variant="outline" disabled={busy || !items.some(n => !n.readAt)} onClick={() => mark(items.filter(n => !n.readAt).map(n => n.id))}>Mark displayed updates as read</Button></div><ErrorMessage message={error} />
    {!loaded && !error ? <CustomerLoading /> : <section className="rounded-card border border-line bg-canvas p-5">{!items.length && <p className="py-5 text-sm text-muted">No updates yet. We’ll let you know when something changes.</p>}<ul className="divide-y divide-line">{items.map(n => <li key={n.id} className={"py-5 " + (!n.readAt ? "border-l-4 border-l-brand-dark pl-4" : "")}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{n.title}</h2><span className="text-xs text-muted">{lagosDate(n.createdAt)}</span></div><p className="mt-2 break-words text-sm leading-6 text-muted">{n.body}</p>{!n.readAt && <Button variant="outline" disabled={busy} onClick={() => mark([n.id])} className="mt-3">Mark as read</Button>}</li>)}</ul>{cursor && <Button variant="outline" disabled={busy} onClick={() => load(true)} className="mt-4 w-full">Load more updates</Button>}{error && <Button onClick={() => load()} className="mt-4">Try again</Button>}</section>}
  </div>;
}
