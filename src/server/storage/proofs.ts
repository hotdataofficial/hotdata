import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SignJWT, jwtVerify } from "jose";
import { config } from "../config";
import { HttpError } from "../security/http";
import { proofStorageAvailable } from "@/lib/proof-storage";
function requireStorage() { if (!proofStorageAvailable()) throw new HttpError(503, "Manual funding is unavailable here. Please use Paystack checkout."); }
const maxBytes = 5 * 1024 * 1024;
function location(key: string) {
  if (!/^[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.(png|jpg|pdf)$/.test(key)) throw new HttpError(400, "Invalid proof reference.");
  const root = path.resolve(process.env.PRIVATE_UPLOAD_DIR || "private-uploads");
  const target = path.resolve(root, key);
  if (!target.startsWith(root + path.sep)) throw new HttpError(400, "Invalid proof reference.");
  return target;
}
export async function uploadProof(userId: string, file: File) {
  requireStorage();
  if (file.size < 8 || file.size > maxBytes) throw new HttpError(400, "Upload a PNG, JPEG or PDF up to 5 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "png" : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "jpg" : bytes.subarray(0, 5).toString() === "%PDF-" ? "pdf" : null;
  if (!type) throw new HttpError(400, "File content must be PNG, JPEG or PDF.");
  const key = userId + "/" + randomUUID() + "." + type;
  const target = location(key); await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  const proofToken = await new SignJWT({ key, purpose: "funding-proof" }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime("24h").sign(new TextEncoder().encode(config().AUTH_CODE_SECRET));
  return { proofToken };
}
export async function verifyProofToken(userId: string, token: string) {
  requireStorage();
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(config().AUTH_CODE_SECRET), { algorithms: ["HS256"] });
    if (payload.sub !== userId || payload.purpose !== "funding-proof" || typeof payload.key !== "string") throw new Error("ownership");
    await readFile(location(payload.key));
    return payload.key;
  } catch { throw new HttpError(400, "Upload a fresh payment proof and try again."); }
}
export async function readProof(key: string) { requireStorage(); return readFile(location(key)); }
