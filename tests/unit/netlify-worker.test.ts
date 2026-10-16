import { describe, it, expect, vi } from "vitest";
import { netlifyWorkerConfigured, workerAuthorized, wakeNetlifyWorker } from "../../src/server/jobs/netlify-trigger";
vi.mock("../../src/server/jobs/netlify-context",()=>({netlifyProductionBuild:true}));
const env = { HOTDATA_WORKER_MODE: "netlify", CONTEXT: "production", HOTDATA_WORKER_SECRET: "a".repeat(64), APP_URL: "https://hotdata-test.netlify.app" };
describe("Netlify background authorization and wake-up", () => {
 it("requires production mode and a strong worker secret", () => {
   expect(netlifyWorkerConfigured(env)).toBe(true);
   for (const patch of [{CONTEXT:"deploy-preview"},{HOTDATA_WORKER_MODE:"disabled"},{HOTDATA_WORKER_SECRET:"short"}]) expect(netlifyWorkerConfigured({...env,...patch})).toBe(false);
 });
 it("rejects forged and missing credentials and non-POST requests", () => {
   expect(workerAuthorized(new Request(env.APP_URL),env)).toBe(false);
   expect(workerAuthorized(new Request(env.APP_URL,{method:"POST",headers:{authorization:"Bearer "+"b".repeat(64)}}),env)).toBe(false);
   expect(workerAuthorized(new Request(env.APP_URL,{method:"POST",headers:{authorization:"Bearer "+env.HOTDATA_WORKER_SECRET}}),env)).toBe(true);
 });
 it("sends only to the configured HTTPS origin and refuses redirects", async () => {
   const send=vi.fn().mockResolvedValue(new Response(null,{status:202}));
   expect(await wakeNetlifyWorker(env,send)).toBe(true);
   expect(send.mock.calls[0][0].toString()).toBe(env.APP_URL+"/.netlify/functions/hotdata-worker");
   expect(send.mock.calls[0][1]).toMatchObject({method:"POST",redirect:"error",headers:{authorization:"Bearer "+env.HOTDATA_WORKER_SECRET}});
   send.mockClear();
   for(const APP_URL of ["http://example.com","https://user:password@example.com","https://example.com/other","https://example.com/?key=secret"]) expect(await wakeNetlifyWorker({...env,APP_URL},send)).toBe(false);
   expect(send).not.toHaveBeenCalled();
 });
 it("does not wake previews and treats network failure as recoverable", async () => {
   const send=vi.fn().mockRejectedValue(new Error("offline"));
   expect(await wakeNetlifyWorker({...env,CONTEXT:"deploy-preview"},send)).toBe(false);
   expect(send).not.toHaveBeenCalled();
   const log=vi.spyOn(console,"warn").mockImplementation(()=>{});
   expect(await wakeNetlifyWorker(env,send)).toBe(false);
   log.mockRestore();
 });
});

it("derives a separate worker credential without transmitting the auth-code secret",async()=>{const auth="c".repeat(43),derivedEnv={...env,HOTDATA_WORKER_SECRET:undefined,AUTH_CODE_SECRET:auth};const send=vi.fn().mockResolvedValue(new Response(null,{status:202}));expect(netlifyWorkerConfigured(derivedEnv)).toBe(true);expect(await wakeNetlifyWorker(derivedEnv,send)).toBe(true);const header=send.mock.calls[0][1].headers.authorization;expect(header).toMatch(/^Bearer [a-f0-9]{64}$/);expect(header).not.toContain(auth);expect(workerAuthorized(new Request(env.APP_URL,{method:"POST",headers:{authorization:header}}),derivedEnv)).toBe(true);expect(workerAuthorized(new Request(env.APP_URL,{method:"POST",headers:{authorization:header}}),{...derivedEnv,AUTH_CODE_SECRET:"d".repeat(43)})).toBe(false);expect(netlifyWorkerConfigured({...derivedEnv,HOTDATA_WORKER_SECRET:"invalid"})).toBe(false);});
