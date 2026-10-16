# Phase 6: administration, reporting and support

Phase 6 adds the protected admin workspace. Phase 7 (referrals, agent features and developer API) and Phase 8 are not implemented in this phase.

## Included

- `/admin`: today's successful sales, gross purchase profit, confirmed funding, new accounts, pending/failed purchases, funding-review queue and provider balance snapshots, using Lagos dates.
- `/admin/users`: searchable accounts, tier/status edits, session revocation, deletion-request flags, immutable wallet ledger inspection and credit/debit adjustments with a reason and retained idempotency key.
- `/admin/transactions`: date/status/reference/phone filters, redacted provider evidence, queued reconciliation and super-admin finalisation based on a fresh query to the original provider reference.
- `/admin/plans`: network controls, pricing, provider mappings, CSV import/export and cost-based bulk markup. Imports are atomic and limited to 50 rows per request.
- `/admin/providers`: super-admin provider priorities, URLs, balance thresholds and encrypted replacement credentials. Credentials are never returned. Adapter, URL and credential changes are blocked while provider attempts remain pending.
- `/admin/funding`: private transfer proof review, actual bank reference verification and audited approval/rejection.
- `/admin/reports`: day/week/month grouping, network breakdown and CSV export. Sales/profit count only successful data purchases. Reports select records by their creation date and show their current outcome, rather than settlement-date accounting.
- `/admin/tickets`: customer support requests, status changes and replies delivered through in-app notifications. Customers open tickets on `/support`.
- `/admin/announcements`: super-admin public notices and broadcasts to all active accounts, customers or agents. A durable worker outbox creates each recipient notification once.
- `/admin/audit`: searchable, paginated audit records. The interface cannot edit or delete them.
- `/admin/settings`: site name/logo, support contacts, funding limits/fees, transfer toggle, maintenance mode and reserved referral/agent settings. Monetary fields are integer kobo; 100 kobo = ₦1. BPS is basis points; 100 = 1%.

## Security and financial behaviour

Admin APIs enforce roles on the server; hiding navigation is only a convenience. SUPER_ADMIN is required for staff access changes, provider credentials, settings, announcements/broadcasts and manual finalisation. ADMIN may manage customer/agent access and wallets but cannot adjust staff wallets. Shared transaction-level advisory locking rechecks current privileges before mutations and serialises staff changes. Self-demotion/suspension and removal of the last active super admin are blocked.

Wallet changes use the existing locked ledger service. Entries remain immutable, and retries preserve their request reference. The user panel exposes ledger entries so operators can inspect an earlier request before starting another. No negative balance is permitted.

Requery queues the existing purchase worker; it preserves its lease and fallback rules. Finalisation requires a definitive provider result for the original attempt reference, no active worker lease and no conflicting attempt evidence. Historical successful/failed attempts cannot be overwritten. Failure/refund requires all attempts to be confirmed failed. UNKNOWN, timeouts and pending results cannot trigger a refund. The refund reference is the same as the worker's, preventing a second refund.

Maintenance pauses new purchase and wallet write requests. Existing reconciliation and payment webhooks continue. Public pages use bounded settings reads with environment fallbacks during database outages; financial writes do not rely on those fallbacks.

Broadcasts retain their UUID for retry. The worker handles active accounts existing when the broadcast was queued in locked batches with deterministic notification IDs. Replies and broadcasts are in-app notifications; this phase does not send external marketing email or SMS.

Provider adapter templates remain disabled. This phase does not introduce live delivery integrations. Referral bonus, referral trigger and agent upgrade fee values are stored for Phase 7; they do not yet pay rewards or purchase upgrades.

## Run locally

Use Node.js 22 or later. From the project root:

```powershell
npm install
Copy-Item .env.example .env
# Configure database, Redis, auth/encryption keys and your business values.
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run dev
```

Run the worker in a separate terminal:

```powershell
npm run worker
```

Use the seeded super-admin account according to the existing seed documentation and environment configuration. Open `/admin` after authentication. No Prisma schema change was needed for this phase; the existing models store settings, audit records, tickets and durable outbox events.

The standalone design preview needs no database or credentials:

```powershell
npm run preview
```

Open `http://127.0.0.1:3100/admin-demo`. `/` remains the public preview and `/dashboard-demo` remains the customer preview. Preview figures, accounts, prices and charts are fictional. Preview actions cannot move money, send messages or call providers.

## Verification in this workspace

