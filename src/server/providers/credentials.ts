import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function key() {
  const text = process.env.PROVIDER_ENCRYPTION_KEY || "";
  const value = Buffer.from(text, "base64");
  if (value.length !== 32 || value.toString("base64") !== text) throw new Error("PROVIDER_ENCRYPTION_KEY must be a canonical base64 32-byte key.");
  return value;
}
export function encryptCredentials(value: Record<string, string>) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from("hotdata-provider-v1"));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), bytes.toString("base64")].join(".");
}
export function decryptCredentials(value: string): Record<string, string> {
  const [version, iv, tag, ciphertext, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra) throw new Error("Invalid encrypted credentials.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from("hotdata-provider-v1")); decipher.setAuthTag(Buffer.from(tag, "base64"));
  const result: unknown = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8"));
  if (!result || typeof result !== "object" || Array.isArray(result) || Object.values(result).some(v => typeof v !== "string")) throw new Error("Invalid credential payload.");
  return result as Record<string, string>;
}
