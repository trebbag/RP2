# Transcript Retention (PHI)

Transcript text is treated as PHI in RP2.

## Storage

- Transcript segments are persisted in Postgres in the `TranscriptSegment` table (`server/prisma/schema.prisma`).
- Each segment contains `speaker`, timing fields, optional `confidence`, and `text` (PHI).

## AI Boundary

- Raw transcript strings must never be sent to external model providers.
- Any transcript-derived AI inputs must be de-identified via `server/src/ai/deidentify.ts` before reaching `server/src/ai/aiGateway.ts`.

## Retention Policy

Environment variable:

- `TRANSCRIPT_RETENTION_DAYS` (default: `7`)
  - `0`: transcript text is redacted immediately on finalize.
  - `>0`: transcript text is redacted for encounters finalized before `now - TRANSCRIPT_RETENTION_DAYS`.

Redaction behavior:

- Transcript rows are preserved (for counts/timing/confidence metrics), but `TranscriptSegment.text` is replaced with the placeholder `"[REDACTED]"`.

## How To Run Cleanup

Admin endpoint:

- `POST /api/admin/transcript-retention/enforce`
  - body: `{ "dryRun": true | false }`

For a dry-run:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/admin/transcript-retention/enforce \
  -d '{"dryRun":true}'
```

## Finalize Hook

When `TRANSCRIPT_RETENTION_DAYS=0`, the finalize flow (`POST /api/wizard/:encounterId/finalize`) redacts transcript text as part of the finalize transaction (after artifacts are created and the encounter is marked finalized).
