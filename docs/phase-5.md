# Phase 5 — Public site, pricing, policies and SEO

Delivered: a responsive green-and-white landing page with the requested tagline, live network/type pricing, three-step purchase guide, product details, FAQs and signup links; pricing and contact pages; full Terms, Privacy and Refund drafts; configurable genuine testimonials and WhatsApp links; canonical metadata, Open Graph/Twitter PNG card, organisation JSON-LD, sitemap and robots rules.

## Files created and earlier files updated

New source: src/components/public/{landing,price-list,contact-options,policy}.tsx; src/lib/{public-catalog,public-site,seo}.ts; src/server/services/public-catalog.ts; src/app/api/public/plans/route.ts; src/app/(public)/layout.tsx and pricing/contact/terms/privacy/refunds pages; src/app/{robots,sitemap}.ts; src/app/opengraph-image.tsx; tests/unit/public-site.test.ts. The full-files deliverable reproduces every changed file with its absolute path.

Updated earlier files: src/app/page.tsx, src/app/layout.tsx, src/components/customer/site-chrome.tsx, .env.example, README.md and scripts/preview.mjs. Added six standalone public-preview HTML files. Two earlier-phase type errors were corrected: Tailwind now copies the readonly font tuple to an array; the private PDF route returns an ArrayBuffer compatible with NextResponse. No database migration is needed for Phase 5.

## Commands

Use Node 22 or newer in the hotdata directory. Set up .env with real development credentials, independent secrets and matching PostgreSQL/Redis URLs, then:

```powershell
npm install
npm run db:generate
docker compose up -d postgres redis
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run build
npm run dev
```

Run npm run worker separately. The current seed intentionally disables unverified provider templates; public prices show only enabled plans, so a fresh seed can correctly show an empty selection. Public prices must not be hardcoded to bypass this.

For the dependency-free design preview run npm run preview and visit http://127.0.0.1:3100/. Routes /pricing, /contact, /terms, /privacy and /refunds work; /dashboard-demo keeps the prior customer demo. All displayed demo prices are fictional. It has no live pricing API, authentication or money movement.

## Public pricing contract

GET /api/public/plans requires no account and uses per-IP Redis rate limiting. It returns active non-deleted networks and up to 1,000 active plans in active networks. Each public plan includes ID, network ID, name, type, size, validity, decimal-string customer price and availability derived from ready active provider mappings. It neither queries nor exposes costs, agent prices, provider credentials or provider mapping codes.

The response uses no-store. Refresh retrieves current database state; purchases independently validate the current price and provider readiness. The UI covers loading, errors/retry, empty filters, unavailable plans and all four networks. Configure TRUST_PROXY only behind a reverse proxy that overwrites forwarded headers and prevents direct access; otherwise anonymous visitors share the development rate-limit bucket.

## Launch and legal settings

Defaults are safe for staging: PUBLIC_SITE_LIVE=false, PUBLIC_INDEXABLE=false and LEGAL_PUBLISHED=false. Set verified BUSINESS_LEGAL_NAME, BUSINESS_ADDRESS, SUPPORT_EMAIL and PRIVACY_EMAIL; optional BUSINESS_REGISTRATION_NUMBER, SUPPORT_WHATSAPP and SUPPORT_HOURS publish real contact information. Invalid configuration fails validation rather than publishing broken contact links.

LEGAL_PUBLISHED=true requires the business identity/address and both contacts. PUBLIC_SITE_LIVE=true requires published policies; it controls the public launch notice and search eligibility, not purchase API permissions. Set PUBLIC_INDEXABLE=true only after launch review on an HTTPS APP_URL. Rebuild/redeploy after environment changes because public metadata/routes may be prerendered. An unlaunched site blocks crawlers and returns an empty sitemap; a launched indexable site lists only the six public pages. Root metadata defaults to noindex for auth/private pages; protected customer pages retain their own noindex metadata. Robots rules supplement authentication and do not replace it.

