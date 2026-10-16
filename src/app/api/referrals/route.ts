import { db } from "@/server/db";
import { requireActor } from "@/server/auth/sessions";
import { endpoint,json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { config } from "@/server/config";
export const runtime="nodejs";
export const GET=endpoint(async req=>{const actor=await requireActor(req);await rateLimit("referrals-read",actor.id,60,60);const [user,clicks,signups,earnings,total,pending]=await Promise.all([db.user.findUniqueOrThrow({where:{id:actor.id},select:{referralCode:true}}),db.referralClick.count({where:{referrerId:actor.id,createdAt:{gte:new Date(Date.now()-30*86400000)}}}),db.user.count({where:{referredById:actor.id}}),db.referralEarning.findMany({where:{referrerId:actor.id},select:{id:true,amountKobo:true,trigger:true,createdAt:true,reference:true},orderBy:{createdAt:"desc"},take:50}),db.referralEarning.aggregate({where:{referrerId:actor.id},_sum:{amountKobo:true}}),db.outboxEvent.count({where:{kind:"REFERRAL_REWARD",deliveredAt:null,payload:{path:["referrerId"],equals:actor.id}}})]);return json({code:user.referralCode,link:config().APP_URL.replace(/\/$/,"")+"/r/"+encodeURIComponent(user.referralCode),uniqueVisitors30Days:clicks,signups,pendingRewards:pending,earningsKobo:(total._sum.amountKobo||0n).toString(),earnings:earnings.map(e=>({...e,amountKobo:e.amountKobo.toString()}))});});
