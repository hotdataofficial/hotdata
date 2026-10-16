# Hotdata staging preparation

This is the release preparation after Phase 8, not a public deployment. The application code remains unchanged; this package adds staging/QA container files, a private environment initializer, a staging guard, a read-only endpoint smoke checker and setup tests. Hosting provider, staging domain and deployment access are still required. No host, database, gateway or provider was provisioned here.

## Files and commands

Use the new compose.staging.yaml on a Docker-capable Linux VPS. It runs web, persistent worker, PostgreSQL, Redis and a tools-profile migration job. The web port is 127.0.0.1:3200; PostgreSQL/Redis have no published ports. Named staging volumes isolate the database, Redis queue and private proof uploads. Container logs rotate, and the worker gets a two-minute shutdown grace period. Readiness checks PostgreSQL and Redis; it does not prove worker/provider/gateway delivery.

Fresh staging setup, on the host, using your real HTTPS staging origin:

```sh
npm ci
npm run staging:init -- https://YOUR_STAGING_DOMAIN
npm run test:staging
# Privately edit .env.staging: sandbox gateway, verified email sender and staging seed details.
npm run staging:check
docker compose --env-file .env.staging -f compose.staging.yaml config --quiet
docker compose --env-file .env.staging -f compose.staging.yaml build app worker migrate
docker compose --env-file .env.staging -f compose.staging.yaml up -d postgres redis
docker compose --env-file .env.staging -f compose.staging.yaml run --rm migrate
docker compose --env-file .env.staging -f compose.staging.yaml up -d app worker
docker compose --env-file .env.staging -f compose.staging.yaml ps
```

Never paste .env.staging into chat or a ticket. The initializer uses exclusive creation and never overwrites existing secrets. On Linux it requests file mode 0600; on Windows verify the file ACL separately. The initializer prints no secrets. Keep PROVIDER_ENCRYPTION_KEY stable and back it up privately. A new file generates fresh independent auth, database, Redis and encryption secrets. This is intended for a new isolated staging database, not credential rotation of an existing instance.

The staging guard validates the file only; it does not connect to services or validate sandbox credentials. It rejects live Paystack keys, alternate unimplemented gateway credentials, public launch/indexing/published-legal flags, duplicate authentication secrets, wrong database names and a financial-test opt-in against staging. Run it before every release. It does not rewrite arbitrary running environments or prevent an operator from bypassing the documented commands.

Leave PUBLIC_SITE_LIVE, PUBLIC_INDEXABLE and LEGAL_PUBLISHED false. Staging Compose also forces them false. It forces RUN_DB_TESTS=false. Keep disabled provider templates disabled until a provider contract and controlled test mode are verified. If the provider has no sandbox, explicitly agree a limited operator-controlled test plan before any real delivery; this package does not authorize real-money operations.

## HTTPS and staging access

Configure a staging DNS record and a valid TLS certificate on the VPS. Adapt deploy/nginx.conf from Phase 8 with your staging domain/certificate paths and change proxy_pass to http://127.0.0.1:3200. Keep direct app access blocked and databases private. Use an IP allowlist or equivalent host access restriction for review access. If a sandbox gateway needs a callback, arrange a narrowly scoped webhook exception while preserving the application's signature check; do not expose all routes for that purpose.

TRUST_PROXY starts false. Set it true only after confirming the reverse proxy overwrites X-Forwarded-For and the app cannot be reached directly. If there is a CDN, configure its trusted real-IP contract first. Production secure cookies and service-worker installation require the real HTTPS staging origin. A loopback HTTP smoke test is not a substitute for an installed device test.

```sh
nginx -t
npm run staging:smoke -- https://YOUR_STAGING_DOMAIN
```

The smoke command checks liveness, dependency readiness, manifest, service worker, offline shell and unauthenticated agent-key protection. It requires CSP and no-store on health/API/service-worker responses. It follows no redirects and never sends a PIN, credentials, funding request or purchase. A proxy access restriction may reject it until it runs from an authorized review IP; keep the restriction and run the check from there.

## Initial staging operator

