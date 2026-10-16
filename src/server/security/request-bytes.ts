import { HttpError } from "./http";
export async function requestBytes(req: Request, limit: number) {
  if (Number(req.headers.get("content-length") || 0) > limit) throw new HttpError(413, "Request is too large.");
  const reader = req.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  if (reader) while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > limit) { await reader.cancel(); throw new HttpError(413, "Request is too large."); }
    chunks.push(part.value);
  }
  return Buffer.concat(chunks);
}
