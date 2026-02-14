const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000"

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  headers?: Record<string, string>
}

export interface AuthUserRecord {
  id: string
  email: string
  name: string
  role: "ADMIN" | "MA" | "CLINICIAN"
  orgId?: string
  orgName?: string | null
  orgSlug?: string | null
  mfaEnabled?: boolean
}

export interface AuthPolicyRecord {
  authMode: "local" | "oidc"
  passwordMinLength: number
  mfaRequired: boolean
  allowDevLogin: boolean
}

export interface AuthBootstrapStatusRecord {
  hasUsers: boolean
}

export interface TemplateRecord {
  id: string
  name: string
  type: "SOAP" | "Wellness" | "Follow-up" | "Custom"
  content: string
  lastModified: string
}

export interface ClinicalRuleRecord {
  id: string
  name: string
  description: string
  condition: string
  action: string
  enabled: boolean
}

export interface UserSettingsRecord {
  suggestions: {
    codes: boolean
    compliance: boolean
    publicHealth: boolean
    differentials: boolean
    followUp: boolean
  }
  appearance: {
    theme: "modern" | "classic" | "compact" | "accessible"
    colorMode: "light" | "dark" | "system"
  }
  clinical: {
    specialty: string
    payer: string
    region: string
    guidelines: string[]
  }
  language: {
    interfaceLanguage: string
    summaryLanguage: string
  }
  templates: TemplateRecord[]
  clinicalRules: ClinicalRuleRecord[]
  advanced: {
    promptOverrides: string
    isOfflineMode: boolean
    localModelsDownloaded: boolean
  }
  mfa: {
    preferredMethod: "totp" | "backup"
  }
}

export class ApiAuthError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = "ApiAuthError"
    this.status = status
    this.payload = payload
  }
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const makeRequest = async (authToken: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers ?? {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })

  let token = window.localStorage.getItem("rp_token")
  let response = await makeRequest(token)

  if (response.status === 401) {
    try {
      await refreshSessionToken()
      token = window.localStorage.getItem("rp_token")
      response = await makeRequest(token)
    } catch {
      // no-op; keep original 401 response semantics below
    }
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API ${response.status}: ${text || response.statusText}`)
  }

  return response.json() as Promise<T>
}

export async function ensureDevSession(options?: { forceDevLogin?: boolean }) {
  const existingToken = window.localStorage.getItem("rp_token")
  if (existingToken) return

  const allowDevLoginFlag = (import.meta.env.VITE_ALLOW_DEV_LOGIN as string | undefined) ?? "false"
  const shouldUseDevLogin = options?.forceDevLogin ? true : import.meta.env.DEV && allowDevLoginFlag !== "false"
  if (!shouldUseDevLogin) {
    await refreshSessionToken()
    return
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/dev-login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "demo.clinician@revenuepilot.local",
      name: "Demo Clinician",
      role: "CLINICIAN"
    })
  })

  if (!response.ok) {
    throw new Error(`Dev login failed (${response.status})`)
  }

  const payload = (await response.json()) as { token: string }
  window.localStorage.setItem("rp_token", payload.token)
}

export async function fetchAuthPolicy() {
  const response = await fetch(`${API_BASE_URL}/api/auth/policy`, {
    method: "GET",
    credentials: "include"
  })

  if (!response.ok) {
    throw new Error(`Policy request failed (${response.status})`)
  }

  return (await response.json()) as { policy: AuthPolicyRecord }
}

export function startOidcLogin(options?: { returnTo?: string }) {
  const returnTo = options?.returnTo ?? window.location.href
  window.localStorage.removeItem("rp_token")
  const url = `${API_BASE_URL}/api/auth/oidc/login?returnTo=${encodeURIComponent(returnTo)}`
  window.location.assign(url)
}

export async function fetchBootstrapStatus() {
  const response = await fetch(`${API_BASE_URL}/api/auth/bootstrap-status`, {
    method: "GET",
    credentials: "include"
  })

  if (!response.ok) {
    throw new Error(`Bootstrap status request failed (${response.status})`)
  }

  return (await response.json()) as AuthBootstrapStatusRecord
}

export async function registerFirstUser(input: {
  email: string
  name: string
  password: string
  role?: "ADMIN" | "MA" | "CLINICIAN"
}) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register-first`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      ...input,
      role: input.role ?? "ADMIN"
    })
  })

  if (!response.ok) {
    const rawBody = await response.text()
    let parsed: unknown = rawBody
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      parsed = rawBody
    }
    throw new ApiAuthError(`Bootstrap registration failed (${response.status})`, response.status, parsed)
  }

  const payload = (await response.json()) as { token: string; user: AuthUserRecord }
  window.localStorage.setItem("rp_token", payload.token)
  return payload
}

