"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authRequest } from "@/lib/auth-client";
import { registerSchema, loginSchema, forgotSchema, resetSchema } from "@/lib/validation/auth";
type Mode = "login" | "register" | "forgot-password" | "reset-password";
const titles: Record<Mode, string> = { login: "Welcome back", register: "Create your Hotdata account", "forgot-password": "Forgot your password?", "reset-password": "Choose a new password" };
export function AuthForm({ mode, referralCode="" }: { mode: Mode; referralCode?:string }) {
  const [showPassword, setShowPassword] = useState(false), [isError, setIsError] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setIsError(false); setBusy(true);
    const form = new FormData(event.currentTarget);
    const input = Object.fromEntries(form.entries());
    try {
      let data: unknown;
      if (mode === "register") data = registerSchema.parse({ ...input, consent: form.get("consent") === "on" });
      else if (mode === "login") data = loginSchema.parse(input);
      else if (mode === "forgot-password") data = forgotSchema.parse(input);
      else data = resetSchema.parse(input);
      const result = await authRequest(mode, data);
      if (mode === "login") { router.push("/dashboard"); router.refresh(); }
      else if (mode === "register") setMessage(result.verificationSent ? "Account created. Sign in and set your transaction PIN. An optional verification code has been emailed to you." : "Account created. You can sign in now and set your transaction PIN. Email verification is optional.");
      else setMessage(result.message);
    } catch (error) {
      setIsError(true); const value = error as { issues?: { message: string }[]; message?: string };
      setMessage(value.issues?.[0]?.message || value.message || "Please try again.");
    } finally { setBusy(false); }
  }
  const field = (name: string, label: string, type = "text", autocomplete?: string, minLength?: number) => <label className="block text-sm font-medium" key={name}>{label}<input required name={name} type={type === "password" && showPassword ? "text" : type} autoComplete={autocomplete} minLength={minLength} maxLength={name.toLowerCase().includes("password") ? 128 : name === "code" ? 6 : 254} inputMode={name === "code" ? "numeric" : undefined} className="mt-2 min-h-12 w-full rounded-button border border-line bg-white px-3 py-3" />{type === "password" && <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark">{showPassword ? "Hide password" : "Show password"}</button>}</label>;
  return <div className="bg-slate-50 px-5 py-8 sm:py-14"><div className="mx-auto max-w-md rounded-[24px] border border-line bg-white p-6 shadow-card sm:p-8">
    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-dark">Your Hotdata account</p><h1 className="text-3xl font-bold tracking-tight">{titles[mode]}</h1><p className="mt-3 text-sm leading-relaxed text-muted">{mode === "login" ? "Sign in to manage your wallet and data purchases." : mode === "register" ? "Start with your details. Set your transaction PIN after signing in." : "Recover access to your account securely."}</p>
    <form onSubmit={submit} className="mt-8 space-y-5">
      {mode === "register" && field("fullName", "Full name", "text", "name")}
      {field(mode === "login" ? "identifier" : "email", mode === "login" ? "Email or Nigerian phone number" : "Email", mode === "login" ? "text" : "email", mode === "login" ? "username" : "email")}
      {mode === "register" && field("phone", "Nigerian phone number", "tel", "tel")}
      {mode === "reset-password" && field("code", "Six-digit reset code", "text", "one-time-code")}
      {mode !== "forgot-password" && field("password", mode === "reset-password" ? "New password (12+ characters)" : mode === "register" ? "Password (12+ characters)" : "Password", "password", mode === "login" ? "current-password" : "new-password", mode === "login" ? undefined : 12)}
      {mode === "register" && <>
        <label className="block text-sm font-medium">Referral code (optional)<input name="referralCode" defaultValue={referralCode} maxLength={32} className="mt-2 min-h-11 w-full rounded-button border border-line px-3" /></label>
        <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed"><input required type="checkbox" name="consent" className="mt-1 h-5 w-5 accent-brand-dark" />I consent to Hotdata processing my name, contact details and account records to provide account, wallet and data services. I can request deletion from security settings.</label>
      </>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot-password" ? "Send reset code" : "Reset password"}</Button>
      {message && <p role={isError ? "alert" : "status"} aria-live="polite" className={"rounded-card border p-4 text-sm " + (isError ? "border-red-200 bg-red-50 text-red-800" : "border-line bg-brand-tint text-brand-deep")}>{message}</p>}
    </form>
    <nav aria-label="Account links" className="mt-6 flex flex-wrap gap-5 text-sm font-semibold text-brand-dark">
      {mode !== "login" && <Link className="inline-flex min-h-11 items-center" href="/login">Sign in</Link>}
      {mode === "login" && <><Link className="inline-flex min-h-11 items-center" href="/register">Create account</Link><Link className="inline-flex min-h-11 items-center" href="/forgot-password">Forgot password?</Link></>}
      {mode === "forgot-password" && <Link className="inline-flex min-h-11 items-center" href="/reset-password">I have a reset code</Link>}
    </nav>
  </div></div>;
}
