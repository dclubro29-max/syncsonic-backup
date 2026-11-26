# SyncSonic platform migration

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