export async function loginWithPassword(input: {
  email: string
  password: string
  mfaCode?: string
  backupCode?: string
}) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(input)
  })

  if (!response.ok) {
    const rawBody = await response.text()
    let parsed: unknown = rawBody
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      parsed = rawBody
    }
    throw new ApiAuthError(`Login failed (${response.status})`, response.status, parsed)
  }

  const payload = (await response.json()) as { token: string; user: AuthUserRecord }
  window.localStorage.setItem("rp_token", payload.token)
  return payload
}

export async function refreshSessionToken() {
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({})
  })

  if (!response.ok) {
    throw new Error(`Refresh failed (${response.status})`)
  }

  const payload = (await response.json()) as { token: string }
  window.localStorage.setItem("rp_token", payload.token)
  return payload
}

export async function logoutSession() {
  const token = window.localStorage.getItem("rp_token")
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: "include",
    body: JSON.stringify({})
  })
  window.localStorage.removeItem("rp_token")
}

export async function fetchCurrentUser() {
  return request<{ user: AuthUserRecord }>("/api/auth/me")
}

export async function setupMfa() {
  return request<{
    setup: {
      secret: string
      otpAuthUrl: string
      issuer: string
    }
  }>("/api/auth/mfa/setup", {
    method: "POST",
    body: {}
  })
}

export async function startMfaEnrollment(email: string, password: string) {
  return request<{
    enrollmentToken: string
    setup: {
      secret: string
      otpAuthUrl: string
      issuer: string
    }
  }>("/api/auth/mfa/enroll/start", {
    method: "POST",
    body: { email, password }
  })
}

export async function completeMfaEnrollment(enrollmentToken: string, mfaCode: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/mfa/enroll/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ enrollmentToken, mfaCode })
  })

  if (!response.ok) {
    const raw = await response.text()
    let parsed: unknown = raw
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = raw
    }
    throw new ApiAuthError(`MFA enrollment complete failed (${response.status})`, response.status, parsed)
  }

  const payload = (await response.json()) as {
    token: string
    user: AuthUserRecord
    backupCodes: string[]
  }
  window.localStorage.setItem("rp_token", payload.token)
  return payload
}

export async function enableMfa(mfaCode: string) {
  return request<{
    enabled: boolean
    backupCodes: string[]
  }>("/api/auth/mfa/enable", {
    method: "POST",
    body: { mfaCode }
  })
}

export async function regenerateMfaBackupCodes(mfaCode: string) {
  return request<{
    backupCodes: string[]
  }>("/api/auth/mfa/backup-codes/regenerate", {
    method: "POST",
    body: { mfaCode }
  })
}

export async function disableMfa(body: { mfaCode?: string; backupCode?: string }) {
  return request<{ enabled: boolean }>("/api/auth/mfa/disable", {
    method: "POST",
    body
  })
}

export async function fetchUserSettings() {
  return request<{
    settings: UserSettingsRecord
    updatedAt: string | null
  }>("/api/settings/me")
}

export async function updateUserSettings(settings: UserSettingsRecord) {
  return request<{
    settings: UserSettingsRecord
    updatedAt: string
  }>("/api/settings/me", {
    method: "PUT",
    body: { settings }
  })
}

export interface AppointmentRecord {
  id: string
  patientId: string
  encounterId?: string
  patientName: string
  patientPhone: string
  patientEmail: string
  appointmentTime: string
  duration: number
  appointmentType: string
  provider: string
  location: string
  status: string
  notes: string
  fileUpToDate: boolean
  priority: "low" | "medium" | "high"
  isVirtual: boolean
}

export interface DraftRecord {
  id: string
  patientId: string
  encounterId: string
  patientName: string
  visitDate: string
  lastEditDate: string
  daysOld: number
  provider: string
  visitType: "SOAP" | "Wellness" | "Follow-up" | "Consultation"
  completionStatus: number
  urgency: "low" | "medium" | "high"
  noteLength: number
  lastEditor: string
  status: "DRAFT_HIDDEN" | "DRAFT_ACTIVE" | "FINAL"
  isFinal: boolean
  notePdfArtifactId?: string | null
  summaryPdfArtifactId?: string | null
}

