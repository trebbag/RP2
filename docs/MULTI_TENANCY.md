# Multi-Tenancy (Organization Scoped)

RP2 enforces tenant isolation at the **Organization** level using:

- Database schema: `Organization` + `Membership` and `orgId` foreign keys on all tenant-scoped rows.
- Request middleware: validates the authenticated user is a member of the requested org.
- Guardrails: Prisma client query interception injects `orgId` for tenant-scoped models inside a request tenant context.

## Tenant Model

- `Organization`
  - `id` (string; we reserve `org_system` and `org_default`)
  - `slug` (unique)
  - `name`
- `Membership`
  - joins `User` ↔ `Organization`
  - `role` is **org-scoped** (`ADMIN|MA|CLINICIAN`)

## Tenant-Scoped Tables

These tables include a required `orgId` foreign key and must never be accessed cross-tenant:

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
- `DispatchJob`
- `AuditLog`
- `AuthSession` (refresh sessions are org-scoped)

## How Org Context Is Determined

1. Login/dev-login issues a JWT that includes `orgId`.
2. `requireOrgContext` middleware verifies a `Membership` exists for `{ orgId, userId }`.
3. The middleware overwrites `req.user.role` with the membership role and establishes an AsyncLocalStorage tenant context.

Relevant code:

- `/Users/gregorygabbert/Documents/GitHub/RP2/server/src/middleware/tenant.ts`
- `/Users/gregorygabbert/Documents/GitHub/RP2/server/src/lib/tenantContext.ts`

## Prisma Guardrails

Inside a request with tenant context, `/Users/gregorygabbert/Documents/GitHub/RP2/server/src/lib/prisma.ts` injects `orgId` into `where`/`data` for tenant-scoped models for:

- `findMany`, `findFirst`, `findFirstOrThrow`, `count`, `aggregate`, `groupBy`
- `create`, `createMany`
- `updateMany`, `deleteMany`

This makes accidental unscoped reads/writes much harder.

## Dev Workflow

- Create a user + org membership in dev:
  - `POST /api/auth/dev-login` accepts optional `{ orgSlug, orgName }`
  - When omitted, dev-login uses the default org (`slug=default`)

## Adding A New Tenant-Scoped Model

1. Add `orgId` + `organization` relation in Prisma and index `orgId`.
2. Add the model name to `TENANT_SCOPED_MODELS` in `/Users/gregorygabbert/Documents/GitHub/RP2/server/src/lib/prisma.ts`.
3. Ensure all routes/services use org-scoped lookup patterns (prefer `{ orgId, externalId }`).
4. Add/extend an integration test to prove cross-tenant access fails.

## Testing Isolation

Run integration tests (requires Postgres):

```bash
npm run db:up
npm run test:integration:prepare
npm run test:integration
```

The multi-tenant isolation test is:

- `/Users/gregorygabbert/Documents/GitHub/RP2/server/tests/multiTenant.integration.test.ts`
