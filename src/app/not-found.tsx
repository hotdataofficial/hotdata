import Link from "next/link";
export default function NotFound() { return <section className="mx-auto max-w-xl px-5 py-16"><h1 className="text-2xl font-bold">We couldn’t find that page.</h1><p className="my-4 text-muted">Use the menu or return to Hotdata.</p><Link href="/" className="inline-flex min-h-11 items-center rounded-button bg-brand-dark px-5 text-white">Go home</Link></section>; }
