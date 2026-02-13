import { PrismaClient } from "@prisma/client"
import { createExternalAppointmentId, createExternalEncounterId, createExternalPatientId } from "../src/utils/id.js"

const prisma = new PrismaClient()

async function main() {
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

  await prisma.user.upsert({
    where: { email: "ma.assistant@revenuepilot.local" },
    update: { name: "MA Assistant", role: "MA" },
    create: {
      email: "ma.assistant@revenuepilot.local",
      name: "MA Assistant",
      role: "MA"
    }
  })

  const patient = await prisma.patient.upsert({
    where: { externalId: "PT-2026-0156" },
    update: {
      firstName: "Sarah",
      lastName: "Chen",
      phone: "(555) 123-4567",
      email: "sarah.chen@example.com"
    },
    create: {
      externalId: createExternalPatientId(),
      firstName: "Sarah",
      lastName: "Chen",
      phone: "(555) 123-4567",
      email: "sarah.chen@example.com"
    }
  })

  const appointment = await prisma.appointment.create({
    data: {
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
