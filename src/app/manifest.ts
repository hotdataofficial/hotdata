import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { id: "/", name: "Hotdata", short_name: "Hotdata", description: "Cheap data. Instant delivery.", start_url: "/dashboard", scope: "/", display: "standalone", background_color: "#F0FDF4", theme_color: "#15803D", lang: "en-NG", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
}
