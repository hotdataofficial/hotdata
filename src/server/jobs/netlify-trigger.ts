import { createHmac, timingSafeEqual } from "node:crypto";
import { netlifyProductionBuild } from "./netlify-context";
type Environment = Record<string, string | undefined>;
// Domain separation avoids sending the application authentication secret itself.
function workerSecret(env: Environment) {
  if (env.HOTDATA_WORKER_SECRET !== undefined && env.HOTDATA_WORKER_SECRET !== "") return /^[a-f0-9]{64}$/.test(env.HOTDATA_WORKER_SECRET) ? env.HOTDATA_WORKER_SECRET : undefined;
  return env.AUTH_CODE_SECRET && env.AUTH_CODE_SECRET.length >= 43 ? createHmac("sha256", env.AUTH_CODE_SECRET).update("hotdata/netlify-worker/v1").digest("hex") : undefined;
}
export function netlifyWorkerConfigured(env: Environment = process.env) {
  return netlifyProductionBuild && env.HOTDATA_WORKER_MODE === "netlify" && (!env.CONTEXT || env.CONTEXT === "production") &&
    !!workerSecret(env);
}
export function workerAuthorized(request: Request, env: Environment = process.env) {
  if (!netlifyWorkerConfigured(env) || request.method !== "POST") return false;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from("Bearer " + workerSecret(env));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
export async function wakeNetlifyWorker(env: Environment = process.env, send: typeof fetch = fetch) {
  if (!netlifyWorkerConfigured(env)) return false;
  try {
    const origin = new URL(env.APP_URL || "");
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return false;
    const response = await send(new URL("/.netlify/functions/hotdata-worker", origin), {
      method: "POST", headers: { authorization: "Bearer " + workerSecret(env) },
      redirect: "error", signal: AbortSignal.timeout(5000),
    });
    return response.status === 202;
  } catch {
    console.warn("Background delivery wake-up unavailable; scheduled recovery will retry.");
    return false;
  }
}
