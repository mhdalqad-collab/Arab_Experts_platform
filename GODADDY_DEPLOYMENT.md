# GoDaddy Node.js deployment

Target confirmed: GoDaddy Node.js Hosting, in a separate app from AES.
Status: Node runtime implemented and locally tested; hosted services and GoDaddy deployment are pending.

## What changed

- Root `npm run build` builds the EIM assets, backend TypeScript and a standard Next.js production app. `npm start` launches one public HTTP server on GoDaddy's `PORT`, bound to `0.0.0.0`.
- All 22 web API route files use a PostgreSQL adapter instead of Cloudflare Worker bindings. Parameterized queries and atomic batches preserve the current API contracts.
- The 22 original web-schema migrations are applied to an isolated PostgreSQL schema, `eim_web`, with checksums, a transaction and an advisory lock. Reruns do not reset saved content.
- Private document bytes use an S3-compatible bucket. Metadata stays in PostgreSQL. Existing download authorization and upload-failure cleanup are retained. Do not enable public bucket access.
- OIDC login replaces trusted platform identity headers. It uses authorization code flow, PKCE, state, nonce and ID-token signature checks. Accounts bind to issuer plus subject; an email collision is rejected rather than silently linking identities.
- Browser sessions are random opaque cookies, hashed in PostgreSQL, expire after eight hours and are revoked on logout. Session cookies use HttpOnly, SameSite=Lax and Secure on HTTPS. Cookie-authenticated writes require the configured exact Origin.
- Build-time Google Fonts downloads were removed. The EIM application's existing assets and styles remain; the account shell uses the browser font stack.

The compatibility schema preserves the existing web data model. It is **not** a completed mapping to the separate enterprise `core`, `membership`, `finance` and other schemas in `database/postgresql`. Those backend domains remain distinct, as they were in the archive. Do not dual-write the same business records into both models. Consolidating them is a separate domain migration with reconciliation and acceptance tests.

No source archive files, AES resources, hosting accounts, DNS records or provider services have been modified.

## First: visual preview on GoDaddy

1. Create a **new** Node.js app and connect `mhdalqad-collab/Arab_Experts_platform`.
2. Select branch **`codex/godaddy-preparation`** and repository root as the app root.
3. Use `npm run build` and `npm start`. Choose a supported Node 22 release, at least 22.13; Node 24 is also supported by this code.
4. Add the Preview secret `DEPLOYMENT_MODE=preview`.
5. Update Preview. Check the Arabic interface and `/health/live`.

In this mode the page shows a preview notice. Login, persistent APIs and the enterprise backend are disabled; `/health/ready` returns 503 by design. A Healthy hosting process only establishes that the preview is running. Do not enter real data into the browser-local demonstration flows.

## Enable persistent accounts

A working deployment requires these separate services. Their credentials must be entered in GoDaddy Secrets, never in GitHub or chat.

| Setting | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact HTTPS origin of this environment, with no path; Preview and Publish normally differ. |
| `WEB_DATABASE_URL` | Dedicated PostgreSQL connection URL. Verify network access from GoDaddy. |
| `WEB_DATABASE_SSL` | Set to `require` for a remote database and use valid certificates. |
| `WEB_DATABASE_POOL_MAX` | Optional, defaults to 5; keep within provider connection limits. |
| `WEB_OIDC_ISSUER` | HTTPS OIDC issuer supporting discovery. |
| `WEB_OIDC_CLIENT_ID`, `WEB_OIDC_CLIENT_SECRET` | Confidential web client credentials. |
| `WEB_STORAGE_BUCKET` | Private bucket for documents. |
| `WEB_STORAGE_REGION` | Provider region; `auto` for a compatible provider that requires it. |
| `WEB_STORAGE_ENDPOINT` | HTTPS endpoint for an S3-compatible service; omit for standard AWS S3. |
| `WEB_STORAGE_ACCESS_KEY_ID`, `WEB_STORAGE_SECRET_ACCESS_KEY` | Credentials restricted to the bucket's required object operations. |
| `PLATFORM_ADMIN_EMAILS` | Optional comma-separated verified admin emails for existing role bootstrap. Leave blank until an administrator is deliberately assigned. |
| `DEPLOYMENT_MODE` | Change from `preview` to `production` only after configuring these services and migrations. |

`godaddy.env.example` contains placeholders only. `production` is the default and fails at startup when required settings are missing.

### Database setup

Use a separate PostgreSQL database. This repository does not assume GoDaddy provides PostgreSQL as part of the hosting subscription.

From a trusted operator environment, install dependencies and set `WEB_DATABASE_MIGRATION_URL` to a schema-owner connection, then run:

