import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireActor } from "@/server/auth/sessions";
import { requireRole,agentRoles } from "@/server/auth/rbac";
import { endpoint,json,checkCsrf,body,HttpError } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { apiKeySchema,revokeKeySchema,bulkQuoteSchema,bulkPurchaseSchema,upgradeSchema } from "@/lib/validation/agent";
import { agentOverview,createAgentKey,revokeAgentKey,quoteBulk,submitBulk,requestAgentUpgrade,payAgentUpgrade } from "@/server/services/agent";
import { purchaseView } from "@/server/services/purchases";
export const runtime="nodejs";
type Context={params:Promise<{action:string}>};
export async function GET(req:NextRequest,context:Context){const {action}=await context.params;return endpoint(async req=>{const actor=action==="overview"?await requireActor(req):await requireRole(req,agentRoles);await rateLimit("agent-read",actor.id,120,60);if(action==="overview")return json(await agentOverview(actor.id));if(action==="keys")return json({keys:await db.apiKey.findMany({where:{userId:actor.id},select:{id:true,name:true,prefix:true,ipWhitelist:true,callbackUrl:true,revokedAt:true,lastUsedAt:true,createdAt:true},orderBy:{createdAt:"desc"},take:50})});if(action==="batches"){const rows=await db.bulkBatch.findMany({where:{userId:actor.id},orderBy:{createdAt:"desc"},take:20,include:{transactions:{orderBy:{bulkRow:"asc"}}}});return json({batches:rows.map(batch=>({id:batch.id,totalKobo:batch.totalKobo.toString(),createdAt:batch.createdAt,rowCount:batch.rowCount,rows:batch.transactions.map(purchaseView)}))});}throw new HttpError(404,"Agent endpoint not found.");})(req);}
export async function POST(req:NextRequest,context:Context){const {action}=await context.params;return endpoint(async req=>{checkCsrf(req);const actor=action==="upgrade"?await requireActor(req):await requireRole(req,agentRoles);await rateLimit("agent-write",actor.id,10,60);if(action==="keys")return json(await createAgentKey(actor.id,await body(req,apiKeySchema)),201);if(action==="revoke")return json(await revokeAgentKey(actor.id,(await body(req,revokeKeySchema)).id));if(action==="quote")return json(await quoteBulk(actor.id,await body(req,bulkQuoteSchema)));if(action==="bulk")return json(await submitBulk(actor.id,await body(req,bulkPurchaseSchema)),202);if(action==="upgrade"){const input=await body(req,upgradeSchema);return json(input.action==="request"?await requestAgentUpgrade(actor.id,input.reason):await payAgentUpgrade(actor.id,input));}throw new HttpError(404,"Agent endpoint not found.");})(req);}
