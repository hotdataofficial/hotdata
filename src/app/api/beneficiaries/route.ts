import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireActor } from "@/server/auth/sessions";
import { lockUser } from "@/server/auth/accounts";
import { body, checkCsrf, endpoint, HttpError, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
import { beneficiarySchema } from "@/lib/validation/customer";
export const runtime = "nodejs";
export const GET = endpoint(async (req: NextRequest) => {
  const actor = await requireActor(req); await rateLimit("beneficiaries-read", actor.id, 120, 60);
  return json({ beneficiaries: await db.beneficiary.findMany({ where: { userId: actor.id }, orderBy: { name: "asc" }, take: 100, select: { id: true, name: true, phone: true, networkCode: true } }) });
});
export const POST = endpoint(async (req: NextRequest) => {
  checkCsrf(req); const actor = await requireActor(req); await rateLimit("beneficiaries-write", actor.id, 20, 60);
  const input = await body(req, beneficiarySchema);
  const beneficiary = await db.$transaction(async tx => {
    await lockUser(tx, actor.id);
    const previous = await tx.beneficiary.findUnique({ where: { userId_phone: { userId: actor.id, phone: input.phone } } });
    if (!previous && await tx.beneficiary.count({ where: { userId: actor.id } }) >= 100) throw new HttpError(400, "You can save up to 100 beneficiaries.");
    return tx.beneficiary.upsert({ where: { userId_phone: { userId: actor.id, phone: input.phone } }, create: { userId: actor.id, ...input }, update: { name: input.name, networkCode: input.networkCode || null } });
  });
  return json({ beneficiary: { id: beneficiary.id, name: beneficiary.name, phone: beneficiary.phone, networkCode: beneficiary.networkCode } });
});
export const DELETE = endpoint(async (req: NextRequest) => {
  checkCsrf(req); const actor = await requireActor(req); await rateLimit("beneficiaries-delete", actor.id, 20, 60);
  const { id } = await body(req, z.object({ id: z.string().min(1).max(64) }).strict());
  await db.beneficiary.deleteMany({ where: { userId: actor.id, id } });
  return json({ ok: true });
});
