import { fetchGsubzCatalog } from "./gsubz-catalog";
import { HttpError } from "../security/http";
import { parseNaira } from "@/lib/money";
import type { DataOrder, ProviderResult, VtuProvider } from "./types";
const origin = "https://api.gsubz.com";
export function gsubzPurchasesEnabled() { return process.env.GSUBZ_ALLOW_LIVE === "true" && process.env.KORAPAY_ALLOW_LIVE === "true" && !!process.env.GSUBZ_API_KEY; }
export function gsubzResult(value: unknown): ProviderResult {
  if (!value || typeof value !== "object") return {status:"UNKNOWN",code:"INVALID_RESPONSE"};
  const data = value as Record<string, unknown>;
  if (data.status === "successful" && [200,406].includes(Number(data.code)) && data.transactionID) {
    try { const costKobo = data.amountPaid === undefined ? undefined : parseNaira(String(data.amountPaid)).toString(); return {status:"SUCCESSFUL",code:"GSUBZ_DELIVERED",...(costKobo ? {costKobo} : {})}; }
    catch { return {status:"UNKNOWN",code:"INVALID_PROVIDER_COST"}; }
  }
  // Gateway errors, missing records and duplicate outcomes require reconciliation.
  if (data.status === "failed" && ["REQUIRED_CONTENT_NOT_SENT","INVALID_CONTENT","INVALID_PLAN","INVALID_API_OR_NOT_FOUND","INSUFFICIENT_BALANCE","REQUEST_METHOD_NOT_IN_POST","SERVICE_DISABLED"].includes(String(data.description))) return {status:"FAILED",code:String(data.description)};
  return {status:"UNKNOWN",code:"GSUBZ_UNCERTAIN"};
}
export function gsubzStatusResult(value: unknown): ProviderResult {
  // The status endpoint uses a different contract from the purchase endpoint.
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    if (Number(data.code) === 200 && data.status === "success" && data.description === "TRANSACTION_SUCCESSFUL") return { status: "SUCCESSFUL", code: "GSUBZ_DELIVERED" };
  }
  return gsubzResult(value);
}
export class GsubzProvider implements VtuProvider {
  constructor(baseUrl = origin) { if (baseUrl.replace(/\/$/, "") !== origin) throw new HttpError(400,"Gsubz must use its official API URL."); }
  private async post(path: string, fields: Record<string,string>) {
    const key = process.env.GSUBZ_API_KEY;
    if (!key) throw new HttpError(503,"Gsubz credentials are not configured.");
    const response = await fetch(origin+path,{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({...fields,api:key}),redirect:"error",signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw new HttpError(502,"Gsubz response requires reconciliation.");
    return await response.json() as Record<string,unknown>;
  }
  async buyData(order: DataOrder): Promise<ProviderResult> {
    if (!gsubzPurchasesEnabled()) throw new HttpError(503,"Real Gsubz purchases are disabled while payments are in test mode.");
    // A mapping stores serviceID:plan, since one network has multiple Gsubz services.
    const mapping = /^([a-z0-9_-]+):([a-zA-Z0-9_-]+)$/.exec(order.providerPlanCode);
    if (!mapping) throw new HttpError(400,"Gsubz mapping must contain serviceID:plan.");
    const phone = order.phone.replace(/^\+234/,"0");
    if (!/^0[789]\d{9}$/.test(phone)) throw new HttpError(400,"Invalid Nigerian phone number.");
    let sending = false;
    try {
      if (order.expectedCostKobo) {
        const plansResponse = await fetch(origin+"/api/plans/?service="+encodeURIComponent(mapping[1]),{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(20000)});
        if (!plansResponse.ok) return {status:"FAILED",code:"PRICE_CHECK_UNAVAILABLE"};
        const catalog = await plansResponse.json() as {plans?:{value:string|number;api_price:string|number}[]};
        const plan = catalog.plans?.find(p=>String(p.value)===mapping[2]);
        if (!plan) return {status:"FAILED",code:"GSUBZ_PLAN_REMOVED"};
        if (parseNaira(String(plan.api_price)) > BigInt(order.expectedCostKobo)) return {status:"FAILED",code:"GSUBZ_PRICE_INCREASED"};
      }
      sending = true;
      return gsubzResult(await this.post("/api/pay/",{serviceID:mapping[1],plan:mapping[2],phone,amount:"",requestID:order.reference})); }
    catch { return sending ? {status:"UNKNOWN" as const,code:"GSUBZ_UNCERTAIN"} : {status:"FAILED" as const,code:"GSUBZ_PRICE_CHECK_FAILED"}; }
  }
  async buyAirtime(): Promise<never> { throw new HttpError(503,"Gsubz airtime is not enabled."); }
  async checkStatus(reference: string) { try { return gsubzStatusResult(await this.post("/api/verify/",{requestID:reference})); } catch { return {status:"UNKNOWN" as const,code:"GSUBZ_UNCERTAIN"}; } }
  async getBalance() { const result=await this.post("/api/balance/",{}); if (typeof result.balance !== "string" && typeof result.balance !== "number") throw new HttpError(502,"Invalid Gsubz balance response."); return parseNaira(String(result.balance)); }
  async getPlans(): Promise<{code:string;name:string}[]> { return (await fetchGsubzCatalog()).plans.map(plan=>({code:plan.providerPlanCode,name:plan.name})); }
}
