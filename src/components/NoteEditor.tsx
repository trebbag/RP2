import { useEffect, useRef, useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Badge } from "./ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { ScrollArea } from "./ui/scroll-area"
import { 
  CheckCircle, 
  Save, 
  Play, 
  Square, 
  Clock, 
  Mic,
  MicOff,
  AlertTriangle
} from "lucide-react"
import { RichTextEditor } from "./RichTextEditor"
import { WorkflowWizardOverlay } from "./finalization/WorkflowWizardOverlay"
import {
  correctTranscriptSegment,
  fetchTranscriptQuality,
  fetchCompliance,
  saveEncounterNote,
  startEncounter,
  stopEncounter,
  streamEncounterTranscript,
  uploadTranscriptAudio,
  updateComplianceStatus,
  type TranscriptQualityReportRecord,
  type TranscriptSegmentRecord
} from "../lib/api"

interface ComplianceIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  status?: 'active' | 'dismissed' | 'resolved'
  title: string
  description: string
  category: 'documentation' | 'coding' | 'billing' | 'quality'
  details: string
  suggestion: string
  learnMoreUrl?: string
  dismissed?: boolean
}

interface NoteEditorProps {
  prePopulatedPatient?: {
    patientId: string
    encounterId: string
  } | null
  initialNoteContent?: string
  selectedCodes?: {
    codes: number
    prevention: number
    diagnoses: number
    differentials: number
  }
  selectedCodesList?: any[]
  onEncounterIdChange?: (encounterId: string) => void
  onNoteContentChange?: (noteContent: string) => void
}

