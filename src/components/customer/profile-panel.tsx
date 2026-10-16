"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { authRequest } from "@/lib/auth-client";
import { apiRequest } from "@/lib/customer-client";
import { useCustomerUser } from "./customer-shell";
import { ErrorMessage } from "./shared";
export function ProfilePanel() {
  const user = useCustomerUser(), router = useRouter(); const [name, setName] = useState(user.fullName), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { const fullName = z.string().trim().min(2).max(100).parse(name); await apiRequest("/api/customer/profile", { fullName }, "POST"); setMessage("Profile updated."); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Try again."); } finally { setBusy(false); }
  }
  async function logout() { if (busy) return; setBusy(true); try { await authRequest("logout"); router.replace("/login"); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Try again."); setBusy(false); } }
  return <div className="mx-auto max-w-2xl space-y-6"><div><h1 className="text-3xl font-bold">Your account, your way.</h1><p className="mt-2 text-muted">Manage your profile and account security.</p></div><ErrorMessage message={error} />{message && <p role="status" className="rounded-card bg-brand-tint p-4 text-sm">{message}</p>}<form onSubmit={submit} className="space-y-5 rounded-card border border-line bg-canvas p-6"><label className="block text-sm">Full name<input className="customer-input mt-2" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" /></label><dl className="space-y-4 text-sm"><div><dt className="text-muted">Email</dt><dd className="mt-1 break-all">{user.email} · {user.emailVerified ? "Verified" : "Not verified (optional)"}</dd></div><div><dt className="text-muted">Phone</dt><dd className="mt-1">{user.phone}</dd></div><div><dt className="text-muted">Account tier</dt><dd className="mt-1">{user.role}</dd></div></dl><p className="text-xs leading-5 text-muted">Contact details are displayed here. Changes to verified contacts require a dedicated verification flow.</p><Button type="submit" disabled={busy}>Save profile</Button></form><section className="rounded-card border border-line bg-canvas p-6"><h2 className="text-lg font-semibold">Account security</h2><p className="mt-2 text-sm text-muted">Verify your email, manage your PIN, change your password or sign out devices.</p><Button asChild variant="outline" className="mt-4"><Link href="/security">Open security settings</Link></Button></section><Button variant="outline" onClick={logout} disabled={busy}>Sign out</Button></div>;
}
