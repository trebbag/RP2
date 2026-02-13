import fs from "node:fs/promises"
import path from "node:path"
import { Router } from "express"
import multer from "multer"
import { z } from "zod"
import { AppointmentPriority, AppointmentStatus, ArtifactType, type UserRole } from "@prisma/client"
import { env } from "../config/env.js"
import { prisma } from "../lib/prisma.js"
import { ApiError } from "../middleware/errorHandler.js"
import type { AuthenticatedRequest } from "../types.js"
import { createExternalAppointmentId, createExternalEncounterId, createExternalPatientId } from "../utils/id.js"
import { ensureDir } from "../utils/fs.js"
import { writeAuditLog } from "../middleware/audit.js"
import { extractStructuredChart, persistStructuredChart } from "../services/chartExtractionService.js"
import { requireRole } from "../middleware/auth.js"

const appointmentCreateSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().min(2),
  patientPhone: z.string().optional(),
  patientEmail: z.string().email().optional(),
  appointmentTime: z.string().datetime(),
  duration: z.number().int().positive().max(240).default(30),
  appointmentType: z.string().min(2).default("Follow-up"),
  provider: z.string().optional(),
  location: z.string().default("Room 101"),
  notes: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  isVirtual: z.boolean().default(false)
})

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.resolve(env.STORAGE_DIR, "uploads")
    await ensureDir(uploadDir)
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")
    cb(null, `${Date.now()}-${safeName}`)
  }
})

const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024, files: 5 } })

function splitName(name: string): { firstName: string; lastName: string } {
  const tokens = name.trim().split(/\s+/)
  if (tokens.length === 1) {
    return { firstName: tokens[0] ?? "Patient", lastName: "Unknown" }
  }

  const firstName = tokens.shift() ?? "Patient"
  const lastName = tokens.join(" ") || "Unknown"
  return { firstName, lastName }
}

async function resolveProvider(providerName: string | undefined, fallbackUserId: string) {
  if (!providerName) {
    return fallbackUserId
  }

  const email = `${providerName.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@revenuepilot.local`

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: providerName },
    create: {
      email,
      name: providerName,
      role: "CLINICIAN" as UserRole
    }
  })

  return user.id
}

async function resolveAppointment(appointmentId: string) {
  return prisma.appointment.findFirst({
    where: {
      OR: [{ id: appointmentId }, { externalId: appointmentId }]
    },
    include: {
      patient: true,
      encounter: {
        include: {
          note: true
        }
      },
      provider: true
    }
  })
}

interface AppointmentRecordLike {
  externalId: string
  scheduledAt: Date
  durationMinutes: number
  appointmentType: string
  location: string | null
  status: AppointmentStatus
  priority: AppointmentPriority
  isVirtual: boolean
  notes: string | null
  patient: {
    externalId: string
    firstName: string
    lastName: string
    phone: string | null
    email: string | null
  }
  encounter?: {
    externalId: string
  } | null
  provider?: {
    name: string
  } | null
}

function mapAppointmentForClient(record: AppointmentRecordLike | null) {
  if (!record) return null

  return {
    id: record.externalId,
    patientId: record.patient.externalId,
    encounterId: record.encounter?.externalId,
    patientName: `${record.patient.firstName} ${record.patient.lastName}`.trim(),
    patientPhone: record.patient.phone ?? "",
    patientEmail: record.patient.email ?? "",
    appointmentTime: record.scheduledAt.toISOString(),
    duration: record.durationMinutes,
    appointmentType: record.appointmentType,
    provider: record.provider?.name ?? "Unassigned",
    location: record.location ?? "",
    status:
      record.status === "CHECKED_IN"
        ? "Checked In"
        : record.status === "IN_PROGRESS"
          ? "In Progress"
          : record.status === "NO_SHOW"
            ? "No Show"
            : record.status.charAt(0) + record.status.slice(1).toLowerCase(),
    notes: record.notes ?? "",
    fileUpToDate: record.encounter ? true : false,
    priority: record.priority.toLowerCase(),
    isVirtual: record.isVirtual
  }
}

export const appointmentRoutes = Router()
appointmentRoutes.use(requireRole(["ADMIN", "MA", "CLINICIAN"]))

appointmentRoutes.get("/", async (_req, res, next) => {
  try {
    const records = await prisma.appointment.findMany({
      orderBy: { scheduledAt: "asc" },
      include: {
        patient: true,
        encounter: true,
        provider: true
      }
    })

    const mapped = records
      .map((record) =>
        mapAppointmentForClient({
          ...record,
          patient: record.patient,
          encounter: record.encounter
        })
      )
      .filter(Boolean)

    res.status(200).json({ appointments: mapped })
  } catch (error) {
    next(error)
  }
})

