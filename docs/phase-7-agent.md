# Phase 7: agents, bulk purchases, API keys and referrals

Phase 7 is implemented in source. Phase 8 hardening, PWA, final QA and deployment remain. Live provider templates stay disabled; the progress preview uses fictional data.

## Agent tier and upgrades

`/agent` shows the authenticated tier, wallet balance and available actions. Customers may open an agent-approval support request; staff review it in `/admin/tickets` and change the tier in `/admin/users`. Approval does not charge the wallet.

Paid upgrades are disabled by default. A super admin may set a positive `agentUpgradeFeeKobo` and enable `agentSelfUpgradeEnabled`. The customer reviews the fee and confirms with their PIN. A locked database transaction rechecks the live fee and role, creates an AGENT_UPGRADE transaction and immutable FEE ledger entry, changes the tier and revokes existing sessions. Concurrent or repeated upgrades cannot charge again once the account is an agent. The user signs in again afterward.

Agent purchases use `agentPriceKobo` from the current plan. `AGENT_PURCHASE_DAILY_LIMIT_KOBO` limits all pending/successful data purchases across normal UI, bulk and API in a Lagos day. The customer limit remains separate. Failed/refunded orders no longer contribute to this spend total.

## Bulk purchase

`/agent/bulk` accepts pasted numbers or a local CSV, up to 50 rows and 6,000 input characters. CSV format is `phone,planId`, with an optional matching header. A selected default plan can be used for phone-only rows. The deliberately simple parser does not accept quoted cells. Repeated phone numbers represent separate intended purchases.

1. The server validates and normalises each phone and checks every plan/provider mapping.
2. The server returns the agent price for each row and the exact integer-kobo total.
3. The agent reviews every row and confirms once with their PIN.
4. Submission rechecks the tier, availability, live price, daily limit and wallet balance. Every transaction, debit and durable queue event commits atomically. Any invalid row, changed price or insufficient balance rolls back the entire batch.
5. The existing worker processes each row independently. Callback delivery runs on a separate maintenance timer so slow callback endpoints do not hold up purchase queue dispatch. Confirmed failures receive one refund. Uncertain outcomes remain pending without refund or unsafe fallback.

`BulkBatch` stores the request hash, total and row count. Transactions store their batch and row index. The browser retains rows and the batch UUID in session storage before sending; it never stores the PIN. Retrying preserves the same batch and row references. Restarting a separate batch is an explicit action after checking recent batches. HTTP JSON bodies are limited to 8 KiB, so exceptionally long inputs may need a smaller batch.

## API keys and endpoints

`/agent/keys` allows an email-verified agent to create up to five active keys after PIN verification. Keys contain 256 bits of randomness, are shown once and stored as SHA-256 hashes with a short display prefix. Reads and audits never return the raw key or callback signing secret. Lost key-creation responses require checking/revoking an unknown key before creating another.

Optional IP allowlists contain up to ten exact IPv4/IPv6 addresses, normalised server-side. CIDR is not supported. Restricted keys require `TRUST_PROXY=true` and a reverse proxy that overwrites `x-forwarded-for` and blocks direct access. An untrusted proxy does not bypass the restriction.

Revocation is permanent. Admin downgrade/suspension of an agent revokes all its keys; restoring the tier does not reactivate those keys. API purchase staging rechecks the live role/status and key while holding the user/key locks. An authorised purchase already committed continues reconciliation even if its key is subsequently revoked.

