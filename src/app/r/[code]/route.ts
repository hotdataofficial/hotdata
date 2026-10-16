import { NextRequest,NextResponse } from "next/server";
import { randomBytes,createHash } from "node:crypto";
import { db } from "@/server/db";
import { endpoint,json,clientIp } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { config } from "@/server/config";
export const runtime="nodejs";
export async function GET(req:NextRequest,context:{params:Promise<{code:string}>}){const {code}=await context.params;return endpoint(async req=>{await rateLimit("referral-click",clientIp(req),120,60);if(!/^[A-Za-z0-9_-]{8,32}$/.test(code))return json({error:"Referral link unavailable."},404);const user=await db.user.findUnique({where:{referralCode:code},select:{id:true,status:true,deletedAt:true}});if(!user||user.status!=="ACTIVE"||user.deletedAt)return json({error:"Referral link unavailable."},404);const old=req.cookies.get("hotdata_referral_visitor")?.value,visitor=old&&/^[A-Za-z0-9_-]{43}$/.test(old)?old:randomBytes(32).toString("base64url"),visitorHash=createHash("sha256").update(code+":"+visitor).digest("hex");await db.referralClick.upsert({where:{referrerId_visitorHash:{referrerId:user.id,visitorHash}},update:{},create:{referrerId:user.id,visitorHash}});const url=new URL("/register",config().APP_URL);url.searchParams.set("ref",code);const response=NextResponse.redirect(url);response.headers.set("Cache-Control","no-store");response.cookies.set("hotdata_referral_visitor",visitor,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/r",maxAge:30*86400});return response;})(req);}
