import { SiteNotices } from "@/components/public/site-notices";
import { Landing } from "@/components/public/landing";
import { publicSite } from "@/lib/public-site";
import { pageMetadata } from "@/lib/seo";
export const generateMetadata = () => pageMetadata("Cheap data. Instant delivery.", "Compare MTN, Airtel, Glo and 9mobile data plans. Fund your Hotdata wallet, choose a plan and follow every purchase.", "/");
export default function Home() {
  const site = publicSite();
  const organization = { "@context": "https://schema.org", "@type": "Organization", name: "Hotdata", url: site.origin, logo: site.origin + "/logo.svg", ...(site.email ? { email: site.email } : {}) };
  return <>{!site.live && <div role="status" className="bg-brand-deep px-5 py-3 text-center text-sm text-white">Preparing for launch. Purchases depend on configured services and verified provider availability.</div>}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\u003c") }} /><SiteNotices /><Landing /></>;
}
