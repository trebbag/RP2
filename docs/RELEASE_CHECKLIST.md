# Release & Promotion Checklist

This checklist standardizes promotion to pilot/production environments.

## 1. Pre-Release Validation

Run locally or in CI:

```bash
npm run typecheck
npm run test
npm run build
```

For DB-backed verification:

```bash
npm run test:integration
```

Optional soak validation:

```bash
npm run test:soak
```

## 2. Migration Process (Versioned)

Migrations are stored under:

- `server/prisma/migrations/`

Commands:

```bash
npm --workspace @revenuepilot/server run prisma:migrate:status
npm --workspace @revenuepilot/server run prisma:migrate:deploy
```

### Existing environments already created via `db push`

If an existing environment predates migration history:

1. Verify schema matches current Prisma model.
2. Mark baseline migration as applied:

```bash
npm --workspace @revenuepilot/server run prisma:migrate:resolve-baseline
```

3. Then use `prisma:migrate:deploy` going forward.

## 3. Environment Promotion Gate

Before promoting:

1. Confirm production env vars are present:
- auth + MFA policy
- dispatch target/auth/certs
- alert sink routing
2. Confirm dispatch sandbox readiness endpoint returns ready:
- `GET /api/admin/dispatch/sandbox-readiness`
3. Confirm contract validation passes for chosen target:
- `POST /api/admin/dispatch/contract/validate`

## 4. Post-Deploy Smoke

1. Health check:
- `GET /health`
2. Auth flows:
- login + refresh + MFA path
3. Core workflow:
- start encounter
- save note
- finalize and dispatch
4. Ops checks:
- `GET /api/admin/observability/summary`
- `GET /api/admin/dispatch/jobs`

## 5. Rollback Plan

If incident severity warrants rollback:

1. Roll back app deployment.
2. Stop new dispatch processing if needed.
3. Replay pending/retrying jobs after fix.
4. Follow `docs/ON_CALL_PLAYBOOK.md` for incident communications and recovery.
