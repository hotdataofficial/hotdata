# Hotdata Neon setup

## Latest verified migration result

On 2026-10-12 the user ran the migration helper in a normal Windows PowerShell session. All five checked-in migrations passed on an isolated production child branch. After starting the idle production compute, the production-only retry applied all five migrations successfully to `br-twilight-voice-zanwwg8s` at `ep-dry-breeze-zaocjqi7.c-2.eu-west-2.aws.neon.tech`. Prisma migrate status reported the database schema is up to date. This evidence is the user's supplied command output; the restricted agent session cannot independently run Prisma because of its Windows TLS error.

The earlier statements below about migrations being pending describe historical setup stages and are superseded by this result. Remaining work: verify deployed database-backed routes, configure Redis and the worker, set authentication and email secrets, establish an administrator account, and configure payment/provider sandbox integrations before customer transactions.

Configured on 2026-10-12:

- Organization: Hotdata (`org-small-smoke-47170447`)
- Project: Hotdata (`fancy-bar-81669748`)
- Branch: production (`br-twilight-voice-zanwwg8s`)
- Neon CLI 8.3.5 authenticated using the DEFAULT profile.
- Official Neon skills installed in `.agents/skills` from `@neon/skills@2.1.2` after the requested CLI installer timed out.
- Project MCP configuration in `.codex/config.toml` uses OAuth and pins the project. MCP OAuth authentication is separate from CLI login and has not been verified.
- `.neon` pins the selected project and production branch.
- Ignored `.env` contains pooled `DATABASE_URL`, direct `DATABASE_URL_UNPOOLED`, and `MIGRATION_DATABASE_URL` for the managed migration helper.

No database migrations or seed operations have run. A read-only Prisma connection probe failed with Windows TLS error `No credentials are available in the security package (os error -2146893042)`. TLS has not been disabled.

Vercel production now stores pooled `DATABASE_URL` as a Secret. Redeployment `dpl_BWyCKuFA3Gp4dqvypcDi1WNJbpGA` reached Ready on 2026-10-12. The public homepage still renders; the price catalog remains unavailable because the application schema has not been migrated. No database-backed user flow has been verified.

An explicit trusted CA bundle did not resolve the local TLS error. `../../work/finish-neon-postgres.ps1` is prepared for execution in the user's normal PowerShell session. It creates a temporary production child branch with a four-hour expiry, runs Prisma migrate deploy/status there, and applies migrations to production only if both test steps succeed. Its syntax was checked; runtime execution remains pending.

Next steps:

1. Test the checked-in Prisma migrations on a temporary branch of production from a working TLS environment.
2. Apply verified migrations to production with `npm run db:migrate:managed`.
3. Set the pooled `DATABASE_URL` as a sensitive server-side Vercel environment variable and redeploy. Never use a NEXT_PUBLIC variable for database credentials.
4. Verify database-backed application routes. Redis, workers, authentication secrets, and payment/provider configuration remain separate setup tasks.

The local CLI wrapper is `../../work/neon.ps1` when run from this application directory. Its credential storage is outside the application tree in `../../work/neon-config`.
