# Hotdata — Phase 8

A phased Next.js App Router/TypeScript VTU platform for Nigerian mobile data. PostgreSQL/Prisma owns account and money records; Redis/BullMQ supports rate limits, durable purchase processing and reconciliation. Money stays integer kobo, with immutable ledger entries and row locks. Node 22 or newer is required.

Delivered phases: foundation; schema/auth/RBAC; wallet/funding; catalog/providers/purchase engine; customer dashboard/receipts; public landing/pricing/contact/legal/SEO. Admin management, reports, audit logs, support tickets and settings are now included. Agent upgrades, hashed API keys, signed callbacks, atomic bulk purchases and referral rewards are now included. Phase 8 adds PWA, security hardening, CI and deployment documentation. Current setup and final checklist: [Phase 8 guide](docs/phase-8-hardening.md). Prior guides remain in docs/.

## Local setup

Copy .env.example to .env. Configure PostgreSQL/Redis credentials, APP_URL and independent JWT, authentication and provider-encryption secrets. Never commit .env or private payment proofs. Generate random secrets separately with Node crypto as documented in the earlier guides.

Run npm install, npm run db:generate, docker compose up -d postgres redis, npm run db:migrate and npm run db:seed. Then npm run dev in one terminal and npm run worker in another. Validate with npm run typecheck, npm test and npm run build. Tests use the native JavaScript config loader to avoid config-bundling access errors. The seed requires explicit seed credentials; do not use sample accounts in production.

For a dependency-free fictional design preview, run npm run preview and open http://127.0.0.1:3100/. Public pages are now the default; /dashboard-demo retains the customer preview; /admin-demo shows Phase 6 and /agent-demo shows Phase 7; /launch-demo shows Phase 8 and /offline.html shows the real offline shell. This static demo has no real authentication, payment or provider API.

## Public launch settings

Set verified BUSINESS_LEGAL_NAME, BUSINESS_ADDRESS, SUPPORT_EMAIL and PRIVACY_EMAIL, optional registration number/support WhatsApp/hours, and review all policy commitments. LEGAL_PUBLISHED=true requires those details. PUBLIC_SITE_LIVE=true requires published policies; it controls the launch notice and indexing eligibility, not financial API permissions. PUBLIC_INDEXABLE=true permits search indexing only for an explicitly launched HTTPS site. Rebuild/redeploy after changing these environment settings because Next.js may prerender public routes.

Only approved genuine testimonials may be configured through PUBLIC_TESTIMONIALS_JSON. The default publishes no quotes. The public plan API returns customer selling prices and availability; costs, agent prices, credentials and provider mappings remain private. The selling price is still checked on the server at purchase confirmation.

## Architecture and deployment

One Next.js app is the simplest starting point. The persistent worker runs separately from web requests. Docker is the first deployment target; a managed web host additionally needs managed PostgreSQL/Redis and a separate persistent worker. See the prior phase guides for containers, provider contracts, queue semantics and disposable database tests. See [deployment and final QA](docs/phase-8-hardening.md) for VPS and Vercel constraints.

The VTPass, DataStation and ClubKonnect adapters remain disabled templates. Implement and verify each provider contract, endpoint allowlist, credential decryption and mapping before changing adapter readiness. A plan activation flag alone must not enable unverified delivery. Unknown outcomes remain pending; never refund or fall back merely because a request timed out.

## Before going live

Confirm CAC business registration and gateway/provider KYC and reseller terms. Review Terms, Refund Policy and Privacy Policy with the actual operator identity, retention schedule, processor list and international-transfer safeguards. The privacy draft references the Nigeria Data Protection Act 2023 and relevant NDPR obligations; it does not certify compliance. Publish real support contacts and a working privacy/deletion review process.

Enable HTTPS, backups, monitoring and secure secret handling. Pass concurrency, idempotency, webhook replay, provider reconciliation, privacy/ownership and payment sandbox tests before handling real funds. Syntax checks and a fictional preview do not establish production readiness.

## Staging release preparation

See [staging runbook](docs/staging-runbook.md) for the isolated VPS stack, fresh secret initializer, sandbox guard and disposable financial QA stack. Staging has not been deployed. Host access and a verified HTTPS staging domain are required.

## Selected managed hosting

Vercel + managed PostgreSQL/Redis and a separate persistent worker is the selected target. See [managed staging guide](docs/vercel-managed-staging.md). Local proof funding is automatically disabled on Vercel until private object storage is implemented. No hosted deployment exists yet.
