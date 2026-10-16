# Phase 2 — wallets and funding

## Included

Integer-kobo wallet services with row locks, immutable signed ledger entries, idempotent references, separate funding/fee entries, zero initial balances and a deferred database trigger rejecting balance updates without matching same-transaction ledger entries. No floating-point money calculations are used.

PaymentGateway interface; Paystack checkout/verification and virtual account adapter; disabled Monnify/Flutterwave adapters. Checkout references are stable across retries. Amount, NGN currency, gateway domain and payer identity are checked server-side before settlement. Browser return URLs and webhook amounts do not establish payment success.

Raw-body HMAC-SHA512 webhook verification using PAYSTACK_SECRET_KEY, independent gateway requery, reference deduplication and atomic ledger/funding status updates. DVA receipts map by gateway customer code and receiver account when provided, never by a client-supplied user ID. Out-of-limit receipts and restricted accounts are retained pending review. Uncertain or non-successful results are not credited. Only charge.success events settle funds; unrelated events are acknowledged without changing balances.

Explicit virtual-account consent is recorded before customer details are transmitted. The adapter looks up existing gateway customers/accounts before creation to recover earlier uncertain provisioning. Paystack can require identity validation and business eligibility; this phase does not collect BVN or bypass gateway KYC. A customer has at most one active stored account per gateway. Virtual provisioning is serialized under a user lock, with bounded API timeouts.

Private PNG/JPEG/PDF payment proof upload, 5 MB maximum, file signature validation, randomized filenames, signed owner-bound upload tokens and authenticated downloads. Manual requests do not credit wallets. Admin approval requires a reason, explicit confirmation of receipt and the actual bank statement reference; the reference is unique across manual credits. The same uploaded proof cannot create multiple requests. The administrator must check actual bank receipts; images alone do not prove payment.

Optional PIN-protected wallet transfers are disabled by default. When enabled, users/wallets lock in consistent order, sender debit and receiver credit are atomic, idempotency prevents duplicate transfers, and per-tier daily caps use the Africa/Lagos day boundary. Failed PIN counters commit even when the transfer is rejected. Admin balance adjustments require reasons and create ledger/audit records.

In-app funding notifications are immediate; email notifications are durable outbox records. Run notifications:dispatch to deliver a batch of 20. Records lease for 60 seconds, retry with backoff and stop after ten attempts; monitor failed records. Email delivery is at least once and may repeat after a crash; wallet credits remain idempotent. Phase 3 connects background processing to the queue worker.

## Run the preview

    npm run preview

Open http://127.0.0.1:3100/. This standalone design preview needs only Node and has no financial API or database connection. Every balance and activity record is explicitly fictional. Funding controls show an explanatory message and do not create payments. It demonstrates wallet, sign-in, registration and security presentation. Stop it with Ctrl+C when no longer needed.

The actual Next.js wallet is /wallet and requires an active account, PostgreSQL and Redis. It supports gateway checkout, account creation consent, private proof upload, funding status checks, ledger display and optional transfers. The main page still shows the foundation; the full customer dashboard arrives in Phase 4.

## Setup

Keep existing .env secrets; add new entries from .env.example. Use Node 22, then:

    npm install
    npm run db:generate
    npx prisma validate
    docker compose up -d postgres redis
    npm run db:migrate
    npm run typecheck
    npm test
    npm run build
    npm run dev

Seed only when needed using npm run db:seed; it does not add wallet balances. Existing persisted settings override environment defaults. Configure fundingMinKobo, fundingMaxKobo, fundingFeeFlatKobo and fundingFeeBps in Setting until the admin settings UI arrives in Phase 6. Money-setting JSON values use decimal strings; fee basis points use an integer. Keep walletTransfersEnabled=false until funding/transfer checks pass.

Set Paystack test keys, a verified email sender, and a supported PAYSTACK_DVA_BANK slug if needed. Monnify and Flutterwave deliberately fail closed. PAYSTACK_WEBHOOK_SECRET has been removed: Paystack signs with PAYSTACK_SECRET_KEY. Configure the public HTTPS webhook URL /api/webhooks/paystack in the Paystack dashboard. Localhost cannot receive gateway webhooks without supported forwarding. Use separate databases and credentials for sandbox and live environments.

