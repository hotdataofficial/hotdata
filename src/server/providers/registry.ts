import { GsubzProvider, gsubzPurchasesEnabled } from "./gsubz";
import type { VtuProvider, ProviderFactory } from "./types";
import { HttpError } from "../security/http";
export const supportedAdapters = ["gsubz", "vtpass", "datastation", "clubkonnect"] as const;
export function isAdapterReady(adapter: string): boolean { return adapter === "gsubz" && gsubzPurchasesEnabled(); }
// Templates stay disabled until request/response contracts and definitive-failure semantics are reviewed.
class DisabledProvider implements VtuProvider {
  async buyData(): Promise<never> { throw new HttpError(503, "Provider adapter is not configured."); }
  async buyAirtime(): Promise<never> { throw new HttpError(503, "Provider adapter is not configured."); }
  async checkStatus() { return { status: "UNKNOWN" as const, code: "ADAPTER_DISABLED" }; }
  async getBalance(): Promise<bigint> { throw new HttpError(503, "Provider adapter is not configured."); }
  async getPlans(): Promise<{ code: string; name: string }[]> { throw new HttpError(503, "Provider adapter is not configured."); }
}
export const providerFactory: ProviderFactory = provider => provider.adapter === "gsubz" ? new GsubzProvider(provider.baseUrl) : new DisabledProvider();
