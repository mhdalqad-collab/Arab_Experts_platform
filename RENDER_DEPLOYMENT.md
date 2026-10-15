# Render free demo

The existing Node.js server supports Render's assigned PORT and listens on 0.0.0.0. No application rewrite is required. This configuration publishes a public demonstration, with login and persistent APIs disabled.

## Create the service

In Render choose **New > Blueprint**, connect `mhdalqad-collab/Arab_Experts_platform`, and select **godaddy-preparation**. Render reads the root `render.yaml`. Review that the service plan is **Free** before deploying. No database or paid service is declared.

If you already created a Web Service, update that service instead of creating a duplicate. A manual Web Service does not automatically import render.yaml; use these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Branch | godaddy-preparation |
| Root directory | Leave blank (repository root) |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Instance type | Free |
| Health check path | `/health/live` |
| Environment: NODE_VERSION | `22` |
| Environment: NODE_ENV | `production` |
| Environment: DEPLOYMENT_MODE | `preview` |
| Environment: ENABLE_DOMAIN_BACKEND | `false` |

Let Render assign PORT. NODE_ENV=production controls the optimized Node/Next runtime; DEPLOYMENT_MODE=preview separately disables features that require external services. The explicit preview setting prevents the missing-credentials startup error.

After deploying, open the onrender.com address. The root redirects to the Arabic EIM interface. `/health/live` should return HTTP 200 and mode `preview`. `/health/ready` returns 503 until real services are configured, so do not use it as the demo health check.

## Existing domain

After the demo works, add your domain under the Render service's **Settings > Custom Domains**. Copy the DNS records Render provides into the domain's DNS settings at GoDaddy. Keep domain registration there; no transfer or GoDaddy hosting purchase is required. Preserve email records and any unrelated subdomains. Wait for domain verification and HTTPS provisioning before testing the domain.

## Free-tier and functionality limits

Free web services sleep after 15 minutes without traffic and can take about a minute to wake. Usage limits can suspend service or builds. Render does not recommend free instances for production applications. Avoid adding a payment method if you want services suspended rather than billed for usage overages; review account billing settings.

This is a demo: accounts, database writes, document uploads and the enterprise backend remain disabled. Existing browser-local workflows are demonstration data, not durable shared records. Render's local filesystem is ephemeral; do not use it for uploads or databases. Render's free PostgreSQL expires after 30 days and is not a durable free database solution.

Before enabling real accounts, configure PostgreSQL, OIDC and private S3-compatible storage using the provider-independent settings and migration instructions in [GODADDY_DEPLOYMENT.md](GODADDY_DEPLOYMENT.md). Set APP_ORIGIN to the chosen HTTPS domain and register its exact /auth/callback URL with the login provider. Change DEPLOYMENT_MODE to production only after these services are configured and tested. If using a Blueprint, update its mode too so later syncs do not restore preview mode.

## References

- [Render Blueprints](https://render.com/docs/blueprint-spec)
- [Node.js versions](https://render.com/docs/node-version)
- [Free service limits](https://render.com/docs/free)
- [Custom domains](https://render.com/docs/custom-domains)
