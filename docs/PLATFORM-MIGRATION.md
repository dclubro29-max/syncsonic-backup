# SyncSonic platform migration

## Preview using Cloudflare

Worldwide library transfers in the preview require a private R2 bucket bound as `TRANSFER_FILES` and D1 migration `0005_cloud_transfers.sql`. Configure an R2 lifecycle rule to expire objects under `transfers/` after one day, then check upload and download on different networks before publishing. The download code is a bearer credential and expires after 24 hours. Keep the bucket private and do not log authorization headers.

Build with `VITE_SYNCSONIC_WORKER_PREVIEW=true` to route sign-in, Premium redemption, remote commands, and speaker calibration through the Worker. The phone and host must use the same SyncSonic account. The host claims each due command in the database before executing it, so two tabs cannot play the same command.

Configure a Cloudflare Access self-hosted application to protect both `/admin-sign-in` and `/api/v1/admin/sign-in` on the preview hostname. Use the same Access application audience for both paths and require MFA at the identity provider or in the Access policy. Set `ADMIN_ACCESS_ISSUER` to the team origin and `ADMIN_ACCESS_AUDIENCE` to the application audience. The Worker issues a short-lived session only after validating the signed assertion and finding an imported administrator with the matching email. The ordinary email link remains limited to non-admin accounts.

Before publication, migrate the Premium administration and library pairing flows, verify the actual dataset in an isolated D1 database, and validate audio and authentication using real devices and the test hostname.

## Current state

The React/Vite frontend is portable, but the application is **not yet independent of Base44**. Do not remove the remaining SDK or backend definitions until the replacement API is implemented and data has been migrated.

The following integrations were confirmed in the source:

- `src/api/base44Client.js` creates the Base44 SDK client.
- `src/lib/AuthContext.jsx` loads public app settings, resolves the current user, and delegates logout/login redirects to the SDK.
- `src/lib/app-params.js`, `src/lib/authMfa.js`, and `src/lib/authMfaFlow.js` depend on Base44 app IDs, token storage, MFA endpoints, social OAuth, and SSO routes.
- Registration, password reset, premium status, and premium activation/admin pages call the SDK.
- Remote control persists `RemoteDevice` and `RemoteCommand` records.
- Phone calibration persists `CalibrationSession` records.
- Premium backend functions are currently Deno functions using `createClientFromRequest` and service-role entity access.

### Data model inventory

The checked-in entity definitions are:

- `User`
- `CalibrationSession`
- `LibraryPair`
- `LibraryShare`
- `PremiumActivation`
- `PremiumBatch`
- `PremiumCampaign`
- `PremiumCode`
- `PremiumEntitlement`
- `PremiumLock`
- `PremiumRateLimit`
- `RemoteCommand`
- `RemoteDevice`

The Premium functions are `premiumAccount`, `premiumAdmin`, and `redeemPremiumCode`.

## Target Cloudflare architecture

The intended independent deployment is a Cloudflare Worker serving the Vite-built static assets and the application's own API, with:

1. **Cloudflare D1** for users, sessions, calibration, remote devices/commands, library sharing, and Premium records.
2. **Cloudflare Workers** for authentication, MFA, OAuth callbacks, password reset, remote-control APIs, calibration APIs, and the three Premium endpoints.
3. **Durable Objects or another explicit atomic coordination mechanism** for operations that currently rely on a database lock (Premium code redemption and command coordination). Do not replace these with a non-atomic read-then-write sequence.
4. **Cloudflare secrets** for OAuth client secrets, session signing keys, email delivery credentials, and any payment-provider secrets. Never put secrets in Vite `VITE_*` variables or commit them.
5. A migration/import process for existing records before switching production traffic.

A D1 schema and API replacement must be implemented before removing the Base44 SDK, entity definitions, or Deno functions. Existing user password hashes may not be portable; confirm export support and plan a secure password-reset/re-enrolment path if necessary. Preserve user IDs or provide a mapping so remote devices and Premium entitlements remain attached to the correct accounts.

## Deployment settings

The draft Worker in `worker/` implements session lookup with hashed session tokens, remote-pairing state and commands, and phone calibration sessions. `worker/wrangler.example.jsonc` shows the static asset, API routing, and D1 bindings. The checked-in integration tests exercise its SQL and request handling using in-memory SQLite. Run them with `node --test worker/worker.test.js`.

The Worker can issue and revoke sessions for existing non-admin users via single-use email links. Set `LOGIN_EMAIL_FROM` to a verified sender and store `RESEND_API_KEY` as a Worker secret. Tests use a stub sender. Admin authentication, MFA, OAuth and user provisioning still need a production implementation. The React frontend still uses the original API client until the remaining routes and import have been verified.

Premium account reads and code redemption are implemented in the Worker. Code digests are keyed with `PREMIUM_CODE_KEY`, a Worker secret of at least 32 characters. Import existing users with their original IDs and validated, unique email addresses before importing campaign, activation and entitlement records. Store imported codes as HMAC digests and retain existing redemption history. The Premium admin routes and batch-card workflow still need to be ported. The example configuration requires a real D1 binding before deployment.

For the current Vite frontend, Cloudflare Pages' React (Vite) build settings are:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root

This only publishes the frontend bundle; it does **not** replace the API or make the app independent. Production deployment should wait until the Worker API and D1 migration are ready. If a Cloudflare Pages project already exists, download and review its current Wrangler configuration before adding a Wrangler file, because a checked-in Wrangler config becomes the source of truth for project settings.

## Work completed in this branch

- Replaced the Base44-hosted favicon with an original SyncSonic mark.
- Added an app manifest for SyncSonic.
- Renamed the npm package to `syncsonic`.
- Removed the Base44 Vite integration plugin and its editor/analytics/HMR hooks. The Base44 SDK remains temporarily because runtime authentication and data calls still use it.
# Worker preview and account snapshot

Build with `VITE_SYNCSONIC_WORKER_PREVIEW=true` and serve the build through the Worker to test email login, sign-out, Premium account status, and redemption. This preview still uses the legacy services for other features and is unsuitable for production. Mail delivery requires a verified sender and `RESEND_API_KEY`.

The local importer takes a private JSON snapshot with arrays named `users`, `campaigns`, `codes`, `activations`, and `entitlements`. Create a fresh SQLite database with the Worker migrations applied, set the same `PREMIUM_CODE_KEY` used by the intended destination, then run `node worker/import-snapshot.js <private-snapshot.json> <private-target.sqlite>`. It verifies counts and rejects nonempty targets. It never imports mail tokens, passwords, or sessions. Neither the snapshot nor the resulting database belongs in GitHub. This command verifies the data locally. It does not write to a Cloudflare database.

