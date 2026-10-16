import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { cache } from "@/server/security/rate-limit";
import { json } from "@/server/security/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
 if (req.nextUrl.searchParams.get("ready") !== "1") return json({ status: "ok" });
 let timer: ReturnType<typeof setTimeout> | undefined;
 try { await Promise.race([Promise.all([db.$queryRaw`SELECT 1`, (async()=>{const redis=cache();if(redis.status==="wait")await redis.connect();if(await redis.ping()!=="PONG")throw Error("Unavailable");})()]),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("Deadline")),2500);})]);return json({status:"ready"}); }
 catch {return json({status:"unavailable"},503);}finally{clearTimeout(timer);}
}
