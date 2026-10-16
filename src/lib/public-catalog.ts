export type PublicNetwork = { id: string; code: string; name: string };
export type PublicPlan = { id: string; networkId: string; name: string; type: string; sizeMb: number; validityDays: number; priceKobo: string; available: boolean };
export type PublicCatalog = { networks: PublicNetwork[]; plans: PublicPlan[]; updatedAt: string };
type Row = { id: string; networkId: string; name: string; type: string; sizeMb: number; validityDays: number; customerPriceKobo: bigint; mappings: { provider: { adapter: string } }[] };
export function publicPlan(row: Row, ready: (adapter: string) => boolean): PublicPlan {
  return { id: row.id, networkId: row.networkId, name: row.name, type: row.type, sizeMb: row.sizeMb, validityDays: row.validityDays, priceKobo: row.customerPriceKobo.toString(), available: row.mappings.some(m => ready(m.provider.adapter)) };
}
export function publicPlanType(type: string) { return type === "CORPORATE_GIFTING" ? "Corporate gifting" : type === "GIFTING" ? "Gifting" : type === "DIRECT" ? "Direct" : "SME"; }
export function planSize(mb: number) { return mb >= 1024 ? (mb / 1024).toLocaleString("en-NG", { maximumFractionDigits: 2 }) + " GB" : mb + " MB"; }
