import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAgentKey } from "@/server/auth/api-keys";
import { endpoint,body,json,HttpError } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { purchaseSchema } from "@/lib/validation/purchases";
import { createPurchase,purchaseView } from "@/server/services/purchases";
import { isAdapterReady } from "@/server/providers/registry";
export const runtime="nodejs";
type Context={params:Promise<{action:string}>};
export async function GET(req:NextRequest,context:Context){const {action}=await context.params;return endpoint(async req=>{const actor=await requireAgentKey(req);await rateLimit("agent-api-read-user",actor.userId,120,60);if(action==="balance"){const wallet=await db.wallet.findUniqueOrThrow({where:{userId:actor.userId},select:{balanceKobo:true}});return json({currency:"NGN",balanceKobo:wallet.balanceKobo.toString()});}if(action==="plans"){const plans=await db.plan.findMany({where:{active:true,deletedAt:null,network:{active:true,deletedAt:null}},select:{id:true,code:true,name:true,type:true,sizeMb:true,validityDays:true,agentPriceKobo:true,network:{select:{code:true}},mappings:{where:{active:true,provider:{active:true,deletedAt:null}},select:{provider:{select:{adapter:true}}}}},take:1000,orderBy:{code:"asc"}});return json({plans:plans.map(p=>({id:p.id,code:p.code,name:p.name,network:p.network.code,type:p.type,sizeMb:p.sizeMb,validityDays:p.validityDays,priceKobo:p.agentPriceKobo.toString(),available:p.mappings.some(m=>isAdapterReady(m.provider.adapter))}))});}if(action==="transactions"){const reference=z.string().min(1).max(64).parse(req.nextUrl.searchParams.get("reference")),order=await db.transaction.findFirst({where:{reference,userId:actor.userId,type:"DATA"}});if(!order)throw new HttpError(404,"Purchase not found.");return json(purchaseView(order));}throw new HttpError(404,"API endpoint not found.");})(req);}
export async function POST(req:NextRequest,context:Context){const {action}=await context.params;return endpoint(async req=>{const actor=await requireAgentKey(req);await rateLimit("agent-api-purchase-user",actor.userId,20,60);if(action!=="buy-data")throw new HttpError(404,"API endpoint not found.");const input=await body(req,purchaseSchema);return json(await createPurchase(actor.userId,input,isAdapterReady,{apiKeyId:actor.keyId}),202);})(req);}
