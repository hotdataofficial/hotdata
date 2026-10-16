"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset(): void }) {
  return <section className="mx-auto max-w-xl px-5 py-16"><h1 className="text-2xl font-bold">We couldn’t load this page.</h1><p className="my-4 text-muted">Try again in a moment. If you submitted a purchase, check History before making another purchase.</p><button onClick={reset} className="min-h-11 rounded-button bg-brand-dark px-5 text-white">Try again</button></section>;
}
