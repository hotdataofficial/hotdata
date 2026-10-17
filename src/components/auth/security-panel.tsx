"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authRequest } from "@/lib/auth-client";
import { verifySchema, setPinSchema, changePasswordSchema } from "@/lib/validation/auth";
import { useRouter } from "next/navigation";
type Profile = { fullName: string; email: string; phone: string; role: string; emailVerified: boolean; phoneVerified: boolean; hasPin: boolean };
type Session = { id: string; current: boolean; userAgent: string; createdAt: string; lastUsedAt: string };
export function SecurityPanel({ user }: { user: Profile }) {
  const [profile, setProfile] = useState(user); const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const router = useRouter();
  useEffect(() => { authRequest("sessions", undefined, "GET").then(result => setSessions(result.sessions)).catch(error => setMessage(error.message)); }, []);
  async function perform(action: string, data?: unknown) {
    if (busy) return; setBusy(true); setMessage("");
    try {
      const result = await authRequest(action, data); setMessage(result.message);
      if (["logout", "change-password"].includes(action) || (action === "revoke-session" && sessions.find(s => s.id === (data as { sessionId: string }).sessionId)?.current)) { router.push("/login"); router.refresh(); return; }
      if (action === "verify" || action === "set-pin") {
        setProfile((await authRequest("me", undefined, "GET")).user);
        // Refresh the shared customer layout too, so buying is enabled after PIN setup.
        router.refresh();
      }
      if (action === "revoke-session") setSessions((await authRequest("sessions", undefined, "GET")).sessions);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  function submit(event: React.FormEvent<HTMLFormElement>, action: string, purpose?: string) {
    event.preventDefault(); const form = event.currentTarget;
    try {
      const raw = Object.fromEntries(new FormData(form));
      const data = action === "verify" ? verifySchema.parse({ ...raw, purpose }) : action === "set-pin" ? setPinSchema.parse({ ...raw, currentPin: raw.currentPin || undefined }) : changePasswordSchema.parse(raw);
      void perform(action, data); form.reset();
    } catch (error) { const value = error as { issues?: { message: string }[] }; setMessage(value.issues?.[0]?.message || "Check your details."); }
  }
  const input = (name: string, label: string, pin = false) => <label className="block text-sm font-medium">{label}<input name={name} required={name !== "currentPin"} type={pin ? "password" : "password"} inputMode={pin ? "numeric" : undefined} pattern={pin ? "[0-9]{4}" : undefined} maxLength={pin ? 4 : 128} autoComplete={pin ? "off" : name === "password" ? "new-password" : "current-password"} className="mt-2 min-h-11 w-full rounded-button border border-line px-3" /></label>;
  return <div className="mx-auto max-w-4xl px-5 py-10">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Account security</h1><p className="mt-2 text-muted">{profile.fullName} · {profile.role}</p></div><Button variant="outline" disabled={busy} onClick={() => perform("logout")}>Sign out</Button></div>
    {message && <p role="status" className="mt-6 rounded-card bg-brand-tint p-4 text-brand-deep">{message}</p>}
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <section className="rounded-card border border-line p-6"><h2 className="text-xl font-semibold">Verify your contacts</h2>
        {(["EMAIL_VERIFICATION", "PHONE_VERIFICATION"] as const).map(purpose => {
          const verified = purpose === "EMAIL_VERIFICATION" ? profile.emailVerified : profile.phoneVerified;
          return <div key={purpose} className="mt-5 space-y-3"><p className="break-all text-sm">{purpose === "EMAIL_VERIFICATION" ? profile.email : profile.phone} · {verified ? "Verified" : "Unverified"}</p>
            {!verified && <><Button variant="outline" disabled={busy} onClick={() => perform("request-otp", { purpose })}>Send {purpose === "EMAIL_VERIFICATION" ? "email" : "phone"} code</Button>
            <form onSubmit={event => submit(event, "verify", purpose)} className="space-y-3"><label className="block text-sm">Six-digit code<input required name="code" pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="one-time-code" className="mt-2 min-h-11 w-full rounded-button border border-line px-3" /></label><Button type="submit" disabled={busy}>Verify</Button></form></>}
          </div>;
        })}
        <p className="mt-4 text-xs text-muted">Phone delivery requires a configured SMS adapter.</p>
      </section>
      <section className="rounded-card border border-line p-6"><h2 className="text-xl font-semibold">{profile.hasPin ? "Change transaction PIN" : "Set transaction PIN"}</h2><form onSubmit={event => submit(event, "set-pin")} className="mt-5 space-y-4">
        {input("password", "Account password")}{profile.hasPin && input("currentPin", "Current PIN", true)}{input("pin", "New four-digit PIN", true)}<Button disabled={busy} type="submit">Save PIN</Button>
      </form></section>
      <section className="rounded-card border border-line p-6"><h2 className="text-xl font-semibold">Change password</h2><form onSubmit={event => submit(event, "change-password")} className="mt-5 space-y-4">{input("currentPassword", "Current password")}{input("password", "New password (12+ characters)")}<Button disabled={busy} type="submit">Change password</Button></form><p className="mt-3 text-xs text-muted">This signs out all devices.</p></section>
      <section className="rounded-card border border-line p-6"><h2 className="text-xl font-semibold">Your data</h2><p className="my-4 text-sm text-muted">Request account deletion. Support will review records that must be retained for financial and legal obligations.</p><Button variant="outline" disabled={busy} onClick={() => perform("request-deletion")}>Request data deletion</Button></section>
    </div>
    <section className="mt-8 rounded-card border border-line p-6"><h2 className="text-xl font-semibold">Active devices</h2><ul className="mt-4 divide-y divide-line">{sessions.map(session => <li key={session.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="max-w-xl break-all text-sm"><p>{session.current ? "This device · " : ""}{session.userAgent}</p><p className="mt-1 text-muted">Signed in {new Date(session.createdAt).toLocaleString("en-NG")}</p></div><Button variant="outline" disabled={busy} onClick={() => perform("revoke-session", { sessionId: session.id })}>Sign out device</Button></li>)}</ul>{!sessions.length && <p className="mt-3 text-sm text-muted">No active devices loaded.</p>}</section>
  </div>;
}
