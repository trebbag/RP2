# Pilot On-Call Playbook

This document defines triage and mitigation steps for pilot incidents.

## Scope

- Dispatch failures and dead-letter growth
- STT/diarization instability
- Auth/login/MFA failures

## Dashboards and Endpoints

- Admin observability summary:
  - `GET /api/admin/observability/summary?windowMinutes=60`
- Dispatch operations:
  - `GET /api/admin/dispatch/jobs`
  - `POST /api/admin/dispatch/retry-due`
  - `POST /api/admin/dispatch/:jobId/replay`
  - `POST /api/admin/dispatch/:jobId/dead-letter`
  - `POST /api/admin/dispatch/contract/validate`
  - `GET /api/admin/dispatch/sandbox-readiness`
- Secret rotation tracking:
  - `GET /api/admin/security/secret-rotation/status`
  - `POST /api/admin/security/secret-rotation/record`
- Transcript quality and correction:
  - `GET /api/encounters/:id/transcript/quality`
  - `POST /api/encounters/:id/transcript/segments/:segmentId/correct`

## Alert Conditions

- Dead-letter growth:
  - Triggered when dead-letter count in alert window exceeds `DISPATCH_DEAD_LETTER_ALERT_THRESHOLD`.
- STT fallback risk:
  - Triggered when fallback rate is high in observability summary.
- Auth failure burst:
  - Triggered when repeated login/MFA/refresh failures occur in window.
- AI quality drift:
  - Triggered when suggestion acceptance drops, transcript correction spikes, or compliance false-positive rate remains elevated.

## Runbook: Dispatch Incident

1. Confirm target and contract:
- Check job `target`, `contractType`, and `lastError` in dispatch dashboard.
2. Validate transport/auth config:
- Verify `DISPATCH_TARGET`, `DISPATCH_WEBHOOK_URL`, MLLP host/port, and auth mode env vars.
3. Contain:
- Move noisy broken jobs to dead-letter if they block queue progress.
4. Recover:
- Fix endpoint/auth mapping.
- Replay dead-letter and retrying jobs in small batches.
5. Verify:
- Ensure new dispatches move to `DISPATCHED`.
- Confirm dead-letter count stabilizes below threshold.

## Runbook: STT/Diarization Incident

1. Identify affected encounters:
- Use observability and transcript quality score.
2. Immediate mitigation:
- Use transcript correction endpoint/UI for critical segments.
3. Root cause checks:
- Microphone/browser capture issues.
- External STT provider degradation.
- Label mismatch in `DIARIZATION_SPEAKERS`.
4. Verify:
- Fallback rate and low-confidence segment rates return to baseline.

## Runbook: Auth/MFA Incident

1. Scope failures:
- Inspect auth failure count and recent audit log entries.
2. Check policy/config:
- `ALLOW_DEV_LOGIN`, `MFA_REQUIRED`, JWT secret validity, token TTL settings.
3. User recovery:
- For locked-out users, verify MFA setup state and backup-code path.
4. Containment:
- If suspicious activity, force `logout-all` and rotate secrets per security runbook.

## Runbook: AI Quality Drift Incident

1. Identify the failing signal:
- Suggestion acceptance low, transcript correction high, or compliance false-positive high.
2. Scope blast radius:
- Confirm whether the drift is one clinician/workflow or broad across encounters.
3. Triage by source:
- Prompt/regression drift: review latest prompt version IDs in trace artifacts.
- STT/diarization drift: inspect transcript quality reports and correction logs.
- Compliance drift: review dismissed-vs-resolved issue patterns by title/fingerprint.
4. Mitigate:
- Roll back prompt overrides for impacted users.
- Increase manual review gate (clinician confirmation before finalize).
- Route severe outliers to escalation queue for audit.
5. Verify recovery:
- Acceptance/correction/false-positive rates return below configured alert thresholds.

## Escalation

- Escalate immediately if:
  - Dispatch is blocked for all encounters > 15 minutes
  - Auth failures indicate brute-force or token compromise
  - STT outage impacts active clinicians broadly
  - AI quality drift persists for > 2 hours across multiple clinicians

- When escalating, include:
  - incident start time
  - current blast radius
  - affected endpoints/services
  - mitigation done
  - next action owner and ETA