export interface CodeSuggestionRecord {
  id: string
  encounterId: string
  generationId: string
  code: string
  codeType: string
  category: "CODE" | "DIAGNOSIS" | "DIFFERENTIAL" | "PREVENTION"
  title: string
  description: string
  rationale: string
  confidence: number
  evidence?: string[]
  status: "SUGGESTED" | "SELECTED" | "REJECTED" | "REMOVED"
}

export async function fetchAppointments(): Promise<AppointmentRecord[]> {
  const data = await request<{ appointments: AppointmentRecord[] }>("/api/appointments")
  return data.appointments
}

export async function uploadChartFiles(appointmentId: string, files: File[]): Promise<void> {
  const token = window.localStorage.getItem("rp_token")
  const formData = new FormData()
  files.forEach((file) => formData.append("files", file))

  const response = await fetch(`${API_BASE_URL}/api/appointments/${appointmentId}/chart`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData
  })

  if (!response.ok) {
    throw new Error(`Chart upload failed (${response.status})`)
  }
}

export async function startEncounter(encounterId: string) {
  return request<{ encounterId: string; status: string }>(`/api/encounters/${encounterId}/start`, {
    method: "POST",
    body: {}
  })
}

export async function stopEncounter(encounterId: string, mode: "pause" | "stop" = "pause") {
  return request<{ encounterId: string; status: string }>(`/api/encounters/${encounterId}/stop`, {
    method: "POST",
    body: { mode }
  })
}

export async function saveEncounterNote(encounterId: string, content: string, patientSummary?: string) {
  return request<{ note: { id: string; updatedAt: string } }>(`/api/encounters/${encounterId}/note`, {
    method: "POST",
    body: { content, patientSummary }
  })
}

export async function fetchDrafts(): Promise<DraftRecord[]> {
  const data = await request<{ drafts: DraftRecord[] }>("/api/drafts")
  return data.drafts
}

export async function fetchDraft(draftId: string) {
  return request<{
    draft: {
      id: string
      encounterId: string
      patientId: string
      patientName: string
      status: string
      visibility: string
      content: string
      patientSummary: string
    }
  }>(`/api/drafts/${draftId}`)
}

export async function refreshSuggestions(
  encounterId: string,
  body: {
    noteContent?: string
    trigger?: "manual" | "delta"
    noteDeltaChars?: number
    transcriptDeltaChars?: number
    secondsSinceLastRefresh?: number
  } = {}
) {
  return request<{
    skipped?: boolean
    reason?: string
    generationId?: string
    suggestions?: CodeSuggestionRecord[]
  }>(`/api/encounters/${encounterId}/suggestions/refresh`, {
    method: "POST",
    body: {
      trigger: body.trigger ?? "manual",
      noteContent: body.noteContent ?? "",
      noteDeltaChars: body.noteDeltaChars ?? 0,
      transcriptDeltaChars: body.transcriptDeltaChars ?? 0,
      secondsSinceLastRefresh: body.secondsSinceLastRefresh ?? 0
    }
  })
}

export interface TranscriptSegmentRecord {
  id?: string
  speaker: string
  speakerLabel?: string
  text: string
  startMs: number
  endMs: number
  confidence?: number
  createdAt?: string
}

export interface TranscriptQualityIssueRecord {
  code: "LOW_CONFIDENCE" | "UNKNOWN_SPEAKER" | "VERY_SHORT_SEGMENT" | "CHATTER_SWITCHING"
  severity: "critical" | "warning" | "info"
  message: string
  segmentId?: string
}

export interface TranscriptQualityReportRecord {
  score: number
  needsReview: boolean
  metrics: {
    segmentCount: number
    lowConfidenceCount: number
    unknownSpeakerCount: number
    veryShortSegmentCount: number
    avgConfidence: number
    speakerSwitchRate: number
  }
  issues: TranscriptQualityIssueRecord[]
  recommendedActions: string[]
}

export async function appendTranscriptSegment(encounterId: string, segment: TranscriptSegmentRecord) {
  return request<{ segment: TranscriptSegmentRecord }>(`/api/encounters/${encounterId}/transcript/segments`, {
    method: "POST",
    body: segment
  })
}

