# Hotdata Redis setup

Upstash for Redis was created through the Hotdata Vercel team's Storage integration on 2026-10-12 after the user approved acceptance of Vercel/Upstash terms.

- Resource: `hotdata-redis`
- Upstash resource ID: `5064ad2f-b0be-4d15-a4dc-3f9339316eee`
- Plan: Free (provisioning screen displayed 500,000 monthly commands)
- Primary region: `iad1`
- Read regions: none
- Eviction: disabled
- Connected Vercel project: `hotdata-vercel-drop`
- Connection environments: Production and Preview
- Credentials were marked Sensitive.
- Integration advertises `REDIS_URL`, `KV_URL`, and REST connection variables. No credentials are recorded here.

A production redeployment was requested to apply the new connection variables. Combined database/Redis readiness has not yet been verified. The purchase/reconciliation worker, authentication secrets, email, administrator account, and payment/provider setup are separate remaining tasks.

Redeployment `dpl_5veVYxyMgi58h1w6kqNpADcYdDZz` reached Ready. The live `/health?ready=1` endpoint returned `{"status":"unavailable"}`. This is a combined check and does not independently verify Redis: its Redis client calls the application's configuration validator, which also requires APP_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, AUTH_CODE_SECRET, and IP_HASH_SECRET. Those application variables have not yet been configured. No Redis PING or BullMQ worker check has been completed.
