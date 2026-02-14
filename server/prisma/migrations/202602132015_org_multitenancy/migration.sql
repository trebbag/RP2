/*
  Organization-scoped multi-tenancy.

  Backfill strategy:
  - Create `org_system` and `org_default` organizations.
  - Assign all existing rows to `org_default`.
  - Create a `Membership` row for each existing user in `org_default` using the user's existing `role`.
*/

-- Drop existing uniqueness that will become org-scoped.
DROP INDEX IF EXISTS "Appointment_externalId_key";
DROP INDEX IF EXISTS "ComplianceIssue_encounterId_fingerprint_key";
DROP INDEX IF EXISTS "Encounter_externalId_key";
DROP INDEX IF EXISTS "Patient_externalId_key";
DROP INDEX IF EXISTS "WizardStepState_wizardRunId_step_key";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLINICIAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- Seed baseline orgs used by runtime bootstrap.
INSERT INTO "Organization" ("id", "slug", "name", "createdAt", "updatedAt")
VALUES
  ('org_system', 'system', 'System', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('org_default', 'default', 'Default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add orgId columns (nullable), backfill, then enforce NOT NULL.
ALTER TABLE "Patient" ADD COLUMN "orgId" TEXT;
UPDATE "Patient" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "Patient" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "Appointment" ADD COLUMN "orgId" TEXT;
UPDATE "Appointment" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "Appointment" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "Encounter" ADD COLUMN "orgId" TEXT;
UPDATE "Encounter" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "Encounter" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "Note" ADD COLUMN "orgId" TEXT;
UPDATE "Note" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "Note" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "NoteVersion" ADD COLUMN "orgId" TEXT;
UPDATE "NoteVersion" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "NoteVersion" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "TranscriptSegment" ADD COLUMN "orgId" TEXT;
UPDATE "TranscriptSegment" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "TranscriptSegment" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "ChartAsset" ADD COLUMN "orgId" TEXT;
UPDATE "ChartAsset" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "ChartAsset" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "SuggestionGeneration" ADD COLUMN "orgId" TEXT;
UPDATE "SuggestionGeneration" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "SuggestionGeneration" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "CodeSuggestion" ADD COLUMN "orgId" TEXT;
UPDATE "CodeSuggestion" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "CodeSuggestion" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "CodeSelection" ADD COLUMN "orgId" TEXT;
UPDATE "CodeSelection" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "CodeSelection" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "ComplianceIssue" ADD COLUMN "orgId" TEXT;
UPDATE "ComplianceIssue" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "ComplianceIssue" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "WizardRun" ADD COLUMN "orgId" TEXT;
UPDATE "WizardRun" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "WizardRun" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "WizardStepState" ADD COLUMN "orgId" TEXT;
UPDATE "WizardStepState" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "WizardStepState" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "ExportArtifact" ADD COLUMN "orgId" TEXT;
UPDATE "ExportArtifact" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "ExportArtifact" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "AuditLog" ADD COLUMN "orgId" TEXT;
UPDATE "AuditLog" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "AuthSession" ADD COLUMN "orgId" TEXT;
UPDATE "AuthSession" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "AuthSession" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "DispatchJob" ADD COLUMN "orgId" TEXT;
UPDATE "DispatchJob" SET "orgId" = 'org_default' WHERE "orgId" IS NULL;
ALTER TABLE "DispatchJob" ALTER COLUMN "orgId" SET NOT NULL;

-- Backfill memberships for existing users into the default org.
INSERT INTO "Membership" ("id", "orgId", "userId", "role", "createdAt", "updatedAt")
SELECT
  concat('m_', "User"."id") AS "id",
  'org_default' AS "orgId",
  "User"."id" AS "userId",
  "User"."role" AS "role",
  CURRENT_TIMESTAMP AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "User";

-- Indexes (including new org-scoped uniqueness).
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");

CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");
CREATE UNIQUE INDEX "Membership_orgId_userId_key" ON "Membership"("orgId", "userId");

CREATE INDEX "Appointment_orgId_idx" ON "Appointment"("orgId");
CREATE UNIQUE INDEX "Appointment_orgId_externalId_key" ON "Appointment"("orgId", "externalId");

CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

CREATE INDEX "AuthSession_orgId_expiresAt_idx" ON "AuthSession"("orgId", "expiresAt");

CREATE INDEX "ChartAsset_orgId_idx" ON "ChartAsset"("orgId");

CREATE INDEX "CodeSelection_orgId_createdAt_idx" ON "CodeSelection"("orgId", "createdAt");

CREATE INDEX "CodeSuggestion_orgId_status_idx" ON "CodeSuggestion"("orgId", "status");

CREATE INDEX "ComplianceIssue_orgId_status_idx" ON "ComplianceIssue"("orgId", "status");
CREATE UNIQUE INDEX "ComplianceIssue_orgId_encounterId_fingerprint_key" ON "ComplianceIssue"("orgId", "encounterId", "fingerprint");

CREATE INDEX "DispatchJob_orgId_status_idx" ON "DispatchJob"("orgId", "status");

CREATE INDEX "Encounter_orgId_idx" ON "Encounter"("orgId");
CREATE UNIQUE INDEX "Encounter_orgId_externalId_key" ON "Encounter"("orgId", "externalId");

CREATE INDEX "ExportArtifact_orgId_type_idx" ON "ExportArtifact"("orgId", "type");

CREATE INDEX "Note_orgId_updatedAt_idx" ON "Note"("orgId", "updatedAt");

CREATE INDEX "NoteVersion_orgId_createdAt_idx" ON "NoteVersion"("orgId", "createdAt");

CREATE INDEX "Patient_orgId_idx" ON "Patient"("orgId");
CREATE UNIQUE INDEX "Patient_orgId_externalId_key" ON "Patient"("orgId", "externalId");

CREATE INDEX "SuggestionGeneration_orgId_createdAt_idx" ON "SuggestionGeneration"("orgId", "createdAt");

CREATE INDEX "TranscriptSegment_orgId_createdAt_idx" ON "TranscriptSegment"("orgId", "createdAt");

CREATE INDEX "WizardRun_orgId_startedAt_idx" ON "WizardRun"("orgId", "startedAt");

CREATE INDEX "WizardStepState_orgId_step_idx" ON "WizardStepState"("orgId", "step");
CREATE UNIQUE INDEX "WizardStepState_orgId_wizardRunId_step_key" ON "WizardStepState"("orgId", "wizardRunId", "step");

-- Foreign keys to Organization.
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteVersion" ADD CONSTRAINT "NoteVersion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChartAsset" ADD CONSTRAINT "ChartAsset_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SuggestionGeneration" ADD CONSTRAINT "SuggestionGeneration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeSuggestion" ADD CONSTRAINT "CodeSuggestion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeSelection" ADD CONSTRAINT "CodeSelection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceIssue" ADD CONSTRAINT "ComplianceIssue_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WizardRun" ADD CONSTRAINT "WizardRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WizardStepState" ADD CONSTRAINT "WizardStepState_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExportArtifact" ADD CONSTRAINT "ExportArtifact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

