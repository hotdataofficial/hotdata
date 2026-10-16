# Authentication and remaining service setup

On 2026-10-12, the following production variables were saved privately in Vercel for `hotdata-vercel-drop`:

- `APP_URL` and `CORS_ALLOWED_ORIGINS`: `https://hotdata-vercel-drop.vercel.app`
- Independent 32-byte random secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AUTH_CODE_SECRET`, `IP_HASH_SECRET`
- Independent AES-256 key: `PROVIDER_ENCRYPTION_KEY`

Values were stored as Secret variables and backed up in the ignored local `.env`. Never publish this file or include it in a deployment archive. These application secrets are not Neon or Upstash API credentials.

Production redeployment: `dpl_6jWcmJsSxS7VQPXVCHEDaXF2Cp6U` reached Ready. The live `/health?ready=1` endpoint returned `{"status":"ready"}`, verifying the deployed Postgres SELECT 1 and Redis PING through the application configuration. This does not verify account creation, email delivery, an administrator login, or purchase processing.

Remaining dependencies:

1. Administrator email must be supplied by the owner. Do not invent an owner or administrator login, promote an existing customer, or use a published default password.
2. Email provider access and a verified sender address/domain are needed before verification and reset emails can be delivered. No email provider account has been connected and no message has been sent.
3. A persistent worker host must be selected and authenticated. `Dockerfile.worker` and `npm run worker` are prepared. Supply the same private database, Redis, signing, and provider encryption secrets as the web app. No cloud worker has been deployed.
4. Sandbox payment credentials and actual provider configuration are required before testing purchase settlement. No live funds or external purchase requests have been initiated.
