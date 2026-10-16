import { z } from "zod";
import { parseNaira } from "./money";
export const gsubzServices = [
 {serviceID:"mtn_sme",network:"MTN",networkName:"MTN",type:"SME"},
 {serviceID:"mtn_gifting",network:"MTN",networkName:"MTN",type:"GIFTING"},
 {serviceID:"airtel_sme",network:"AIRTEL",networkName:"Airtel",type:"SME"},
 {serviceID:"airtel_gifting",network:"AIRTEL",networkName:"Airtel",type:"GIFTING"},
 {serviceID:"glo_sme",network:"GLO",networkName:"Glo",type:"SME"},
 {serviceID:"glo_data",network:"GLO",networkName:"Glo",type:"CORPORATE_GIFTING"},
 {serviceID:"etisalat_data",network:"9MOBILE",networkName:"9mobile / T2",type:"DIRECT"},
] as const;
const rawPlan = z.object({displayName:z.string().min(1).max(100),value:z.union([z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),z.number().int().nonnegative()]),api_price:z.union([z.string(),z.number()])});
const responseSchema=z.object({plans:z.array(rawPlan).max(1000)});
export function suggestedGsubzPrice(cost:bigint,tier:"CUSTOMER"|"AGENT") {
 if(cost<=0n)throw new Error("Provider cost must be positive.");
 const bps=tier==="CUSTOMER"?1000n:500n,min=tier==="CUSTOMER"?2000n:1000n;
 const percentage=(cost*bps+9999n)/10000n,margin=percentage>min?percentage:min;
 return ((cost+margin+499n)/500n)*500n;
}
export function normalizeGsubzPlans(serviceID:string,response:unknown){
 const service=gsubzServices.find(s=>s.serviceID===serviceID);if(!service)throw new Error("Unsupported Gsubz data service.");
 const data=responseSchema.parse(response),seen=new Set<string>();
 return data.plans.map(raw=>{
  const name=raw.displayName.replace(/\(Promo:[^)]*\)/gi,"").replace(/\s+/g," ").trim();
  const size=/([0-9]+(?:\.[0-9]+)?)\s*(GB|MB)\b/i.exec(name),days=/([0-9]+)\s*days?\b/i.exec(name);
  if(!size||!days)throw new Error("Bundle size or validity requires manual review: "+name);
  const sizeMb=Math.round(Number(size[1])*(size[2].toUpperCase()==="GB"?1024:1)),validityDays=Number(days[1]);
  if(sizeMb<=0||sizeMb>1000000||validityDays<1||validityDays>365)throw new Error("Unsupported bundle dimensions.");
  const costKobo=parseNaira(String(raw.api_price));if(costKobo<=0n)throw new Error("Invalid supplier cost.");
  const code="GSUBZ_"+serviceID.toUpperCase()+"_"+String(raw.value).toUpperCase();if(seen.has(code))throw new Error("Duplicate provider plan.");seen.add(code);
  return {...service,code,name,sizeMb,validityDays,costKobo:costKobo.toString(),customerPriceKobo:suggestedGsubzPrice(costKobo,"CUSTOMER").toString(),agentPriceKobo:suggestedGsubzPrice(costKobo,"AGENT").toString(),providerPlanCode:serviceID+":"+raw.value};
 });
}
export type GsubzCatalogPlan=ReturnType<typeof normalizeGsubzPlans>[number];
