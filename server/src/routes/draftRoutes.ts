import { Router } from "express"
import { ApiError } from "../middleware/errorHandler.js"
import { prisma } from "../lib/prisma.js"
import { requireRole } from "../middleware/auth.js"

function toVisitType(appointmentType: string): "SOAP" | "Wellness" | "Follow-up" | "Consultation" {
  if (appointmentType === "Wellness") return "Wellness"
  if (appointmentType === "Follow-up") return "Follow-up"
  if (appointmentType === "Consultation") return "Consultation"
  return "SOAP"
}

export const draftRoutes = Router()
draftRoutes.use(requireRole(["ADMIN", "MA", "CLINICIAN"]))

draftRoutes.get("/", async (_req, res, next) => {
  try {
    const notes = await prisma.note.findMany({
      include: {
        encounter: {
          include: {
            appointment: true,
            patient: true,
            provider: true
          }
        },
        exportArtifacts: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    })

    const now = Date.now()

    const drafts = notes.map((note) => {
      const encounter = note.encounter
      const appointment = encounter.appointment
      const patient = encounter.patient
      const lastEdit = note.updatedAt
      const daysOld = Math.max(0, Math.floor((now - lastEdit.getTime()) / (1000 * 60 * 60 * 24)))

      const notePdfArtifact = note.exportArtifacts.find((artifact) => artifact.type === "NOTE_PDF")
      const summaryPdfArtifact = note.exportArtifacts.find((artifact) => artifact.type === "PATIENT_SUMMARY_PDF")

      return {
        id: note.id,
        patientId: patient.externalId,
        encounterId: encounter.externalId,
        patientName: `${patient.firstName} ${patient.lastName}`.trim(),
        visitDate: appointment?.scheduledAt.toISOString() ?? note.createdAt.toISOString(),
        lastEditDate: lastEdit.toISOString(),
        daysOld,
        provider: encounter.provider?.name ?? "Unassigned",
        visitType: toVisitType(appointment?.appointmentType ?? "SOAP"),
        completionStatus: Math.min(100, Math.round((note.content.length / 1800) * 100)),
        urgency: appointment?.priority.toLowerCase() ?? "medium",
        noteLength: note.content.length,
        lastEditor: encounter.provider?.name ?? "Unknown",
        status: note.status,
        isFinal: note.status === "FINAL",
        notePdfArtifactId: notePdfArtifact?.id ?? null,
        summaryPdfArtifactId: summaryPdfArtifact?.id ?? null
      }
    })

    res.status(200).json({ drafts })
  } catch (error) {
    next(error)
  }
})

draftRoutes.get("/:draftId", async (req, res, next) => {
  try {
    const draft = await prisma.note.findFirst({
      where: {
        OR: [{ id: req.params.draftId }]
      },
      include: {
        encounter: {
          include: {
            patient: true,
            appointment: true,
            provider: true
          }
        },
        versions: {
          orderBy: { versionNumber: "desc" }
        },
        exportArtifacts: true
      }
    })

    if (!draft) {
      throw new ApiError(404, "Draft not found")
    }

    res.status(200).json({
      draft: {
        id: draft.id,
        encounterId: draft.encounter.externalId,
        patientId: draft.encounter.patient.externalId,
        patientName: `${draft.encounter.patient.firstName} ${draft.encounter.patient.lastName}`,
        status: draft.status,
        visibility: draft.visibility,
        content: draft.content,
        patientSummary: draft.patientSummary,
        versions: draft.versions,
        exportArtifacts: draft.exportArtifacts,
        updatedAt: draft.updatedAt
      }
    })
  } catch (error) {
    next(error)
  }
})
