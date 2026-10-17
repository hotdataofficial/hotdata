import { afterEach, expect, it, vi } from "vitest";
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
function responses(){let active=0,maximum=0;const fetcher=vi.fn(async(url:string)=>{
  if(url.endsWith("csrf"))return new Response(JSON.stringify({csrfToken:"fixture"}));
  active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,5));active--;
  return new Response(JSON.stringify({ok:true}));
});vi.stubGlobal("fetch",fetcher);return {fetcher,maximum:()=>maximum};}
it("coalesces refresh calls inside one tab",async()=>{
  const mock=responses();vi.stubGlobal("navigator",{});
  const {refreshSession}=await import("../../src/lib/auth-client");
  await Promise.all([refreshSession(),refreshSession(),refreshSession()]);
  expect(mock.fetcher.mock.calls.filter(([url])=>url.endsWith("refresh"))).toHaveLength(1);
});
it("serializes refresh rotations from separate tabs using the origin-wide browser lock",async()=>{
  let tail=Promise.resolve<unknown>(undefined);
  const request=vi.fn((name:string,work:()=>Promise<unknown>)=>{const task=tail.then(work);tail=task.catch(()=>{});return task;});
  vi.stubGlobal("navigator",{locks:{request}});const mock=responses();
  const one=await import("../../src/lib/auth-client");vi.resetModules();const two=await import("../../src/lib/auth-client");
  await Promise.all([one.refreshSession(),two.refreshSession()]);
  expect(request.mock.calls.map(([name])=>name)).toEqual(["hotdata-session-refresh","hotdata-session-refresh"]);
  expect(mock.fetcher.mock.calls.filter(([url])=>url.endsWith("refresh"))).toHaveLength(2);
  expect(mock.maximum()).toBe(1);
});
it("releases failed refresh single-flight state so a later attempt can run",async()=>{
  vi.stubGlobal("navigator",{});let attempts=0;
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.endsWith("csrf")?new Response(JSON.stringify({csrfToken:"fixture"})):new Response(JSON.stringify({error:"Sign in again"}),{status:++attempts===1?401:200})));
  const {refreshSession}=await import("../../src/lib/auth-client");
  await expect(refreshSession()).rejects.toThrow("Sign in again");await expect(refreshSession()).resolves.toBeDefined();expect(attempts).toBe(2);
});
