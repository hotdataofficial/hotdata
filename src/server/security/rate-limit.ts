import Redis from "ioredis";
import { config } from "../config";
import { digest } from "./crypto";
import { HttpError } from "./http";
let redis: Redis | undefined;
export function cache() {
  return redis ??= new Redis(config().REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000, enableOfflineQueue: false, lazyConnect: true });
}
const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n";
export async function rateLimit(scope: string, identity: string, maximum: number, seconds: number) {
  try {
    const client = cache();
    if (client.status === "wait") await client.connect();
    const count = Number(await client.eval(script, 1, "hotdata:rl:" + scope + ":" + digest(identity), seconds));
    if (count > maximum) throw new HttpError(429, "Too many attempts. Please try again later.");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Account services are temporarily unavailable.");
  }
}
