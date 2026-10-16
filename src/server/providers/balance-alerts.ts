import { db } from "../db";
import { providerFactory, isAdapterReady } from "./registry";
import { sendEmail } from "../notifications/delivery";
import { formatKobo } from "@/lib/money";
export async function checkProviderBalances() {
  const providers = await db.provider.findMany({ where: { active: true, deletedAt: null } });
  for (const provider of providers) {
    if (!isAdapterReady(provider.adapter)) continue;
    try {
      const balance = await providerFactory(provider).getBalance();
      if (balance >= provider.lowBalanceThresholdKobo) continue;
      const key = "provider-alert:" + provider.id + ":" + new Date().toISOString().slice(0, 10);
      const event = await db.outboxEvent.upsert({ where: { dedupeKey: key }, create: { kind: "PROVIDER_BALANCE_ALERT", payload: { providerId: provider.id }, dedupeKey: key }, update: {} });
      if (!event.deliveredAt && process.env.PROVIDER_ALERT_EMAIL) {
        await sendEmail(process.env.PROVIDER_ALERT_EMAIL, "Hotdata provider balance alert", provider.name + " balance: " + formatKobo(balance));
        await db.outboxEvent.update({ where: { id: event.id }, data: { deliveredAt: new Date() } });
      }
    } catch { console.warn(JSON.stringify({ event: "provider_balance_check_unavailable", providerId: provider.id })); }
  }
}
// Telegram delivery is intentionally a stub; no token or chat ID is logged.
export async function telegramBalanceAlert(): Promise<never> { throw new Error("Telegram adapter is not configured."); }
