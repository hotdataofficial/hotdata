import { SiteNotices } from "@/components/public/site-notices";
import { publicSite } from "@/lib/public-site";
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const site = publicSite();
  return <>{!site.live && <div role="status" className="bg-brand-deep px-5 py-3 text-center text-sm text-white">Hotdata is being prepared for launch. Purchases depend on configured services and verified provider availability.</div>}<SiteNotices />{children}</>;
}
