import type { Metadata } from "next";
import { publicSite } from "./public-site";
export function pageMetadata(title: string, description: string, pathname: string): Metadata {
  const site = publicSite();
  return { title, description, alternates: { canonical: pathname }, robots: { index: site.indexable, follow: site.indexable }, openGraph: { title: title + " | Hotdata", description, url: site.origin + pathname, siteName: "Hotdata", locale: "en_NG", type: "website", images: [{ url: site.origin + "/opengraph-image", width: 1200, height: 630, alt: "Hotdata: Cheap data. Instant delivery." }] }, twitter: { card: "summary_large_image", title: title + " | Hotdata", description, images: [site.origin + "/opengraph-image"] } };
}
