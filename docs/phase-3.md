# Phase 3 — Catalog, providers and purchase engine

Delivered: authenticated catalog and purchase/history APIs; role-specific price selection; PIN protection; daily limit; atomic immutable-ledger debit plus pending transaction and outbox; stable request idempotency; durable provider attempts; lease-fenced worker processing; requery after uncertain calls; priority fallback after definite failure; one refund after provider exhaustion; encrypted credential storage; audited plan/provider APIs; fixed/percentage bulk markup; CSV import/export; callbacks that independently requery; funding-email dispatch and provider-balance alert scaffolding; separate worker container.

Provider status: VTPass, DataStation and ClubKonnect are **disabled templates**, with editable mapping files. No undocumented live request is made, no provider plan IDs are guessed, and no real delivery is claimed. Implement and contract-test each adapter, enforce provider-specific HTTPS destination allowlists, wire its mapping file and credential decryption, then update registry readiness. Plan activation alone cannot enable delivery. getBalance, getPlans and buyAirtime contracts exist; their templates are disabled. Airtime purchases are a later extension.

## Setup and commands

Run in the hotdata project directory with Node 22 or newer:

```powershell
Copy-Item .env.example .env
npm install
npm run db:generate
docker compose up -d postgres redis
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run dev
```

Run the background worker in another terminal:

```powershell
npm run worker
```

For containers, run migrations before starting app and worker:

```powershell
docker compose build
docker compose run --rm worker npm run db:migrate
docker compose up -d app worker
```

The Redis service uses append-only persistence and noeviction. Queue connection configuration follows [BullMQ guidance](https://docs.bullmq.io/guide/connections). Keep the worker running separately from the Next.js request server. Configure PROVIDER_ENCRYPTION_KEY with a canonical base64-encoded random 32-byte key. Keep this key durable and backed up; key rotation requires decrypt/re-encrypt migration. Never commit .env. PURCHASE_DAILY_LIMIT_KOBO defaults to 100000000 kobo across pending and successful data orders per Lagos calendar day. PROVIDER_ALERT_EMAIL receives configured provider balance alerts; Telegram is a disabled stub.

## API contracts

All financial writes require an authenticated account, verified email, matching CSRF cookie/header and transaction PIN. PIN failures persist and five failures lock the PIN. Existing successful idempotency replays return the original order without a second debit; changing plan or phone with the same key returns 409.

- GET /api/catalog: active networks and plans, caller's selling price as a decimal kobo string, and provider availability.
- POST /api/purchases: JSON { planId, phone, pin, idempotencyKey }. Do not submit frontend prices. Returns reference/status and 202. Repeat the identical payload/key after a lost response.
- GET /api/purchases: latest 50 own orders; optional ?reference=... filters own records.
- GET/POST /api/admin/plans: ADMIN or SUPER_ADMIN. POST actions save, mapping, network, markup, import; audited transaction.
- GET /api/admin/plans?format=csv: up to 1000 plans; spreadsheet formula prefixes are escaped.
- Markup action: ids up to 100, mode FIXED or PERCENT, integer value string, target CUSTOMER/AGENT/BOTH. Percentage value is basis points: 1250 means 12.5%. Rounds upward to kobo.
- Import action: exported CSV header and at most 50 rows, up to 6000 CSV characters within the 8192-byte JSON request cap. Validation and writes are atomic. Split larger exports into batches.
- GET/POST /api/admin/providers: SUPER_ADMIN only. Credentials are encrypted, omitted from reads/audits. Attempts to activate disabled templates return 503.
- POST /api/webhooks/providers/[code]: Hotdata callback template. HMAC-SHA256 exact raw bytes in x-hotdata-signature, encrypted credential callbackSecret at least 32 characters, JSON reference equals the ProviderAttempt reference. Translate each vendor's real signature/payload contract in its adapter. Callbacks only enqueue an independent status query.

Worker ticks every 30 seconds, leases pending outbox rows, publishes stable queue job IDs and cycles a cursor through all pending orders. Database state is the authority. Unknown results stay pending without refund or fallback. A crash after the persisted attempt but before sending conservatively requires provider status lookup; “not found” must remain UNKNOWN unless the provider can definitively prove that reference cannot deliver later. Provider disabling or credential changes must not destroy the ability to query existing references. Keep old query credentials until reconciliation finishes. Old unresolved orders require operator investigation; never manually force a refund without proof of non-delivery.

Requests have a ten-second provider deadline and a sixty-second database processing lease. A stale worker cannot finalize after another worker has acquired a new token. Adapters must distinguish definitive non-delivery from pending/transport/ambiguous results. Failed attempts permit another provider on a subsequent tick. Only when no usable providers remain and no uncertain attempt exists does the engine refund atomically. Failed orders have zero profit. Balance alerts and emails are at-least-once delivery; a rare duplicate email does not move money.

## Tests and evidence

Performed in this environment:
- 16 standalone assertions against actual pricing/CSV/AES-GCM source copies using Node 24 type stripping: passed.
- Node syntax checks on all 20 new/modified TypeScript files: passed. These are syntax checks, not TypeScript type checks.
- Local preview responds HTTP 200. Browser plan selection, review and demo delivery checked.
- Desktop and mobile preview inspected; fictional sample data, no payment/provider call.

Not performed: npm install, Prisma generation/migration, TypeScript type checking, Next build, Vitest execution, PostgreSQL concurrency/invariant tests, Redis/BullMQ integration, authenticated API calls, provider contract tests or real data delivery. Dependency installation remains blocked by the sandbox's ancestor-path EPERM; Docker is unavailable. This phase is implementation progress, not production validation.

Database test command (disposable database only, create hotdata_test first, apply migrations there):

```powershell
$env:DATABASE_URL="postgresql://hotdata:YOUR_PASSWORD@localhost:5432/hotdata_test?schema=public"
$env:RUN_DB_TESTS="true"
npm run db:migrate
npm run test:integration
```

Tests cover duplicate simultaneous requests, price snapshot, single provider call on replay, uncertain timeout/requery without resend, confirmed failure refund once, safe fallback, bad PIN persistence; existing wallet suites cover overspend and ledger triggers. Fixtures remain in the disposable database because ledger entries are immutable.

## Phase checklist

- [x] Catalog and server-owned role pricing
- [x] Purchase debit/outbox transaction and request idempotency
- [x] Persisted provider attempts and lease fencing
- [x] Conservative timeout handling, safe fallback, exactly-once refund references
- [x] Provider credential encryption and redacted attempt metadata
- [x] Audited plan/provider controls, mappings, CSV and bulk markup
- [x] Worker, callback/reconciliation and alert scaffolding
- [x] Preview and test specifications
- [ ] Dependency install, generated Prisma client, typecheck/build and all runtime tests
- [ ] Configure and verify a real provider adapter before activating purchases

Phase 4 next: customer dashboard, real purchase screens, beneficiaries, history and receipts. Stop here until CONTINUE.
