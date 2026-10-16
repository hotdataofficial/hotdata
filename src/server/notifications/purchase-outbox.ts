import { z } from "zod";
import { db } from "../db";
import { sendEmail } from "./delivery";
import { formatKobo } from "@/lib/money";
import { config } from "../config";
export async function dispatchPurchaseEmails(limit = 20) {
  let delivered = 0;
  for (let i = 0; i < Math.min(20, limit); i++) {
    const event = await db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "OutboxEvent" WHERE kind = 'EMAIL_PURCHASE' AND "deliveredAt" IS NULL AND "availableAt" <= NOW() AND attempts < 10 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      return tx.outboxEvent.update({ where: { id: rows[0].id }, data: { attempts: { increment: 1 }, availableAt: new Date(Date.now() + 60000) } });
    });
    if (!event) break;
    try {
      const input = z.object({ email: z.email(), reference: z.string().min(1).max(100), amountKobo: z.string().regex(/^[1-9]\d{0,14}$/), status: z.enum(["SUCCESSFUL", "FAILED"]), refunded: z.boolean() }).parse(event.payload);
      const title = input.status === "SUCCESSFUL" ? "Your Hotdata data receipt" : "Your Hotdata purchase was refunded";
      const receiptUrl = new URL("/receipts/" + encodeURIComponent(input.reference), config().APP_URL).toString();
      await sendEmail(input.email, title, "Reference: " + input.reference + ". Amount: " + formatKobo(input.amountKobo) + ". Status: " + (input.status === "SUCCESSFUL" ? "Successful" : input.refunded ? "Failed, refunded" : "Failed") + ". Sign in to view your receipt: " + receiptUrl);
      await db.outboxEvent.update({ where: { id: event.id }, data: { deliveredAt: new Date() } }); delivered++;
    } catch {
      await db.outboxEvent.update({ where: { id: event.id }, data: { availableAt: new Date(Date.now() + Math.min(86400000, 60000 * 2 ** event.attempts)) } });
    }
  }
  return delivered;
}
