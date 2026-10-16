import { z } from "zod";
import { db } from "../db";
import { sendEmail } from "./delivery";
import { formatKobo } from "../../lib/money";
export async function dispatchFundingEmails(limit = 20) {
  let delivered = 0;
  for (let i = 0; i < Math.min(20, limit); i++) {
    const event = await db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "OutboxEvent" WHERE kind = 'EMAIL_FUNDING' AND "deliveredAt" IS NULL AND "availableAt" <= NOW() AND attempts < 10 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      return tx.outboxEvent.update({ where: { id: rows[0].id }, data: { attempts: { increment: 1 }, availableAt: new Date(Date.now() + 60000) } });
    });
    if (!event) break;
    try {
      const input = z.object({ email: z.email(), amountKobo: z.string().regex(/^\d+$/), feeKobo: z.string().regex(/^\d+$/), reference: z.string() }).parse(event.payload);
      await sendEmail(input.email, "Your Hotdata wallet has been funded", "Your wallet received " + formatKobo(BigInt(input.amountKobo) - BigInt(input.feeKobo)) + ". Funding fee: " + formatKobo(input.feeKobo) + ". Reference: " + input.reference);
      await db.outboxEvent.update({ where: { id: event.id }, data: { deliveredAt: new Date() } }); delivered++;
    } catch {
      await db.outboxEvent.update({ where: { id: event.id }, data: { availableAt: new Date(Date.now() + Math.min(86400000, 60000 * 2 ** event.attempts)) } });
    }
  }
  return delivered;
}
