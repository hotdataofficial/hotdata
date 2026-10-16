import { NextRequest } from "next/server";
import { readPublicCatalog } from "@/server/services/public-catalog";
import { clientIp, endpoint, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (request: NextRequest) => {
  await rateLimit("public-plans", clientIp(request), 120, 60);
  return json(await readPublicCatalog());
});
