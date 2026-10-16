import "dotenv/config";
import { PrismaClient, Role, PlanType } from "@prisma/client";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { z } from "zod";
const db = new PrismaClient();
async function main() {
  const credentials = z.object({ ADMIN_SEED_EMAIL: z.email(), ADMIN_SEED_PASSWORD: z.string().min(16), TEST_CUSTOMER_SEED_EMAIL: z.email().optional(), TEST_CUSTOMER_SEED_PASSWORD: z.string().min(12).optional(), TEST_AGENT_SEED_EMAIL: z.email().optional(), TEST_AGENT_SEED_PASSWORD: z.string().min(12).optional() }).parse(Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== "")));
  const networks = [["MTN", "MTN"], ["AIRTEL", "Airtel"], ["GLO", "Glo"], ["9MOBILE", "9mobile"]];
  for (const [code, name] of networks) {
    const network = await db.network.upsert({ where: { code }, update: {}, create: { code, name } });
    await db.plan.upsert({ where: { code: code + "-DEMO-1GB" }, update: {}, create: { networkId: network.id, code: code + "-DEMO-1GB", name: "Sample 1GB — configure before activation", type: PlanType.SME, sizeMb: 1024, validityDays: 30, costKobo: 25000n, customerPriceKobo: 30000n, agentPriceKobo: 28000n, active: false } });
  }
  const accounts: { email: string; password: string; name: string; phone: string; role: Role }[] = [
    { email: credentials.ADMIN_SEED_EMAIL.toLowerCase(), password: credentials.ADMIN_SEED_PASSWORD, name: "Hotdata Super Admin", phone: "+2348000000001", role: Role.SUPER_ADMIN },
  ];
  if (process.env.NODE_ENV !== "production") {
    if (!credentials.TEST_CUSTOMER_SEED_EMAIL || !credentials.TEST_CUSTOMER_SEED_PASSWORD || !credentials.TEST_AGENT_SEED_EMAIL || !credentials.TEST_AGENT_SEED_PASSWORD) throw new Error("Set all test seed credentials for development.");
    accounts.push({ email: credentials.TEST_CUSTOMER_SEED_EMAIL.toLowerCase(), password: credentials.TEST_CUSTOMER_SEED_PASSWORD, name: "Test Customer", phone: "+2348000000002", role: Role.CUSTOMER }, { email: credentials.TEST_AGENT_SEED_EMAIL.toLowerCase(), password: credentials.TEST_AGENT_SEED_PASSWORD, name: "Test Agent", phone: "+2348000000003", role: Role.AGENT });
  }
  for (const account of accounts) {
    const exists = await db.user.findUnique({ where: { email: account.email } });
    if (exists) {
      if (exists.role !== account.role) throw new Error("Existing seed account role mismatch. Refusing to promote automatically.");
      continue;
    }
    await db.user.create({ data: { email: account.email, passwordHash: await argon2.hash(account.password, { type: argon2.argon2id }), fullName: account.name, phone: account.phone, role: account.role, consentAt: new Date(), consentVersion: "bootstrap-development-v1", emailVerifiedAt: new Date(), referralCode: randomBytes(9).toString("hex"), wallet: { create: {} } } });
  }
  const settings: Record<string, unknown> = { siteName: "Hotdata", fundingMinKobo: "10000", fundingMaxKobo: "100000000", fundingFeeFlatKobo: "0", fundingFeeBps: 0, referralBonusKobo: "0", walletTransfersEnabled: false, maintenanceMode: false };
  for (const [key, value] of Object.entries(settings)) await db.setting.upsert({ where: { key }, update: {}, create: { key, value: value as string | number | boolean } });
}
main().catch(() => { console.error("Seed failed. Check database access and seed credentials; secrets are not printed."); process.exitCode = 1; }).finally(() => db.$disconnect());
