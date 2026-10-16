import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireRole } from "@/server/auth/rbac";
import { lockAdmin } from "@/server/auth/admin-transaction";
import { body, checkCsrf, endpoint, HttpError, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { GsubzProvider, gsubzPurchasesEnabled } from "@/server/providers/gsubz";
import { fetchGsubzCatalog } from "@/server/providers/gsubz-catalog";
export const runtime="nodejs";
export const maxDuration=60;
export const GET=endpoint(async(req:NextRequest)=>{
 const actor=await requireRole(req,["SUPER_ADMIN"]);await rateLimit("gsubz-check",actor.id,5,60);
 try { const balance=await new GsubzProvider().getBalance();return json({authenticated:true,balanceKobo:balance.toString(),purchasesEnabled:gsubzPurchasesEnabled()}); }
 catch { throw new HttpError(503,"Gsubz balance check failed. Check the server API key and provider account."); }
});
export const POST=endpoint(async(req:NextRequest)=>{
 checkCsrf(req);const actor=await requireRole(req,["SUPER_ADMIN"]);await rateLimit("gsubz-sync",actor.id,3,300);
 await body(req,z.object({action:z.literal("sync")}).strict());
 let catalog:Awaited<ReturnType<typeof fetchGsubzCatalog>>;try{catalog=await fetchGsubzCatalog();}catch{throw new HttpError(503,"Gsubz returned an incomplete catalog. No plans were changed.");}
 await db.$transaction(async tx=>{
  await lockAdmin(tx,actor.id,true);
  const prior=await tx.provider.findUnique({where:{code:"GSUBZ"}});
  if(prior&&await tx.providerAttempt.count({where:{providerId:prior.id,status:"PENDING"}}))throw new HttpError(409,"Resolve pending Gsubz orders before syncing.");
  const provider=await tx.provider.upsert({where:{code:"GSUBZ"},create:{code:"GSUBZ",name:"Gsubz",adapter:"gsubz",baseUrl:"https://api.gsubz.com",active:false,priority:10},update:{active:false}});
  const codes:string[]=[];
  for(const row of catalog.plans){
   const network=await tx.network.upsert({where:{code:row.network},create:{code:row.network,name:row.networkName},update:{name:row.networkName}});
   const priorPlan=await tx.plan.findUnique({where:{code:row.code}});
   const suggestedCustomer=BigInt(row.customerPriceKobo),suggestedAgent=BigInt(row.agentPriceKobo),cost=BigInt(row.costKobo);
   const data={networkId:network.id,name:row.name,type:row.type,sizeMb:row.sizeMb,validityDays:row.validityDays,costKobo:cost,customerPriceKobo:priorPlan&&priorPlan.customerPriceKobo>=cost?priorPlan.customerPriceKobo:suggestedCustomer,agentPriceKobo:priorPlan&&priorPlan.agentPriceKobo>=cost?priorPlan.agentPriceKobo:suggestedAgent};
   const plan=await tx.plan.upsert({where:{code:row.code},create:{...data,code:row.code,active:true},update:data});
   await tx.providerPlanMap.upsert({where:{planId_providerId:{planId:plan.id,providerId:provider.id}},create:{planId:plan.id,providerId:provider.id,providerPlanCode:row.providerPlanCode,active:true},update:{providerPlanCode:row.providerPlanCode}});
   codes.push(row.code);
  }
  await tx.plan.updateMany({where:{code:{startsWith:"GSUBZ_",notIn:codes}},data:{active:false}});
  await tx.auditLog.create({data:{actorId:actor.id,action:"GSUBZ_CATALOG_SYNC",entityType:"Plan",metadata:{count:codes.length,fetchedAt:catalog.fetchedAt,deliveryEnabled:false}}});
 },{timeout:45000});
 return json({imported:catalog.plans.length,fetchedAt:catalog.fetchedAt,deliveryEnabled:false});
});