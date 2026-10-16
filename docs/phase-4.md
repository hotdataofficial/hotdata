# Phase 4 — Customer dashboard and purchase experience

Delivered: protected customer navigation and mobile bottom bar; dashboard balance, quick buy, funding account, recent transactions and alerts; catalog-backed network/type/plan selection; normalized recipient numbers and beneficiary shortcuts; PIN confirmation; retained request keys and price-change rejection; filtered, paginated history; owner-only receipts with PNG, PDF, share and buy-again; beneficiary management; notifications; profile editing and configurable support contacts. Purchase processing and terminal email notifications use the durable outbox.

## Files and earlier-phase updates

Complete changed files are in hotdata-phase-4-full-files.md; the ZIP includes the complete project. Earlier-phase updates include the root chrome and login destination, authentication refresh coordination, wallet client, purchase validation/service, Prisma schema/migration, worker, environment example and preview server. The migration adds an immutable display snapshot to new purchase records so later catalog edits do not rewrite receipts. Legacy records explicitly identify their current-catalog fallback.

## Setup and commands

Use Node 22 or newer in the hotdata directory. Configure .env from .env.example with independent secrets and database/Redis credentials, then:

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

In another terminal run `npm run worker`. Configure SUPPORT_EMAIL and SUPPORT_WHATSAPP (international digits) to show real support links. Purchase receipt emails use the existing email transport and EMAIL_PURCHASE outbox. No SMS or WhatsApp delivery is enabled.

For the standalone design preview run `npm run preview` and open http://127.0.0.1:3100/. It uses clearly labelled fictional data, no authentication, database, payments or provider delivery. The production pages are separate Next.js routes.

## Contracts and safeguards

- GET /api/customer/dashboard: safe account summary, wallet, funding accounts, recent purchases and notification counts.
- POST /api/customer/profile: own full-name update.
- GET /api/customer/history: status, network, phone/reference search, from/to Lagos dates and owned cursor; twenty purchases per page.
- GET/POST/DELETE /api/beneficiaries: own records, normalized numbers, maximum one hundred; upsert by owned phone.
- GET/POST /api/notifications: owned pagination and read markers for explicit owned IDs.
- GET /api/receipts/[reference]: owner-only receipt JSON; `?format=pdf` returns an authenticated PDF attachment. PNG is rendered locally from the same owned receipt data. Sharing exports the image; the receipt URL remains private.
- POST /api/purchases additionally accepts optional expectedPriceKobo as a quote comparison. The server still selects the actual price from the database; a changed quote returns 409 before debit.

The browser persists only plan, normalized recipient, request key and display quote in sessionStorage, never the PIN. An uncertain response retains the original key and locks recipient/plan edits. Retry the same request or inspect history. Starting a separate request requires an explicit acknowledgement and may create another purchase. A stale quote requires checking history and starting a separate request to accept the updated price. Pending receipts poll while visible for up to five minutes and always offer manual refresh. Failed/refunded, processing and successful statuses have distinct text labels.

New purchases require verified email, PIN, funds and a verified ready provider adapter. Existing disabled provider templates remain disabled. No real delivery is claimed. Network prefix suggestions are advisory because number portability permits a different network.

## Manual checks

1. Register, verify email, set a PIN and sign in; confirm dashboard and mobile navigation.
2. Save/edit/remove a beneficiary; confirm another account cannot access that record.
3. With a verified sandbox provider, buy a plan; double-click and replay the same request, confirming one debit. Simulate a lost response and retry the retained key.
4. Change the plan price between review and confirmation; expect 409 and no debit.
5. Filter history by status/network/phone and Lagos date range; page through records.
6. Open an owned receipt, export PNG/PDF, share the image and buy again. Another account must receive 404 for the reference.
7. Change a plan name after purchase; the original snapshot must stay on its receipt.
8. Confirm pending status never implies delivery or refund, and notifications/read markers remain owned.

Database tests require a disposable migrated database named hotdata_test and RUN_DB_TESTS=true; see Phase 3 instructions. Existing ledger fixtures are immutable.

## Verification evidence

Passed: TypeScript/TSX syntax parsing for 43 changed source files; 24 standalone assertions using actual customer/date/PDF source copies, including exact kobo, valid PDF cross-reference offsets, pending/refund labels and Lagos dates. Browser dashboard, history filters and refunded receipt details were checked in the standalone preview. A desktop screenshot is included.

Dependency installation was attempted with the bundled newer Node runtime and cached official npm downloads. Full install, Prisma generation, typecheck, production build, Vitest and database/Redis/provider tests are recorded separately in phase-4-verification.json; do not infer these passed from syntax checks. The PNG browser download verification timed out, so export remains unverified in this environment. Docker and database services are unavailable.

## Phase checklist

- [x] Protected dashboard and responsive customer shell
- [x] Catalog purchase UI, PIN review and safe retained retries
- [x] History filters, pagination and owner-only receipt endpoints
- [x] PNG/PDF export implementation, sharing and buy-again
- [x] Owned beneficiaries, notifications, profile and support
- [x] Purchase snapshot migration and durable receipt email dispatch
- [x] Full source delivery, preview and verification specifications
- [ ] Successful dependency/runtime/database/provider verification

Phase 5 next: public landing page, live price list, legal pages and SEO. Stop here until CONTINUE.
