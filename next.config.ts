import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";
const config: NextConfig = {output:"standalone",poweredByHeader:false,experimental:{cpus:2},async headers(){return [{source:"/:path*",headers:securityHeaders(process.env.NODE_ENV==="production")},{source:"/sw.js",headers:[{key:"Content-Type",value:"application/javascript; charset=utf-8"},{key:"Cache-Control",value:"no-cache, no-store, must-revalidate"},{key:"Service-Worker-Allowed",value:"/"}]},{source:"/(dashboard|buy-data|wallet|history|beneficiaries|notifications|profile|security|support|receipts|admin|agent|referrals)/:path*",headers:[{key:"Cache-Control",value:"private, no-store, max-age=0"}]}];}};
export default config;
