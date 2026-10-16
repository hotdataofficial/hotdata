import { PriceList } from "@/components/public/price-list";
import { pageMetadata } from "@/lib/seo";
export const generateMetadata = () => pageMetadata("Data prices", "Browse current Hotdata customer data prices by network, type, size and validity.", "/pricing");
export default function PricingPage() { return <section className="mx-auto max-w-6xl px-5 py-14"><p className="text-xs font-bold uppercase tracking-widest text-brand-dark">Make room for more</p><h1 className="mt-4 text-4xl font-bold">A plan for your next connection.</h1><p className="mb-9 mt-4 max-w-2xl leading-relaxed text-muted">Compare customer plans for MTN, Airtel, Glo and 9mobile. Choose the right network for your number, even if you’ve changed network through number portability.</p><PriceList /></section>; }
