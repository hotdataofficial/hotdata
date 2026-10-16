# Hotdata — Vercel with managed services

Selected hosting: Vercel for the Next.js web app, managed PostgreSQL and TCP/TLS Redis, plus a separate persistent Docker worker. This replaces the VPS-only staging assumption. No repository was uploaded or deployment created. The user will provide another repository; offhospot/offhotspot remains untouched. The Vercel integration is available but connection is not yet confirmed.

## Source layout and Vercel import

Upload the contents of the hotdata directory as the repository root, including package-lock.json, prisma/, src/, public/, scripts/, Dockerfile.worker and vercel.json. Do not upload the outer outputs directory, node_modules, .next, .env files, private-uploads, test-results or playwright-report. If using a repository with a different structure, set Vercel Root Directory to the directory containing package.json and vercel.json.

Import the user-selected repository into a dedicated Hotdata staging Vercel project. Select Next.js and Node 22. vercel.json sets npm ci and Prisma Client generation followed by the production build. It intentionally never migrates or seeds a database during a web build. Keep the project's deployment access protection enabled while testing. Configure a stable HTTPS staging origin before using accounts, callbacks or CSRF-protected writes. Do not reuse one APP_URL across unrelated preview URLs; keep financial testing on the configured staging domain.

## Managed PostgreSQL and Redis

Provision an isolated staging database/branch and a completely separate disposable hotdata_test database for financial tests. Use the provider's Prisma-compatible pooled TLS URL for web runtime, with a small connection limit; choose the final limit from the managed service's actual budget and load test. The env template uses connection_limit=3 as a starting setting, not a guaranteed capacity target. Vercel function concurrency can multiply pools. Put the web app, database, Redis and worker near each other geographically and verify latency.

Keep a direct TLS migration URL in the release job only. DATABASE_URL and MIGRATION_DATABASE_URL must point to the same database name. This project's Prisma 6.19 schema continues using DATABASE_URL; the managed migration helper substitutes the direct URL only in the migration subprocess. It does not change the application runtime datasource. Both pooled and direct connections must preserve PostgreSQL transactions and the row locks used for money movement.

Redis must support persistent TCP/TLS connections, BullMQ's Lua/blocking commands and noeviction. REDIS_URL starts rediss:// for hosted TLS. An HTTP REST-only Redis endpoint is incompatible with this ioredis/BullMQ implementation. Verify persistence, connection limits and the provider's actual BullMQ support. No Redis vendor or paid plan has been purchased.

## Private environment settings

Use deploy/vercel-staging.env.example as a names-only/template reference and enter real values privately in the platform settings. It contains no real credentials. Shared web and worker values:

- APP_URL and CORS_ALLOWED_ORIGINS: stable HTTPS staging origin.
- DATABASE_URL: managed runtime PostgreSQL connection.
- REDIS_URL: managed TLS Redis connection.
- JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, AUTH_CODE_SECRET, IP_HASH_SECRET: independent strong secrets.
- PROVIDER_ENCRYPTION_KEY: canonical base64 for exactly 32 random bytes, identical on both runtimes and preserved/backed up.
- STAGING=true; PUBLIC_SITE_LIVE=false; PUBLIC_INDEXABLE=false; LEGAL_PUBLISHED=false; RUN_DB_TESTS=false.
- PROOF_STORAGE_DISABLED=true on both runtimes.
- PAYSTACK_SECRET_KEY/PUBLIC_KEY: test-mode keys only; email sender/API settings for actual staging verification.
- AGENT_CALLBACK_ALLOWED_HOSTS: only controlled approved test callback hosts, or blank to disable registration.
- TRUST_PROXY=false until the host forwarding-header and direct-access contract is verified. Exact-IP agent keys remain unavailable until that verification.

Do not put MIGRATION_DATABASE_URL or seed passwords in the Vercel web project. Put them only in controlled release/bootstrap jobs. Never put any secret in NEXT_PUBLIC_ variables or the repository. Copying the VPS .env.staging file will not work: its internal postgres/redis hostnames are for Docker networking.

