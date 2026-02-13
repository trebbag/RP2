# Security Runbook (Pilot)

This runbook defines baseline controls for pilot rollout and operations.

## 1. Authentication and MFA Policy

- Production must set:
  - `ALLOW_DEV_LOGIN=false`
  - `MFA_REQUIRED=true`
  - `NODE_ENV=production`
- First bootstrap account:
  - Use `POST /api/auth/register-first` once.
  - Immediately enroll MFA using one of:
    - Self-service setup: `POST /api/auth/mfa/setup` + `POST /api/auth/mfa/enable`
    - Required-enrollment flow (when `MFA_REQUIRED=true`): `POST /api/auth/mfa/enroll/start` + `POST /api/auth/mfa/enroll/complete`
- Ongoing account creation:
  - Admin-only `POST /api/auth/register`.
  - Enforce MFA enrollment before granting production access.

## 2. Password Policy

- Controlled by `PASSWORD_MIN_LENGTH` (minimum 12 in pilot).
- Backend enforces:
  - uppercase + lowercase + number + symbol
  - no whitespace
  - weak-pattern rejection
- Register endpoints reject weak passwords with explicit policy issues.

## 3. Secret Rotation Procedure

Rotate all secrets every 90 days or on security events.

1. Prepare new secrets in secret manager:
   - `JWT_SECRET`
   - `OPENAI_API_KEY`
   - dispatch credentials/endpoint secrets (if any)
2. Deploy with dual-window compatibility where applicable:
   - For JWT signing key rotation, schedule maintenance because active access tokens signed with old key will expire naturally.
   - Refresh tokens are server-side hashed; rotate by forcing `logout-all` for users if needed.
3. Verify after deploy:
   - `GET /health`
   - login + refresh token flow
   - compose/suggestion endpoints (if AI enabled)
   - dispatch retries for outbound jobs
4. Record rotation event:
   - date/time, operator, ticket id, affected environments, rollback plan.
5. Record in system:
   - `POST /api/admin/security/secret-rotation/record`
   - Verify policy posture with `GET /api/admin/security/secret-rotation/status`.

## 4. Session Controls

- Recommended pilot defaults:
  - `SESSION_TTL_HOURS=12`
  - `REFRESH_TOKEN_TTL_HOURS=168`
- If a token leak is suspected:
  - revoke user sessions via `POST /api/auth/logout-all`
  - rotate `JWT_SECRET`
  - review audit logs by request id and actor.

## 5. Dispatch Reliability Controls

- Use admin endpoints:
  - `GET /api/admin/dispatch/jobs`
  - `POST /api/admin/dispatch/retry-due`
  - `POST /api/admin/dispatch/:jobId/replay`
  - `POST /api/admin/dispatch/:jobId/dead-letter`
- Terminal dispatch failures are moved to `DEAD_LETTER`.
- Replay from dashboard after endpoint/config correction.

## 6. Audit and Retention

- Audit events are stored in `AuditLog`.
- Enforce retention with:
  - `POST /api/admin/audit-retention/enforce`
- Recommended pilot retention: 7 years (`AUDIT_RETENTION_DAYS=2555`).
