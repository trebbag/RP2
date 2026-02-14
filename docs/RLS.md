# Postgres Row-Level Security (RLS)

RP2 uses Postgres Row-Level Security as a defense-in-depth layer to enforce **Organization tenant isolation** at the database level.

## How It Works

1. RLS policies are enabled on tenant-scoped tables.
2. Policies permit access only when the row `orgId` matches the Postgres session setting:

`current_setting('app.current_org', true)`

3. The server sets this setting per request/transaction:

`SELECT set_config('app.current_org', '<orgId>', true);`

If `app.current_org` is not set, RLS filters everything out (safe default).

## Where It’s Implemented

- Migration enabling RLS + policies:
  - `/Users/gregorygabbert/Documents/GitHub/RP2/server/prisma/migrations/202602132040_tenant_rls/migration.sql`
- Request middleware that creates a transaction and sets `app.current_org`:
  - `/Users/gregorygabbert/Documents/GitHub/RP2/server/src/middleware/rls.ts`
  - Mounted in `/Users/gregorygabbert/Documents/GitHub/RP2/server/src/app.ts`
- RLS helper (used by long-lived stream endpoints + background jobs):
  - `/Users/gregorygabbert/Documents/GitHub/RP2/server/src/lib/rls.ts`

## Tables Covered

RLS is enabled on these tenant-scoped tables:

- `Patient`
- `Appointment`
- `Encounter`
- `Note`, `NoteVersion`
- `TranscriptSegment`
- `ChartAsset`
- `SuggestionGeneration`, `CodeSuggestion`, `CodeSelection`
- `ComplianceIssue`
- `WizardRun`, `WizardStepState`
- `ExportArtifact`
- `AuditLog`
- `DispatchJob`

**Exception:** `AuthSession` is currently excluded from RLS because refresh token rotation must look up sessions before org context is established.

## Important Operational Note

RLS is bypassed by Postgres superusers. For RLS to provide real isolation:

- Run migrations with an admin role (e.g., `postgres`).
- Run the application with a restricted DB role (no superuser, no BYPASSRLS).

For integration tests, RP2 bootstraps an `rp2_app` role (see below).

## Local / CI Integration Setup

Integration uses:

- `DATABASE_ADMIN_URL` for migrations + role bootstrap
- `DATABASE_URL` for the app runtime connection (recommended: `rp2_app`)

Bootstrap script:

- `/Users/gregorygabbert/Documents/GitHub/RP2/scripts/bootstrap_rls_app_role.mjs`

Run integration locally:

```bash
npm run db:up
npm run test:integration:prepare
npm run test:integration
```

The RLS integration test is:

- `/Users/gregorygabbert/Documents/GitHub/RP2/server/tests/rls.integration.test.ts`