## Persistent worker and migrations

Deploy Dockerfile.worker on your selected background-worker/container host. It has no public HTTP endpoint and runs npm run worker continuously. Do not replace it with a Vercel function, a web startup hook, or a request-triggered cron. Keep at least one instance active; monitor process restarts plus pending/outbox age. Allow sufficient graceful shutdown time and preserve managed Redis queues across releases.

Before the web and worker release, run a controlled job from the same source revision, with the direct migration environment configured privately:

```sh
npm ci
npm run db:generate
npm run db:migrate:managed
```

Alternatively run npm run db:migrate:managed in the Dockerfile.worker image as a one-off release command. The helper rejects missing direct URL, database-name mismatch and non-TLS migration configuration. It passes the direct URL to Prisma without printing it. Prisma's own output can reveal infrastructure metadata; keep release logs private. The helper's shape validation does not verify network reachability or credentials. Do not run this job against production while preparing staging.

Bootstrap one staging super admin in a controlled job with explicit unique ADMIN_SEED_EMAIL/PASSWORD and NODE_ENV=production. The seed creates no development customer/agent accounts in that mode; replace its placeholder phone/profile before use. Do not rerun seed automatically on every release.

## Manual proof funding on Vercel

The application now fails closed for local proof upload, token verification and proof reads when VERCEL=1, regardless of an attempted PROOF_STORAGE_DISABLED=false override. Wallet summaries omit manual bank instructions in that case. An explicit PROOF_STORAGE_DISABLED=true also disables it on the worker/other hosts. Paystack checkout/DVA code is unaffected.

This is a temporary reduction of available funding methods, not a private object-storage implementation. Private object storage with authenticated upload/download, ownership, content/size validation, retention and migration of any existing proof objects is required before restoring manual proof funding. Do not migrate existing pending manual-funding records to Vercel without a proof-storage migration plan. Confirmed wallet/ledger records must always be preserved. There is no public blob bucket or /tmp fallback.

## Verification and release gates

```sh
npm run typecheck
npm test
npm run test:staging
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run staging:smoke -- https://YOUR_STAGING_DOMAIN
```

Run the existing 26 database tests against disposable hotdata_test with RUN_DB_TESTS=true; never against your managed staging or production database. Verify pooled-connection concurrency, duplicate purchases, webhook replay, bulk atomicity, refunds and referral-once behavior on the managed service. Verify the persistent worker actually processes/reconciles jobs. Sandbox gateway/provider delivery, real-device PWA installation, backups/restoration, restricted staging access and operator/legal readiness remain required before production.

The latest verification record is vercel-verification.json. No hosted URL is available until the chosen repository, Vercel connection and managed services are configured. Hosting choices do not imply approval to publish production or spend on a paid plan.

References: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), [Vercel worker deployment guidance](https://vercel.com/kb/guide/docker-on-vercel-vs-render), [Prisma 6 Neon connections](https://docs.prisma.io/docs/orm/v6/overview/databases/neon), [BullMQ Redis requirements](https://docs.bullmq.io/guide/connections).

## Actual local checks

94 unit tests and nine staging setup tests passed. The full TypeScript check and updated production webpack build passed. Migration helper syntax passed; missing configuration was correctly rejected without a database call. The 26 database tests remain skipped, and managed database/Redis connections, worker Docker build, actual migrations, private proof object storage and hosted sandbox flows remain unverified. No repository was changed and no deployment was made.

## Files created or updated

- `.env.example`
- `Dockerfile.worker`
- `README.md`
- `deploy/vercel-staging.env.example`
- `docs/staging-runbook.md`
- `docs/vercel-managed-staging.md`
- `docs/vercel-verification.json`
- `package.json`
- `preview/launch.html`
- `scripts/migrate-managed.mjs`
- `src/app/api/wallet/[action]/route.ts`
- `src/components/wallet/wallet-panel.tsx`
- `src/lib/proof-storage.ts`
- `src/server/storage/proofs.ts`
- `tests/unit/proof-storage.test.ts`
- `vercel.json`