export async function fetchTranscriptQuality(encounterId: string) {
  return request<{
    encounterId: string
    report: TranscriptQualityReportRecord
  }>(`/api/encounters/${encounterId}/transcript/quality`)
}

export async function correctTranscriptSegment(
  encounterId: string,
  segmentId: string,
  body: {
    speaker?: string
    speakerLabel?: string
    text?: string
    reason?: string
  }
) {
  return request<{
    segment: TranscriptSegmentRecord
    qualityReport: TranscriptQualityReportRecord
  }>(`/api/encounters/${encounterId}/transcript/segments/${segmentId}/correct`, {
    method: "POST",
    body
  })
}

export async function uploadTranscriptAudio(
  encounterId: string,
  audioBlob: Blob,
  options?: {
    speakerHint?: string
    sessionElapsedMs?: number
    chunkDurationMs?: number
  }
) {
  const token = window.localStorage.getItem("rp_token")
  const form = new FormData()
  const extension = audioBlob.type.includes("webm") ? "webm" : audioBlob.type.includes("wav") ? "wav" : "audio"
  form.append("audio", audioBlob, `chunk-${Date.now()}.${extension}`)

  if (options?.speakerHint) form.append("speakerHint", options.speakerHint)
  if (typeof options?.sessionElapsedMs === "number") form.append("sessionElapsedMs", String(options.sessionElapsedMs))
  if (typeof options?.chunkDurationMs === "number") form.append("chunkDurationMs", String(options.chunkDurationMs))

  const response = await fetch(`${API_BASE_URL}/api/encounters/${encounterId}/transcript/audio`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: form
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Audio transcription failed (${response.status}): ${text || "Unknown error"}`)
  }

  return response.json() as Promise<{
    accepted: boolean
    provider: "openai" | "offlineMock" | "fallback"
    transcriptText: string
    warnings?: string[]
    segments: TranscriptSegmentRecord[]
    qualityReport?: TranscriptQualityReportRecord
  }>
}

type StreamHandlers = {
  onConnected?: (payload: { encounterId: string; segments?: TranscriptSegmentRecord[] }) => void
  onSegment?: (segment: TranscriptSegmentRecord) => void
  onSegmentCorrected?: (segment: TranscriptSegmentRecord) => void
  onQuality?: (report: TranscriptQualityReportRecord) => void
  onStatus?: (payload: { encounterId: string; status: string }) => void
  onError?: (error: Event) => void
}

async function postTranscriptStreamMetric(
  encounterId: string,
  body: {
    event: "connected" | "reconnect_attempt" | "reconnect_success" | "reconnect_failed"
    attempt?: number
    backoffMs?: number
    jitterMs?: number
    connectionUptimeMs?: number
    reason?: string
    clientId?: string
  }
) {
  try {
    await request(`/api/encounters/${encounterId}/transcript/stream-metrics`, {
      method: "POST",
      body
    })
  } catch {
    // No-op. Stream metrics should never block the transcript experience.
  }
}

export function streamEncounterTranscript(encounterId: string, handlers: StreamHandlers): () => void {
  let source: EventSource | null = null
  let reconnectAttempts = 0
  let reconnectTimer: number | null = null
  let closedByClient = false
  const streamClientId = `sse-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  let currentConnectionStartedAt = 0

  const connect = () => {
    if (closedByClient) return
    currentConnectionStartedAt = Date.now()

    const token = window.localStorage.getItem("rp_token")
    const params = new URLSearchParams({
      clientId: streamClientId
    })
    if (token) {
      params.set("access_token", token)
    }

    source = new EventSource(`${API_BASE_URL}/api/encounters/${encounterId}/transcript/stream?${params.toString()}`)

    source.addEventListener("open", () => {
      const uptime = Date.now() - currentConnectionStartedAt
      void postTranscriptStreamMetric(encounterId, {
        event: reconnectAttempts > 0 ? "reconnect_success" : "connected",
        attempt: reconnectAttempts,
        connectionUptimeMs: uptime,
        clientId: streamClientId
      })
      reconnectAttempts = 0
    })

    source.addEventListener("connected", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        encounterId: string
        segments?: TranscriptSegmentRecord[]
      }
      handlers.onConnected?.(payload)
    })

    source.addEventListener("transcript.segment", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TranscriptSegmentRecord
      handlers.onSegment?.(payload)
    })

    source.addEventListener("transcript.segment.corrected", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TranscriptSegmentRecord
      handlers.onSegmentCorrected?.(payload)
    })

    source.addEventListener("transcript.quality", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TranscriptQualityReportRecord
      handlers.onQuality?.(payload)
    })

    source.addEventListener("encounter.status", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { encounterId: string; status: string }
      handlers.onStatus?.(payload)
    })

    source.onerror = (error) => {
      handlers.onError?.(error)
      source?.close()

      if (closedByClient) return

      reconnectAttempts += 1
      const exponentialBackoffMs = Math.min(15_000, 500 * 2 ** Math.min(reconnectAttempts, 6))
      const jitterMs = Math.floor(Math.random() * 450)
      const backoffMs = exponentialBackoffMs + jitterMs
      const connectionUptimeMs = Math.max(0, Date.now() - currentConnectionStartedAt)
      void postTranscriptStreamMetric(encounterId, {
        event: "reconnect_attempt",
        attempt: reconnectAttempts,
        backoffMs,
        jitterMs,
        connectionUptimeMs,
        reason: "eventsource_error",
        clientId: streamClientId
      })

      reconnectTimer = window.setTimeout(() => {
        connect()
      }, backoffMs)

      if (reconnectAttempts >= 8) {
        void postTranscriptStreamMetric(encounterId, {
          event: "reconnect_failed",
          attempt: reconnectAttempts,
          backoffMs,
          jitterMs,
          reason: "max_attempts_exceeded_soft",
          clientId: streamClientId
        })
      }
    }
  }

  connect()

  return () => {
    closedByClient = true
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    source?.close()
  }
}