Public documentation is at `/api-docs` and includes complete cURL, server JavaScript and PHP examples, error semantics, retries and callback signature verification. The authenticated REST endpoints are:

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/v1/balance` | Currency and integer-kobo balance string |
| GET | `/api/v1/plans` | Enabled plan details, agent prices and availability |
| POST | `/api/v1/buy-data` | Queued purchase, reference and current status |
| GET | `/api/v1/transactions?reference=...` | An owned data purchase's current status |

Send `Authorization: Bearer YOUR_KEY`. New purchases require a four-digit PIN, plan ID, normalised phone and UUID idempotency key; send expectedPriceKobo to guard against repricing. API purchases use the same locked ledger, immutable price snapshot, queue and safe provider engine as ordinary purchases. Cookie authentication does not authorise these endpoints. Bearer-only requests do not use browser CSRF cookies; arbitrary browser origins do not receive CORS access.

Rate limits apply across an agent's keys: 120 reads and 20 purchases/minute per account, plus 300 authentication requests/minute per client IP. A replay is bound to its original API key and cannot acquire a different key's callback destination. Transaction-status reads are scoped to the owning agent account.

## Signed callbacks

Specify an optional callback URL when creating a key. Its exact hostname must be listed in `AGENT_CALLBACK_ALLOWED_HOSTS`. Empty configuration disables callback registration. HTTPS on port 443, no URL credentials/fragment, public DNS addresses, default TLS certificate checks and no redirects are enforced. DNS lookup and delivery are bounded. Every attempt re-resolves the host, rejects non-public answers and pins the HTTPS connection to a validated address while preserving the original TLS hostname.

The separate 256-bit callback signing secret is shown once and encrypted at rest using the platform's AES-GCM provider-encryption key. It is not the bearer key. Operator key rotation therefore needs to consider both provider credentials and callback signing secrets.

Final data outcomes create a durable callback outbox event in the same transaction, including manual super-admin finalisation. Signature is lowercase HMAC-SHA256 over `timestamp + "." + exactRawJsonBody`. Headers: `X-Hotdata-Timestamp`, `X-Hotdata-Signature`, `X-Hotdata-Event-Id`. JSON includes a stable eventId, event=`data.final`, transactionId, reference, status, amountKobo, phone, refunded and completedAt.

Delivery is at least once. Consumers verify the raw-body signature and timestamp tolerance, atomically deduplicate eventId, and acknowledge with HTTP 2xx. Up to eight attempts use exponential delays; failure notifies the agent to poll status. Attempts for revoked keys or unavailable agent accounts are cancelled. An HTTP request already in flight may complete; revocation cannot recall an already transmitted message. The worker never sends a pending/UNKNOWN purchase as a final outcome.

## Referrals

`/referrals` shows the unique code/link, unique visitors in the last 30 days, signups, queued rewards and credited earnings. `/r/[code]` records a hashed random visitor identifier and redirects to registration with the code prefilled. It stores no raw IP for analytics. The first-party visitor cookie is HTTP-only; worker maintenance removes click records older than 30 days. Counts are referral analytics, not eligibility checks.

Super-admin settings choose FIRST_FUNDING or FIRST_PURCHASE and an integer-kobo bonus. Under the referee's user lock, the first confirmed qualifying event snapshots the policy and queues one qualification. Prior successful activity is not rewarded retroactively. The deduplicated outbox key and unique `ReferralEarning.refereeId` ensure at most one reward across both trigger types, including policy changes.

The worker rechecks the source event, locks the two user rows in stable order, creates the earning and credits the referrer's wallet through the immutable ledger in one transaction. A suspended referrer is deferred; a deleted referrer is cancelled with an audit record. A zero bonus consumes the first qualification without moving money, so enabling a bonus later does not reward already-qualified activity. Rewards are zero by default; the operator decides when to enable and fund this programme.

## Earlier files updated and migration correction

Existing purchase staging, funding notifications, super-admin finalisation, user-access changes, worker maintenance, registration, customer navigation, admin settings and public documentation navigation were extended. The complete changed-file list is appended below and every changed file is included in the full-files deliverable.

Apply `202610110007_phase7`. It adds batch/click records, transaction origins, key callback fields and one-reward-per-referee uniqueness. It also corrects the original `Transaction_money_valid` constraint: failed/refunded purchases recognise zero profit while retaining original amount/cost, and non-failed transactions still enforce sales minus cost. The original equality would otherwise reject a refund settlement. Existing ledger protections remain in force.

Migration stops if legacy referral data already contains multiple earnings for one referee. Do not delete financial history to force it through; review and reconcile those records before migrating. Prisma generation/schema validation does not prove SQL migration execution.

## Run and test

Use Node 22+. From the project root:

```powershell
npm install
npm run db:generate
# Configure .env with PostgreSQL, Redis, independent auth/encryption keys and APP_URL.
docker compose up -d postgres redis
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run dev
```

In a second terminal:

```powershell
npm run worker
```

For disposable database tests, configure a database named exactly `hotdata_test` and apply migrations there first:

```powershell
$env:DATABASE_URL = 'postgresql://YOUR_TEST_USER:YOUR_TEST_PASSWORD@localhost:5432/hotdata_test'
$env:RUN_DB_TESTS = 'true'
npm run db:migrate
npm run test:integration
```

The integration tests refuse another database name and create persistent test ledger records; do not point them at a production database. They inject a fake provider for tests only; production adapters remain disabled.

For the dependency-free design preview:

```powershell
npm run preview
```

Open `http://127.0.0.1:3100/agent-demo`. Root/public, customer and admin previews remain available. `/api-docs` shows the copied real documentation examples in the static preview. Preview controls cannot move money, issue valid keys or contact providers.

## Verification and acceptance

