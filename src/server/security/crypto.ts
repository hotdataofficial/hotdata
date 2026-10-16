import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { config } from "../config";
export const hashSecret = (value: string) => argon2.hash(value, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifySecret = (hash: string, value: string) => argon2.verify(hash, value);
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const otpCode = () => randomInt(0, 1000000).toString().padStart(6, "0");
export const codeDigest = (userId: string, purpose: string, code: string) => createHmac("sha256", config().AUTH_CODE_SECRET).update([userId, purpose, code].join(":" )).digest("hex");
export const ipDigest = (ip: string) => createHmac("sha256", config().IP_HASH_SECRET).update(ip).digest("hex");
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