export interface ComplianceIssueRecord {
  id: string
  severity: "CRITICAL" | "WARNING" | "INFO"
  status: "ACTIVE" | "DISMISSED" | "RESOLVED"
  title: string
  description: string
  rationale: string
  remediation: string
  evidence?: string[]
  createdAt: string
}

export async function fetchCompliance(encounterId: string) {
  return request<{ issues: ComplianceIssueRecord[] }>(`/api/encounters/${encounterId}/compliance`)
}

export async function updateComplianceStatus(
  encounterId: string,
  issueId: string,
  status: "ACTIVE" | "DISMISSED" | "RESOLVED",
  reason?: string
) {
  return request<{ issue: ComplianceIssueRecord }>(`/api/encounters/${encounterId}/compliance/${issueId}/status`, {
    method: "POST",
    body: { status, reason }
  })
}

export async function composeWizard(encounterId: string, noteContent?: string) {
  return request<{
    traceId: string
    enhancedNote: string
    patientSummary: string
    stages: Array<{ id: number; title: string; status: "pending" | "in-progress" | "completed" }>
  }>(`/api/wizard/${encounterId}/compose`, {
    method: "POST",
    body: { noteContent }
  })
}

export async function rebeautifyWizard(encounterId: string, noteContent?: string) {
  return request<{
    traceId: string
    enhancedNote: string
    patientSummary: string
  }>(`/api/wizard/${encounterId}/rebeautify`, {
    method: "POST",
    body: { noteContent }
  })
}

export async function wizardStepAction(
  encounterId: string,
  step: number,
  action: {
    actionType: "keep" | "remove" | "move_to_diagnosis" | "move_to_differential" | "add_from_suggestion"
    suggestionId?: string
    code?: string
    codeType?: string
    category?: "CODE" | "DIAGNOSIS" | "DIFFERENTIAL" | "PREVENTION"
    reason?: string
  }
) {
  return request<{ stepState: { id: string } }>(`/api/wizard/${encounterId}/step/${step}/actions`, {
    method: "POST",
    body: action
  })
}

export async function fetchWizardState(encounterId: string) {
  return request<{
    state: {
      encounterId: string
      suggestedStep: number
      runId: string | null
      runStatus: string | null
      stepStates: Array<{
        id: string
        step: string
        status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED"
        payload?: Record<string, unknown>
      }>
      decisions: Array<{
        code: string
        action: "KEEP" | "REMOVE" | "MOVE_TO_DIAGNOSIS" | "MOVE_TO_DIFFERENTIAL" | "ADD_FROM_SUGGESTION"
        category: string
        codeType: string
        createdAt: string
      }>
      note: {
        content: string
        patientSummary: string
        status: string
      }
      latestComposeVersion: null | {
        versionNumber: number
        source: string
        traceId: string | null
        content: string
        patientSummary: string
      }
      exportArtifacts: Array<{ id: string; type: string; fileName: string }>
    }
  }>(`/api/wizard/${encounterId}/state`)
}

