/*
  Postgres Row-Level Security (RLS) for Organization-scoped multi-tenancy.

  This migration enables RLS on tenant-scoped tables and enforces that all
  SELECT/INSERT/UPDATE/DELETE operations can only access rows where:

    "orgId" = current_setting('app.current_org', true)

  The application must set the session variable at runtime (per request /
  per transaction) using:

    SELECT set_config('app.current_org', '<orgId>', true);
*/

-- Tenant-scoped tables (RLS enabled)
-- NOTE: AuthSession is intentionally excluded from RLS because refresh token
-- rotation requires looking up sessions before org context is established.

ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Patient" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Patient";
CREATE POLICY "tenant_isolation" ON "Patient"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Appointment";
CREATE POLICY "tenant_isolation" ON "Appointment"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "Encounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Encounter" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Encounter";
CREATE POLICY "tenant_isolation" ON "Encounter"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "Note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Note" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Note";
CREATE POLICY "tenant_isolation" ON "Note"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "NoteVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NoteVersion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "NoteVersion";
CREATE POLICY "tenant_isolation" ON "NoteVersion"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "TranscriptSegment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TranscriptSegment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "TranscriptSegment";
CREATE POLICY "tenant_isolation" ON "TranscriptSegment"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "ChartAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChartAsset" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ChartAsset";
CREATE POLICY "tenant_isolation" ON "ChartAsset"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "SuggestionGeneration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuggestionGeneration" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "SuggestionGeneration";
CREATE POLICY "tenant_isolation" ON "SuggestionGeneration"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "CodeSuggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CodeSuggestion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CodeSuggestion";
CREATE POLICY "tenant_isolation" ON "CodeSuggestion"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "CodeSelection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CodeSelection" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CodeSelection";
CREATE POLICY "tenant_isolation" ON "CodeSelection"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "ComplianceIssue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComplianceIssue" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ComplianceIssue";
CREATE POLICY "tenant_isolation" ON "ComplianceIssue"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "WizardRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WizardRun" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "WizardRun";
CREATE POLICY "tenant_isolation" ON "WizardRun"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "WizardStepState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WizardStepState" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "WizardStepState";
CREATE POLICY "tenant_isolation" ON "WizardStepState"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "ExportArtifact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExportArtifact" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ExportArtifact";
CREATE POLICY "tenant_isolation" ON "ExportArtifact"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AuditLog";
CREATE POLICY "tenant_isolation" ON "AuditLog"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

ALTER TABLE "DispatchJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DispatchJob" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "DispatchJob";
CREATE POLICY "tenant_isolation" ON "DispatchJob"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));

