# Chart Extraction (Async, PHI-Safe)

## Overview

When a chart document (PDF or image) is uploaded, RP2:

1. Stores the uploaded file on disk under `STORAGE_DIR/charts/<appointmentExternalId>/...` (PHI).
2. Creates a `ChartAsset` row (upload metadata) and a `ChartExtractionJob` row in `QUEUED`.
3. A background worker extracts text server-side:
   - PDF embedded text extraction when present.
   - OCR for image charts and scanned PDFs.
4. Stores extracted text in `ChartAsset.rawText` (PHI).
5. Stores structured chart facts in `ChartAsset.extractedJson` (PHI).

Raw extracted chart text is **never** sent to external model providers.

## Database Models

- `ChartAsset`: upload metadata + storage pointer + extracted payloads.
  - `rawText` is extracted text (PHI).
  - `extractedJson` is structured chart facts (PHI).
- `ChartExtractionJob`: background job state machine.
  - `QUEUED` → `RUNNING` → `SUCCEEDED` | `FAILED`

Both tables are tenant-scoped (`orgId`) and protected by Postgres RLS.

## APIs

Upload (queues extraction):

- `POST /api/appointments/:appointmentId/chart`
  - saves files + creates `ChartAsset` + `ChartExtractionJob(QUEUED)`

List charts + status:

- `GET /api/appointments/:appointmentId/charts`
  - default response does not include extracted text
  - pass `?includeText=1` to include `ChartAsset.rawText` (PHI)

Admin (deterministic processing for tests / manual runs):

- `POST /api/admin/chart-extraction/process`
  - body: `{ "limit": number }`
  - requires `ADMIN`

## Worker

In `server/src/index.ts`, the in-process worker polls every 10s:

- claims queued jobs
- extracts text
- updates `ChartAsset.rawText` + `ChartAsset.extractedJson`
- marks job `SUCCEEDED` or `FAILED`

Implementation: `server/src/services/chartExtractionJobService.ts`.

## OCR Implementation

- OCR is performed locally with `tesseract.js` + `@tesseract.js-data/eng`.
- Scanned PDFs are handled by extracting the largest image XObject from each page and OCR’ing it.

No network calls are required for OCR.

## PHI Boundary Notes

- `ChartAsset.rawText` is always PHI.
- Any AI task input that uses chart context must use only structured facts and must go through the PHI boundary (`server/src/ai/*`).
- Do not pass `rawText` into `deidentifyEncounterContext` or `aiGateway`.

## Tests

- Unit: `server/tests/chartExtractionService.test.ts`
  - `text-chart.pdf` (embedded text)
  - `scanned-chart.pdf` (OCR)
- Integration: `server/tests/encounterFlow.integration.test.ts`
  - upload → queue → admin process → retrieve extracted text