export async function finalizeWizard(
  encounterId: string,
  body: {
    finalNote: string
    finalPatientSummary: string
    attestClinicalAccuracy?: boolean
    attestBillingAccuracy?: boolean
    payerModel?: string
    monthlyRevenueCents?: number
    expectedCoderLiftPct?: number
    deductibleRemainingCents?: number
    coinsurancePct?: number
    copayCents?: number
  }
) {
  return request<{
    status: string
    artifacts: Array<{ id: string; type: "NOTE_PDF" | "PATIENT_SUMMARY_PDF" }>
    dispatch?: {
      jobId: string
      status: string
      attemptCount: number
      nextRetryAt?: string | null
      lastError?: string | null
    } | null
    billing: {
      payerModel: string
      feeScheduleVersion: string
      feeSchedulePackVersion: string
      feeScheduleApprovedBy: string
      feeScheduleApprovedAt: string
      feeScheduleSource: string
      allowedAmountCents: number
      deductibleAppliedCents: number
      copayCents: number
      coinsuranceCents: number
      estimatedChargeCents: number
      outOfPocketCents: number
      expectedReimbursementCents: number
      projectedRevenueDeltaCents: number
    }
  }>(`/api/wizard/${encounterId}/finalize`, {
    method: "POST",
    body: {
      ...body,
      attestClinicalAccuracy: body.attestClinicalAccuracy ?? true,
      attestBillingAccuracy: body.attestBillingAccuracy ?? true
    }
  })
}

export async function previewBillingWizard(
  encounterId: string,
  body?: {
    payerModel?: string
    monthlyRevenueCents?: number
    expectedCoderLiftPct?: number
    deductibleRemainingCents?: number
    coinsurancePct?: number
    copayCents?: number
  }
) {
  return request<{
    billing: {
      payerModel: string
      feeScheduleVersion: string
      feeSchedulePackVersion: string
      feeScheduleApprovedBy: string
      feeScheduleApprovedAt: string
      feeScheduleSource: string
      selectedCptCodes: string[]
      allowedAmountCents: number
      deductibleAppliedCents: number
      copayCents: number
      coinsuranceCents: number
      estimatedChargeCents: number
      outOfPocketCents: number
      expectedReimbursementCents: number
      projectedRevenueDeltaCents: number
    }
  }>(`/api/wizard/${encounterId}/billing-preview`, {
    method: "POST",
    body: body ?? {}
  })
}

export function buildExportUrl(artifactId: string): string {
  return `${API_BASE_URL}/api/exports/${artifactId}`
}

export interface DispatchJobRecord {
  id: string
  encounterId: string
  target: "FHIR_R4" | "HL7_V2" | "VENDOR_API" | "NONE"
  contractType?: string | null
  status: "PENDING" | "RETRYING" | "DISPATCHED" | "FAILED" | "DEAD_LETTER"
  attemptCount: number
  maxAttempts: number
  nextRetryAt?: string | null
  dispatchedAt?: string | null
  deadLetteredAt?: string | null
  externalMessageId?: string | null
  lastError?: string | null
  updatedAt: string
  createdAt: string
}

