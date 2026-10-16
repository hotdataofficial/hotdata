export type ProviderResult = { status: "SUCCESSFUL" | "FAILED" | "UNKNOWN"; code: string; costKobo?: string };
export type DataOrder = { reference: string; phone: string; networkCode: string; providerPlanCode: string; expectedCostKobo?: string };
export interface VtuProvider {
  buyData(order: DataOrder): Promise<ProviderResult>;
  buyAirtime(order: { reference: string; phone: string; networkCode: string; amountKobo: bigint }): Promise<ProviderResult>;
  checkStatus(reference: string): Promise<ProviderResult>;
  getBalance(): Promise<bigint>;
  getPlans(): Promise<{ code: string; name: string }[]>;
}
export type ProviderFactory = (provider: { adapter: string; credentialsEncrypted: string | null; baseUrl: string }) => VtuProvider;
