import { NextRequest } from "next/server";
import { registerSchema, loginSchema, forgotSchema, resetSchema, requestOtpSchema, verifySchema, changePasswordSchema, setPinSchema, revokeSchema } from "@/lib/validation/auth";
import { db } from "@/server/db";
import { register, login, issueCode, verifyContact, forgotPassword, resetPassword, changePassword, setPin, revokeSession } from "@/server/auth/accounts";
import { requireActor, rotateSession, setAuthCookies, clearAuthCookies } from "@/server/auth/sessions";
import { body, checkCsrf, clientIp, csrfResponse, endpoint, HttpError, json } from "@/server/security/http";
import { rateLimit } from "@/server/security/rate-limit";
export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };
export async function GET(req: NextRequest, context: Context) {
  const { action } = await context.params;
  return endpoint(async req => {
    if (!["csrf", "me", "sessions"].includes(action)) throw new HttpError(404, "Endpoint not found.");
    if (action === "csrf") {
      await rateLimit("csrf", clientIp(req), 120, 60);
      return csrfResponse(req);
    }
    const actor = await requireActor(req);
    if (action === "me") return json({ user: { id: actor.id, fullName: actor.fullName, email: actor.email, phone: actor.phone, role: actor.role, emailVerified: !!actor.emailVerifiedAt, phoneVerified: !!actor.phoneVerifiedAt, hasPin: !!actor.pinHash } });
    if (action === "sessions") {
      const sessions = await db.session.findMany({ where: { userId: actor.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true } });
      return json({ sessions: sessions.map(session => ({ ...session, current: session.id === actor.sessionId })) });
    }
    throw new HttpError(404, "Endpoint not found.");
  })(req);
}
export async function POST(req: NextRequest, context: Context) {
  const { action } = await context.params;
  return endpoint(async req => {
    if (!["register", "login", "refresh", "forgot-password", "reset-password", "logout", "request-otp", "verify", "change-password", "set-pin", "revoke-session", "request-deletion"].includes(action)) throw new HttpError(404, "Endpoint not found.");
    checkCsrf(req);
    await rateLimit("auth:" + action, clientIp(req), action === "login" ? 30 : 20, 60);
    if (action === "register") {
      const input = await body(req, registerSchema);
      await rateLimit("register-email", input.email, 3, 3600);
      return json({ ...await register(input), message: "Account created. Sign in to verify your email." }, 201);
    }
    if (action === "login") {
      const input = await body(req, loginSchema);
      await rateLimit("login-identifier", input.identifier.toLowerCase(), 10, 900);
      const tokens = await login(input.identifier, input.password, req);
      const response = json({ message: "Signed in." }); setAuthCookies(response, tokens.access, tokens.refresh); return response;
    }
    if (action === "refresh") {
      const tokens = await rotateSession(req);
      const response = json({ message: "Session refreshed." }); setAuthCookies(response, tokens.access, tokens.refresh); return response;
    }
    if (action === "forgot-password") {
      const input = await body(req, forgotSchema);
      await rateLimit("reset-email", input.email, 3, 3600);
      await forgotPassword(input.email);
      return json({ message: "If the account exists, a reset code will be sent." });
    }
    if (action === "reset-password") {
      const input = await body(req, resetSchema);
      await rateLimit("reset-attempt", input.email, 10, 900);
      await resetPassword(input.email, input.code, input.password);
      const response = json({ message: "Password reset. Please sign in again." }); clearAuthCookies(response); return response;
    }
    const actor = await requireActor(req);
    await rateLimit("user-auth:" + action, actor.id, 10, 900);
    if (action === "logout") {
      await revokeSession(actor.id, actor.sessionId);
      const response = json({ message: "Signed out." }); clearAuthCookies(response); return response;
    }
    if (action === "request-otp") {
      const input = await body(req, requestOtpSchema);
      await rateLimit("otp-send:" + input.purpose, actor.id, 3, 3600);
      await issueCode(actor.id, input.purpose); return json({ message: "Verification code sent." });
    }
    if (action === "verify") {
      const input = await body(req, verifySchema);
      await verifyContact(actor.id, input.purpose, input.code); return json({ message: "Contact verified." });
    }
    if (action === "change-password") {
      const input = await body(req, changePasswordSchema);
      await changePassword(actor.id, input.currentPassword, input.password);
      const response = json({ message: "Password changed. All devices signed out." }); clearAuthCookies(response); return response;
    }
    if (action === "set-pin") {
      const input = await body(req, setPinSchema);
      await setPin(actor.id, input.password, input.pin, input.currentPin); return json({ message: "Transaction PIN saved." });
    }
    if (action === "revoke-session") {
      const input = await body(req, revokeSchema);
      await revokeSession(actor.id, input.sessionId);
      const response = json({ message: "Device signed out." });
      if (input.sessionId === actor.sessionId) clearAuthCookies(response);
      return response;
    }
    if (action === "request-deletion") {
      await db.$transaction([
        db.user.update({ where: { id: actor.id }, data: { deletionRequestedAt: new Date() } }),
        db.auditLog.create({ data: { actorId: actor.id, action: "DATA_DELETION_REQUESTED", entityType: "User", entityId: actor.id } }),
      ]);
      return json({ message: "Deletion request recorded. Support will review retention requirements." });
    }
    throw new HttpError(404, "Endpoint not found.");
  })(req);
}