export function NoteEditor({ 
  prePopulatedPatient,
  initialNoteContent = "",
  selectedCodes = { codes: 0, prevention: 0, diagnoses: 0, differentials: 0 },
  selectedCodesList = [],
  onEncounterIdChange,
  onNoteContentChange
}: NoteEditorProps) {
  const [patientId, setPatientId] = useState(prePopulatedPatient?.patientId || "")
  const [encounterId, setEncounterId] = useState(prePopulatedPatient?.encounterId || "")
  const [noteContent, setNoteContent] = useState(initialNoteContent)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  const [isRecording, setIsRecording] = useState(false)
  const [visitStarted, setVisitStarted] = useState(false)
  const [hasEverStarted, setHasEverStarted] = useState(false)
  const [currentSessionTime, setCurrentSessionTime] = useState(0)
  const [pausedTime, setPausedTime] = useState(0)
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegmentRecord[]>([])
  const [streamStatus, setStreamStatus] = useState("Disconnected")
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [showFullTranscript, setShowFullTranscript] = useState(false)
  const [showFinalizationWizard, setShowFinalizationWizard] = useState(false)
  const [transcriptQuality, setTranscriptQuality] = useState<TranscriptQualityReportRecord | null>(null)
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [correctionSpeaker, setCorrectionSpeaker] = useState("Patient")
  const [correctionText, setCorrectionText] = useState("")
  const [correctionReason, setCorrectionReason] = useState("")
  const [isApplyingCorrection, setIsApplyingCorrection] = useState(false)
  const [isRefreshingCompliance, setIsRefreshingCompliance] = useState(false)
  const transcriptDedupRef = useRef<Set<string>>(new Set())
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunkStartedAtRef = useRef<number | null>(null)
  const sessionSecondsRef = useRef(0)

  const [complianceIssues, setComplianceIssues] = useState<ComplianceIssue[]>([
    {
      id: "mdm-1",
      severity: "critical",
      title: "Medical Decision Making complexity not documented",
      description: "The note lacks specific documentation of medical decision making complexity required for E/M coding.",
      category: "documentation",
      details: "For CPT 99214, you must document moderate level medical decision making. Include number of diagnoses/management options, amount of data reviewed, and risk assessment.",
      suggestion: "Add a Medical Decision Making section with: 1) Problem complexity assessment, 2) Data reviewed, 3) Risk stratification table showing moderate complexity.",
      learnMoreUrl: "https://www.cms.gov/outreach-and-education/medicare-learning-network-mln/mlnproducts/downloads/eval-mgmt-serv-guide-icn006764.pdf",
      dismissed: false,
      status: "active"
    },
    {
      id: "ros-1", 
      severity: "warning",
      title: "Review of Systems incomplete",
      description: "Extended Review of Systems (ROS) documentation is missing or incomplete for this level of service.",
      category: "documentation",
      details: "E/M level 4 visits require extended ROS covering 2-9 systems or complete ROS covering 10+ systems to support the level of service billed.",
      suggestion: "Document a systematic review of systems including respiratory, cardiovascular, gastrointestinal, and other relevant systems. Include both positive and negative findings.",
      learnMoreUrl: "https://www.cms.gov/medicare/physician-fee-schedule/physician-fee-schedule",
      dismissed: false,
      status: "active"
    },
    {
      id: "icd-specificity-1",
      severity: "info", 
      title: "ICD-10 code specificity can be improved",
      description: "Some diagnosis codes could be more specific to improve clinical accuracy and billing precision.",
      category: "coding",
      details: "Using more specific ICD-10 codes when clinical information supports it can improve care coordination and reduce the need for additional documentation requests.",
      suggestion: "Review selected diagnosis codes and consider if more specific codes are appropriate based on documented clinical findings.",
      dismissed: false,
      status: "active"
    }
  ])

  const mapComplianceCategory = (title: string, description: string): ComplianceIssue["category"] => {
    const joined = `${title} ${description}`.toLowerCase()
    if (joined.includes("billing") || joined.includes("cpt")) return "billing"
    if (joined.includes("code") || joined.includes("icd")) return "coding"
    if (joined.includes("quality")) return "quality"
    return "documentation"
  }

  const transcriptSignature = (segment: TranscriptSegmentRecord) =>
    `${segment.id || "noid"}|${segment.speaker}|${segment.startMs}|${segment.endMs}|${segment.text.trim().toLowerCase()}`

  const mergeTranscriptSegments = (segments: TranscriptSegmentRecord[], mode: "append" | "replace" = "append") => {
    setTranscriptSegments((prev) => {
      const dedup = mode === "replace" ? new Set<string>() : new Set(transcriptDedupRef.current)
      const base = mode === "replace" ? [] : [...prev]

      for (const segment of segments) {
        const key = transcriptSignature(segment)
        if (dedup.has(key)) continue
        dedup.add(key)
        base.push(segment)
      }

      const trimmed = base.slice(-300)
      transcriptDedupRef.current = new Set(trimmed.map(transcriptSignature))
      return trimmed
    })
  }

  const replaceTranscriptSegment = (segment: TranscriptSegmentRecord) => {
    if (!segment.id) {
      mergeTranscriptSegments([segment], "append")
      return
    }

    setTranscriptSegments((prev) => {
      const updated = prev.map((existing) => (existing.id === segment.id ? { ...existing, ...segment } : existing))
      transcriptDedupRef.current = new Set(updated.map(transcriptSignature))
      return updated
    })
  }

  const refreshTranscriptQuality = async () => {
    if (!encounterId.trim()) return

    try {
      const response = await fetchTranscriptQuality(encounterId)
      setTranscriptQuality(response.report)
    } catch (error) {
      console.warn("Could not refresh transcript quality report", error)
    }
  }

  const refreshComplianceIssues = async () => {
    if (!encounterId.trim()) return
    setIsRefreshingCompliance(true)
    try {
      const response = await fetchCompliance(encounterId)
      setComplianceIssues(
        response.issues.map((issue) => ({
          id: issue.id,
          severity:
            issue.severity === "CRITICAL"
              ? "critical"
              : issue.severity === "WARNING"
                ? "warning"
                : "info",
          status:
            issue.status === "DISMISSED"
              ? "dismissed"
              : issue.status === "RESOLVED"
                ? "resolved"
                : "active",
          title: issue.title,
          description: issue.description,
          category: mapComplianceCategory(issue.title, issue.description),
          details: issue.rationale,
          suggestion: issue.remediation,
          dismissed: issue.status === "DISMISSED"
        }))
      )
    } catch (error) {
      console.warn("Could not refresh compliance issues", error)
    } finally {
      setIsRefreshingCompliance(false)
    }
  }

  const handleDismissIssue = async (issueId: string) => {
    setComplianceIssues((prev) =>
      prev.map((issue) =>
        issue.id === issueId ? { ...issue, dismissed: true, status: "dismissed" } : issue
      )
    )

    if (!encounterId) return
    try {
      await updateComplianceStatus(encounterId, issueId, "DISMISSED")
    } catch (error) {
      console.warn("Failed to persist compliance dismissal", error)
    }
  }

  const handleRestoreIssue = async (issueId: string) => {
    setComplianceIssues((prev) =>
      prev.map((issue) =>
        issue.id === issueId ? { ...issue, dismissed: false, status: "active" } : issue
      )
    )

    if (!encounterId) return
    try {
      await updateComplianceStatus(encounterId, issueId, "ACTIVE")
    } catch (error) {
      console.warn("Failed to restore compliance issue", error)
    }
  }

  // Calculate active issues for button state
  const activeIssues = complianceIssues.filter((issue) => !issue.dismissed && issue.status !== "resolved")
  const criticalIssues = activeIssues.filter(issue => issue.severity === 'critical')
  const hasActiveIssues = activeIssues.length > 0
  const hasCriticalIssues = criticalIssues.length > 0

  const stopAudioCapture = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
    }
    mediaRecorderRef.current = null

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
    }
    mediaStreamRef.current = null
    chunkStartedAtRef.current = null
  }

  useEffect(() => {
    if (!encounterId.trim()) return

    const close = streamEncounterTranscript(encounterId, {
      onConnected: (payload) => {
        setStreamStatus("Connected")
        if (payload.segments && payload.segments.length > 0) {
          mergeTranscriptSegments(payload.segments.slice(-300), "replace")
        }
      },
      onSegment: (segment) => {
        mergeTranscriptSegments([segment], "append")
      },
      onSegmentCorrected: (segment) => {
        replaceTranscriptSegment(segment)
      },
      onQuality: (report) => {
        setTranscriptQuality(report)
      },
      onStatus: (payload) => {
        setStreamStatus(payload.status)
      },
      onError: () => {
        setStreamStatus("Reconnecting")
      }
    })

    return () => {
      close()
      setStreamStatus("Disconnected")
    }
  }, [encounterId])

  const startAudioCapture = async (): Promise<boolean> => {
    if (!encounterId.trim()) return false

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError("Microphone capture is not supported in this browser.")
      return false
    }

    try {
      setRecordingError(null)

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const candidateMimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      const selectedMimeType =
        candidateMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || ""

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = async (event) => {
        if (!encounterId.trim() || event.data.size === 0) return
        const now = Date.now()
        const chunkStarted = chunkStartedAtRef.current ?? now
        const chunkDurationMs = Math.max(500, now - chunkStarted)
        chunkStartedAtRef.current = now

        try {
          const response = await uploadTranscriptAudio(encounterId, event.data, {
            speakerHint: "Patient",
            sessionElapsedMs: sessionSecondsRef.current * 1000,
            chunkDurationMs
          })

          if (response.qualityReport) {
            setTranscriptQuality(response.qualityReport)
          }

          if (response.provider === "fallback" && response.warnings?.length) {
            setRecordingError(response.warnings[0] ?? "Transcription fallback was used.")
          }
        } catch (error) {
          console.warn("Failed to upload transcript audio chunk", error)
          setRecordingError(error instanceof Error ? error.message : "Audio transcription upload failed.")
        }
      }

      recorder.onerror = () => {
        setRecordingError("Audio recording encountered an error. Please check microphone permissions.")
      }

      recorder.start(4500)
      chunkStartedAtRef.current = Date.now()
      mediaRecorderRef.current = recorder
      setStreamStatus("Recording")
      return true
    } catch (error) {
      console.warn("Unable to start microphone capture", error)
      setRecordingError(error instanceof Error ? error.message : "Unable to access microphone.")
      stopAudioCapture()
      return false
    }
  }

  // Timer effect for elapsed visit clock
  useEffect(() => {
    if (!isRecording || !visitStarted) return

    const interval = setInterval(() => {
      setCurrentSessionTime((time) => time + 1)
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [isRecording, visitStarted])

  useEffect(() => {
    return () => {
      stopAudioCapture()
    }
  }, [])

  useEffect(() => {
    if (prePopulatedPatient) {
      setPatientId(prePopulatedPatient.patientId)
      setEncounterId(prePopulatedPatient.encounterId)
    }
  }, [prePopulatedPatient?.patientId, prePopulatedPatient?.encounterId])

  useEffect(() => {
    if (initialNoteContent) {
      setNoteContent(initialNoteContent)
    }
  }, [initialNoteContent])

  useEffect(() => {
    onEncounterIdChange?.(encounterId)
  }, [encounterId, onEncounterIdChange])

  useEffect(() => {
    onNoteContentChange?.(noteContent)
  }, [noteContent, onNoteContentChange])

  useEffect(() => {
    sessionSecondsRef.current = currentSessionTime
  }, [currentSessionTime])

  useEffect(() => {
    if (!encounterId.trim()) return
    void refreshComplianceIssues()
    void refreshTranscriptQuality()
  }, [encounterId])

  useEffect(() => {
    setEditingSegmentId(null)
    setTranscriptQuality(null)
  }, [encounterId])

  // Get the last 3 lines of transcription for tooltip
  const getRecentTranscription = () => {
    const recent = transcriptSegments.slice(-3)
    if (recent.length === 0) {
      return ["Live transcript will appear here once audio capture starts."]
    }
    return recent.map((segment) => `${segment.speaker}: ${segment.text}`)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const openCorrectionEditor = (segment: TranscriptSegmentRecord) => {
    if (!segment.id) return
    setEditingSegmentId(segment.id)
    setCorrectionSpeaker(segment.speaker || "Patient")
    setCorrectionText(segment.text || "")
    setCorrectionReason("")
  }

  const applySegmentCorrection = async () => {
    if (!encounterId.trim() || !editingSegmentId) return
    setIsApplyingCorrection(true)
    setRecordingError(null)

    try {
      const corrected = await correctTranscriptSegment(encounterId, editingSegmentId, {
        speaker: correctionSpeaker,
        text: correctionText,
        reason: correctionReason || "Speaker correction"
      })

      replaceTranscriptSegment(corrected.segment)
      setTranscriptQuality(corrected.qualityReport)
      setEditingSegmentId(null)
      setCorrectionReason("")
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : "Failed to apply transcript correction.")
    } finally {
      setIsApplyingCorrection(false)
    }
  }

  const handleFinalize = () => {
    setShowFinalizationWizard(true)
  }

  const handleSaveDraft = async () => {
    if (!encounterId) return
    setIsSaving(true)
    setStatusMessage("")

    try {
      await saveEncounterNote(encounterId, noteContent)
      setStatusMessage("Draft saved")
    } catch (error) {
      console.error(error)
      setStatusMessage("Save failed")
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (!encounterId.trim() || !visitStarted) return

    const timeout = setTimeout(async () => {
      try {
        await saveEncounterNote(encounterId, noteContent)
        await refreshComplianceIssues()
      } catch (error) {
        console.warn("Autosave or compliance refresh failed", error)
      }
    }, 2500)

    return () => {
      clearTimeout(timeout)
    }
  }, [encounterId, noteContent, visitStarted])

  const handleVisitToggle = async () => {
    if (!visitStarted) {
      if (encounterId) {
        try {
          await startEncounter(encounterId)
          await refreshComplianceIssues()
        } catch (error) {
          console.error("Failed to start encounter", error)
        }
      }
      // Starting or resuming visit
      setVisitStarted(true)
      const captureStarted = await startAudioCapture()
      setIsRecording(captureStarted)
      if (!captureStarted) {
        if (encounterId) {
          try {
            await stopEncounter(encounterId, "pause")
          } catch (error) {
            console.warn("Failed to rollback encounter start after microphone error", error)
          }
        }
        setVisitStarted(false)
        return
      }
      if (!hasEverStarted) {
        // First time starting - reset everything
        setHasEverStarted(true)
        setCurrentSessionTime(0)
        setPausedTime(0)
      } else {
        // Resuming - continue from paused time
        setCurrentSessionTime(pausedTime)
      }
    } else {
      if (encounterId) {
        try {
          await stopEncounter(encounterId, "pause")
        } catch (error) {
          console.error("Failed to pause encounter", error)
        }
      }
      // Pausing visit
      setVisitStarted(false)
      setIsRecording(false)
      stopAudioCapture()
      setPausedTime(currentSessionTime)
    }
  }

  const totalDisplayTime = visitStarted ? currentSessionTime : pausedTime
  const isEditorDisabled = !visitStarted
  const hasRecordedTime = totalDisplayTime > 0
  const canStartVisit = patientId.trim() !== "" && encounterId.trim() !== ""

  return (
    <div className="flex flex-col flex-1">
      {/* Toolbar */}
      <div className="border-b bg-background p-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="patient-id">Patient ID</Label>
            <Input
              id="patient-id"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Enter Patient ID"
            />
          </div>
          
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="encounter-id">Encounter ID</Label>
            <Input
              id="encounter-id"
              value={encounterId}
              onChange={(e) => setEncounterId(e.target.value)}
              placeholder="Enter Encounter ID"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          {/* Primary Actions */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleFinalize}
                  disabled={!hasRecordedTime || hasActiveIssues}
                  className={`shadow-sm ${
                    hasActiveIssues 
                      ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                >
                  {hasActiveIssues ? (
                    <AlertTriangle className="w-4 h-4 mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {hasActiveIssues ? 'Issues Must Be Resolved' : 'Save & Finalize Note'}
                </Button>
              </TooltipTrigger>
              {hasActiveIssues && (
                <TooltipContent>
                  <div className="space-y-1">
                    <div className="font-medium text-sm">
                      {activeIssues.length} compliance issue{activeIssues.length !== 1 ? 's' : ''} must be resolved
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {hasCriticalIssues && `${criticalIssues.length} critical issue${criticalIssues.length !== 1 ? 's' : ''} requiring attention`}
                    </div>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          
          <Button 
            variant="outline"
            onClick={handleSaveDraft}
            disabled={!hasRecordedTime || isSaving}
            className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Draft & Exit"}
          </Button>
          {statusMessage && <span className="text-sm text-muted-foreground">{statusMessage}</span>}
          {recordingError && <span className="text-sm text-destructive">{recordingError}</span>}
          {encounterId && (
            <Badge variant="outline" className="text-xs">
              Stream: {streamStatus}
            </Badge>
          )}
          {isRefreshingCompliance && (
            <Badge variant="secondary" className="text-xs">
              Compliance Refreshing...
            </Badge>
          )}
          
          {/* Start Visit with Recording Indicator */}
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleVisitToggle}
              disabled={!canStartVisit && !visitStarted}
              variant={visitStarted ? "destructive" : "default"}
              className={!visitStarted ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm" : ""}
            >
              {!visitStarted ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Visit
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Visit
                </>
              )}
            </Button>
            
            {/* Show indicators when visit has ever been started */}
            {hasEverStarted && (
              <div className="flex items-center gap-3 text-destructive">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-mono font-medium min-w-[3rem] tabular-nums">
                    {formatTime(totalDisplayTime)}
                  </span>
                </div>
                
                {/* Audio Wave Animation - show when visit has ever been started */}
                {hasEverStarted && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="flex items-center gap-0.5 h-6 cursor-pointer"
                          onClick={() => setShowFullTranscript(true)}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div
                              key={i}
                              className={`w-0.5 rounded-full ${isRecording ? 'bg-destructive' : 'bg-muted-foreground'}`}
                              style={{
                                height: isRecording ? `${8 + (i % 4) * 3}px` : `${6 + (i % 3) * 2}px`,
                                animation: isRecording ? `audioWave${i} ${1.2 + (i % 3) * 0.3}s ease-in-out infinite` : 'none',
                                animationDelay: isRecording ? `${i * 0.1}s` : '0s'
                              }}
                            />
                          ))}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="bottom" 
                        align="center"
                        className="max-w-sm p-3 bg-popover border-border"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-destructive animate-pulse' : 'bg-muted-foreground'}`}></div>
                            {isRecording ? 'Live Transcription Preview' : 'Transcription Preview (Paused)'}
                          </div>
                          <div className="bg-muted/50 rounded-md p-2 border-l-2 border-destructive space-y-1">
                            {getRecentTranscription().map((line, index) => (
                              <div 
                                key={index} 
                                className={`text-xs leading-relaxed ${
                                  index === 2 
                                    ? 'text-foreground font-medium' 
                                    : 'text-muted-foreground'
                                }`}
                                style={{
                                  opacity: index === 2 ? 1 : 0.7 - (index * 0.2)
                                }}
                              >
                                {line}
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                            Click audio wave to view full transcript
                            {!isRecording && (
                              <div className="mt-1 text-muted-foreground/80">
                                Recording paused - transcript available
                              </div>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Rich Text Editor */}
      <div className="flex-1">
        <RichTextEditor 
          value={noteContent}
          disabled={isEditorDisabled}
          complianceIssues={complianceIssues}
          onDismissIssue={handleDismissIssue}
          onRestoreIssue={handleRestoreIssue}
          onContentChange={setNoteContent}
        />
      </div>

      {/* Full Transcript Modal */}
      <Dialog open={showFullTranscript} onOpenChange={setShowFullTranscript}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0 bg-background border-border">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <DialogTitle className="text-lg font-medium">Full Transcript</DialogTitle>
                <DialogDescription className="sr-only">
                  Real-time transcription of your patient encounter showing the complete conversation history.
                </DialogDescription>
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <>
                      <Mic className="w-4 h-4 text-destructive" />
                      <Badge variant="destructive" className="text-xs">
                        <div className="w-1.5 h-1.5 bg-destructive-foreground rounded-full animate-pulse mr-1"></div>
                        Recording
                      </Badge>
                    </>
                  ) : (
                    <>
                      <MicOff className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="secondary" className="text-xs">
                        Paused
                      </Badge>
                    </>
                  )}
                </div>
                <div className={`flex items-center gap-1 text-sm ${isRecording ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <Clock className="w-4 h-4" />
                  <span className="font-mono tabular-nums">
                    {formatTime(totalDisplayTime)}
                  </span>
                </div>
                {transcriptQuality && (
                  <Badge variant={transcriptQuality.needsReview ? "destructive" : "secondary"} className="text-xs">
                    Quality {transcriptQuality.score}%
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                {isRecording 
                  ? "Real-time transcription of your patient encounter. The transcript updates automatically as the conversation continues."
                  : "Transcription of your patient encounter. Recording is currently paused - click 'Start Visit' to resume recording and live transcription."
                }
              </div>

              {transcriptQuality?.needsReview && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Transcript quality needs review. Low confidence or speaker-label issues were detected.
                </div>
              )}
              
              <div className="space-y-3">
                {transcriptSegments.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No transcript segments yet. Start recording and speak to stream live transcription.
                  </div>
                )}

                {transcriptSegments.map((segment, index) => {
                  const isCurrent = index === transcriptSegments.length - 1 && isRecording
                  const speaker = segment.speaker
                  const content = segment.text
                  const isLowConfidence = typeof segment.confidence === "number" && segment.confidence < 0.72
                  const isEditing = segment.id && editingSegmentId === segment.id
                  
                  return (
                    <div 
                      key={segment.id || `${segment.startMs}-${segment.endMs}-${index}`}
                      className={`flex gap-3 p-3 rounded-lg transition-all duration-300 ${
                        isCurrent 
                          ? 'bg-destructive/10 border border-destructive/20 shadow-sm' 
                          : 'bg-muted/30'
                      }`}
                    >
                      <div className={`font-medium text-sm min-w-16 ${
                        speaker === 'Doctor' ? 'text-primary' : 'text-blue-600'
                      }`}>
                        {speaker}:
                      </div>
                      <div className="flex-1 space-y-2">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Speaker</Label>
                                <Select value={correctionSpeaker} onValueChange={setCorrectionSpeaker}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Doctor">Doctor</SelectItem>
                                    <SelectItem value="Patient">Patient</SelectItem>
                                    <SelectItem value="Caregiver">Caregiver</SelectItem>
                                    <SelectItem value="Staff">Staff</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Reason</Label>
                                <Input
                                  value={correctionReason}
                                  onChange={(event) => setCorrectionReason(event.target.value)}
                                  placeholder="Speaker misattribution"
                                  className="h-8"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Corrected Text</Label>
                              <Textarea
                                value={correctionText}
                                onChange={(event) => setCorrectionText(event.target.value)}
                                className="min-h-[64px]"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" disabled={isApplyingCorrection} onClick={applySegmentCorrection}>
                                {isApplyingCorrection ? "Saving..." : "Save Correction"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingSegmentId(null)}
                                disabled={isApplyingCorrection}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className={`text-sm leading-relaxed ${isCurrent ? 'font-medium' : ''}`}>
                            {content}
                            {isCurrent && isRecording && (
                              <span className="inline-block w-2 h-4 bg-destructive ml-1 animate-pulse"></span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {typeof segment.confidence === "number" && (
                            <span>Confidence {Math.round(segment.confidence * 100)}%</span>
                          )}
                          {isLowConfidence && <Badge variant="outline">Low Confidence</Badge>}
                          {segment.id && !isEditing && (
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => openCorrectionEditor(segment)}>
                              Correct
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {isRecording && (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
                    Listening and transcribing...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="border-t border-border p-4 bg-muted/30 shrink-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>
                {transcriptSegments.length} lines transcribed
              </div>
              <div className="flex items-center gap-4">
                <div>
                  Words: ~
                  {transcriptSegments
                    .map((segment) => segment.text.split(/\s+/).filter(Boolean).length)
                    .reduce((sum, count) => sum + count, 0)}
                </div>
                <div>
                  Confidence:{" "}
                  {transcriptQuality
                    ? `${Math.round(transcriptQuality.metrics.avgConfidence * 100)}%`
                    : "N/A"}
                </div>
                {transcriptQuality && transcriptQuality.needsReview && (
                  <div className="text-amber-700">
                    Review Needed ({transcriptQuality.issues.length} issues)
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <WorkflowWizardOverlay
        isOpen={showFinalizationWizard}
        onClose={() => setShowFinalizationWizard(false)}
        initialNoteContent={noteContent}
        encounterId={encounterId || undefined}
      />
    </div>
  )
}
