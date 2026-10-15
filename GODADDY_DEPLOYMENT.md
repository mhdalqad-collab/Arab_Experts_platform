# GoDaddy deployment assessment

Assessment date: 2026-10-15. Status: **source imported; migration required before deployment**.

This repository is a separate project from the AES website. Do not reuse the AES app,
database, secrets, domain, or deployment configuration. The V113 R5 reference archive
was read only; changes are maintained in this GitHub repository.

## What is implemented today

| Component | Current implementation | Deployment implication |
| --- | --- | --- |
| Frontend | React 19, Next-compatible routes, Vinext/Vite and Cloudflare Worker build | The current output targets the old hosting runtime, not a verified GoDaddy Node app. |
| Main interface | `public/eim/index.html`, 35 JavaScript source modules | Static rendering alone does not prove login or persistent workflows work. Some features retain browser-local state. |
| Frontend APIs | 22 paths / 52 operations in `app/api` | They access Cloudflare D1 directly, with R2 for document storage. These bindings are unavailable in an ordinary Node process. |
| Frontend identity | `app/chatgpt-auth.ts` reads platform-injected identity headers | GoDaddy needs a real session/login integration. Never trust client-supplied identity headers as authentication. |
| Backend | Separate Node/TypeScript HTTP service, 82 paths / 90 operations | It must be started and routed explicitly; root `npm start` currently starts only Vinext. |
| Backend database | PostgreSQL, 93 migration files | Keep the PostgreSQL domain model. Do not substitute the AES MySQL database or assume the D1 schema is interchangeable. |
| Backend identity | OIDC issuer, JWKS, audience and provider code | Real provider configuration and end-to-end browser login are still required. |
| Private files | Backend storage upload/download gateway contracts | Provision a private storage integration; a bare public folder or bucket URL does not implement the existing authorization protocol. |
| Deployment templates | Separate frontend/backend/PostgreSQL containers | Compose templates are a starting point, not evidence that the frontend's Cloudflare dependencies work outside its original host. |

The archive already describes an incomplete D1-to-PostgreSQL transition in
`docs/backend-handoff/01_ADR_POSTGRES_SOURCE_OF_TRUTH_AR.md`. D1 API payloads and
PostgreSQL domain contracts need an explicit mapping; changing a connection string
cannot complete that transition.

## Hosting choice

Confirm whether the target is **GoDaddy Node.js Hosting** (the AES-style workflow)
or **GoDaddy VPS** before selecting the runtime architecture.

For Node.js Hosting, the published requirements specify a root `package.json`, real
`build` and `start` scripts, the assigned `PORT`, and installed build/runtime
dependencies. The current scripts and Cloudflare bindings need adaptation. Verify
PostgreSQL connectivity and availability for this particular subscription; the
assessment has not established that a PostgreSQL service is included.

A VPS can host a multi-service deployment, but does not automatically supply D1,
R2 or the old platform's identity service. Those integrations still need replacing
or explicitly retaining behind authenticated services.

No GoDaddy app, subscription, database, provider account, or domain has been
created or modified as part of this assessment.

## Implementation sequence after the hosting choice

1. Select the Node frontend runtime and one public entry point; expose the assigned
   port, route the backend explicitly, and keep internal callback routes private.
2. Implement browser login and verified server sessions using the selected identity
   provider. Reject spoofed identity headers and validate redirects, CSRF, logout,
   roles and step-up requirements.
3. Map each existing frontend API to the PostgreSQL domain service while preserving
   frontend response contracts. Identify missing backend capabilities rather than
   silently disabling them or pretending local browser state is server persistence.
4. Configure a separate PostgreSQL database and private object-storage gateway.
   Rehearse migrations and restore on a disposable database before real data is used.
5. Make production installation, build and startup independent of the old Sites
   runtime. Bundle fonts or otherwise remove build-time font network dependencies.
6. Run API, role, persistence, upload/download and production HTTP tests, then deploy
   a separate GoDaddy Preview app and repeat them after restart/redeploy.
7. Review the preview before publishing to the chosen domain. Record backup,
   rollback, monitoring and provider setup instructions in this document.

## Information still needed

- The GoDaddy hosting product and a separate app slot/server for this project.
- The intended domain or subdomain (only needed before public launch).
- Existing PostgreSQL, identity-provider and private storage services, if any.
  Credentials must be entered in hosting secrets, not committed or pasted into chat.
- Whether any real data exists in the previous D1/R2 deployment that needs migration.

## Validation performed during import

- Dependency lockfile install completed with `npm ci --ignore-scripts` on Node 24.11.
- TypeScript check passed.
- ESLint completed successfully using its Node CLI.
- 111 frontend architecture/role-flow tests passed.
- 52 backend unit/HTTP tests passed; these are not a live PostgreSQL integration test.
- OpenAPI validation passed: 52 frontend and 90 backend operations, no backend drift.
- Existing EIM static-asset validation passed.
- Fixed file-URL conversion in three maintenance scripts so Windows paths and paths
  containing spaces can be read correctly; no API behavior was changed.
- Recognized secret-pattern scan found no matches before source import. Only
  placeholder environment examples are tracked.

The full Linux production build, container startup, live PostgreSQL integration,
OIDC/storage-provider tests and GoDaddy Preview remain unverified. Local Docker's
Linux engine was unavailable. Passing the checks above does not establish production
readiness. Original archive readiness reports describe earlier runs, not this deployment.

## Official hosting references

- [GoDaddy Node.js app requirements](https://developer.godaddy.com/en/docs/api-users/hosting/app-requirements)
- [GoDaddy Node.js upload and deployment guide](https://no.godaddy.com/help/upload-my-ai-generated-app-to-godaddy-nodejs-hosting-42987?lc=en-US)

Generated `dist`, backend compiler output, dependency folders and real environment
files are excluded from Git. `build/sites-vite-plugin.ts` is source code and is
included. The original archive's inventory and checksum files describe that archive,
not the evolving Git checkout.
