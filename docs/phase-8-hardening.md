# Hotdata Phase 8 — hardening and deployment readiness

## Delivered files and behavior

This phase adds a scoped PWA manifest, generated 192/512 PNG icons, a maskable icon, a generic offline shell, install/connectivity/update controls, safe error and not-found screens, security headers, private-page cache restrictions, health checks, a deployment preflight, read-only ledger reconciliation SQL, nginx configuration, GitHub Actions and three Playwright browser safety flows. Earlier auth, money, provider, customer/admin/agent services remain in the same app. HTTP JSON parsing now requires the exact application/json media type, allowing parameters.

No live deployment or provider activation is included. Source implementation is complete for this phase; operational acceptance is pending the launch checklist below. Unit tests, static preview and types do not establish payment or provider readiness.

## PWA and performance

The root layout links /manifest.webmanifest and registers /sw.js only in a secure context. Install Hotdata appears when the browser offers installation; on iOS use Safari Share → Add to Home Screen. The worker caches only /offline.html and two icons, never API responses, account HTML, RSC, balances, receipts, tokens, keys or proof uploads. Navigations use the network and fall back to the generic offline shell on connection failure. Non-GET requests, cross-origin requests and API/RSC fetches are not intercepted. No background sync or offline financial queue exists.

An update waits until the user accepts Reload safely; it warns about checking submitted orders first. It never forces a mid-purchase reload. Increment the service-worker cache version when changing cached assets. Activation removes only Hotdata's old offline caches. The maskable icon stays inside its safe zone. Offline shells deliberately show no stored balance or recent transactions.

Keep dynamic financial pages dynamic. Next standalone output, small signal icons and no PWA SDK reduce overhead. Build concurrency is limited to two workers for modest servers. Profile real routes on a low-end Android phone and slow 3G before launch; no Lighthouse score or under-20-second delivery guarantee is claimed here. The browser preview uses fictional data and does not prove production performance.

## Security review and practical limits

Existing protections reviewed: cookie session RBAC/ownership, CSRF origin and double-submit token, bounded streamed JSON/webhook bodies, fail-closed Redis limits, Argon2 passwords/PINs, encrypted provider/callback secrets, hashed agent keys, callback hostname/public-IP pinning, immutable kobo ledger and row locks, safe fallback only after definitive provider failure, queue reconciliation and revoked-key rechecks. New tests assert the service worker avoids private data and safe incident records omit exception messages.

Production headers include CSP, frame denial, nosniff, restrictive browser permissions and one-year HTTPS transport protection. CSP uses same-origin scripts/connections and disallows eval in production; Next inline hydration and existing inline styles still require unsafe-inline. This is a baseline CSP, not nonce-based XSS prevention. A future nonce rollout must cover Next hydration and all inline styles, with browser regression testing. HTTPS images are allowed for admin-configured branding. There is no broad CORS response grant. Private route headers and financial API no-store prevent intended browser/proxy caching; the nginx sample explicitly disables proxy caching.

Structured incidents carry an event UUID, event name, error type and timestamp only. Forward this allowlisted JSON from your log collector into Sentry using its DSN/credential integration; SENTRY_DSN is reserved, not an active in-app SDK. Do not turn on default request body, SQL, stack or session replay capture. Configure alerts for unknown outcomes, stale pending transactions, queue delays, callback exhaustion and provider low balances. The public /health endpoint exposes only status; it does not reveal secrets, dependency addresses or SQL errors. /health?ready=1 additionally checks PostgreSQL and Redis within a bounded deadline. Readiness does not prove worker, gateway or provider health.

TRUST_PROXY=true is safe only when your proxy overwrites X-Forwarded-For and direct app access is blocked. The nginx example sets the address from its immediate client. If using a CDN, configure nginx's trusted real-IP ranges first; never trust a user-provided forwarding chain. A managed host needs an equivalent verified ingress contract; leave IP-restricted agent keys disabled until verified.

## Commands and checks

Use Node 22+ and the committed lockfile:

