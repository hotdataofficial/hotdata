# Gsubz setup

Official contract: https://app.gsubz.com/api_doc/
Server credential: GSUBZ_API_KEY. Adapter uses the fixed official HTTPS host. Purchases require both GSUBZ_ALLOW_LIVE=true and KORAPAY_ALLOW_LIVE=true; keep both false during payment sandbox testing. Do not enable before sandbox balances are isolated/removed and a worker is deployed.

Provider row: adapter gsubz, baseUrl https://api.gsubz.com. Plan mappings use serviceID:plan (for example mtn_sme:260); fetch current prices and confirm retail margins before adding active plans. No provider row or catalog is automatically created.

Timeouts, malformed results, gateway errors, missing transactions and ambiguous duplicates stay UNKNOWN and are queried by the same requestID. No blind repeat or fallback is allowed for uncertain attempts. Airtime and automatic plan imports remain disabled.

Key presence and balance authentication are not yet verified against production. No real purchase has been sent.

Deployment 2026-10-14: dpl_6gtWv3CuRjG7KLqbF3wKbVdBV12K READY; Vercel compile and TypeScript passed. Live browser readiness returned {"status":"ready"}. Four Gsubz contract tests passed. Provider authentication, current plan mappings and worker are still pending; actual delivery is disabled.

2026-10-14: Gsubz authentication VERIFIED inside Vercel build using production GSUBZ_API_KEY; no purchase sent. Public catalog imported: 94 bundles across four networks, seven service types, all mapped. Supplier cost preflight and actual amountPaid accounting implemented. Protected super-admin check/sync controls added. Delivery remains disabled pending worker and live-mode readiness.