export interface ActivityRecord {
  id: string
  timestamp: string
  action: string
  category: "documentation" | "schedule" | "settings" | "auth" | "system" | "backend"
  description: string
  userId: string
  userName: string
  severity: "info" | "warning" | "error" | "success"
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export interface ActivityPageInfo {
  requestedLimit: number
  returned: number
  hasMore: boolean
  nextCursor: string | null
  scannedRows: number
}

export async function fetchActivityEntries(params?: {
  limit?: number
  search?: string
  category?: ActivityRecord["category"] | "all"
  severity?: ActivityRecord["severity"] | "all"
  includeBackend?: boolean
  from?: string
  to?: string
  cursor?: string
}) {
  const query = new URLSearchParams()
  if (typeof params?.limit === "number") query.set("limit", String(params.limit))
  if (params?.search) query.set("search", params.search)
  if (params?.category && params.category !== "all") query.set("category", params.category)
  if (params?.severity && params.severity !== "all") query.set("severity", params.severity)
  if (params?.includeBackend) query.set("includeBackend", "true")
  if (params?.from) query.set("from", params.from)
  if (params?.to) query.set("to", params.to)
  if (params?.cursor) query.set("cursor", params.cursor)

  const suffix = query.toString() ? `?${query.toString()}` : ""
  return request<{ activities: ActivityRecord[]; pageInfo: ActivityPageInfo }>(`/api/activity${suffix}`)
}

export async function listDispatchJobs(input?: {
  status?: DispatchJobRecord["status"] | "ALL"
  encounterId?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (input?.status && input.status !== "ALL") params.set("status", input.status)
  if (input?.encounterId) params.set("encounterId", input.encounterId)
  if (typeof input?.limit === "number") params.set("limit", String(input.limit))
  const query = params.toString()
  return request<{ jobs: DispatchJobRecord[] }>(`/api/admin/dispatch/jobs${query ? `?${query}` : ""}`)
}

export async function retryDueDispatchJobs(limit = 20) {
  return request<{
    processed: Array<{
      id: string
      status: string
      attemptCount: number
      nextRetryAt: string | null
      lastError: string | null
    }>
  }>("/api/admin/dispatch/retry-due", {
    method: "POST",
    body: { limit }
  })
}

export async function replayDispatchJob(jobId: string) {
  return request<{
    job: {
      id: string
      status: string
      attemptCount: number
      nextRetryAt: string | null
      deadLetteredAt: string | null
      lastError: string | null
    }
  }>(`/api/admin/dispatch/${jobId}/replay`, {
    method: "POST",
    body: {}
  })
}

export async function deadLetterDispatchJob(jobId: string, reason: string) {
  return request<{
    job: {
      id: string
      status: string
      deadLetteredAt: string | null
      lastError: string | null
    }
  }>(`/api/admin/dispatch/${jobId}/dead-letter`, {
    method: "POST",
    body: { reason }
  })
}

export interface ObservabilitySummaryRecord {
  windowMinutes: number
  dispatch: {
    windowMinutes: number
    deadLetterRecentCount: number
    retryingCount: number
    pendingCount: number
    terminalFailures: number
  }
  stt: {
    ingestCount: number
    fallbackCount: number
    fallbackRate: number
  }
  auth: {
    failureCount: number
  }
  aiQuality: {
    suggestions: {
      decisionCount: number
      acceptedCount: number
      removedCount: number
      acceptanceRate: number
    }
    transcript: {
      segmentCount: number
      correctionCount: number
      correctionRate: number
    }
    compliance: {
      dismissedCount: number
      resolvedCount: number
      reviewedCount: number
      activeCount: number
      falsePositiveRate: number
    }
  }
  alerts: {
    dlqThresholdBreached: boolean
    sttFallbackHigh: boolean
    authFailureBurst: boolean
    suggestionAcceptanceLow: boolean
    transcriptCorrectionHigh: boolean
    complianceFalsePositiveHigh: boolean
  }
}

export async function fetchObservabilitySummary(windowMinutes = 60) {
  const params = new URLSearchParams({ windowMinutes: String(windowMinutes) })
  return request<{ summary: ObservabilitySummaryRecord }>(`/api/admin/observability/summary?${params.toString()}`)
}

export interface ObservabilityTrendPointRecord {
  bucketStart: string
  bucketEnd: string
  dispatch: {
    deadLetterCount: number
    terminalFailureCount: number
  }
  stt: {
    ingestCount: number
    fallbackCount: number
    fallbackRate: number
  }
  auth: {
    failureCount: number
  }
  aiQuality: {
    suggestions: {
      decisionCount: number
      acceptedCount: number
      acceptanceRate: number
    }
    transcript: {
      segmentCount: number
      correctionCount: number
      correctionRate: number
    }
    compliance: {
      reviewedCount: number
      dismissedCount: number
      resolvedCount: number
      falsePositiveRate: number
    }
  }
}

export interface ObservabilityTrendsRecord {
  windowMinutes: number
  bucketMinutes: number
  start: string
  end: string
  points: ObservabilityTrendPointRecord[]
}

export async function fetchObservabilityTrends(windowMinutes = 24 * 60, bucketMinutes = 60) {
  const params = new URLSearchParams({
    windowMinutes: String(windowMinutes),
    bucketMinutes: String(bucketMinutes)
  })
  return request<{ trends: ObservabilityTrendsRecord }>(`/api/admin/observability/trends?${params.toString()}`)
}

export async function validateDispatchContract(body?: {
  target?: "FHIR_R4" | "HL7_V2" | "VENDOR_API" | "NONE"
  vendor?: "GENERIC" | "ATHENAHEALTH" | "NEXTGEN" | "ECLINICALWORKS"
  payload?: unknown
}) {
  return request<{
    validation: {
      ok: boolean
      contractType: string
      contentType: string
      errors: string[]
    }
  }>("/api/admin/dispatch/contract/validate", {
    method: "POST",
    body: body ?? {}
  })
}

export async function fetchDispatchSandboxReadiness() {
  return request<{
    configuredTarget: "FHIR_R4" | "HL7_V2" | "VENDOR_API" | "NONE"
    configuredVendor: "GENERIC" | "ATHENAHEALTH" | "NEXTGEN" | "ECLINICALWORKS"
    authMode: "NONE" | "API_KEY" | "BEARER" | "HMAC"
    readiness: {
      ready: boolean
      checks: Array<{ key: string; ok: boolean; detail: string }>
    }
  }>("/api/admin/dispatch/sandbox-readiness")
}

export interface AdminUserRecord {
  id: string
  email: string
  name: string
  role: "ADMIN" | "MA" | "CLINICIAN"
  mfaEnabled: boolean
  mfaEnrolledAt?: string | null
  createdAt: string
}

export async function listAdminUsers(limit = 100) {
  const params = new URLSearchParams({ limit: String(limit) })
  return request<{ users: AdminUserRecord[] }>(`/api/admin/users?${params.toString()}`)
}

export async function adminResetUserMfa(userId: string, reason: string) {
  return request<{
    user: {
      id: string
      email: string
      name: string
      role: "ADMIN" | "MA" | "CLINICIAN"
      mfaEnabled: boolean
    }
  }>(`/api/admin/users/${userId}/mfa/reset`, {
    method: "POST",
    body: { reason }
  })
}

export interface BillingSchedulePackRecord {
  packVersion: string
  updatedAt: string
  updatedBy: string
  schedules: Record<
    "MEDICARE" | "AETNA_PPO" | "BCBS_PPO" | "SELF_PAY",
    {
      version: string
      payerModel: string
      approval: {
        approvedBy: string
        approvedAt: string
        source: string
      }
      defaultRateCents: number
      cptRatesCents: Record<string, number>
      defaultCoinsurancePct: number
      defaultCopayCents: number
      rules: {
        requireAtLeastOneCpt: boolean
        maxCoinsurancePct: number
        maxCopayCents: number
      }
    }
  >
}

export async function fetchBillingSchedulePack() {
  return request<{ pack: BillingSchedulePackRecord }>("/api/admin/billing/fee-schedules")
}

export async function updateBillingSchedulePack(pack: BillingSchedulePackRecord) {
  return request<{ path: string; pack: BillingSchedulePackRecord }>("/api/admin/billing/fee-schedules", {
    method: "PUT",
    body: { pack }
  })
}

export interface SecretRotationStatusRecord {
  policy: {
    maxAgeDays: number
  }
  latestRotation: {
    ticketId: string
    rotatedAt: string
    actorId?: string | null
  } | null
  secretsTracked: Array<{
    secret: string
    rotatedAt: string
    ageDays: number
    withinPolicy: boolean
  }>
  staleSecrets: Array<{
    secret: string
    rotatedAt: string
    ageDays: number
    withinPolicy: boolean
  }>
  hasRecordedRotation: boolean
}

export async function fetchSecretRotationStatus() {
  return request<{ status: SecretRotationStatusRecord }>("/api/admin/security/secret-rotation/status")
}

export async function recordSecretRotationEvent(input: {
  ticketId: string
  secrets: string[]
  notes?: string
  rotatedAt?: string
}) {
  return request<{
    rotation: {
      ticketId: string
      secrets: string[]
      rotatedAt: string
    }
  }>("/api/admin/security/secret-rotation/record", {
    method: "POST",
    body: input
  })
}
