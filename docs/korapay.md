# Korapay wallet funding

Hosted checkout integration uses Korapay's server-side initialize and query-charge APIs. Hotdata keeps amounts in integer kobo and converts Korapay's major currency units at the gateway boundary. Webhooks authenticate `JSON.stringify(payload.data)` with HMAC-SHA256 using the secret key and `x-korapay-signature`, then independently query the charge before settlement. The existing ledger and funding reference locks handle replayed notifications.

Vercel production settings:

- `PAYMENT_GATEWAY=korapay`
- `KORAPAY_SECRET_KEY`: enter your Korapay **test** secret key privately as a Secret.
- `KORAPAY_ALLOW_LIVE=false`
- `APP_URL=https://hotdata-vercel-drop.vercel.app`

Webhook URL: `https://hotdata-vercel-drop.vercel.app/api/webhooks/korapay`. It is supplied when checkout is initialized; it can also be entered in the Korapay dashboard where applicable.

Dedicated virtual bank accounts are not implemented for Korapay. Hosted checkout can expose the channels enabled by Korapay for the merchant. No public key or browser payment SDK is required for this hosted-redirect implementation. Existing Paystack requests are queried through their stored gateway instead of the newly selected gateway.

Before live activation, verify a full sandbox funding cycle, webhook and customer-triggered verification, duplicate notifications, incorrect amount/currency/reference rejection, and exactly one wallet credit. Live keys are blocked unless `KORAPAY_ALLOW_LIVE=true` is explicitly set. Registration can fund without email verification; payment details still must match the saved funding request. No real funds should be used during sandbox validation.

Sources:
- https://developers.korapay.com/docs/checkout-redirect
- https://developers.korapay.com/docs/webhooks
- https://docs.korapay.com/

Current status: implementation added locally; Vercel secret name/type/environment was confirmed without revealing its value. Deployment and end-to-end sandbox verification remain pending.

Validation on 2026-10-14: TypeScript passed and all 101 unit tests passed, including seven new Korapay tests. The source archive `../hotdata-korapay.zip` contains 285 files with verified ZIP CRCs and excludes private env files, dependencies, build output and agent configuration. A production build was started; its result remains pending. Vercel's variable editor failed to load project data and repeatedly displayed a discard warning after Save. `PAYMENT_GATEWAY=korapay` and `KORAPAY_ALLOW_LIVE=false` were prepared but have not been confirmed saved. The added KORAPAY_SECRET_KEY itself was confirmed present in Production as a Secret, without inspecting its value or validating it with Korapay.

Update: optimized production build passed. Vercel confirmed PAYMENT_GATEWAY=korapay and KORAPAY_ALLOW_LIVE=false saved on the next setup attempt. Updated source deployment and full sandbox payment verification remain pending.


## Deployment verified — 2026-10-14
Updated source deployed successfully to https://hotdata-vercel-drop.vercel.app (dpl_DFNqMegqv8gb1rQZXxtMtNPGFZ7X). Vercel cloud build passed. Browser verified the updated login frontend and /health?ready=1 returned {"status":"ready"}. Earlier source-deployment-pending notes are superseded.

Live forged-webhook verification could not complete because the Windows HTTP clients failed SSL connection establishment; unit coverage passed, but do not treat it as a live payment test. Full sandbox settlement and replay testing remain pending. Administrator, Resend, persistent worker, VTU provider, and business/legal setup remain pending. Cloud npm audit reported 15 vulnerabilities (3 moderate, 10 high, 2 critical); review the affected dependencies before public launch. Live payments remain disabled.

2026-10-15 recheck: User save confirmed in Vercel hotdata1/hotdata-vercel-drop Production, updated minutes before inspection. Fresh deployment dpl_2h4xH1CdmHoGxxwrV5KwBKo24o29 READY. Build classification remains PUBLIC_KEY_IN_SECRET_FIELD; actual value was not opened or exported. Gsubz authentication remains verified. User must replace this variable with the Test Secret Key beginning sk_test_, keeping it private. Live payments and real data delivery remain disabled. Paid Render setup deferred because the user cannot currently afford a subscription.

2026-10-15 latest key save: build classification changed from PUBLIC_KEY_IN_SECRET_FIELD to LIVE_SECRET_BLOCKED_UNLESS_ENABLED. The value is now a live secret key, not a test secret. No key was revealed or exported. Keep live payments disabled; use the Test-mode secret beginning sk_test_ for sandbox verification. Gsubz non-spending authentication still verified.
