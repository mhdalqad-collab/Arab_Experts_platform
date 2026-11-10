# Activate Arab Experts on the included GoDaddy database

The Node.js app is already published. Real accounts require database setup and a login provider before changing `DEPLOYMENT_MODE`. This guide applies only to Arab Experts.

## 1. Set up the included MySQL database

Deploy the latest `main` to Preview. In Settings > Secrets > Preview add the settings in `godaddy-mysql.env.example`. Do not overwrite the automatic `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` or `DB_PASSWORD` values. GoDaddy provides those. Root path stays `/`.

`WEB_DATABASE_SETUP=true` is an explicit, Preview-only setup switch. Restart/update Preview and look for `Arab Experts database setup complete` in its logs. Setup uses an advisory lock, creates 60 application/authentication/private-file tables with an `eim_` prefix, and records a checksum. It does not drop tables or import old records. Existing unrelated tables remain untouched. Existing unowned `eim_` tables cause setup to stop for review. MySQL DDL commits independently; an interrupted initial setup can be resumed with the same code. Future schema changes require an explicit migration; a checksum mismatch stops setup.

After successful setup, remove `WEB_DATABASE_SETUP` (or set it to `false`). Never copy `true` to Publish: production refuses to start with setup enabled. Preview and Publish share the GoDaddy database, so preview writes are real writes, not a sandbox. The migration can also be run explicitly with `npm run db:migrate:web` from an operator environment that has the DB variables and network access. Python is needed only to regenerate/check the committed schema metadata, not to run the app.

## 2. Enable both login methods

The app supports one OIDC provider with Google and email/password connections. Auth0 Universal Login is one compatible option. Account creation, email verification and password recovery happen at the provider; the website does not store passwords.

1. Create an Auth0 tenant and a **Regular Web Application** for Arab Experts. Use the free plan if its current terms/limits meet your needs; no purchase is required by the code.
2. Set the exact Allowed Callback URL to `https://arabexperts.net/auth/callback`. Copy the tenant's exact HTTPS issuer (including its trailing slash), Client ID and Client Secret into GoDaddy Secrets as `WEB_OIDC_ISSUER`, `WEB_OIDC_CLIENT_ID`, `WEB_OIDC_CLIENT_SECRET`. Keep the secret out of Git and chat.
3. Enable the application's `Username-Password-Authentication` database connection, signup, email verification and password reset. Configure production email delivery with your provider; its test email sender is not a production delivery service. The app accepts only verified emails.
4. Configure the Google social connection using your own Google OAuth web client. Its Google callback is the Auth0 URL shown by Auth0 (`https://YOUR-TENANT/login/callback`), not the app's callback. Enable `google-oauth2` for this application. Do not use Auth0's shared developer Google keys for launch.
5. Set `WEB_OIDC_GOOGLE_CONNECTION=google-oauth2` and `WEB_OIDC_EMAIL_CONNECTION=Username-Password-Authentication`. The website sign-in page now offers both choices, routed through PKCE/state/nonce and signed identity tokens.
6. For testing on GoDaddy's separate preview hostname, use a separate Auth0 application/client and set Preview's `APP_ORIGIN` and callback to that exact HTTPS hostname. Publish uses `https://arabexperts.net`. Do not leave Preview's origin pointing at the live domain when testing preview login.

An existing email is not silently linked to a second Google/password identity. Use the original login method or perform verified account linking at the identity provider. This prevents another identity claiming an existing account. Logout revokes the website session; it does not log the user out of Google or the provider globally.

## 3. Private uploads

`WEB_STORAGE_DRIVER=mysql` stores private file bytes in the included database, in chunks within an atomic transaction. The existing authorized download route is the only application access path. The 10 MiB per-file limit remains. Files survive app restarts and deploys. Database storage and backups now include uploaded bytes; monitor your hosting database quota and verify backups/restoration before accepting real users. This is suitable for initial limited document use; S3-compatible private storage remains supported for larger volumes.

This does not add antivirus scanning or change the existing document verification workflow.

## 4. Verify, then publish

Once setup is complete and the real provider credentials are configured, set Preview's `DEPLOYMENT_MODE=production` (this controls application features, not GoDaddy's deployment variant). Test Google login, email signup and verification, password reset, logout, saving profiles, private upload/download, rejection for another user, and persistence after restart. Confirm `/health/ready` returns 200. Local automated tests do not prove your provider credentials or GoDaddy database connectivity.

Then copy the intended settings to Publish, with `APP_ORIGIN=https://arabexperts.net`, the matching provider client, `WEB_DATABASE_SETUP=false`, and `DEPLOYMENT_MODE=production`. Publish to Live and repeat the checks on the domain. The evaluation banner goes away in production mode. Do not remove the banner by editing its text while services are unconfigured.

The separate enterprise backend still requires PostgreSQL; keep `ENABLE_DOMAIN_BACKEND=false`. Some archived finance/governance screens remain browser-local demonstrations. These database/authentication changes do not turn those screens into real payments or complete all business integrations.

References: [Auth0 database connections](https://auth0.com/docs/authenticate/database-connections), [Google social connection setup](https://developer.auth0.com/resources/labs/authentication/google-social-connection-to-login), [GoDaddy Node.js hosting](https://www.godaddy.com/en-in/hosting/nodejs).
