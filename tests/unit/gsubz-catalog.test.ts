import { describe, expect, it } from "vitest";
import { normalizeGsubzPlans, suggestedGsubzPrice } from "../../src/lib/gsubz-catalog";
describe("Gsubz bundle catalog and margin policy",()=>{
 it("uses API cost, retains restrictions and maps exact provider codes",()=>{
  const [plan]=normalizeGsubzPlans("mtn_gifting",{plans:[{displayName:"1.2GB (All Social Media) - 30days",value:"166",price:"1000",api_price:"394.89"}]});
  expect(plan).toMatchObject({network:"MTN",type:"GIFTING",sizeMb:1229,validityDays:30,costKobo:"39489",customerPriceKobo:"43500",agentPriceKobo:"41500",providerPlanCode:"mtn_gifting:166"});
  expect(plan.name).toContain("All Social Media");
 });
 it("removes supplier promotional prices from the retail label",()=>{expect(normalizeGsubzPlans("mtn_sme",{plans:[{displayName:"5GB - 30days (Promo: N359/GB)",value:"5",api_price:"1000"}]})[0].name).toBe("5GB - 30days");});
 it("handles mixed spacing and minimum margins using integer kobo",()=>{
  const [plan]=normalizeGsubzPlans("glo_data",{plans:[{displayName:"200 MB - 14days",value:200,api_price:"118.80"}]});
  expect(plan).toMatchObject({sizeMb:200,validityDays:14,customerPriceKobo:"14000",agentPriceKobo:"13000",type:"CORPORATE_GIFTING"});
  expect(suggestedGsubzPrice(10000n,"CUSTOMER")).toBe(12000n);
  expect(suggestedGsubzPrice(10000n,"AGENT")).toBe(11000n);
 });
 it("rejects unknown services, incomplete labels, fractional kobo and duplicate mappings",()=>{
  expect(()=>normalizeGsubzPlans("unknown",{plans:[]})).toThrow();
  for(const plan of [{displayName:"Unlimited",value:"1",api_price:"100"},{displayName:"1GB - 30days",value:"1",api_price:"1.001"},{displayName:"1GB - 30days",value:"1",api_price:"0"}])expect(()=>normalizeGsubzPlans("mtn_sme",{plans:[plan]})).toThrow();
  const plan={displayName:"1GB - 30days",value:"1",api_price:"100"};expect(()=>normalizeGsubzPlans("mtn_sme",{plans:[plan,plan]})).toThrow();
 });
});
