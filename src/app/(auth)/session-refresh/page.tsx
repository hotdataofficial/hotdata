"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { refreshSession } from "@/lib/auth-client";
import { sessionReturn } from "@/lib/session-return";
export default function SessionRefresh() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    refreshSession().then(() => {
      if (active) window.location.replace(sessionReturn(new URLSearchParams(window.location.search).get("next")));
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return <main className="mx-auto max-w-lg px-5 py-20"><h1 className="text-2xl font-bold">{failed ? "Please sign in again" : "Restoring your session…"}</h1><p className="mt-4 text-muted">{failed ? "Your session could not be restored. Your wallet and payment records are safe." : "You’ll return to your page shortly."}</p>{failed && <Link className="mt-6 inline-block font-semibold text-brand-dark" href="/login">Sign in →</Link>}</main>;
}
