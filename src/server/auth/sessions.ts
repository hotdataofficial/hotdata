import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import type { Prisma, User } from "@prisma/client";
import { db } from "../db";
import { config } from "../config";
import { digest, ipDigest, randomToken, safeEqual } from "../security/crypto";
import { clientIp, HttpError } from "../security/http";
const encoder = new TextEncoder();
export type Actor = Pick<User, "id" | "role" | "fullName" | "email" | "phone" | "emailVerifiedAt" | "phoneVerifiedAt" | "pinHash"> & { sessionId: string };
async function sign(user: Pick<User, "id" | "authVersion">, sessionId: string, kind: "access" | "refresh") {
  const env = config();
  return new SignJWT({ sid: sessionId, ver: user.authVersion, kind }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setSubject(user.id).setJti(randomToken()).setIssuer(env.JWT_ISSUER).setAudience(env.JWT_AUDIENCE).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + (kind === "access" ? env.JWT_ACCESS_TTL_SECONDS : env.JWT_REFRESH_TTL_SECONDS)).sign(encoder.encode(kind === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET));
}
export async function decode(token: string, kind: "access" | "refresh") {
  const env = config();
  try {
    const { payload } = await jwtVerify(token, encoder.encode(kind === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET), { algorithms: ["HS256"], issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE });
    if (payload.kind !== kind || typeof payload.sid !== "string" || typeof payload.sub !== "string" || typeof payload.ver !== "number") throw new Error("claims");
    return { userId: payload.sub, sessionId: payload.sid, version: payload.ver };
  } catch { throw new HttpError(401, "Please sign in again."); }
}
export function setAuthCookies(response: NextResponse, access: string, refresh: string) {
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };
  response.cookies.set("hotdata_access", access, { ...options, maxAge: config().JWT_ACCESS_TTL_SECONDS });
  response.cookies.set("hotdata_refresh", refresh, { ...options, maxAge: config().JWT_REFRESH_TTL_SECONDS });
}
export function clearAuthCookies(response: NextResponse) {
  for (const name of ["hotdata_access", "hotdata_refresh"]) response.cookies.set(name, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}
export async function createSession(tx: Prisma.TransactionClient, user: User, req: NextRequest) {
  const id = randomToken();
  const refresh = await sign(user, id, "refresh");
  await tx.session.create({ data: { id, userId: user.id, authVersion: user.authVersion, refreshHash: digest(refresh), userAgent: (req.headers.get("user-agent") || "Unknown device").slice(0, 300), ipHash: ipDigest(clientIp(req)), expiresAt: new Date(Date.now() + config().JWT_REFRESH_TTL_SECONDS * 1000) } });
  return { access: await sign(user, id, "access"), refresh };
}
export async function requireActor(req: NextRequest): Promise<Actor> {
  const token = req.cookies.get("hotdata_access")?.value;
  if (!token) throw new HttpError(401, "Please sign in.");
  const claims = await decode(token, "access");
  const session = await db.session.findUnique({ where: { id: claims.sessionId }, include: { user: true } });
  const user = session?.user;
  if (!session || !user || session.userId !== claims.userId || session.revokedAt || session.expiresAt <= new Date() || user.authVersion !== claims.version || session.authVersion !== user.authVersion || user.status !== "ACTIVE" || user.deletedAt) throw new HttpError(401, "Please sign in again.");
  return { id: user.id, role: user.role, fullName: user.fullName, email: user.email, phone: user.phone, emailVerifiedAt: user.emailVerifiedAt, phoneVerifiedAt: user.phoneVerifiedAt, pinHash: user.pinHash, sessionId: session.id };
}
export async function rotateSession(req: NextRequest) {
  const token = req.cookies.get("hotdata_refresh")?.value;
  if (!token) throw new HttpError(401, "Please sign in.");
  const claims = await decode(token, "refresh");
  const result = await db.$transaction(async tx => {
    // Consistent locking order across password changes, logout and rotation.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${claims.userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${claims.sessionId} FOR UPDATE`;
    const session = await tx.session.findUnique({ where: { id: claims.sessionId }, include: { user: true } });
    if (!session || session.userId !== claims.userId || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE" || session.user.deletedAt || session.user.authVersion !== claims.version || session.authVersion !== claims.version) return null;
    if (!safeEqual(session.refreshHash, digest(token))) {
      await tx.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return null;
    }
    const refresh = await sign(session.user, session.id, "refresh");
    await tx.session.update({ where: { id: session.id }, data: { refreshHash: digest(refresh), lastUsedAt: new Date(), expiresAt: new Date(Date.now() + config().JWT_REFRESH_TTL_SECONDS * 1000) } });
    return { access: await sign(session.user, session.id, "access"), refresh };
  });
  if (!result) throw new HttpError(401, "Please sign in again.");
  return result;
}