```sh
npm run db:migrate:web
```

This command runs once for initial setup and again for controlled upgrades. It is never run implicitly during app startup or build. It creates `eim_web`, the compatibility tables, identity bindings and session tables; it does not apply the 93 enterprise backend migrations.

The runtime user needs CONNECT on this database, USAGE on `eim_web`, and SELECT/INSERT/UPDATE/DELETE on its tables. Use a separate migration owner; configure default privileges for future tables. Keep the runtime role unable to create/drop schemas. Set `WEB_DATABASE_URL` to the runtime connection, not the migration owner.

For any existing D1 records, perform an explicit export/import and reconcile counts, relationships and identity bindings first. The migration command creates schema; it does not copy D1 data or recover missing file bytes. Existing accounts are not automatically claimed by a matching email on first OIDC login.

### Login provider

Register `${APP_ORIGIN}/auth/callback` as an exact allowed callback. Configure a separate Preview callback/client as appropriate. Request scopes `openid email profile`. The ID token must include `sub`, `email`, and `email_verified=true`. Configure account registration and MFA at the identity provider.

The old `/signin-with-chatgpt`, `/signout-with-chatgpt` and `/callback` paths are compatibility aliases; this implementation does not depend on ChatGPT sign-in. Logout revokes the application session and clears the browser's EIM draft state; it does not end the identity provider's global SSO session.

### Private uploads

Keep the bucket private and allow the server to get, put and delete objects. Test an upload, an authorized download and denial for another account, then redeploy and repeat. Do not store uploads inside the Git checkout. The archive's scan/verification workflow is preserved; this hosting change does not provision a malware scanner or make unverified documents verified.

## Optional enterprise backend

`ENABLE_DOMAIN_BACKEND=false` by default. To expose the existing `/v1/*` API in the same Node process, apply its separate PostgreSQL migrations and configure its existing `DATABASE_URL`, `DATABASE_SSL`, `APP_ENV=production`, `IDENTITY_*` and provider settings, then set `ENABLE_DOMAIN_BACKEND=true`. The backend handler is composed into the public server; no second public port is required. `/internal/*` stays blocked at that entry point.

Browser OIDC sessions and enterprise bearer-token identities remain separate contracts. Enabling the backend does not automatically link their accounts or map web requests into enterprise records. Internal jobs/callbacks need a separate authenticated private execution path. Keep `POSTGRES_OPERATIONS_ACTIONS_ENABLED=false` and `POSTGRES_OPERATIONS_STEP_UP_READY=false` until that operational integration is validated.

## Validation and launch

Local verification includes TypeScript, lint, the 111 existing frontend tests, 52 backend tests, nine new hosting/database/security tests, and three real HTTP tests against the production Next.js build in preview mode. All 22 web migrations were exercised in PGlite's PostgreSQL engine, including idempotence, rollback and persistence after closing/reopening the database. All 300 non-interpolated API SQL statements were planned against that schema. Storage tests use a mocked S3 client. Production dependencies pass npm audit after updating Next.js and Sharp. The retained legacy Cloudflare/Vinext development toolchain still has audit findings; it is not the GoDaddy runtime and should not be exposed as a server.

GitHub CI additionally has PostgreSQL 16 and a production HTTP integration test that creates sessions, saves a membership, restarts the app, verifies persistence and rejects cross-account access. Its result must be checked on the exact commit being deployed. The real identity provider callback, real storage provider and GoDaddy network/runtime are not proven by local tests.

`/health/live` checks the process. `/health/ready` checks production mode and the web migration marker (plus backend readiness when enabled); it does not establish that an OIDC provider or storage bucket is reachable. Complete those provider checks separately.

The archive still includes browser-local demonstration functionality (for example simulated finance/security/governance flows). Hosting conversion does not turn those into real payment, recovery, MFA or business services. Exercise the intended production workflows before accepting real users.

Before publishing: verify login/logout, role separation, saved profiles, document authorization and persistence after restart/update; confirm backups and a restore rehearsal; then review the GoDaddy preview. Use separate Preview and Publish databases/buckets or deliberately account for any shared test data. Keep credentials and storage targets stable across deployments. Rolling back code must not delete database rows or objects.

## References

- [GoDaddy Node.js requirements](https://developer.godaddy.com/en/docs/api-users/hosting/app-requirements)
- [Next.js custom server](https://nextjs.org/docs/app/guides/custom-server)
- [OpenID Connect client](https://github.com/panva/openid-client)

The legacy Sites/Cloudflare source and archive readiness reports remain for reference. `build:legacy` is not the GoDaddy build. Archive inventory/checksum files describe the original archive, not this evolving repository.