The policies are explicit launch drafts until reviewed. Confirm operator identity, retention periods, processor contracts, cross-border safeguards, complaint handling and actual refund operations before publishing. Privacy includes data categories, uses, sharing, essential cookies/sessionStorage, rights, account deletion requests and an NDPC complaint link. It references the Nigeria Data Protection Act 2023 and relevant NDPR obligations without claiming compliance certification.

Official review references: [Nigeria Data Protection Act](https://www.ndpc.gov.ng/ndp-act-2023/) and [NDPC 2025 guidance](https://ndpc.gov.ng/wp-content/uploads/2025/03/NDP-ACT-GAID-2025-MARCH-20TH.pdf).

Refund copy matches the engine: confirmed failure refunds the purchase debit to the wallet; uncertain results remain processing; successful delivery/wrong-number disputes require investigation; funding reversals are distinct. No fixed delivery/reconciliation guarantee or fabricated legal identity is supplied.

PUBLIC_TESTIMONIALS_JSON defaults to []. Supply at most six approved genuine quotes with permission to publish name and optional context. Shape: [{"name":"...","quote":"...","context":"..."}]. Malformed/unknown-field data is omitted. No fabricated quotes, ratings or customer counts are published. WhatsApp opens the configured number without prefilled private transaction data.

## How to test

1. Open all six public pages logged out. Check keyboard navigation, focus, headings, FAQ expansion and footer links at desktop and phone widths.
2. Enable a verified provider-backed plan in the database/admin tools. Check anonymous prices against its customer price, then change price/active/network flags and refresh. Confirm disabled/soft-deleted items disappear and unavailable adapters never show a buy action.
3. Inspect /api/public/plans JSON; costs, agent prices, provider records and secrets must be absent. Test Redis rate limiting and safe errors if database/Redis is unavailable.
4. In staging, verify noindex, crawler blocking and empty sitemap. With reviewed launch settings on HTTPS, verify canonical URLs, exactly six sitemap entries, private route exclusions and the 1200×630 PNG social card.
5. Configure verified support contacts and approved testimonial quotes; check display, WhatsApp/email links and draft/published policy labels. Confirm invalid launch identity/configuration is rejected.
6. Follow the privacy deletion link while logged in and test the earlier account-deletion-request flow; it must not promise immediate erasure of required ledger records.

Run npm test -- tests/unit/public-site.test.ts for launch/privacy boundary specifications, and the existing database suites against a disposable migrated hotdata_test database for runtime verification. Never run destructive fixtures against production.

## Evidence and limits

Passed: Prisma Client generation; full project TypeScript typecheck; 25 standalone assertions against actual catalog/settings/money source copies (including actual Zod parsing); TypeScript syntax checks; all seven standalone preview routes returned 200, with unknown/API/private-file routes returning 404. Browser network/type filters, empty selection, FAQ expansion and privacy navigation passed. Desktop and narrow 450px layouts were inspected with no horizontal overflow; screenshots are included.

Vitest startup failed because esbuild could not read an ancestor directory in this environment. The production webpack build reached optimisation but exceeded the 90-second verification deadline, so build success is not claimed. PostgreSQL/Redis runtime pricing, migrations, provider delivery and production Open Graph image rendering were not verified. See phase-5-verification.json for exact outcomes. The preview is separate from the live Next.js application.

## Checklist before moving on

- [x] Public landing, customer pricing interface, contact and all policy pages
- [x] Safe public projection, disabled-provider availability and validated launch settings
- [x] Canonicals, Open Graph/Twitter metadata, JSON-LD, sitemap and robots
- [x] Full typecheck, isolated boundary assertions and responsive demo checks
- [x] Complete files, archive, commands and review guide
- [ ] Successful production build, Vitest and live database/Redis pricing tests
- [ ] Operator policy/contact/retention review before enabling public launch/indexing

Phase 6 next: admin screens, reports, audit logs and settings. Stop here until CONTINUE.
