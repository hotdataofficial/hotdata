import { Resend } from "resend";
import nodemailer from "nodemailer";
import { HttpError } from "../security/http";
export async function sendEmail(to: string, subject: string, text: string) {
  if (process.env.RESEND_API_KEY) {
    try {
      const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM!, to, subject, text });
      if (!result.error) return;
    } catch { /* SMTP fallback below. Never log message contents. */ }
  }
  if (process.env.SMTP_HOST) {
    const smtp = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", requireTLS: process.env.SMTP_SECURE !== "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined });
    await smtp.sendMail({ from: process.env.EMAIL_FROM, to, subject, text });
    return;
  }
  throw new HttpError(503, "Email delivery is not configured. Please contact support.");
}
export interface SmsProvider { sendOtp(phone: string, code: string): Promise<void>; }
export const disabledSms: SmsProvider = {
  async sendOtp() { throw new HttpError(503, "Phone verification is unavailable until an SMS provider is configured."); },
};
export interface WhatsAppProvider { send(phone: string, message: string): Promise<void>; }
export const disabledWhatsApp: WhatsAppProvider = {
  async send() { throw new HttpError(503, "WhatsApp delivery is not configured."); },
};
