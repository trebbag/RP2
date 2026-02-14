import { PrismaClient } from "@prisma/client"

export function resolveIntegrationAdminDbUrl(): string | null {
  return process.env.RP2_INTEGRATION_DB_ADMIN_URL || process.env.DATABASE_ADMIN_URL || null
}

export function createAdminPrisma() {
  const adminUrl = resolveIntegrationAdminDbUrl()
  if (!adminUrl) {
    throw new Error("Missing DATABASE_ADMIN_URL (or RP2_INTEGRATION_DB_ADMIN_URL) for integration test cleanup.")
  }

  return new PrismaClient({
    datasources: {
      db: { url: adminUrl }
    }
  })
}

export async function clearTablesInOrder(prisma: PrismaClient) {
  await prisma.auditLog.deleteMany({})
  await prisma.exportArtifact.deleteMany({})
  await prisma.wizardStepState.deleteMany({})
  await prisma.wizardRun.deleteMany({})
  await prisma.complianceIssue.deleteMany({})
  await prisma.codeSelection.deleteMany({})
  await prisma.codeSuggestion.deleteMany({})
  await prisma.suggestionGeneration.deleteMany({})
  await prisma.transcriptSegment.deleteMany({})
  await prisma.noteVersion.deleteMany({})
  await prisma.note.deleteMany({})
  await prisma.dispatchJob.deleteMany({})
  await prisma.encounter.deleteMany({})
  await prisma.chartExtractionJob.deleteMany({})
  await prisma.chartAsset.deleteMany({})
  await prisma.appointment.deleteMany({})
  await prisma.patient.deleteMany({})
  await prisma.userSettings.deleteMany({})
  await prisma.authSession.deleteMany({})
  await prisma.membership.deleteMany({})
  await prisma.organization.deleteMany({})
  await prisma.user.deleteMany({})
}