appointmentRoutes.post("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const payload = appointmentCreateSchema.parse(req.body)
    const patientNames = splitName(payload.patientName)
    const externalPatientId = payload.patientId ?? createExternalPatientId()

    const providerId = await resolveProvider(payload.provider, authReq.user.id)

    const patient = await prisma.patient.upsert({
      where: { externalId: externalPatientId },
      update: {
        firstName: patientNames.firstName,
        lastName: patientNames.lastName,
        phone: payload.patientPhone,
        email: payload.patientEmail
      },
      create: {
        externalId: externalPatientId,
        firstName: patientNames.firstName,
        lastName: patientNames.lastName,
        phone: payload.patientPhone,
        email: payload.patientEmail
      }
    })

    const created = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          externalId: createExternalAppointmentId(),
          patientId: patient.id,
          providerId,
          createdById: authReq.user.id,
          scheduledAt: new Date(payload.appointmentTime),
          durationMinutes: payload.duration,
          appointmentType: payload.appointmentType,
          location: payload.location,
          status: AppointmentStatus.SCHEDULED,
          priority:
            payload.priority === "high"
              ? AppointmentPriority.HIGH
              : payload.priority === "low"
                ? AppointmentPriority.LOW
                : AppointmentPriority.MEDIUM,
          isVirtual: payload.isVirtual,
          notes: payload.notes
        }
      })

      const encounter = await tx.encounter.create({
        data: {
          externalId: createExternalEncounterId(new Date(payload.appointmentTime)),
          appointmentId: appointment.id,
          patientId: patient.id,
          providerId,
          status: "PENDING",
          hiddenDraftCreated: new Date()
        }
      })

      const note = await tx.note.create({
        data: {
          encounterId: encounter.id,
          status: "DRAFT_HIDDEN",
          visibility: "HIDDEN",
          content: "",
          patientSummary: "",
          createdById: authReq.user.id,
          updatedById: authReq.user.id
        }
      })

      await tx.noteVersion.create({
        data: {
          noteId: note.id,
          versionNumber: 1,
          source: "appointment-create",
          content: "",
          patientSummary: "",
          createdById: authReq.user.id
        }
      })

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          patient: true,
          encounter: true,
          provider: true
        }
      })
    })

    await writeAuditLog({
      req,
      res,
      action: "create",
      entity: "appointment",
      entityId: created.id,
      encounterId: created.encounter?.id,
      details: {
        patientId: created.patient.externalId,
        encounterExternalId: created.encounter?.externalId
      }
    })

    res.status(201).json({ appointment: mapAppointmentForClient(created) })
  } catch (error) {
    next(error)
  }
})

appointmentRoutes.post("/:appointmentId/chart", upload.array("files", 5), async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest
    const appointment = await resolveAppointment(req.params.appointmentId)
    if (!appointment) {
      throw new ApiError(404, "Appointment not found")
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? []
    if (files.length === 0) {
      throw new ApiError(400, "At least one chart file is required")
    }

    const encounterId = appointment.encounter?.id
    const chartDir = path.resolve(env.STORAGE_DIR, "charts", appointment.externalId)
    await ensureDir(chartDir)

    const createdAssets = [] as Array<{
      id: string
      fileName: string
      extractedJson: Record<string, unknown>
    }>

    for (const file of files) {
      const destinationPath = path.resolve(chartDir, file.filename)
      await fs.rename(file.path, destinationPath)
      const extraction = await extractStructuredChart({
        filePath: destinationPath,
        fileName: file.originalname,
        mimeType: file.mimetype,
        patientId: appointment.patient.externalId,
        encounterId: appointment.encounter?.externalId
      })

      const structuredFileName = `${path.parse(file.filename).name}.structured.json`
      const structuredPath = path.resolve(chartDir, structuredFileName)
      const structuredSizeBytes = await persistStructuredChart(structuredPath, extraction.extractedJson)

      const asset = await prisma.chartAsset.create({
        data: {
          appointmentId: appointment.id,
          encounterId,
          patientId: appointment.patient.id,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storagePath: destinationPath,
          extractedJson: extraction.extractedJson as never,
          rawText: extraction.rawText,
          createdById: authReq.user.id
        }
      })

      if (appointment.encounter) {
        await prisma.exportArtifact.create({
          data: {
            encounterId: appointment.encounter.id,
            noteId: appointment.encounter.note?.id,
            type: ArtifactType.STRUCTURED_CHART_JSON,
            filePath: structuredPath,
            mimeType: "application/json",
            fileName: structuredFileName,
            sizeBytes: structuredSizeBytes,
            createdById: authReq.user.id
          }
        })
      }

      createdAssets.push({
        id: asset.id,
        fileName: file.originalname,
        extractedJson: extraction.extractedJson as unknown as Record<string, unknown>
      })
    }

    await writeAuditLog({
      req,
      res,
      action: "upload",
      entity: "chart",
      entityId: appointment.id,
      encounterId,
      details: {
        files: createdAssets.map((file) => file.fileName)
      }
    })

    res.status(201).json({
      uploaded: createdAssets,
      count: createdAssets.length,
      encounterId: appointment.encounter?.externalId
    })
  } catch (error) {
    next(error)
  }
})
