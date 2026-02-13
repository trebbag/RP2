# RevenuePilot (RP2)

RevenuePilot is a Vite + React frontend with a new TypeScript/Express backend for encounter lifecycle, drafts, AI suggestion/compliance workflows, and finalization/export APIs.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript + Prisma + PostgreSQL
- Storage: local filesystem (`server/storage`) for uploaded charts, traces, and PDF exports
- Realtime: SSE stream per encounter (`/api/encounters/:id/transcript/stream`)
- Audio transcription: chunked audio upload (`/api/encounters/:id/transcript/audio`) with diarization + persisted segments

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 15+

## Setup

1. Copy environment file.

```bash
cp .env.example .env
```

2. Install dependencies for root + server workspace.

```bash
npm install
```

3. Start local Postgres (docker-based default).

```bash
npm run db:up
```

If port `5432` is already in use:

```bash
RP2_POSTGRES_PORT=55432 npm run db:up
```

4. Generate Prisma client and apply schema.

```bash
npm --workspace @revenuepilot/server run prisma:generate
npm --workspace @revenuepilot/server run prisma:push
```

5. (Optional) Seed demo data.

```bash
npm --workspace @revenuepilot/server run prisma:seed
```

## Run

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Verification Commands

```bash
npm run typecheck
npm run test
npm run build
```

## Local Admin Bootstrap Helper

If you need a known local login quickly, run:

```bash
npm run admin:create-local
```

Defaults:
- Email: `admin@rp2.local`
- Password: `AdminPass#12345`

Override values:

```bash
npm run admin:create-local -- --email you@example.com --name "Clinic Admin" --password "YourStrongPass#123"
```

Optional integration flow test (requires running Postgres + schema and sets explicit flag):

```bash
npm run test:integration
```

One-command local integration + soak run (brings up Postgres, waits for readiness, prepares Prisma schema, then runs suites):

```bash
npm run test:integration:local
```

Optional soak validation (long transcript and dispatch retry storm simulation):

```bash
npm run test:soak
```

This runs:
- Encounter flow integration (schedule -> visit -> wizard -> finalize -> artifact download)
- Auth + MFA lifecycle integration checks
- Role matrix + audit retention + admin operations authorization checks
- Soak coverage when `test:soak` is used

To run integration tests against a non-default Postgres port:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/revenuepilot npm --workspace @revenuepilot/server run prisma:push
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/revenuepilot JWT_SECRET=integration-jwt-secret-1234567890 CORS_ORIGIN=http://localhost:5173 STORAGE_DIR=./server/storage ALLOW_DEV_LOGIN=true npm run test:integration
```

If you only want to prepare schema + client without running tests:

```bash
npm run test:integration:prepare
```

`test:integration` sets `RP2_OFFLINE_AI=1` so integration runs stay deterministic without external model latency.

## Implemented APIs

- `POST /api/appointments`
- `POST /api/appointments/:id/chart`
- `POST /api/encounters/:id/start`
- `POST /api/encounters/:id/stop`
- `GET /api/encounters/:id/transcript/stream`
- `POST /api/encounters/:id/transcript/segments`
- `POST /api/encounters/:id/transcript/audio`
- `GET /api/encounters/:id/transcript/quality`
- `POST /api/encounters/:id/transcript/segments/:segmentId/correct`
- `POST /api/encounters/:id/transcript/stream-metrics`
- `POST /api/encounters/:id/suggestions/refresh`
- `GET /api/encounters/:id/compliance`
- `POST /api/encounters/:id/compliance/:issueId/status`
- `GET /api/settings/me`
- `PUT /api/settings/me`
- `POST /api/wizard/:encounterId/step/:n/actions`
- `GET /api/wizard/:encounterId/state`
- `POST /api/wizard/:encounterId/compose`
- `POST /api/wizard/:encounterId/rebeautify`
- `POST /api/wizard/:encounterId/billing-preview`
- `POST /api/wizard/:encounterId/finalize`
- `GET /api/drafts`
- `GET /api/drafts/:id`
- `GET /api/exports/:artifactId`
- `GET /api/auth/policy`
- `GET /api/auth/bootstrap-status`
- `POST /api/auth/register-first`
- `POST /api/auth/register` (admin only)
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `POST /api/auth/mfa/setup`
- `POST /api/auth/mfa/enable`
- `POST /api/auth/mfa/disable`
- `POST /api/auth/mfa/backup-codes/regenerate`
- `POST /api/auth/mfa/enroll/start` (when `MFA_REQUIRED=true`)
- `POST /api/auth/mfa/enroll/complete` (when `MFA_REQUIRED=true`)
- `GET /api/auth/me`
- `POST /api/admin/audit-retention/enforce` (admin only)
- `POST /api/admin/dispatch/retry-due` (admin only)
- `GET /api/admin/dispatch/jobs` (admin only)
- `POST /api/admin/dispatch/:jobId/replay` (admin only)
- `POST /api/admin/dispatch/:jobId/dead-letter` (admin only)
- `POST /api/admin/dispatch/contract/validate` (admin only)
- `GET /api/admin/dispatch/sandbox-readiness` (admin only)
- `GET /api/admin/billing/fee-schedules` (admin only)
- `PUT /api/admin/billing/fee-schedules` (admin only)
- `GET /api/admin/security/secret-rotation/status` (admin only)
- `POST /api/admin/security/secret-rotation/record` (admin only)
- `GET /api/admin/users` (admin only)
- `POST /api/admin/users/:userId/mfa/reset` (admin only)
- `GET /api/admin/observability/summary` (admin only)
- `GET /api/activity` (supports cursor pagination via `cursor` and returns `pageInfo`)

## Auth Strategy

- Access token: JWT bearer token (`Authorization: Bearer ...`), short-lived (`SESSION_TTL_HOURS`).
- Refresh token: HTTP-only cookie (`rp_refresh`) backed by persisted `AuthSession` rows.
- Production defaults: `SESSION_TTL_HOURS=12`, `REFRESH_TOKEN_TTL_HOURS=168`, `ALLOW_DEV_LOGIN=false`, `MFA_REQUIRED=true`.
- Production login routes:
  - `GET /api/auth/policy`
  - `POST /api/auth/register-first` (bootstrap only when no users exist)
  - `POST /api/auth/register` (admin only)
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/logout-all`
  - `POST /api/auth/mfa/setup`
  - `POST /api/auth/mfa/enable`
  - `POST /api/auth/mfa/disable`
  - `POST /api/auth/mfa/backup-codes/regenerate`
  - `POST /api/auth/mfa/enroll/start` (required enrollment flow)
  - `POST /api/auth/mfa/enroll/complete` (required enrollment flow)
