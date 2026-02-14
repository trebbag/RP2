-- CreateEnum
CREATE TYPE "ChartExtractionJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ChartExtractionJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "chartAssetId" TEXT NOT NULL,
    "status" "ChartExtractionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartExtractionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChartExtractionJob_chartAssetId_key" ON "ChartExtractionJob"("chartAssetId");
CREATE INDEX "ChartExtractionJob_orgId_status_createdAt_idx" ON "ChartExtractionJob"("orgId", "status", "createdAt");
CREATE INDEX "ChartExtractionJob_status_createdAt_idx" ON "ChartExtractionJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ChartExtractionJob" ADD CONSTRAINT "ChartExtractionJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChartExtractionJob" ADD CONSTRAINT "ChartExtractionJob_chartAssetId_fkey" FOREIGN KEY ("chartAssetId") REFERENCES "ChartAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant RLS
ALTER TABLE "ChartExtractionJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChartExtractionJob" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ChartExtractionJob";
CREATE POLICY "tenant_isolation" ON "ChartExtractionJob"
  USING ("orgId" = current_setting('app.current_org', true))
  WITH CHECK ("orgId" = current_setting('app.current_org', true));
