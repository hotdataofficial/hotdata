import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireActor } from "@/server/auth/sessions";
import { body, checkCsrf, endpoint, HttpError, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
export const runtime = "nodejs";
export const GET = endpoint(async (req: NextRequest) => {
  const actor = await requireActor(req); await rateLimit("notifications-read", actor.id, 120, 60);
  const cursor = z.string().min(1).max(64).optional().parse(req.nextUrl.searchParams.get("cursor") || undefined);
  if (cursor && !await db.notification.findFirst({ where: { id: cursor, userId: actor.id }, select: { id: true } })) throw new HttpError(400, "Invalid notification cursor.");
  const rows = await db.notification.findMany({ where: { userId: actor.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, title: true, body: true, readAt: true, createdAt: true } });
  const page = rows.slice(0, 20);
  return json({ notifications: page, nextCursor: rows.length > 20 ? page[page.length - 1].id : null });
});
export const POST = endpoint(async (req: NextRequest) => {
  checkCsrf(req); const actor = await requireActor(req); await rateLimit("notifications-write", actor.id, 30, 60);
  const input = await body(req, z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(100) }).strict());
  await db.notification.updateMany({ where: { userId: actor.id, id: { in: input.ids }, readAt: null }, data: { readAt: new Date() } });
  return json({ ok: true });
});
