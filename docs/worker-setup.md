# Worker deployment preparation

A Render Docker background worker blueprint is prepared in render.yaml. No paid service has been created. Review https://render.com/pricing before approving deployment; the selected 0.5c-512mb compute plan is paid.

1. Create a Render account and sign in privately.
2. Authorize GitHub access to hotdataofficial/hotdata. The currently connected GitHub integration rejects repository writes with 403 Resource not accessible by integration; grant repository contents write access or upload the prepared source manually.
3. Import the source repository with render.yaml at its root. Dockerfile.worker starts npm run worker.
4. Privately set the environment variables listed in the blueprint. Use the same production secrets as Vercel. Vercel sensitive values cannot be exported. Do not paste secrets into chat. Add Resend configuration separately when ready.
5. Keep both live-mode flags false while testing. Confirm database/Redis access and worker logs before activation.
6. Finish a complete Korapay sandbox funding test; confirm customer wallet and ledger exactly once, including callback retries. Remove/isolate test balances before any real Gsubz spending.

The worker uses the existing PostgreSQL and Redis services; no second database or Redis instance is required. Its persistent process dispatches purchases, reconciles uncertain provider attempts and runs outbox notifications. Current Gsubz provider remains inactive. Public launch, live payment activation and any paid service creation require the remaining readiness checks.

2026-10-14: Render sign-in verified in workspace Hot data. Prepared unsaved worker form with public repository hotdataofficial/hotdata, name hotdata-worker, Docker runtime, Dockerfile.worker, main branch, and displayed compute price USD7/month. No worker created and no billing started. Source repository is still empty; GitHub integration rejects writes. Private worker environment values remain unset. Fresh deployment dpl_3Zfe8FLF1HjYtsLe21juGdLLhkAG READY; Korapay classification again PUBLIC_KEY_IN_SECRET_FIELD, Gsubz authentication VERIFIED. No secret values revealed.
