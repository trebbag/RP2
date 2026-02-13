import { z } from "zod"

const suggestionSettingsSchema = z.object({
  codes: z.boolean(),
  compliance: z.boolean(),
  publicHealth: z.boolean(),
  differentials: z.boolean(),
  followUp: z.boolean()
})

const appearanceSettingsSchema = z.object({
  theme: z.enum(["modern", "classic", "compact", "accessible"]),
  colorMode: z.enum(["light", "dark", "system"])
})

const clinicalSettingsSchema = z.object({
  specialty: z.string().min(1).max(120),
  payer: z.string().min(1).max(120),
  region: z.string().min(1).max(120),
  guidelines: z.array(z.string().min(1).max(80)).max(20)
})

const languageSettingsSchema = z.object({
  interfaceLanguage: z.string().min(2).max(8),
  summaryLanguage: z.string().min(2).max(8)
})

const templateSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  type: z.enum(["SOAP", "Wellness", "Follow-up", "Custom"]),
  content: z.string().min(1).max(30_000),
  lastModified: z.string().min(1).max(80)
})

const clinicalRuleSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  condition: z.string().min(1).max(600),
  action: z.string().min(1).max(120),
  enabled: z.boolean()
})

const advancedSettingsSchema = z.object({
  promptOverrides: z.string().max(30_000),
  isOfflineMode: z.boolean(),
  localModelsDownloaded: z.boolean()
})

const mfaPreferencesSchema = z.object({
  preferredMethod: z.enum(["totp", "backup"]).default("totp")
})

export const userSettingsSchema = z.object({
  suggestions: suggestionSettingsSchema,
  appearance: appearanceSettingsSchema,
  clinical: clinicalSettingsSchema,
  language: languageSettingsSchema,
  templates: z.array(templateSchema).max(100),
  clinicalRules: z.array(clinicalRuleSchema).max(200),
  advanced: advancedSettingsSchema,
  mfa: mfaPreferencesSchema
})

export type UserSettingsPayload = z.infer<typeof userSettingsSchema>

export const defaultUserSettings: UserSettingsPayload = {
  suggestions: {
    codes: true,
    compliance: true,
    publicHealth: false,
    differentials: true,
    followUp: true
  },
  appearance: {
    theme: "modern",
    colorMode: "system"
  },
  clinical: {
    specialty: "family-medicine",
    payer: "medicare",
    region: "us-east",
    guidelines: ["cms", "aafp"]
  },
  language: {
    interfaceLanguage: "en",
    summaryLanguage: "en"
  },
  templates: [
    {
      id: "soap-default",
      name: "Standard SOAP Note",
      type: "SOAP",
      content: "S: \nO: \nA: \nP: ",
      lastModified: "Seeded"
    },
    {
      id: "wellness-default",
      name: "Annual Wellness Visit",
      type: "Wellness",
      content:
        "Chief Complaint:\nHistory of Present Illness:\nReview of Systems:\nPhysical Examination:\nAssessment and Plan:",
      lastModified: "Seeded"
    }
  ],
  clinicalRules: [
    {
      id: "diabetes-eye-exam",
      name: "Diabetes Annual Eye Exam",
      description: "Remind for annual eye exam for diabetic patients",
      condition: "diagnosis:diabetes AND last_eye_exam > 365_days",
      action: "suggest_eye_exam_referral",
      enabled: true
    },
    {
      id: "hypertension-followup",
      name: "High Blood Pressure Follow-up",
      description: "Schedule follow-up for uncontrolled hypertension",
      condition: "bp_systolic > 140 OR bp_diastolic > 90",
      action: "suggest_followup_2weeks",
      enabled: true
    }
  ],
  advanced: {
    promptOverrides: JSON.stringify(
      {
        suggestion_context: {
          medical_specialty: "{{specialty}}",
          coding_accuracy_threshold: 0.85,
          enable_differential_analysis: true
        },
        output_formatting: {
          include_confidence_scores: true,
          max_suggestions_per_category: 5
        }
      },
      null,
      2
    ),
    isOfflineMode: false,
    localModelsDownloaded: false
  },
  mfa: {
    preferredMethod: "totp"
  }
}

export function normalizeUserSettingsPayload(payload: unknown): UserSettingsPayload {
  const merged = {
    ...defaultUserSettings,
    ...(payload && typeof payload === "object" ? payload : {})
  }

  return userSettingsSchema.parse(merged)
}
