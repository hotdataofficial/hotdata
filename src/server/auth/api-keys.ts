import { rateLimit } from "../security/rate-limit";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { apiKeyDigest } from "../security/agent-secrets";
export { apiKeyDigest } from "../security/agent-secrets";
import { db } from "../db";
import { HttpError, clientIp } from "../security/http";
import { canonicalIp } from "../security/agent-ip";
import { config } from "../config";
export async function requireAgentKey(req:NextRequest){await rateLimit("agent-api-auth-ip",clientIp(req),300,60);const header=req.headers.get("authorization")||"";if(!/^Bearer hd_live_[A-Za-z0-9_-]{43}$/.test(header))throw new HttpError(401,"Use a valid agent API bearer key.");const row=await db.apiKey.findUnique({where:{keyHash:apiKeyDigest(header.slice(7))},include:{user:{select:{id:true,role:true,status:true,deletedAt:true,emailVerifiedAt:true}}}});if(!row||row.revokedAt||row.user.role!=="AGENT"||row.user.status!=="ACTIVE"||row.user.deletedAt||!row.user.emailVerifiedAt)throw new HttpError(401,"API key is invalid or unavailable.");if(row.ipWhitelist.length){let ip:string;try{if(config().TRUST_PROXY!=="true")throw Error("Untrusted proxy");ip=canonicalIp(clientIp(req));}catch{throw new HttpError(403,"A trusted client IP is required.");}if(!row.ipWhitelist.includes(ip))throw new HttpError(403,"Client IP is not allowed.");}await db.apiKey.update({where:{id:row.id},data:{lastUsedAt:new Date()}});return {userId:row.userId,keyId:row.id};}
// Caller holds the User lock. Recheck after authentication to close revocation/tier races.
export async function lockAgentKey(tx:Prisma.TransactionClient,userId:string,keyId:string){await tx.$queryRaw`SELECT id FROM "ApiKey" WHERE id = ${keyId} FOR UPDATE`;const key=await tx.apiKey.findUnique({where:{id:keyId}}),user=await tx.user.findUnique({where:{id:userId}});if(!key||key.userId!==userId||key.revokedAt||!user||user.role!=="AGENT"||user.status!=="ACTIVE"||user.deletedAt||!user.emailVerifiedAt)throw new HttpError(401,"Agent API access changed. Authenticate again.");return key;}
