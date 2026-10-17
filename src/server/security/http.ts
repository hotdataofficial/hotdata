import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { config } from "../config";
import { incident } from "../observability";
import { randomToken, safeEqual } from "./crypto";
import { publicServiceError } from "@/lib/service-branding";
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function clientIp(req: NextRequest) {
  // Enable only when the reverse proxy overwrites this header and blocks direct access.
  return config().TRUST_PROXY === "true" ? (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown") : "local";
}
export function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = new Set([new URL(config().APP_URL).origin, ...config().CORS_ALLOWED_ORIGINS.split(",").filter(Boolean)]);
  if (!origin || !allowed.has(origin) || req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Request origin is not allowed.");
}
export function checkCsrf(req: NextRequest) {
  checkOrigin(req);
  const cookie = req.cookies.get("hotdata_csrf")?.value;
  const header = req.headers.get("x-csrf-token");
  if (!cookie || !header || !safeEqual(cookie, header)) throw new HttpError(403, "Refresh the page and try again.");
}
export function csrfResponse(req: NextRequest) {
  const token = req.cookies.get("hotdata_csrf")?.value || randomToken();
  const response = json({ csrfToken: token });
  response.cookies.set("hotdata_csrf", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 3600 });
  return response;
}
export async function body<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
  if (req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") throw new HttpError(415, "Send JSON.");
  if (Number(req.headers.get("content-length") || 0) > 8192) throw new HttpError(413, "Request is too large.");
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  if (reader) {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new HttpError(413, "Request is too large."); }
      chunks.push(part.value);
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try { return schema.parse(JSON.parse(text)); }
  catch (error) { if (error instanceof z.ZodError) throw error; throw new HttpError(400, "Invalid JSON."); }
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
export function endpoint(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && (["/api/purchases","/api/airtime","/api/v1/buy-data","/api/agent/bulk","/api/agent/upgrade"].includes(req.nextUrl.pathname) || req.nextUrl.pathname.startsWith("/api/wallet/"))) {
        const { maintenanceEnabled } = await import("../services/admin-settings");
        if (await maintenanceEnabled()) throw new HttpError(503, "New purchases and funding requests are paused for maintenance. Existing payments and pending outcomes are still reconciled.");
      }
      return await handler(req);
    }
    catch (error) {
      if (error instanceof HttpError) return json({ error: req.nextUrl.pathname.startsWith("/api/admin/") ? error.message : publicServiceError(error.message) }, error.status);
      if (error instanceof z.ZodError) return json({ error: "Check your details.", fields: error.flatten().fieldErrors }, 400);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return json({ error: "Those details or reference are already in use." }, 409);
      // Do not log request bodies, tokens, credentials or error messages containing SQL.
      incident("request_failed", error);
      return json({ error: "We couldn’t complete that request. Please try again." }, 503);
    }
  };
}
