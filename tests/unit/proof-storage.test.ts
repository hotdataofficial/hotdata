import { describe,it,expect,vi } from "vitest";
import { proofStorageAvailable } from "../../src/lib/proof-storage";
import { uploadProof,verifyProofToken,readProof } from "../../src/server/storage/proofs";
describe("Vercel private proof storage",()=>{
 it("disables local storage on Vercel even if an operator tries to enable it",()=>{expect(proofStorageAvailable({VERCEL:"1",PROOF_STORAGE_DISABLED:"false"})).toBe(false);expect(proofStorageAvailable({PROOF_STORAGE_DISABLED:"true"})).toBe(false);expect(proofStorageAvailable({NETLIFY:"true"})).toBe(false);expect(proofStorageAvailable({HOTDATA_WORKER_MODE:"netlify"})).toBe(false);expect(proofStorageAvailable({})).toBe(true);});
 it("rejects upload, token verification and reads before disk or auth access",async()=>{vi.stubEnv("VERCEL","1");try{await expect(uploadProof("test",new File(["fake"],"proof.pdf"))).rejects.toMatchObject({status:503});await expect(verifyProofToken("test","invalid")).rejects.toMatchObject({status:503});await expect(readProof("test/invalid.pdf")).rejects.toMatchObject({status:503});}finally{vi.unstubAllEnvs();}});
});