```sh
npm ci
npm run db:generate
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Configure a disposable PostgreSQL database named hotdata_test and Redis before database tests. Never use a production URL:

```sh
# Set DATABASE_URL and REDIS_URL to disposable services first.
npm run db:migrate
RUN_DB_TESTS=true npm run test:integration
```

PowerShell: set $env:RUN_DB_TESTS = 'true' before the test command. Existing test suites share the disposable database sequentially. CI sets RUN_DB_TESTS=true, applies every SQL migration and fails on any test failure. There is no database skip in CI. Unit-only local runs still skip DB tests when the flag is absent.

For an existing local Edge installation, optionally set PLAYWRIGHT_EXECUTABLE_PATH to its absolute binary path; CI uses the installed Playwright Chromium instead.

The three mobile Chromium flows check signed-out wallet/API protection, registration password/consent validation, and an actual service-worker offline navigation/cache boundary. They do not simulate successful funding or delivery. Complete the real sandbox financial browser flows in the checklist. Browser diagnostics may contain rendered account information, so keep them private and short-lived. GitHub CI retains its synthetic diagnostics seven days.

```sh
npm run check:runtime
curl -fsS https://YOUR_DOMAIN/health
curl -fsS 'https://YOUR_DOMAIN/health?ready=1'
```

The preflight checks required environment shapes, independent secrets, canonical base64 encryption key and HTTPS APP_URL. It never contacts services and does not verify credentials. Generate each authentication secret independently from at least 32 random bytes; PROVIDER_ENCRYPTION_KEY is canonical base64 of exactly 32 random bytes. Store it in a secret manager and preserve it through redeploys so existing credentials remain decryptable.

## VPS deployment

1. Provision a staging domain and HTTPS, Node/Docker-capable VPS, secure SSH and firewall. Expose only HTTP/HTTPS/SSH; bind app, PostgreSQL and Redis to loopback as compose.yaml already does. Use separate staging credentials and gateway/provider sandbox accounts.
2. Copy source, create a restricted .env from .env.example and set public origin, database/Redis passwords and independent secrets. Keep launch/indexing off, legal drafts unpublished and unverified providers disabled. Set real email and verified support/operator details before publication.
3. Run npm ci, db:generate, typecheck, tests, build, preflight and browser flows in staging. Take a database backup before migration. Review unique referral constraints against legacy records; do not delete ledger evidence to force a migration.
4. Build the application and worker images; run migrations with the worker image before starting the new version:

```sh
docker compose build app worker
docker compose up -d postgres redis
docker compose run --rm worker npm run db:migrate
docker compose up -d app worker
```

5. Bootstrap the initial super admin once using a separate controlled seed execution, with production NODE_ENV and strong explicit ADMIN_SEED credentials. The sample phone is a bootstrap placeholder: verify and replace the real operator profile before use. Never seed test accounts in production. Do not use seed as a deployment hook.
6. Install deploy/nginx.conf after replacing its domain and TLS paths. Run nginx -t before reloading. Set TRUST_PROXY=true only after verifying ingress headers and firewall. Monitor public liveness and readiness plus worker/outbox/provider indicators.
7. Mount and back up private_uploads and PostgreSQL; encrypt backups and test restores. Redis AOF is enabled and noeviction preserves queue data. Keep at least one persistent worker running independently of requests. Do not run the worker as a web serverless function or depend on user visits for reconciliation.
8. Execute all final checks below with low-value sandbox operations. Configure production gateway webhooks using the exact routes documented in Phase 2/3 and verify actual raw-byte signatures. Enable only adapters you implemented and validated. Publish legal/support information, then turn on public launch flags after acceptance.

## Vercel plus managed services

Deploy the Next web app separately from a persistent worker on a container host. Use managed PostgreSQL and Redis with TLS and reachable network rules. Provide environment variables to both runtimes; APP_URL must be your HTTPS origin. Run prisma migrate deploy as a controlled release job, not at request startup. Configure the host-supported connection pooling/direct migration URLs with Prisma documentation; verify transaction/row-lock behavior in the chosen pooler. Do not use an HTTP-only Redis service that cannot support BullMQ.

Current manual-funding proof storage uses private local files and a persistent volume. Vercel's ephemeral filesystem cannot provide that guarantee. For this target, implement a private object-storage adapter with authenticated upload/download, strict limits/type validation and retention before enabling manual funding. Until then use the VPS/persistent-volume target. Sharing a local path between Vercel and the worker does not solve private proof persistence. Confirm the host's forwarding header contract before enabling TRUST_PROXY or IP-restricted agent keys.

Vercel must not cache private financial routes or APIs. Verify the deployed Cache-Control behavior. Worker scaling must preserve queue/outbox leases and deployment health checks. Keep public indexing off on staging and restrict staging access. No host account or domain was created during this phase.

## Operations, backups and rollback

Run deploy/reconciliation.sql daily with a read-only account in a consistent snapshot. The first two queries should return zero rows; investigate wallet/ledger differences with the original references and audit evidence. The pending query is an alert for investigation, never an instruction to refund. UNKNOWN provider results remain pending until confirmed. The outbox summary indicates dispatcher delays but not completion by itself.

Alert after repeated readiness failures, oldest pending/outbox age above the accepted SLA, worker failures, gateway signature failures and provider balances below configured thresholds. Daily reconciliation complements the worker's frequent sweeps. Back up before releases, daily thereafter and more frequently as transaction volume requires. Test a full restore into an isolated environment including encryption secrets and private proofs. Agree actual RPO/RTO with the operator; no arbitrary recovery guarantee is claimed.

Rollback application images to the prior known-good version only if schema compatibility is verified. Prefer forward fixes for financial migrations. Never roll back a database snapshot onto a live system without accounting for gateway/provider deliveries since the backup. Pause new orders through maintenance mode while reconciliation continues. Drain jobs safely before worker retirement; do not purge UNKNOWN or queued financial records.

## Final launch checklist

- [ ] All SQL migrations, immutable-ledger constraints, wallet concurrency, bulk atomicity, duplicate order/webhook replay, PIN lockout, upgrade concurrency and referral-once tests pass on disposable PostgreSQL/Redis.
- [ ] Production build, typecheck, unit and integration suites, all three Playwright flows and CI complete successfully on Linux.
- [ ] Real registration, verification email, login, reset, PIN setup/change, session revocation, deletion request and account ownership pass in staging.
- [ ] A verified sandbox funding webhook credits once; replay cannot double-credit; fees and manual proof approval are correct.
- [ ] Verified provider success, definitive failure/refund, timeout/UNKNOWN, re-query and safe fallback behave correctly. UNKNOWN is never refunded or sent to another provider automatically.
- [ ] Real customer and agent purchase browser flows retain one UUID across double taps/network retries and show correct receipts/history/notifications.
- [ ] Agent keys, trusted IP restrictions, callback raw-byte signatures/replays/retries/exhaustion, bulk per-row outcomes, upgrades and referral policy pass live staging checks.
- [ ] Private pages, financial APIs and proofs have correct no-store/ownership controls; cross-origin and CSRF attempts fail; secrets never appear in logs or client bundles.
- [ ] Mobile installation, offline navigation, reconnection, manual app updates, accessible focus/labels and no horizontal overflow pass on Android Chrome and iOS Safari.
- [ ] Slow-3G/low-end-phone profiling, rate/velocity guards, maintenance behavior, worker recovery and dependency outages pass.
- [ ] Monitoring, provider balance alerts, signed webhooks, backups and tested restore/rollback procedure are operational.
- [ ] Verified identity, CAC/KYC/reseller terms, legal policies, privacy/deletion process and real support contacts are reviewed and published.
- [ ] Operator explicitly approves staging-to-production release with all unresolved checks closed.

## Local verification record

The production webpack build and full TypeScript check passed. Vitest: 92 unit tests passed, 26 database tests skipped. All three Playwright mobile safety flows passed against the built app using installed Edge with a Pixel 7 viewport. Liveness was 200; readiness correctly returned 503 with PostgreSQL/Redis unavailable. Manifest, service worker and offline endpoints were 200 with the expected headers, and unauthenticated agent access was 401/no-store. Preflight accepted synthetic valid configuration and rejected missing configuration. SQL migrations/database integration, Linux GitHub CI, Docker/nginx runtime, genuine device installation, live payment/provider callbacks and restore tests were not executed. No deployment or provider activation occurred.

See phase-8-verification.json for actual results and limitations. The fictional design preview is available at /launch-demo and the real offline shell at /offline.html on port 3100. The design preview does not install the production worker or perform financial operations.

References: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) and [Playwright CI guide](https://playwright.dev/docs/ci).

## Files created or updated

- `.dockerignore`
- `.github/workflows/ci.yml`
- `README.md`
- `deploy/nginx.conf`
- `deploy/reconciliation.sql`
- `docs/phase-8-hardening.md`
- `docs/phase-8-verification.json`
- `next-env.d.ts`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `preview/launch.html`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/maskable-512.png`
- `public/offline.html`
- `public/sw.js`
- `scripts/check-runtime.mjs`
- `scripts/generate-icons.mjs`
- `scripts/preview.mjs`
- `src/app/error.tsx`
- `src/app/health/route.ts`
- `src/app/layout.tsx`
- `src/app/manifest.ts`
- `src/app/not-found.tsx`
- `src/components/pwa-controls.tsx`
- `src/lib/security-headers.ts`
- `src/server/observability.ts`
- `src/server/security/http.ts`
- `tests/e2e/safety.spec.ts`
- `tests/unit/hardening.test.ts`

Stop here after Phase 8. Deployment is a separate, explicitly approved action after staging acceptance.
