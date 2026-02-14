# PHI Boundary

## Purpose

RP2 enforces a strict server-side PHI boundary for all model calls.

- Raw PHI must not cross from RP2 business logic into any external AI model provider.
- All LLM/orchestration traffic must go through `server/src/ai/aiGateway.ts`.
- AI payloads must be de-identified DTOs and pass runtime PHI checks.

## Allowed vs Forbidden

Allowed AI payload fields are task-specific de-identified DTOs:

- `suggestions`: `noteText`, `transcriptText`, `chartFacts`
- `compliance`: `noteText`, `selectedCodes`
- `compose`: `noteText`
- `diarization`: `transcriptText`, `speakerHint`, `speakerHints`

Forbidden PHI keys are rejected anywhere in nested payload structures:

- `patientName`
- `firstName`
- `lastName`
- `dob`
- `dateOfBirth`
- `mrn`
- `medicalRecordNumber`
- `ssn`
- `phone`
- `email`
- `address`
- `street`
- `zip`
- `city`
- `state`
- `insuranceMemberId`
- `insuranceId`
- `guarantor`

PHI-like patterns are also rejected:

- emails
- US phone numbers
- SSN-like values

## Transcription Note

Audio transcription is implemented behind a pluggable provider interface (`TRANSCRIPTION_PROVIDER`).

- The transcription provider may call an external STT service depending on environment policy.
- Transcript _text_ is always treated as PHI and must be de-identified before being included in any LLM task payloads.

## Chart Note

Chart uploads are PHI.

- `ChartAsset.rawText` (extracted chart text) must never be sent to external model providers.
- AI tasks may use only structured chart facts (`ChartAsset.extractedJson`) as `chartFacts` after de-identification/guardrails.
- Avoid placing identifying metadata (e.g. uploaded file names) into `chartFacts` since name-like strings are not reliably detected by pattern-based PHI guards.

## How To Add A New AI Task Safely

1. Add the task type to `server/src/ai/types.ts`.
2. Add a strict payload schema for the new task in `server/src/ai/aiGateway.ts` (`PAYLOAD_SCHEMAS`).
3. Build/transform route/service input with `deidentifyEncounterContext` and/or `deidentifyText`.
4. Ensure the service calls `runTask(...)` via `orchestrationService` and never calls external model APIs directly.
5. Add unit tests for:
   - forbidden key rejection
   - pattern rejection
   - de-identification output shape
6. Add or update an integration test for an API endpoint that triggers the task.

## How To Test PHI Rejection

Unit:

- `server/tests/phiBoundary.unit.test.ts`

Integration:

- `server/tests/phiBoundary.integration.test.ts`

Run:

```bash
npm run lint:phi
npm run typecheck
npm run test
npm run test:integration:local
```

Expected behavior:

- `PhiViolationError` is converted to HTTP `422` with safe metadata.
- Error details include key paths and pattern counts only.
- Logs include payload stats only and never include raw payload text.

## Developer Guardrails

Static scanning is enforced to prevent reintroducing PHI keys into AI payload layers.

- Script: `scripts/lint_phi.mjs`
- Command: `npm run lint:phi`
- CI: `lint:phi` runs before typecheck/tests/build.

Rule of thumb:

- Forbidden PHI keys may appear only in `server/src/ai/deidentify.ts` and `server/src/ai/phiGuards.ts`.
- Any file that calls `runJsonTask(...)` / `runTask(...)` must not reference forbidden PHI keys in payload objects.
