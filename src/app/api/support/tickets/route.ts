import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { requireActor } from "@/server/auth/sessions";
import { checkCsrf, body, endpoint, json, HttpError } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { ticketSchema } from "@/lib/validation/admin";
export const runtime="nodejs";
export const GET=endpoint(async req=>{const actor=await requireActor(req);await rateLimit("tickets-read",actor.id,60,60);return json({tickets:await db.supportTicket.findMany({where:{userId:actor.id},select:{id:true,reference:true,subject:true,body:true,status:true,createdAt:true},orderBy:{createdAt:"desc"},take:50})});});
export const POST=endpoint(async req=>{checkCsrf(req);const actor=await requireActor(req);await rateLimit("tickets-create",actor.id,5,3600);const input=await body(req,ticketSchema);const ticket=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.id} FOR UPDATE`;if(await tx.supportTicket.count({where:{userId:actor.id,status:{in:["OPEN","IN_PROGRESS"]}}})>=10)throw new HttpError(400,"Resolve an existing ticket before opening another.");return tx.supportTicket.create({data:{userId:actor.id,reference:"HD-S-"+randomUUID(),...input}});});return json({reference:ticket.reference},201);});
