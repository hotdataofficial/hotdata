import { db } from "../db";
import { verifyOwnFunding } from "../services/funding";
export function recoverableFundingWhere() {
  return { gateway: { in: ["korapay", "paystack"] }, status: "PENDING" as const, reviewRequired: false, checkoutUrl: { not: null }, createdAt: { gte: new Date(Date.now() - 7 * 86400000), lte: new Date(Date.now() - 60000) } };
}
export async function reconcilePendingFunding() {
  // Oldest check first; otherwise five recent unpaid links can starve every
  // older gateway-confirmed payment until it leaves the recovery window.
  const rows = await db.fundingTransaction.findMany({ where: recoverableFundingWhere(), orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: 5, select: { id: true, userId: true, reference: true } });
  let confirmed = 0;
  for (const row of rows) {
    try { const result = await verifyOwnFunding(row.userId, row.reference); if (result.status === "SUCCESSFUL") confirmed++; }
    catch (error) {
      const detail = error as { name?: string; code?: string; status?: number; message?: string };
      console.warn("Funding confirmation will retry; no unverified wallet credit was applied.", JSON.stringify({ type: detail.name, code: /^[A-Z0-9_]{1,20}$/.test(detail.code || "") ? detail.code : undefined, status: detail.status, unsupportedVoid: /void|deserialize/i.test(detail.message || "") }));
    }
    finally {
      // Only scheduling metadata changes; settlement still requires gateway proof.
      await db.fundingTransaction.updateMany({ where: { id: row.id, status: "PENDING" }, data: { updatedAt: new Date() } });
    }
  }
  console.info("HOTDATA_FUNDING_RECOVERY", JSON.stringify({ checked: rows.length, confirmed }));
}
