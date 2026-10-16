export function proofStorageAvailable(env: Record<string,string|undefined> = process.env) { return env.VERCEL !== "1" && env.PROOF_STORAGE_DISABLED !== "true"; }
