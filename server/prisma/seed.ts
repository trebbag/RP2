import { PrismaClient } from "@prisma/client"
import { createExternalAppointmentId, createExternalEncounterId, createExternalPatientId } from "../src/utils/id.js"

const prisma = new PrismaClient()

const SYSTEM_ORG_ID = "org_system"
const DEFAULT_ORG_ID = "org_default"

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

function normalizeOrganizationInput(input: { orgName?: string; orgSlug?: string }): { slug: string; name: string } {
  const name = (input.orgName || "Default Organization").trim().slice(0, 120)
  const slugSource = input.orgSlug?.trim() || name
  const slug = normalizeSlug(slugSource) || "default"
  return { slug, name }
}

async function ensureTenantBootstrap(): Promise<void> {
  await prisma.organization.upsert({
    where: { id: SYSTEM_ORG_ID },
    update: { name: "System", slug: "system" },
    create: { id: SYSTEM_ORG_ID, name: "System", slug: "system" }
  })

  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: { name: "Default Organization", slug: "default" },
    create: { id: DEFAULT_ORG_ID, name: "Default Organization", slug: "default" }
  })
}

async function ensureOrganization(input: { slug: string; name: string }) {
  const slug = normalizeSlug(input.slug)
  return prisma.organization.upsert({
    where: { slug },
    update: { name: input.name },
    create: { slug, name: input.name }
  })
}

async function ensureMembership(input: { orgId: string; userId: string; role: "ADMIN" | "MA" | "CLINICIAN" }) {
  return prisma.membership.upsert({
    where: {
      orgId_userId: {
        orgId: input.orgId,
        userId: input.userId
      }
    },
    update: { role: input.role },
    create: {
      orgId: input.orgId,
      userId: input.userId,
      role: input.role
    }
  })
}

async function main() {
  await prisma.$connect()
  await ensureTenantBootstrap()
  const orgInput = normalizeOrganizationInput({ orgName: "Seed Clinic", orgSlug: "seed-clinic" })
  const organization = await ensureOrganization(orgInput)

  const clinician = await prisma.user.upsert({
    where: { email: "dr.johnson@revenuepilot.local" },
    update: {
      name: "Dr. Sarah Johnson",
      role: "CLINICIAN"
    },
    create: {
      email: "dr.johnson@revenuepilot.local",
      name: "Dr. Sarah Johnson",
      role: "CLINICIAN"
    }
  })

  await ensureMembership({
    orgId: organization.id,
    userId: clinician.id,
    role: "CLINICIAN"
  })

  const ma = await prisma.user.upsert({
    where: { email: "ma.assistant@revenuepilot.local" },
    update: { name: "MA Assistant", role: "MA" },
    create: {
      email: "ma.assistant@revenuepilot.local",
      name: "MA Assistant",
      role: "MA"
    }
  })

  await ensureMembership({
    orgId: organization.id,
    userId: ma.id,
    role: "MA"
  })

  const patient = await prisma.patient.upsert({
    where: {
      orgId_externalId: {
        orgId: organization.id,
        externalId: "PT-2026-0156"
      }
    },
    update: {
      firstName: "Sarah",
      lastName: "Chen",
      phone: "(555) 123-4567",
      email: "sarah.chen@example.com"
    },
    create: {
      orgId: organization.id,
      externalId: createExternalPatientId(),
      firstName: "Sarah",
      lastName: "Chen",
      phone: "(555) 123-4567",
      email: "sarah.chen@example.com"
    }
  })

  const appointment = await prisma.appointment.create({
    data: {
      orgId: organization.id,
      externalId: createExternalAppointmentId(),
      patientId: patient.id,
      providerId: clinician.id,
      createdById: clinician.id,
      scheduledAt: new Date(Date.now() + 1000 * 60 * 45),
      durationMinutes: 30,
      appointmentType: "Follow-up",
      location: "Room 101",
      status: "CHECKED_IN",
      priority: "MEDIUM",
      isVirtual: false,
      notes: "Seed appointment"
    }
  })

  const encounter = await prisma.encounter.create({
    data: {
      orgId: organization.id,
      externalId: createExternalEncounterId(),
      appointmentId: appointment.id,
      patientId: patient.id,
      providerId: clinician.id,
      status: "PENDING",
      hiddenDraftCreated: new Date()
    }
  })

  const note = await prisma.note.create({
    data: {
      orgId: organization.id,
      encounterId: encounter.id,
      status: "DRAFT_HIDDEN",
      visibility: "HIDDEN",
      content: "CHIEF COMPLAINT:\nPatient reports ongoing chest discomfort with exertion.",
      patientSummary: "",
      createdById: clinician.id,
      updatedById: clinician.id
    }
  })

  await prisma.noteVersion.create({
    data: {
      orgId: organization.id,
      noteId: note.id,
      versionNumber: 1,
      source: "seed",
      content: note.content,
      patientSummary: "",
      createdById: clinician.id
    }
  })

  console.log("Seed complete", {
    clinician: clinician.email,
    appointment: appointment.externalId,
    encounter: encounter.externalId
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
