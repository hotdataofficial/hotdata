import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { vercelWorkerConfigured } from "@/server/jobs/netlify-trigger";
import { runNetlifyJobs } from "@/server/jobs/netlify-runner";
import { json } from "@/server/security/http";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const supplied = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from("Bearer " + secret);
  if (!vercelWorkerConfigured() || secret.length < 43 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return json({ error: "Unauthorized" }, 401);
  await runNetlifyJobs({ budgetMs: 120000, maxEvents: 10 });
  return json({ ok: true });
}
