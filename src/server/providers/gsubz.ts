import { airtimeAmount } from "@/lib/airtime";
import { fetchGsubzCatalog } from "./gsubz-catalog";
import { HttpError } from "../security/http";
import { parseNaira } from "@/lib/money";
import type { DataOrder, ProviderResult, VtuProvider } from "./types";
const origin = "https://api.gsubz.com";
// Supplier discounts can contain sub-kobo fractions (e.g. 380.58461538462).
// Round once to the nearest kobo with decimal arithmetic, never binary floats.
export function gsubzCost(input: unknown): bigint {
  if (typeof input !== "string" && typeof input !== "number") throw new Error("Invalid supplier amount");
  const text = String(input).trim();
  if (!/^\d{1,12}(?:\.\d{1,15})?$/.test(text)) throw new Error("Invalid supplier amount");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, "0")) + (Number(fraction[2] || "0") >= 5 ? 1n : 0n);
}
export function gsubzPurchasesEnabled() { return process.env.GSUBZ_ALLOW_LIVE === "true" && process.env.KORAPAY_ALLOW_LIVE === "true" && !!process.env.GSUBZ_API_KEY; }
export function gsubzResult(value: unknown): ProviderResult {
  if (!value || typeof value !== "object") return {status:"UNKNOWN",code:"INVALID_RESPONSE"};
  const data = value as Record<string, unknown>;
  if (Number(data.code) === 407) return { status: "FAILED", code: "API_ACCESS_NOT_ENABLED" };
  if (data.status === "successful" && [200,406].includes(Number(data.code)) && data.transactionID) {
    const providerTransactionId = /^\d{1,30}$/.test(String(data.transactionID)) ? String(data.transactionID) : undefined;
    try { const costKobo = data.amountPaid === undefined ? undefined : gsubzCost(data.amountPaid).toString(); return {status:"SUCCESSFUL",code:"GSUBZ_DELIVERED",...(costKobo ? {costKobo} : {}),...(providerTransactionId ? {providerTransactionId} : {})}; }
    catch { return {status:"UNKNOWN",code:"INVALID_PROVIDER_COST",...(providerTransactionId ? {providerTransactionId} : {})}; }
  }
  // Gateway errors, missing records and duplicate outcomes require reconciliation.
  if (data.status === "failed" && ["REQUIRED_CONTENT_NOT_SENT","INVALID_CONTENT","INVALID_PLAN","INVALID_API_OR_NOT_FOUND","INSUFFICIENT_BALANCE","REQUEST_METHOD_NOT_IN_POST","SERVICE_DISABLED","ACCOUNT_BLOCKED"].includes(String(data.description))) return {status:"FAILED",code:String(data.description)};
  return {status:"UNKNOWN",code:"GSUBZ_UNCERTAIN"};
}
export function gsubzStatusResult(value: unknown): ProviderResult {
  // The status endpoint uses a different contract from the purchase endpoint.
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    if (Number(data.code) === 200 && data.status === "success" && data.description === "TRANSACTION_SUCCESSFUL") {
      try { return { status: "SUCCESSFUL", code: "GSUBZ_DELIVERED", ...(data.amount !== undefined ? {costKobo:gsubzCost(data.amount).toString()} : {}) }; }
      catch { return {status:"UNKNOWN",code:"INVALID_PROVIDER_COST"}; }
    }
  }
  return gsubzResult(value);
}
export class GsubzProvider implements VtuProvider {
  constructor(baseUrl = origin) { if (baseUrl.replace(/\/$/, "") !== origin) throw new HttpError(400,"Gsubz must use its official API URL."); }
  private async post(path: string, fields: Record<string,string>) {
    const key = process.env.GSUBZ_API_KEY?.trim();
    if (!key) throw new HttpError(503,"Gsubz credentials are not configured.");
    const response = await fetch(origin+path,{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({...fields,api:key}),redirect:"error",signal:AbortSignal.timeout(60000)});
    const result = await response.json() as Record<string,unknown>;
    // Preserve explicit, uncharged API rejections even when the HTTP status is not 2xx.
    if (!response.ok && !(path === "/api/pay/" && gsubzResult(result).status === "FAILED")) throw new HttpError(502,"Gsubz response requires reconciliation.");
    return result;
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
  async buyAirtime(order: { reference: string; phone: string; networkCode: string; amountKobo: bigint }): Promise<ProviderResult> {
    if (!gsubzPurchasesEnabled()) throw new HttpError(503, "Real purchases are disabled.");
    const services: Record<string, string> = { MTN: "mtn", AIRTEL: "airtel", GLO: "glo", "9MOBILE": "etisalat" };
    const serviceID = services[order.networkCode], phone = order.phone.replace(/^\+234/, "0");
    if (!serviceID || !/^0[789]\d{9}$/.test(phone) || !airtimeAmount.safeParse(order.amountKobo.toString()).success) return { status: "FAILED", code: "INVALID_AIRTIME_REQUEST" };
    // One stable requestID per intended delivery. A transport failure never proves non-delivery.
    try { return gsubzResult(await this.post("/api/pay/", { serviceID, amount: (order.amountKobo / 100n).toString(), phone, requestID: order.reference })); }
    catch { return { status: "UNKNOWN", code: "GSUBZ_UNCERTAIN" }; }
  }
  async checkStatus(reference: string, providerTransactionId?: string) { const id = providerTransactionId && /^\d{1,30}$/.test(providerTransactionId) ? providerTransactionId : undefined; try { return {...gsubzStatusResult(await this.post("/api/verify/",{requestID:id || reference})), ...(id ? {providerTransactionId:id} : {})}; } catch { return {status:"UNKNOWN" as const,code:"GSUBZ_UNCERTAIN",...(id ? {providerTransactionId:id} : {})}; } }
  async getBalance() { const result=await this.post("/api/balance/",{}); if (typeof result.balance !== "string" && typeof result.balance !== "number") throw new HttpError(502,"Invalid Gsubz balance response."); return gsubzCost(result.balance); }
  async getPlans(): Promise<{code:string;name:string}[]> { return (await fetchGsubzCatalog()).plans.map(plan=>({code:plan.providerPlanCode,name:plan.name})); }
}
