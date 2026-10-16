import { test,expect } from "@playwright/test";
test("signed-out users cannot read wallets or generate agent keys",async({page,request})=>{
 await page.goto("/wallet");await expect(page).toHaveURL(/\/login/);await expect(page.getByRole("heading",{name:"Welcome back"})).toBeVisible();
 const response=await request.get("/api/agent/keys");expect(response.status()).toBe(401);expect(response.headers()["cache-control"]).toContain("no-store");
});
test("registration requires consent and a valid password before an account request",async({page})=>{
 await page.goto("/register");await page.getByLabel("Full name",{exact:true}).fill("Browser Test");await page.getByLabel("Email",{exact:true}).fill("browser@example.test");await page.getByLabel("Nigerian phone number",{exact:true}).fill("08012345678");await page.getByLabel("Password (12+ characters)",{exact:true}).fill("short");await page.getByRole("button",{name:"Create account",exact:true}).click();expect(await page.locator('input[name="password"]').evaluate((input:HTMLInputElement)=>input.validity.tooShort)).toBe(true);expect(await page.getByRole("checkbox").isChecked()).toBe(false);await expect(page).toHaveURL(/\/register/);
});
test("offline shell excludes account data and financial requests",async({page,context})=>{
 await page.goto("/login");await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 await page.goto("/wallet");
 const cached=await page.evaluate(async()=>{const keys=await caches.keys();return (await Promise.all(keys.map(async key=>(await (await caches.open(key)).keys()).map(request=>new URL(request.url).pathname)))).flat();});expect(cached.sort()).toEqual(["/icons/icon-192.png","/icons/icon-512.png","/offline.html"]);
 await context.setOffline(true);await page.goto("/dashboard");await expect(page.getByRole("heading",{name:"Let's reconnect."})).toBeVisible();await expect(page.getByText("Purchases are never queued offline.",{exact:false})).toBeVisible();await context.setOffline(false);
});