Prisma Client generated successfully, Prisma schema validation passed and the full TypeScript application check passed. 53 isolated checks against copies of the actual production modules passed for bulk parsing, exact totals, required PIN/quotes, strict input, key hashing, signatures, IP normalisation/private-address rejection and callback host restrictions. No external callbacks or real provider requests were sent.

The original bundled Vitest loader hit an esbuild ancestor-directory access-denied error. A native JavaScript config loader resolved it: 87 tests passed; 26 database integration tests were skipped. `vitest.config.mjs` replaces `vitest.config.ts`, and npm test/test:integration now use the native loader. PostgreSQL/Redis integration tests and the SQL migration were not executed here. Production build status and browser results are recorded in `phase-7-verification.json`. A timeout or unexecuted test is not a pass. The static preview verifies design interactions, not the authenticated application runtime.

- [ ] Apply migrations and run every existing financial test plus `tests/integration/agent.test.ts` on disposable PostgreSQL.
- [ ] Confirm duplicate/concurrent bulk submissions create one batch and one debit per row; invalid rows/changed prices roll back everything.
- [ ] Confirm bad PIN attempts persist without a debit and lock after five failures.
- [ ] Confirm concurrent paid upgrades charge once, preserve fee ledger evidence and revoke sessions.
- [ ] Confirm customer/staff accounts cannot use agent endpoints; revoked/downgraded/suspended keys cannot stage purchases.
- [ ] Confirm live API plan responses omit provider credentials and cost/margin fields.
- [ ] Confirm exact-IP restrictions fail without a trusted proxy and behave correctly for normalised IPv4/IPv6.
- [ ] Confirm signed callback raw bytes/timestamps, event replay, retry/exhaustion, cancellation, redirect rejection and pinned public DNS/TLS against controlled approved endpoints.
- [ ] Confirm UNKNOWN outcomes stay pending and confirmed exhausted failures refund once with zero profit.
- [ ] Confirm referral webhook/purchase replay and trigger changes produce one snapshotted reward/ledger credit per referee.
- [ ] Confirm prior successful activity and zero-bonus qualifications are not retroactively rewarded; suspended referrers defer and deleted ones cancel.
- [ ] Confirm all money-writing UI/API routes obey maintenance mode, while existing queue reconciliation continues.
- [ ] Complete the production build and full authenticated browser flows before deployment.

## Changed files

- `.env.example`
- `README.md`
- `docs/phase-7-agent.md`
- `docs/phase-7-verification.json`
- `package.json`
- `preview/agent.html`
- `prisma/migrations/202610110007_phase7/migration.sql`
- `prisma/schema.prisma`
- `scripts/preview.mjs`
- `scripts/worker.ts`
- `src/app/(auth)/register/page.tsx`
- `src/app/(customer)/agent/bulk/page.tsx`
- `src/app/(customer)/agent/keys/page.tsx`
- `src/app/(customer)/agent/page.tsx`
- `src/app/(customer)/referrals/page.tsx`
- `src/app/(public)/api-docs/page.tsx`
- `src/app/api/agent/[action]/route.ts`
- `src/app/api/referrals/route.ts`
- `src/app/api/v1/[action]/route.ts`
- `src/app/r/[code]/route.ts`
- `src/app/robots.ts`
- `src/components/admin/configuration-panel.tsx`
- `src/components/admin/shared.tsx`
- `src/components/agent/bulk-panel.tsx`
- `src/components/agent/keys-panel.tsx`
- `src/components/agent/overview-panel.tsx`
- `src/components/auth/auth-form.tsx`
- `src/components/customer/customer-shell.tsx`
- `src/components/customer/dashboard-panel.tsx`
- `src/components/customer/referrals-panel.tsx`
- `src/components/customer/site-chrome.tsx`
- `src/lib/agent.ts`
- `src/lib/public-site.ts`
- `src/lib/validation/admin.ts`
- `src/lib/validation/agent.ts`
- `src/server/auth/api-keys.ts`
- `src/server/notifications/agent-callback-outbox.ts`
- `src/server/security/agent-callback.ts`
- `src/server/security/agent-ip.ts`
- `src/server/security/agent-secrets.ts`
- `src/server/security/http.ts`
- `src/server/services/admin-settings.ts`
- `src/server/services/admin-transactions.ts`
- `src/server/services/admin-users.ts`
- `src/server/services/agent.ts`
- `src/server/services/funding.ts`
- `src/server/services/purchases.ts`
- `src/server/services/referrals.ts`
- `tests/integration/agent.test.ts`
- `tests/unit/admin.test.ts`
- `tests/unit/agent.test.ts`
- `vitest.config.mjs`

Removed: `vitest.config.ts` (replaced by `vitest.config.mjs`).

Stop here. Begin Phase 8 only after CONTINUE.
