# Needs From You

These inputs are required to complete full pilot readiness and production configuration.

1. `OPENAI_API_KEY` and model policy
- Which model(s) are approved for compose/suggestions/compliance runs?
- Any cost caps or max tokens per run?

2. STT provider + diarization constraints
- Preferred provider (OpenAI, Deepgram, Azure, etc.)
- Required diarization granularity and acceptable error tolerance.

3. EHR/PM dispatch integration targets
- Which system(s) should receive finalized notes and billing payloads?
- Transport requirements (FHIR R4 bundle API, HL7 v2 ORU over MLLP, or vendor JSON API).
- For HTTP dispatch (`FHIR_R4` / `VENDOR_API`): endpoint URL, auth headers/signature scheme, and idempotency semantics.
- For HL7 dispatch (`HL7_V2`): MLLP host/port, ack contract, and site connectivity requirements.
- Confirm vendor mapping target (`GENERIC`, `ATHENAHEALTH`, `NEXTGEN`, `ECLINICALWORKS`) and required field validation.
- If mutual TLS is required: provide cert/key/CA management process and rotation cadence.

4. Billing rules for Step 5
- Payer logic, fee schedules, and allowed CPT/ICD mappings.
- Patient responsibility assumptions by payer and plan type.
- Confirm payer model IDs and fee schedule versioning source-of-truth (currently seeded defaults are used).
- Provide the payer-approved schedule pack JSON to be mounted at `BILLING_SCHEDULES_PATH` for pilot/prod.

5. PDF output requirements
- Branding assets (logo, fonts, legal footer text).
- Final template constraints for clinical note and patient summary PDFs.

6. Pilot workflow and compliance constraints
- Role matrix (MA vs clinician vs admin permissions).
- Audit retention period and policy requirements (HIPAA/SOC2 internal controls).
- Session security policy: token TTLs, password policy, and MFA requirement (if any).
- Secret rotation owners + cadence and incident response contacts.

7. Infrastructure choices
- Postgres host details for non-local environments.
- Object storage target (S3 bucket/MinIO endpoint) and credentials strategy.
- Alert routing targets (PagerDuty/Slack/email) for dispatch DLQ, STT fallback spikes, and auth failure bursts.
- Secret-rotation ticketing convention and operator ownership for `POST /api/admin/security/secret-rotation/record`.

## Current Temporary Defaults (Implemented Until You Confirm)

- Role matrix:
  - `MA`: appointments/chart upload/draft read/export download.
  - `CLINICIAN`: full encounter + wizard/finalization operations.
  - `ADMIN`: all operations + audit retention enforcement endpoint.
- Audit retention policy default: `2555` days (~7 years).
- AI orchestration model default: `gpt-5-mini` when `OPENAI_API_KEY` is provided.