Optional manual funding requires actual MANUAL_FUNDING_BANK_NAME, MANUAL_FUNDING_ACCOUNT_NAME and MANUAL_FUNDING_ACCOUNT_NUMBER values. PRIVATE_UPLOAD_DIR must be outside public/ and backed by durable private storage. Compose mounts a private_uploads volume; the Docker runtime creates a directory owned by its non-root user. Do not deploy local-file proof uploads to ephemeral Vercel storage; replace this storage adapter with private object storage first. Back up proofs with the database and define retention/orphan cleanup before launch.

The Phase 2 migration adds mandatory customer-code/provider-slug fields to VirtualAccount. Phase 1 never created these rows; if you imported rows manually, backfill verified gateway ownership in a separate reviewed migration rather than inserting invented values.

Dispatch queued funding emails with:

    npm run notifications:dispatch

## API contracts

All wallet/admin POST routes require Origin, the CSRF token from /api/auth/csrf in X-CSRF-Token, active cookies and appropriate server roles. Amounts are positive decimal strings in kobo. References/idempotency keys must stay the same when retrying an uncertain operation.

- GET /api/wallet/summary: balance, last 20 ledger entries, last 10 funding requests, own bank accounts and current limits.
- POST /api/wallet/checkout: { amountKobo, idempotencyKey: UUID }.
- POST /api/wallet/virtual-account: { consent: true }.
- POST /api/wallet/upload-proof: multipart form field proof; returns proofToken.
- POST /api/wallet/manual-funding: { amountKobo, idempotencyKey, proofToken }.
- POST /api/wallet/verify-funding: { reference }; only the funding owner may verify.
- GET /api/wallet/proof?fundingId=ID: authenticated attachment download; owner/admin only.
- POST /api/wallet/transfer: { recipientPhone, amountKobo, pin, idempotencyKey }.
- GET /api/admin/funding: oldest 50 pending manual/flagged requests with authorized proof links.
- POST /api/admin/funding: { fundingId, decision: "APPROVE" or "REJECT", reason, confirmedReceipt: true for approval, bankReference for manual approval }.
- POST /api/admin/wallet: { userId, amountKobo, direction: "CREDIT" or "DEBIT", reason, idempotencyKey }.
- POST /api/webhooks/paystack: raw signed Paystack payload; intentionally excludes browser CSRF but requires the verified gateway signature.

Payment failures/unknown initialization outcomes keep their stable reference and do not change balances. Reusing an initialized reference returns the saved checkout URL. If the gateway created a checkout but its response was lost, do not generate replacement references automatically; check the pending reference and reconcile. Queue reconciliation follows in Phase 3. Failed/rejected DVA receipts remain visible for operational review in Paystack; this phase does not automatically refund bank deposits.

## Tests and verification

The Vitest wallet unit suite covers exact kobo parsing, large integer formatting, fee rounding, signature replay/tampering and approval confirmation. Integration tests against hotdata_test cover concurrent duplicate credits, double spending, direct balance edits, ledger immutability, separate fee entries, funding replay and mismatched/unconfirmed payments. Follow docs/phase-1.md to create the dedicated test database, apply both migrations and set RUN_DB_TESTS=true. Wallet test fixtures remain in that disposable database because ledger entries are immutable.

Verified here: preview HTTP 200; visible browser wallet page; funding dialog opening and confirmation without balance changes; desktop CSS viewport 1280px and mobile CSS viewport 480px with no horizontal overflow. Screenshots are included as outputs. Eleven standalone checks executed the saved money/signature function bodies with only TypeScript annotations removed; all passed. This is not a full TypeScript/Vitest run.

Still unverified: dependency installation, Prisma validation, migration application, database concurrency tests, full typecheck/build and Paystack sandbox transactions. The host still has Node 20.15 and no Docker; Windows ancestor path access prevents normal project execution. The standalone preview is usable despite those backend limitations.

## Checklist before Phase 3

- Client generation, schema validation, migrations, typecheck, unit/integration tests and build pass.
- Paystack sandbox funding credits exactly once across webhook replays and browser status checks.
- Fee entries sum to the displayed net wallet credit; payer/currency/amount mismatches never credit.
- DVA ownership and explicit consent are verified; restricted receipts require review.
- Manual proofs remain private; duplicate bank references cannot create another credit.
- Transfers remain disabled unless PIN, concurrency, daily-cap and idempotency tests pass.
- Admin actions reject customers and always create audit records.
- Durable proof storage, email dispatcher, HTTPS and monitoring are configured before live use.
