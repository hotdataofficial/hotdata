import Redis from "ioredis";
import { config } from "../config";
import { digest } from "./crypto";
import { HttpError } from "./http";
let redis: Redis | undefined;
let readiness: Promise<Redis> | undefined;
export function cache() {
  return redis ??= new Redis(config().REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000, enableOfflineQueue: false, lazyConnect: true });
}
export async function readyCache(): Promise<Redis> {
  const client = cache();
  if (client.status === "ready") return client;
  if (!readiness) readiness = (async () => {
    if (client.status === "wait" || client.status === "end") await client.connect();
    else await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); client.off("ready", ready); client.off("error", failed); client.off("end", ended); };
      const ready = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error("Cache unavailable")); };
      const ended = () => failed();
      const timer = setTimeout(failed, 3000);
      client.once("ready", ready); client.once("error", failed); client.once("end", ended);
      if (client.status === "ready") ready();
    });
    if (client.status !== "ready") throw new Error("Cache unavailable");
    return client;
  })().finally(() => { readiness = undefined; });
  return readiness;
}
const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n";
export async function rateLimit(scope: string, identity: string, maximum: number, seconds: number) {
  try {
    const client = await readyCache();
    const count = Number(await client.eval(script, 1, "hotdata:rl:" + scope + ":" + digest(identity), seconds));
    if (count > maximum) throw new HttpError(429, "Too many attempts. Please try again later.");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Account services are temporarily unavailable.");
  }
}
