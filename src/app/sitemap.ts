import type { MetadataRoute } from "next";
import { publicPaths, publicSite } from "@/lib/public-site";
export default function sitemap(): MetadataRoute.Sitemap { const site = publicSite(); return site.indexable ? publicPaths.map(path => ({ url: site.origin + path, changeFrequency: path === "/" || path === "/pricing" ? "daily" as const : "monthly" as const, priority: path === "/" ? 1 : path === "/pricing" ? 0.9 : 0.5 })) : []; }
