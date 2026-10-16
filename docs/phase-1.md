# Phase 1 — database and authentication

## What is included

21 Prisma models with roles/status/type enums, required relationships, indexes, unique references, zero-balance wallets and BigInt money fields. The initial PostgreSQL migration adds nonnegative money constraints and an append-only ledger trigger. No wallet purchase/funding mutations are implemented until Phases 2 and 3.

Argon2id passwords/PINs; access and rotating refresh JWTs in httpOnly same-site cookies; database-backed session revocation; login and PIN lockouts after five failures for 15 minutes; six-digit codes with 10-minute expiry and five-attempt limits; email verification, reset and password change; recorded signup consent and deletion requests; server RBAC; Redis-backed limits; origin and double-submit CSRF checks; request size limits. Password resets/changes revoke every session. Old refresh-token replay revokes its session. Browser refresh requests are coordinated within a tab; competing refreshes across tabs can still trigger replay protection and require signing in again.

Resend sends email with SMTP fallback. No message or secret is logged. Phone/WhatsApp delivery remains explicitly disabled behind adapters; selecting a provider environment value alone does not implement that provider. Integrate a real SmsProvider and test delivery before requiring phone verification in purchases. Email delivery failure leaves a newly registered account intact with verificationSent=false, so the user can resend later. Reset responses deliberately do not disclose account existence; delivery latency can differ and should be revisited during Phase 8 hardening.

## Setup and commands (PowerShell)

Install Node 22 and Docker Desktop (or use separate PostgreSQL and Redis services). From the Hotdata project directory:

    npm install
    npm run db:generate
    docker compose up -d postgres redis
    npm run db:migrate
    npm run db:seed
    npm run typecheck
    npm test
    npm run build
    npm run dev

Copy .env.example to .env only if .env does not already exist. Preserve existing secrets. Set matching database/Redis passwords, different JWT secrets, AUTH_CODE_SECRET and IP_HASH_SECRET. Generate each independently with:

    node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"

Use at least 16 characters for ADMIN_SEED_PASSWORD and 12 for both development account passwords. Set actual seed emails. Seed creates four networks and inactive sample plans, a super admin, a customer and an agent outside production. It preserves existing passwords, balances, pricing and settings; it refuses to silently promote an existing account. Test phone numbers are placeholders and must be replaced before live use. Seeds never credit wallets. Commit the generated package-lock.json after successful installation. Prisma 6.19 is pinned so the datasource configuration and migration commands remain consistent.

Configure RESEND_API_KEY and verified EMAIL_FROM, or SMTP settings with TLS. Local app development uses http://localhost:3000 and non-secure development cookies. Production rejects a non-HTTPS APP_URL; the production Docker container needs a TLS reverse proxy and an HTTPS origin for auth. TRUST_PROXY=true is permitted only behind a trusted reverse proxy which overwrites X-Forwarded-For and rejects direct traffic. With false, IP limits use a shared local bucket; per-identifier/user limits still apply.

Build the Docker image with docker compose build app. Apply migrations and seed with the local tooling before starting app containers; the standalone runtime intentionally does not contain the Prisma CLI or development seed. No automatic production seeding is performed.

## Routes

GET /api/auth/csrf returns the CSRF token and sets its httpOnly cookie. Send the token in X-CSRF-Token, plus the exact Origin header and Content-Type: application/json, on every POST. GET endpoints have no-store responses. No cross-origin response access is enabled.

Public POST actions: register, login, refresh, forgot-password, reset-password. Authenticated POST actions: logout, request-otp, verify, change-password, set-pin, revoke-session, request-deletion. GET /api/auth/me and /api/auth/sessions require an active access token and live session. /api/admin/access allows ADMIN and SUPER_ADMIN; /api/super-admin/access allows only SUPER_ADMIN. Tokens never carry authoritative roles; each protected request reads current account/session state.

Browser pages: /register, /login, /forgot-password, /reset-password and protected /security. The security page redirects expired access sessions to login; API calls refresh active sessions automatically. Full dashboard/navigation arrives in Phase 4.

Example POST bodies:

    register: { fullName, email, phone, password, consent: true, referralCode? }
    login: { identifier, password }
    forgot-password: { email }
    reset-password: { email, code, password }
    request-otp: { purpose: "EMAIL_VERIFICATION" | "PHONE_VERIFICATION" }
    verify: { purpose, code }
    change-password: { currentPassword, password }
    set-pin: { password, pin, currentPin? }
    revoke-session: { sessionId }

Transactions in later phases must call verifyPinInTransaction while holding the User lock, commit failed-attempt updates without throwing inside that transaction, and then acquire Wallet locks in a consistent order. Do not expose a standalone purchase bypass or refund uncertain delivery results.

## Integration tests

Use a separate PostgreSQL database named hotdata_test. Create it with:

    docker compose exec postgres createdb -U hotdata hotdata_test

Set DATABASE_URL in the test terminal to the same credentials but database hotdata_test. Set JWT/HMAC environment values as above; .env is loaded without overwriting explicit shell values. Then:

    npm run db:migrate
    $env:RUN_DB_TESTS = 'true'
    npm run test:integration
    Remove-Item Env:RUN_DB_TESTS

Restore the main DATABASE_URL before regular app operations. The suite refuses any database name other than hotdata_test. It creates and cleans isolated users. Unit tests cover phone normalization, consent, Argon2, role allowlists, CSRF and body limits. Integration tests cover persisted login lockout, concurrent PIN failures, refresh replay, one-use reset codes, session invalidation and OTP lockout. These suites require generated Prisma client/native dependencies.

## Manual QA checklist

- Generate client, apply migrations, seed, typecheck, unit tests and production build succeed.
- Test seed accounts exist with zero wallets; all sample plans stay inactive.
- Register a new user with consent and a local Nigerian phone; duplicate email/phone returns 409.
- Log in by email and +234/local phone; inspect httpOnly cookies and verify email with a real delivered code.
- Five bad passwords lock the account; waiting 15 minutes restores access.
- Set a PIN; changing an existing PIN requires account password and current PIN.
- A second browser session is listed; revoking it immediately rejects its protected requests.
- Reset/change password signs out every device; reused codes fail.
- Customer gets 403 from admin access; admin gets 403 from super-admin access.
- Missing/mismatched CSRF, forbidden Origin and oversized requests are rejected.
- SMS stub reports unavailable and never claims a code was sent.
- Deletion requests create a timestamp and audit entry atomically.
- Production HTTPS, email domain, real contacts and proxy settings are configured before deployment.

## Verification performed here

File/JSON/schema-to-SQL source checks only. Dependency installation was attempted and failed with Windows EPERM while reading C:/Users/USER; the granted read permission did not resolve the failure. A Node REPL installation also hit network EACCES. Docker was not available. Prisma validation, migration application, typecheck, automated tests, production build and browser QA have not passed here. Run the checklist before treating Phase 1 as verified.
