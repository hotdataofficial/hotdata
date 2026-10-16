import { createHash,createHmac } from "node:crypto";
export const apiKeyDigest=(value:string)=>createHash("sha256").update(value).digest("hex");
export const callbackSignature=(secret:string,timestamp:string,rawBody:string)=>createHmac("sha256",secret).update(timestamp+"."+rawBody).digest("hex");
