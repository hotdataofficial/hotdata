import { describe, expect, it } from "vitest";
import { publicSite } from "../../src/lib/public-site";
import { publicPlan } from "../../src/lib/public-catalog";
const operator = { APP_URL: "https://hotdata.example", LEGAL_PUBLISHED: "true", BUSINESS_LEGAL_NAME: "Test operator", BUSINESS_ADDRESS: "Test address", SUPPORT_EMAIL: "support@example.com", PRIVACY_EMAIL: "privacy@example.com" };
describe("public launch and privacy boundaries", () => {
  it("keeps unconfigured sites and policies off search indexes", () => { const site = publicSite({}); expect(site.indexable).toBe(false); expect(site.live).toBe(false); expect(site.legalReady).toBe(false); });
  it("requires reviewed operator contacts before launch", () => { expect(() => publicSite({ PUBLIC_SITE_LIVE: "true" })).toThrow(); expect(() => publicSite({ LEGAL_PUBLISHED: "true" })).toThrow(); });
  it("indexes only an explicitly launched HTTPS site", () => { expect(publicSite({ ...operator, PUBLIC_SITE_LIVE: "true", PUBLIC_INDEXABLE: "true" }).indexable).toBe(true); expect(publicSite({ ...operator, PUBLIC_SITE_LIVE: "true", PUBLIC_INDEXABLE: "true", APP_URL: "http://localhost:3000" }).indexable).toBe(false); });
  it("rejects credential-bearing or non-HTTP app URLs", () => { expect(() => publicSite({ APP_URL: "https://user:secret@example.com" })).toThrow(); expect(() => publicSite({ APP_URL: "ftp://example.com" })).toThrow(); });
  it("omits malformed testimonial data", () => { expect(publicSite({ PUBLIC_TESTIMONIALS_JSON: "not JSON" }).testimonials).toEqual([]); expect(publicSite({ PUBLIC_TESTIMONIALS_JSON: '[{"name":"Name","quote":"Quote","secret":"x"}]' }).testimonials).toEqual([]); });
  it("publishes only customer pricing and public plan fields", () => { const row = { id: "p", networkId: "n", name: "Plan", type: "SME", sizeMb: 1024, validityDays: 30, customerPriceKobo: 30000n, costKobo: 20000n, agentPriceKobo: 25000n, mappings: [{ provider: { adapter: "disabled", credentialsEncrypted: "secret" } }] }; const plan = publicPlan(row, () => false); expect(plan.available).toBe(false); expect(plan.priceKobo).toBe("30000"); expect(JSON.stringify(plan)).not.toMatch(/secret|costKobo|agentPriceKobo|mappings/); });
});
