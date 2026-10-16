import { db } from "../db";
import { verifyOwnFunding } from "../services/funding";
export function recoverableFundingWhere() {
  return { gateway: { in: ["korapay", "paystack"] }, status: "PENDING" as const, reviewRequired: false, checkoutUrl: { not: null }, createdAt: { gte: new Date(Date.now() - 7 * 86400000), lte: new Date(Date.now() - 60000) } };
}
export async function reconcilePendingFunding() {
  const rows = await db.fundingTransaction.findMany({ where: recoverableFundingWhere(), orderBy: { createdAt: "desc" }, take: 5, select: { userId: true, reference: true } });
  let confirmed = 0;
  for (const row of rows) {
    try { const result = await verifyOwnFunding(row.userId, row.reference); if (result.status === "SUCCESSFUL") confirmed++; }
    catch { console.warn("Funding confirmation will retry; no unverified wallet credit was applied."); }
  }
  console.info("HOTDATA_FUNDING_RECOVERY", JSON.stringify({ checked: rows.length, confirmed }));
}