Privately set ADMIN_SEED_EMAIL and a strong unique ADMIN_SEED_PASSWORD on the staging host. Run the seed only once in a controlled staging environment:

```sh
docker compose --env-file .env.staging -f compose.staging.yaml run --rm migrate npm run db:seed
```

The tools image uses production NODE_ENV and creates only the bootstrap super admin, never development customer/agent accounts. Replace its placeholder phone/profile with actual staging operator details. Seed does not credit a wallet. Use a dedicated staging identity and test accounts. Never reuse a production administrator password. Seed refuses automatic promotion of an existing account with a different role.

## Disposable financial verification

compose.qa.yaml is independent of staging and production. It uses the exact database name hotdata_test required by the integration tests, ephemeral test PostgreSQL/Redis services and fake test-only credentials, with no published ports or named persistent volumes. Its migration job must complete successfully before npm test runs with RUN_DB_TESTS=true. No real gateway/provider keys are configured.

Run on a Docker-capable host, then retain the command's exit code and output as release evidence:

```sh
docker compose -f compose.qa.yaml config --quiet
docker compose -f compose.qa.yaml build tests migrate_test
docker compose -f compose.qa.yaml run --rm tests
```

This should run 94 Vitest unit tests and all 26 financial/database tests. The nine staging configuration tests run separately through npm run test:staging and are included in GitHub CI. Do not run RUN_DB_TESTS=true against hotdata_staging or production. Financial tests alter records/settings and require a disposable database. Do not claim these tests passed until their actual execution succeeds. No automatic cleanup/purge command is supplied for active staging data.

If tests fail, investigate and fix the source, then rebuild and rerun the affected suite. Do not force migrations by deleting ledger rows, resetting production databases or editing balances. Run the read-only reconciliation queries in deploy/reconciliation.sql against staging and retain any anomalies for investigation.

## Release acceptance

- [ ] VPS/provider, domain, HTTPS certificate and deployment access are available through secure channels.
- [ ] Staging preflight and Docker Compose validation pass on the target host.
- [ ] Migrations complete on isolated staging and disposable QA databases.
- [ ] All 26 database tests pass; build, unit/browser/staging tests and CI remain green.
- [ ] Web readiness is healthy and the persistent worker demonstrably reconciles queued/pending outcomes.
- [ ] Registration/verification/login/PIN/session/deletion/role and ownership flows work through HTTPS.
- [ ] A sandbox payment credits once; replay cannot double-credit; fees and manual proof storage behave correctly.
- [ ] Verified provider success, failure/refund and UNKNOWN/reconciliation pass under the agreed testing mode.
- [ ] Agent bulk/API/signature/retry/referral and administrator audit/report flows pass.
- [ ] Installation, offline/reconnect/manual update and accessibility pass on real Android/iOS devices.
- [ ] Private data stays out of caches/logs; staging is unindexed and access restricted.
- [ ] Backups and restore are tested, support/legal details reviewed, and unresolved checks are closed before production approval.

## Actual verification in this workspace

Nine staging tests passed. Both YAML documents parsed with merge handling; eight assertions verified exposed-port, environment and dependency isolation. Existing Phase 8 evidence remains 92 unit tests, three mobile browser tests, TypeScript and production build passed. Docker is unavailable here, so target-host Compose validation, container builds/migrations and all 26 database tests remain unexecuted. No public staging site was deployed; no secrets or credentials were generated into the project during this preparation.

For Vercel hosting, follow the Phase 8 managed-service guide instead: deploy the web app separately from the persistent worker and implement private object storage before manual funding. This Docker staging package is not directly deployable as a Vercel-only app.

## Files created or updated

- `.github/workflows/ci.yml`
- `README.md`
- `compose.qa.yaml`
- `compose.staging.yaml`
- `docs/staging-runbook.md`
- `docs/staging-verification.json`
- `package.json`
- `preview/launch.html`
- `scripts/check-staging.mjs`
- `scripts/init-staging.mjs`
- `scripts/staging-config.mjs`
- `scripts/staging-smoke.mjs`
- `tests/staging.test.mjs`

Reference: [Docker Compose run](https://docs.docker.com/reference/cli/docker/compose/run/) and [environment interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation).
