import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { fundingFee } from "@/lib/money";
import { HttpError } from "../security/http";
export async function fundingSettings(client: Pick<Prisma.TransactionClient, "setting"> = db) {
  const rows = await client.setting.findMany({ where: { key: { in: ["fundingMinKobo", "fundingMaxKobo", "fundingFeeFlatKobo", "fundingFeeBps", "walletTransfersEnabled"] } } });
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const parse = (key: string, fallback: string) => {
    const value = String(values[key] ?? fallback);
    if (!/^\d+$/.test(value)) throw new HttpError(503, "Funding settings need administrator attention.");
    return BigInt(value);
  };
  const minimum = parse("fundingMinKobo", process.env.FUNDING_MIN_KOBO || "10000");
  const maximum = parse("fundingMaxKobo", process.env.FUNDING_MAX_KOBO || "100000000");
  const flat = parse("fundingFeeFlatKobo", process.env.FUNDING_FEE_FLAT_KOBO || "0");
  const bps = Number(parse("fundingFeeBps", process.env.FUNDING_FEE_BPS || "0"));
  if (maximum < minimum || minimum <= 0n || bps > 10000) throw new HttpError(503, "Funding settings need administrator attention.");
  return { minimum, maximum, flat, bps, transfersEnabled: values.walletTransfersEnabled === true };
}
export function validateFundingAmount(amount: bigint, settings: Awaited<ReturnType<typeof fundingSettings>>) {
  if (amount < settings.minimum || amount > settings.maximum) throw new HttpError(400, "Amount is outside the funding limits.");
  try { return fundingFee(amount, settings.flat, settings.bps); }
  catch { throw new HttpError(400, "Amount must exceed the configured funding fee."); }
}