- Full TypeScript application check passed.
- 33 isolated checks using copies of the actual helper and validation source passed: permissions, self-access protection, refund evidence, Lagos ranges/calendar validation, CSV formula neutralisation, exact money serialisation, support/broadcast validation and settings constraints. Equivalent tests are in `tests/unit/admin.test.ts`.
- Vitest could not initialise: esbuild encountered an ancestor-directory access-denied error in this sandbox. This is not a passing test-suite result.
- PostgreSQL and Redis integration scenarios were not executed in this environment. Last-super-admin concurrency, financial mutations, real authentication, private proof access and durable worker delivery still require runtime validation with those services.
- The standalone browser preview was checked for desktop/mobile layout, customer search and pending-transaction filtering. It is a design preview, not verification of the authenticated Next.js application.
- Production build result is recorded in the separate Phase 6 verification report. A timeout is not a successful build.

## Runtime acceptance checklist

- [ ] CUSTOMER/AGENT cannot access admin pages or APIs; ADMIN cannot use super-admin endpoints.
- [ ] Two simultaneous staff edits cannot remove the last active super admin; revoked sessions fail on their next request.
- [ ] Credit/debit retry creates exactly one ledger entry; staff-wallet restrictions and insufficient balance are enforced.
- [ ] Pending/UNKNOWN provider evidence cannot refund or enable fallback; final success cannot be rewritten as failure.
- [ ] Manual finalisation during an active worker lease is rejected; confirmed failure creates one refund and terminal notification.
- [ ] Funding approval verifies proof/bank reference; repeated approval creates one credit and fee pair.
- [ ] Reports match successful purchases and funding in the selected Lagos creation-date range; malformed dates return HTTP 400.
- [ ] Provider reads/audits exclude credentials; pending attempts prevent changes to their query credentials.
- [ ] Maintenance blocks new money requests while webhooks and queued purchase reconciliation continue.
- [ ] Tickets belong to their authenticated customer; staff replies create notifications; concurrent ticket creation respects the open-ticket limit.
- [ ] Broadcast crash/retry creates one notification per eligible account; newly created accounts after the cutoff are excluded.
- [ ] Every admin mutation and protected record view has an audit record.

Complete changed files, with absolute file headings and full source, are included in `hotdata-phase-6-full-files.md`. The ZIP contains the complete project source and excludes dependencies, build output, private uploads and secret `.env` files.

Stop here. Continue to Phase 7 only when the user says CONTINUE.

## Changed file list

- `README.md`
- `docs/phase-6-admin.md`
- `docs/phase-6-verification.json`
- `preview/admin.html`
- `scripts/preview.mjs`
- `scripts/worker.ts`
- `src/app/(customer)/layout.tsx`
- `src/app/(public)/layout.tsx`
- `src/app/admin/announcements/page.tsx`
- `src/app/admin/audit/page.tsx`
- `src/app/admin/funding/page.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/plans/page.tsx`
- `src/app/admin/providers/page.tsx`
- `src/app/admin/reports/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/tickets/page.tsx`
- `src/app/admin/transactions/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/api/admin/funding/route.ts`
- `src/app/api/admin/manage/[section]/route.ts`
- `src/app/api/admin/plans/route.ts`
- `src/app/api/admin/providers/route.ts`
- `src/app/api/customer/[action]/route.ts`
- `src/app/api/support/tickets/route.ts`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/admin/admin-shell.tsx`
- `src/components/admin/configuration-panel.tsx`
- `src/components/admin/funding-panel.tsx`
- `src/components/admin/overview-panel.tsx`
- `src/components/admin/plans-panel.tsx`
- `src/components/admin/providers-panel.tsx`
- `src/components/admin/records-panel.tsx`
- `src/components/admin/reports-panel.tsx`
- `src/components/admin/shared.tsx`
- `src/components/admin/transactions-panel.tsx`
- `src/components/admin/users-panel.tsx`
- `src/components/customer/customer-shell.tsx`
- `src/components/customer/site-chrome.tsx`
- `src/components/customer/support-panel.tsx`
- `src/components/customer/tickets-panel.tsx`
- `src/components/public/contact-options.tsx`
- `src/components/public/site-notices.tsx`
- `src/lib/admin.ts`
- `src/lib/validation/admin.ts`
- `src/server/auth/admin-transaction.ts`
- `src/server/notifications/broadcast-outbox.ts`
- `src/server/security/http.ts`
- `src/server/services/admin-reports.ts`
- `src/server/services/admin-settings.ts`
- `src/server/services/admin-transactions.ts`
- `src/server/services/admin-users.ts`
- `src/server/services/manual-funding.ts`
- `src/server/services/pricing.ts`
- `src/server/services/wallet-adjustment.ts`
- `tests/unit/admin.test.ts`
