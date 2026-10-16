import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { body, checkCsrf } from "../../src/server/security/http";
beforeAll(() => {
  // Isolated unit-test configuration; never used by the running app.
  Object.assign(process.env, { APP_URL: "http://localhost:3000", DATABASE_URL: "postgresql://test:test@localhost/hotdata_test", REDIS_URL: "redis://localhost:6379", JWT_ACCESS_SECRET: "a".repeat(43), JWT_REFRESH_SECRET: "b".repeat(43), AUTH_CODE_SECRET: "c".repeat(43), IP_HASH_SECRET: "d".repeat(43) });
});
const request = (origin: string, token: string) => new NextRequest("http://localhost:3000/api/auth/login", { method: "POST", headers: { origin, cookie: "hotdata_csrf=correct", "x-csrf-token": token } });
describe("request boundaries", () => {
  it("rejects a cross-origin request even with a matching CSRF value", () => expect(() => checkCsrf(request("https://attacker.example", "correct"))).toThrow());
  it("requires the header and cookie to match", () => {
    expect(() => checkCsrf(request("http://localhost:3000", "wrong"))).toThrow();
    expect(() => checkCsrf(request("http://localhost:3000", "correct"))).not.toThrow();
  });
  it("rejects oversized bodies and non-JSON requests", async () => {
    const large = new NextRequest("http://localhost:3000", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "x".repeat(9000) }) });
    await expect(body(large, z.object({ text: z.string() }))).rejects.toMatchObject({ status: 413 });
    const wrong = new NextRequest("http://localhost:3000", { method: "POST", body: "text" });
    await expect(body(wrong, z.object({}))).rejects.toMatchObject({ status: 415 });
  });
});