- Dev login route (`POST /api/auth/dev-login`) is gated by `ALLOW_DEV_LOGIN` and always disabled in production mode.
- In production mode, server startup now fails fast if insecure auth/session settings are configured.

## Security Notes

- The frontend contains no API keys.
- Backend secrets are environment-only.
- JWT auth middleware is enabled for all non-auth API routes and requires explicit tokens.
- SSE supports authenticated streaming via `access_token` query token (for EventSource compatibility).
- Audit log entries are persisted for key write operations.
- API responses include `x-request-id`; server emits structured JSON logs for request correlation.
- Audit retention enforcement endpoint supports dry-run and apply modes.
- Password complexity policy + MFA policy are enforced server-side (`PASSWORD_MIN_LENGTH`, `MFA_REQUIRED`).
- Login and refresh routes are protected by server-side rate limiting / brute-force controls (`AUTH_LOGIN_*`, `AUTH_REFRESH_*`).
- Dispatch jobs are persisted with retry metadata, dead-letter handling, and replay controls.
- Dispatch auth signing supports API-key, bearer, HMAC, and optional client-cert transport (`DISPATCH_AUTH_MODE` and related env vars).
- HTTP dispatch now includes explicit idempotency headers (`Idempotency-Key`, `X-RP-Idempotency-Key`) plus vendor-specific request/correlation headers where required.
- Step-5 billing now loads payer-approved fee schedules from `BILLING_SCHEDULES_PATH` (default: `server/config/billing-fee-schedules.json`) and exposes schedule-pack admin APIs for controlled updates.
- DLQ growth alerting is emitted by worker thresholds (`DISPATCH_DEAD_LETTER_ALERT_*`).
- Pilot operations runbook: `docs/SECURITY_RUNBOOK.md`.
- On-call incident playbook: `docs/ON_CALL_PLAYBOOK.md`.
- Pilot dashboard package: `docs/OBSERVABILITY_DASHBOARDS.md`.
- Release and migration checklist: `docs/RELEASE_CHECKLIST.md`.

## CI Notes

- `verify` job runs typecheck + tests + build.
- `integration` job runs real Postgres-backed integration tests on push/PR.
- `soak` job runs real Postgres soak tests on nightly schedule and manual workflow dispatch.

## Current Limitations

- If `OPENAI_API_KEY` is not configured, AI services fall back to deterministic local logic.
- FHIR/HL7/vendor payload contracts are implemented, but production endpoint credentials and validation certs are still environment-specific.
