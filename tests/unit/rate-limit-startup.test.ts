import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({clients:[] as any[]}));
vi.mock("../../src/server/config",()=>({config:()=>({REDIS_URL:"redis://unit-test.invalid"})}));
vi.mock("ioredis",async()=>{const {EventEmitter}=await import("node:events");return {default:class extends EventEmitter {
  status="wait";connect=vi.fn(async()=>{this.status="connecting";await new Promise<void>((resolve,reject)=>{this.once("ready",()=>{this.status="ready";resolve()});this.once("error",reject)});});
  eval=vi.fn(async()=>1);constructor(){super();m.clients.push(this);}
}};});
beforeEach(()=>{vi.resetModules();m.clients.length=0;});
afterEach(()=>{vi.restoreAllMocks();});
it("shares one cold-start connection and runs no limiter command before readiness",async()=>{
  const {rateLimit}=await import("../../src/server/security/rate-limit");
  const requests=[rateLimit("a","one",10,60),rateLimit("a","two",10,60),rateLimit("a","three",10,60)];
  const client=m.clients[0];expect(client.connect).toHaveBeenCalledOnce();expect(client.eval).not.toHaveBeenCalled();
  client.emit("ready");await Promise.all(requests);expect(client.eval).toHaveBeenCalledTimes(3);
});
it("fails closed on connection failure and allows a later reconnect",async()=>{
  const {rateLimit}=await import("../../src/server/security/rate-limit");
  const failed=rateLimit("a","one",10,60);const client=m.clients[0];client.emit("error",new Error("offline"));
  await expect(failed).rejects.toMatchObject({status:503});expect(client.eval).not.toHaveBeenCalled();
  client.status="wait";const next=rateLimit("a","one",10,60);client.emit("ready");await expect(next).resolves.toBeUndefined();
});
it("waits for an already reconnecting cache and preserves rate-limit rejection",async()=>{
  const {cache,rateLimit}=await import("../../src/server/security/rate-limit");
  const client=cache() as unknown as EventEmitter & {status:string;eval:ReturnType<typeof vi.fn>};client.status="reconnecting";client.eval.mockResolvedValue(11);
  const pending=rateLimit("a","one",10,60);expect(client.eval).not.toHaveBeenCalled();client.status="ready";client.emit("ready");
  await expect(pending).rejects.toMatchObject({status:429});
});
