import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { HttpError } from "../security/http";
import { historyQuerySchema } from "@/lib/validation/customer";
import { historyDates } from "@/lib/history-dates";
import type { Receipt } from "@/lib/customer";
const snapshotSchema = z.object({ name: z.string(), networkCode: z.string(), type: z.string(), sizeMb: z.number(), validityDays: z.number() });
export function planDetails(snapshot: unknown, fallback?: { name: string; type: string; sizeMb: number; validityDays: number; network: { code: string } } | null) {
  const result = snapshotSchema.safeParse(snapshot);
  return result.success ? result.data : fallback ? { name: fallback.name, type: fallback.type, sizeMb: fallback.sizeMb, validityDays: fallback.validityDays, networkCode: fallback.network.code } : null;
}
export async function purchaseHistory(userId: string, input: z.infer<typeof historyQuerySchema>) {
  let createdAt: ReturnType<typeof historyDates>; try { createdAt = historyDates(input.from, input.to); } catch { throw new HttpError(400, "Enter a valid calendar date."); }
  const where: Prisma.TransactionWhereInput = { userId, type: input.purchaseType || { in: ["DATA", "AIRTIME"] }, ...(input.status ? { status: input.status } : {}), ...(input.from || input.to ? { createdAt } : {}), AND: [
    ...(input.search ? [{ OR: [{ reference: { contains: input.search, mode: "insensitive" as const } }, { phone: { contains: input.search.replace(/[^0-9+]/g, "").replace(/^0(?=[0-9]{10}$)/, "+234") || input.search } }] }] : []),
    ...(input.network ? [{ OR: [{ planSnapshot: { path: ["networkCode"], equals: input.network } }, { planSnapshot: { equals: Prisma.DbNull }, plan: { network: { code: input.network } } }] }] : []),
  ] };
  if (input.cursor && !await db.transaction.findFirst({ where: { id: input.cursor, userId, type: { in: ["DATA", "AIRTIME"] } }, select: { id: true } })) throw new HttpError(400, "Invalid history cursor.");
  // Older transactions predate plan snapshots. Relation filtering remains a
  // fallback only; all new purchases filter their historical network.
  const rows = await db.transaction.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), include: { plan: { include: { network: true } } } });
  const page = rows.slice(0, 20);
  return { transactions: page.map(t => ({ id: t.id, purchaseType: t.type, reference: t.reference, phone: t.phone, status: t.status, amountKobo: t.amountKobo.toString(), refundedAt: t.refundedAt, createdAt: t.createdAt, plan: planDetails(t.planSnapshot, t.plan) })), nextCursor: rows.length > 20 ? page[page.length - 1].id : null };
}
export async function ownReceipt(userId: string, reference: string): Promise<Receipt> {
  if (!reference || reference.length > 100) throw new HttpError(404, "Receipt not found.");
  const order = await db.transaction.findFirst({ where: { userId, reference, type: { in: ["DATA", "AIRTIME"] } }, include: { user: { select: { fullName: true } }, plan: { include: { network: true } } } });
  if (!order) throw new HttpError(404, "Receipt not found.");
  return { purchaseType: order.type === "AIRTIME" ? "AIRTIME" : "DATA", reference: order.reference, status: order.status, phone: order.phone, amountKobo: order.amountKobo.toString(), refundedAt: order.refundedAt?.toISOString() || null, createdAt: order.createdAt.toISOString(), completedAt: order.completedAt?.toISOString() || null, plan: planDetails(order.planSnapshot, order.plan), historicalSnapshot: snapshotSchema.safeParse(order.planSnapshot).success, customerName: order.user.fullName, planId: order.planId };
}
