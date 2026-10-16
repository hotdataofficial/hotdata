# Hotdata test readiness

Production build, TypeScript, and all 101 unit tests passed. Korapay integration, optional customer email verification, and frontend improvements are implemented locally. Vercel test-mode gateway settings are now saved.

Remaining: updated source deployment; full sandbox payment and replay/ledger testing; owner administrator email and credentials; Resend credentials and a verified sender domain; authenticated persistent worker hosting; a selected VTU provider with implemented adapters and plan mappings; business/legal/contact settings.

All real VTU adapters remain disabled. Test payments do not deliver data. Test balances must not be used for real fulfilment; use a clean live database or an audited ledger transition before enabling live mode. Public launch and indexing remain disabled.


## Deployment verified — 2026-10-14
Updated source deployed successfully to https://hotdata-vercel-drop.vercel.app (dpl_DFNqMegqv8gb1rQZXxtMtNPGFZ7X). Vercel cloud build passed. Browser verified the updated login frontend and /health?ready=1 returned {"status":"ready"}. Earlier source-deployment-pending notes are superseded.

Live forged-webhook verification could not complete because the Windows HTTP clients failed SSL connection establishment; unit coverage passed, but do not treat it as a live payment test. Full sandbox settlement and replay testing remain pending. Administrator, Resend, persistent worker, VTU provider, and business/legal setup remain pending. Cloud npm audit reported 15 vulnerabilities (3 moderate, 10 high, 2 critical); review the affected dependencies before public launch. Live payments remain disabled.


2026-10-14 catalog update: 4 networks, 94 Gsubz bundles and mappings imported with provider disabled. Suggested retail and agent prices stored. Profit reports label gross margin; supplier price preflight and actual cost accounting implemented. Full sandbox payment, provider authentication, owner admin, persistent worker, email and business/legal setup still need completion.

Final catalog checks: Gsubz authentication verified; 94 live plans returned, zero available for purchase; protected admin Gsubz endpoint rejects unauthenticated reads with 401. Korapay key classification: PUBLIC_KEY_IN_SECRET_FIELD. Replace with test secret privately. Worker hosting and GitHub contents write access are still external blockers. Production-only npm audit reports six high findings, zero critical.


2026-10-15 live activation preflight: Korapay live key authenticated against read-only Balance API (HTTP 200). Gsubz authentication and positive balance confirmed; balance covers the individual supplier cost of 33/94 plans at inspection, not 33 orders. Database audit: one user, zero admins, zero successful funding transactions, zero pending data orders, zero active providers. Vercel team plan verified as Hobby; official plan policy restricts commercial use. No fulfilment worker is running and user has declined new subscriptions. Live-mode flags and provider activation remain unchanged pending a permitted hosting and fulfilment solution.
