"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/customer-client";
import { TicketsPanel } from "./tickets-panel";
import { ErrorMessage } from "./shared";
export function SupportPanel() {
  const [details, setDetails] = useState<{ email: string | null; whatsapp: string | null } | null>(null), [error, setError] = useState("");
  useEffect(() => { apiRequest<{ email: string | null; whatsapp: string | null }>("/api/customer/support").then(setDetails).catch(e => setError(e.message)); }, []);
  return <div className="mx-auto max-w-2xl space-y-6"><div><h1 className="text-3xl font-bold">A little help goes a long way.</h1><p className="mt-2 text-muted">Include your purchase reference when contacting support.</p></div><ErrorMessage message={error} /><section className="rounded-card border border-line bg-canvas p-6"><h2 className="text-lg font-semibold">Get in touch</h2>{details ? <div className="mt-4 space-y-3">{details.email && <a href={"mailto:" + details.email} className="inline-flex min-h-11 items-center break-all font-semibold text-brand-dark">{details.email}</a>}{details.whatsapp && <a href={"https://wa.me/" + details.whatsapp.replace(/[^0-9]/g, "")} target="_blank" rel="noopener noreferrer" className="block min-h-11 py-3 font-semibold text-brand-dark">Chat on WhatsApp →</a>}{!details.email && !details.whatsapp && <p className="text-sm text-muted">Support contact details are being configured. Your receipts and account records remain available below.</p>}</div> : !error && <p className="mt-4 text-sm text-muted" role="status">Loading support details…</p>}<Link href="/history" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand-dark">Find your purchase reference →</Link><p className="mt-4 text-sm leading-6 text-muted">For a processing purchase, wait for delivery confirmation. Confirmed failures are refunded automatically. Never share your password, PIN or verification codes.</p></section><TicketsPanel/></div>;
}
