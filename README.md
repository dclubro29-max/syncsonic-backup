# SyncSonic

A browser-based DJ and party audio studio with synchronized multi-speaker playback, local Auto DJ, remote control, speaker calibration, and Premium features.

## Development

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Quality checks:

```bash
npm run lint
npm run typecheck
```

## Runtime configuration

The frontend currently still uses its legacy hosted authentication and API service for account sessions, MFA/social sign-in, remote devices/commands, speaker calibration sessions, and Premium features. Configure the existing runtime environment variables in your local `.env.local` (never commit this file):

- `VITE_BASE44_APP_ID`
- `VITE_BASE44_FUNCTIONS_VERSION`
- `VITE_BASE44_APP_BASE_URL`

This is a transitional requirement, not the intended final architecture. The app is **not yet fully independent**. See [the platform migration plan](docs/PLATFORM-MIGRATION.md) for the verified dependency inventory, Cloudflare target architecture, and safe migration order.

## Cloudflare

The Vite frontend uses `npm run build` and outputs to `dist/`. Cloudflare Pages can host this static bundle with build command `npm run build` and output directory `dist`, but doing so alone does not replace the existing backend. Production cutover must wait until the Cloudflare Worker API, D1 schema, authentication, and data migration are complete.

## Project structure

- `src/` — React application, UI, audio engine, and frontend services
- `base44/entities/` — current hosted-backend entity definitions (temporary)
- `base44/functions/` — current hosted-backend functions (temporary)
- `docs/PLATFORM-MIGRATION.md` — migration architecture and status
