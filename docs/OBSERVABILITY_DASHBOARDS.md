# Pilot Observability Dashboards

This package defines the minimum pilot dashboard and alert surfaces for dispatch, STT, auth, and AI quality pathways.

## 1. Admin Dashboard Source

- Endpoint: `GET /api/admin/observability/summary?windowMinutes=60`
- Trend endpoint: `GET /api/admin/observability/trends?windowMinutes=1440&bucketMinutes=60`
- Access: `ADMIN` role
- Used by frontend Ops tab (`Settings` → `Ops` → `Pilot Observability`)

## 2. Core Signals

- Dispatch:
  - `deadLetterRecentCount`
  - `retryingCount`
  - `pendingCount`
  - `terminalFailures`
- STT:
  - `ingestCount`
  - `fallbackCount`
  - `fallbackRate`
- Auth:
  - `failureCount` (login/MFA/refresh failures)
- AI quality:
  - Suggestions: `decisionCount`, `acceptedCount`, `removedCount`, `acceptanceRate`
  - Transcript: `segmentCount`, `correctionCount`, `correctionRate`
  - Compliance: `dismissedCount`, `resolvedCount`, `reviewedCount`, `activeCount`, `falsePositiveRate`

## 3. Alert Logic (Current)

- DLQ threshold:
  - Trigger when dead-letter count in the active window is `>= DISPATCH_DEAD_LETTER_ALERT_THRESHOLD`
  - Worker sends alert via configured sinks and writes audit event `dispatch_dead_letter_alert`
- STT fallback high:
  - Triggered in summary when `fallbackRate >= 0.3` and `ingestCount >= 5`
- Auth failure burst:
  - Triggered in summary when `failureCount >= 10`
- Suggestion acceptance low:
  - Triggered when `decisionCount >= AI_SUGGESTION_ACCEPTANCE_ALERT_MIN_DECISIONS`
  - And `acceptanceRate < AI_SUGGESTION_ACCEPTANCE_ALERT_THRESHOLD`
- Transcript correction high:
  - Triggered when `segmentCount >= AI_TRANSCRIPT_CORRECTION_ALERT_MIN_SEGMENTS`
  - And `correctionRate > AI_TRANSCRIPT_CORRECTION_ALERT_THRESHOLD`
- Compliance false-positive high:
  - Triggered when `reviewedCount >= AI_COMPLIANCE_FALSE_POSITIVE_ALERT_MIN_REVIEWED`
  - And `falsePositiveRate > AI_COMPLIANCE_FALSE_POSITIVE_ALERT_THRESHOLD`

### Tunable Env Vars

- `AI_SUGGESTION_ACCEPTANCE_ALERT_THRESHOLD` (default `0.30`)
- `AI_SUGGESTION_ACCEPTANCE_ALERT_MIN_DECISIONS` (default `20`)
- `AI_TRANSCRIPT_CORRECTION_ALERT_THRESHOLD` (default `0.22`)
- `AI_TRANSCRIPT_CORRECTION_ALERT_MIN_SEGMENTS` (default `40`)
- `AI_COMPLIANCE_FALSE_POSITIVE_ALERT_THRESHOLD` (default `0.50`)
- `AI_COMPLIANCE_FALSE_POSITIVE_ALERT_MIN_REVIEWED` (default `15`)

## 4. Alert Delivery Paths

- `ALERT_WEBHOOK_URL`
- `ALERT_SLACK_WEBHOOK_URL`
- `PAGERDUTY_ROUTING_KEY`

## 5. Runbook Mapping

- Dispatch failures: `docs/ON_CALL_PLAYBOOK.md` → "Runbook: Dispatch Incident"
- STT/diarization failures: `docs/ON_CALL_PLAYBOOK.md` → "Runbook: STT/Diarization Incident"
- Auth/MFA failures: `docs/ON_CALL_PLAYBOOK.md` → "Runbook: Auth/MFA Incident"
- AI quality drift: `docs/ON_CALL_PLAYBOOK.md` → "Runbook: AI Quality Drift Incident"

## 6. Recommended Pilot Dashboard Panels

- Dispatch Queue Health (DLQ, retrying, pending)
- Dispatch Terminal Failure Trend (last 24h)
- STT Fallback Rate (5m/15m/60m windows)
- Auth Failure Rate (login/MFA/refresh)
- Suggestion Acceptance Trend (60m/24h)
- Transcript Correction Trend (60m/24h)
- Compliance False-Positive Rate (resolved vs dismissed)
- Alert Sink Delivery Success/Failure counts
