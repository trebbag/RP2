import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Check, Settings } from "lucide-react"
import { ProgressIndicator } from "./ProgressIndicator"
import { WorkflowNoteEditor } from "./WorkflowNoteEditor"
import { StepContent } from "./StepContent"
import { DualRichTextEditor } from "./DualRichTextEditor"
import {
  composeWizard,
  fetchWizardState,
  finalizeWizard,
  previewBillingWizard,
  rebeautifyWizard,
  wizardStepAction
} from "../../lib/api"

interface WorkflowWizardProps {
  initialNoteContent?: string
  encounterId?: string
}

export function WorkflowWizard({ initialNoteContent, encounterId }: WorkflowWizardProps) {
  type ComposeStage = {
    id: number
    title: string
    status: "pending" | "in-progress" | "completed"
  }

  const defaultNote = `PATIENT: John Smith, 65-year-old male
DATE: ${new Date().toLocaleDateString()}

CHIEF COMPLAINT:
Chest pain for 2 days, described as sharp, located in the precordial region.

HISTORY OF PRESENT ILLNESS:
Patient reports chest pain that began approximately 48 hours prior to this encounter. He describes the pain as sharp in character, localized to the precordial region. The pain is intermittent and worsens with physical activity. Patient has a history of smoking 1 pack per day for 30 years. No associated shortness of breath, nausea, or diaphoresis reported.

PHYSICAL EXAMINATION:
GENERAL: Alert, oriented, appears comfortable at rest
CARDIOVASCULAR: Regular rate and rhythm, no murmurs appreciated, no peripheral edema
RESPIRATORY: Clear to auscultation bilaterally
EXTREMITIES: No cyanosis, clubbing, or edema

ASSESSMENT:
Chest pain, likely musculoskeletal in nature given characteristics and lack of associated symptoms. However, given patient's smoking history and age, cardiac evaluation warranted.

PLAN:
1. EKG to rule out cardiac abnormalities
2. Basic metabolic panel and lipid profile
3. Consider stress testing if symptoms persist
4. Smoking cessation counseling provided`

  const initialNote = initialNoteContent && initialNoteContent.trim() ? initialNoteContent : defaultNote

  const [currentStep, setCurrentStep] = useState(1)
  const [activeItemData, setActiveItemData] = useState<any>(null)
  const [isShowingEvidence, setIsShowingEvidence] = useState(false)
  const [patientQuestions, setPatientQuestions] = useState<
    Array<{
      id: number
      question: string
      source: string
      priority: "high" | "medium" | "low"
      codeRelated: string
      category: "clinical" | "administrative" | "documentation"
    }>
  >([])
  const [showPatientQuestions, setShowPatientQuestions] = useState(false)
  const [noteContent, setNoteContent] = useState(initialNote)
  const [beautifiedContent, setBeautifiedContent] = useState(initialNote)
  const [patientSummaryContent, setPatientSummaryContent] = useState("Patient summary will be generated after compose.")
  const [composeStages, setComposeStages] = useState<ComposeStage[]>([
    { id: 1, title: "Analyzing Content", status: "pending" as const },
    { id: 2, title: "Enhancing Structure", status: "pending" as const },
    { id: 3, title: "Beautifying Language", status: "pending" as const },
    { id: 4, title: "Final Review", status: "pending" as const }
  ])
  const [composeTraceId, setComposeTraceId] = useState<string | null>(null)
  const [composeError, setComposeError] = useState<string | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [finalizationError, setFinalizationError] = useState<string | null>(null)
  const [finalizationArtifacts, setFinalizationArtifacts] = useState<Array<{ id: string; type: string }>>([])
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null)
  const [decisionStatusByCode, setDecisionStatusByCode] = useState<
    Record<string, "confirmed" | "rejected" | "pending">
  >({})
  const [billingPreview, setBillingPreview] = useState<{
    payerModel: string
    feeScheduleVersion: string
    selectedCptCodes: string[]
    allowedAmountCents: number
    deductibleAppliedCents: number
    copayCents: number
    coinsuranceCents: number
    estimatedChargeCents: number
    outOfPocketCents: number
    expectedReimbursementCents: number
    projectedRevenueDeltaCents: number
  } | null>(null)
  const [billingInputs, setBillingInputs] = useState({
    payerModel: "MEDICARE",
    monthlyRevenueDollars: 10000,
    expectedCoderLiftPct: 3.5,
    deductibleRemainingDollars: 0,
    coinsurancePct: 20,
    copayDollars: 0
  })
  const [attestClinicalAccuracy, setAttestClinicalAccuracy] = useState(true)
  const [attestBillingAccuracy, setAttestBillingAccuracy] = useState(true)

  const resolvedStatusForCode = (
    codeTitle: string,
    fallback: "pending" | "completed" | "in-progress" | "confirmed" | "rejected"
  ) => {
    const code = codeTitle.split(" - ")[0]?.trim()
    if (!code) return fallback
    const persistedStatus = decisionStatusByCode[code]
    if (persistedStatus === "confirmed") return "confirmed"
    if (persistedStatus === "rejected") return "rejected"
    return fallback
  }

  const steps: any[] = [
    {
      id: 1,
      title: "Code Review",
      description: "Review and validate your selected diagnostic codes",
      type: "selected-codes",
      stepType: "selected",
      totalSelected: 4,
      totalSuggestions: 6,
      items: [
        {
          id: 1,
          title: "I25.10 - Atherosclerotic heart disease",
          status: resolvedStatusForCode("I25.10 - Atherosclerotic heart disease", "confirmed"),
          details: "Primary diagnosis confirmed with supporting documentation",
          codeType: "ICD-10",
          category: "diagnosis",
          confidence: 95,
          docSupport: "strong",
          stillValid: true,
          gaps: [],
          evidence: ["chest pain", "cardiac evaluation warranted", "smoking history", "age"]
        },
        {
          id: 2,
          title: "Z87.891 - Personal history of nicotine dependence",
          status: resolvedStatusForCode("Z87.891 - Personal history of nicotine dependence", "pending"),
          details: "Review patient history and confirm current status",
          codeType: "ICD-10",
          category: "history",
          confidence: 78,
          docSupport: "moderate",
          stillValid: true,
          gaps: ["Current smoking status unclear", "Pack-year history incomplete"],
          evidence: ["smoking 1 pack per day for 30 years", "Smoking cessation counseling"]
        },
        {
          id: 3,
          title: "E78.5 - Hyperlipidemia, unspecified",
          status: resolvedStatusForCode("E78.5 - Hyperlipidemia, unspecified", "confirmed"),
          details: "Lab values support this diagnosis",
          codeType: "ICD-10",
          category: "diagnosis",
          confidence: 88,
          docSupport: "strong",
          stillValid: true,
          gaps: ["Specific lipid values not documented"],
          evidence: ["lipid profile", "Basic metabolic panel"]
        },
        {
          id: 4,
          title: "I10 - Essential hypertension",
          status: resolvedStatusForCode("I10 - Essential hypertension", "confirmed"),
          details: "Documented with current BP readings",
          codeType: "ICD-10",
          category: "diagnosis",
          confidence: 92,
          docSupport: "strong",
          stillValid: true,
          gaps: [],
          evidence: ["CARDIOVASCULAR:", "Regular rate and rhythm"]
        }
      ],
      patientQuestions: []
    },
    {
      id: 2,
      title: "Suggestion Review",
      description: "Evaluate AI-recommended diagnostic codes",
      type: "suggested-codes",
      stepType: "suggested",
      totalSelected: 4,
      totalSuggestions: 6,
      items: [
        {
          id: 1,
          title: "Z13.6 - Encounter for screening for cardiovascular disorders",
          status: resolvedStatusForCode("Z13.6 - Encounter for screening for cardiovascular disorders", "pending"),
          details: "AI suggests adding this screening code for completeness",
          codeType: "ICD-10",
          category: "screening",
          confidence: 82,
          docSupport: "moderate",
          aiReasoning: "Patient age and risk factors indicate appropriate cardiovascular screening",
          evidence: ["EKG to rule out cardiac abnormalities", "stress testing"],
          suggestedBy: "Clinical Decision Support"
        },
        {
          id: 2,
          title: "F17.210 - Nicotine dependence, cigarettes, uncomplicated",
          status: resolvedStatusForCode("F17.210 - Nicotine dependence, cigarettes, uncomplicated", "pending"),
          details: "More specific than current history code - consider upgrading",
          codeType: "ICD-10",
          category: "diagnosis",
          confidence: 91,
          docSupport: "strong",
          aiReasoning: "Current smoking documented with specific frequency and duration",
          evidence: ["smoking 1 pack per day for 30 years", "Smoking cessation counseling"],
          suggestedBy: "Coding Optimization"
        },
        {
          id: 3,
          title: "Z68.36 - Body mass index 36.0-36.9, adult",
          status: resolvedStatusForCode("Z68.36 - Body mass index 36.0-36.9, adult", "pending"),
          details: "BMI documentation supports billing and care coordination",
          codeType: "ICD-10",
          category: "screening",
          confidence: 94,
          docSupport: "strong",
          aiReasoning: "BMI calculated from documented height/weight measurements",
          evidence: ["PHYSICAL EXAMINATION:", "GENERAL:"],
          suggestedBy: "Documentation Enhancement"
        },
        {
          id: 4,
          title: "99213 - Office visit, established patient, low complexity",
          status: resolvedStatusForCode("99213 - Office visit, established patient, low complexity", "pending"),
          details: "Appropriate E/M level based on documentation complexity",
          codeType: "CPT",
          category: "evaluation",
          confidence: 87,
          docSupport: "strong",
          aiReasoning: "Documentation supports this level of medical decision making",
          evidence: ["PLAN:", "Consider stress testing"],
          suggestedBy: "Billing Optimization"
        },
        {
          id: 5,
          title: "80061 - Lipid panel",
          status: resolvedStatusForCode("80061 - Lipid panel", "pending"),
          details: "Lab work mentioned in plan should be coded",
          codeType: "CPT",
          category: "procedure",
          confidence: 76,
          docSupport: "moderate",
          aiReasoning: "Lab orders documented in assessment and plan",
          evidence: ["lipid profile", "Basic metabolic panel"],
          suggestedBy: "Procedure Capture"
        },
        {
          id: 6,
          title: "93000 - Electrocardiogram, routine ECG with interpretation",
          status: resolvedStatusForCode("93000 - Electrocardiogram, routine ECG with interpretation", "pending"),
          details: "ECG mentioned in plan should be captured for billing",
          codeType: "CPT",
          category: "procedure",
          confidence: 85,
          docSupport: "strong",
          aiReasoning: "ECG explicitly mentioned in treatment plan",
          evidence: ["EKG to rule out cardiac abnormalities"],
          suggestedBy: "Procedure Capture"
        }
      ],
      patientQuestions: []
    },
    {
      id: 3,
      title: "Compose",
      description: "AI beautification and enhancement",
      type: "loading",
      progressSteps: composeStages
    },
    {
      id: 4,
      title: "Compare & Edit",
      description: "Compare original draft with beautified version",
      type: "dual-editor",
      originalContent: noteContent,
      beautifiedContent: beautifiedContent,
      patientSummaryContent: patientSummaryContent
    },
    {
      id: 5,
      title: "Billing & Attest",
      description: "Final review, billing verification, and attestation",
      type: "placeholder",
      items: []
    },
    {
      id: 6,
      title: "Sign & Dispatch",
      description: "Final confirmation and submission",
      type: "dispatch",
      items: []
    }
  ]

  const handleInsertTextToNote = (text: string) => {
    let insertPosition = noteContent.length

    if (text.toLowerCase().includes("smoking") || text.toLowerCase().includes("cigarette")) {
      const historyIndex = noteContent.indexOf("HISTORY OF PRESENT ILLNESS:")
      if (historyIndex !== -1) {
        const sectionEnd = noteContent.indexOf("\n\n", historyIndex)
        insertPosition = sectionEnd !== -1 ? sectionEnd : noteContent.length
      }
    } else if (text.toLowerCase().includes("weight") || text.toLowerCase().includes("bmi")) {
      const examIndex = noteContent.indexOf("PHYSICAL EXAMINATION:")
      if (examIndex !== -1) {
        const sectionEnd = noteContent.indexOf("\n\n", examIndex)
        insertPosition = sectionEnd !== -1 ? sectionEnd : noteContent.length
      }
    } else if (text.toLowerCase().includes("family history")) {
      const assessmentIndex = noteContent.indexOf("ASSESSMENT:")
      if (assessmentIndex !== -1) {
        insertPosition = assessmentIndex
      }
    }

    const formattedText = `\n\nADDITIONAL INFORMATION:\n${text}`
    const newContent = noteContent.slice(0, insertPosition) + formattedText + noteContent.slice(insertPosition)
    setNoteContent(newContent)
  }

  const handleStepChange = (stepId: number) => {
    setCurrentStep(stepId)
  }

  const generatePatientQuestions = () => {
    const questions: Array<{
      id: number
      question: string
      source: string
      priority: "high" | "medium" | "low"
      codeRelated: string
      category: "clinical" | "administrative" | "documentation"
    }> = []

    const selectedCodesStep = steps.find((step) => step.id === 1)
    if (selectedCodesStep?.items) {
      selectedCodesStep.items.forEach((item: any) => {
        if (item.gaps && item.gaps.length > 0) {
          item.gaps.forEach((gap: string, index: number) => {
            const questionId = parseInt(`0${item.id}${index}`)
            let questionText = ""
            let priority: "high" | "medium" | "low" = "medium"

            if (gap.includes("smoking status")) {
              questionText = "How many cigarettes do you currently smoke per day? When did you start smoking?"
              priority = "high"
            } else if (gap.includes("lipid values")) {
              questionText = "When was your last cholesterol test? Do you remember any of the specific numbers?"
              priority = "medium"
            } else if (gap.includes("Pack-year")) {
              questionText = "For how many years have you been smoking at your current rate?"
              priority = "high"
            } else {
              questionText = `Please provide more details about: ${gap}`
            }

            questions.push({
              id: questionId,
              question: questionText,
              source: `Code Gap: ${item.title}`,
              priority,
              codeRelated: item.title,
              category: "clinical"
            })
          })
        }
      })
    }

    const suggestedCodesStep = steps.find((step) => step.id === 2)
    if (suggestedCodesStep?.items) {
      suggestedCodesStep.items.forEach((item: any) => {
        if (item.category === "screening") {
          const questionId = parseInt(`1${item.id}99`)
          let questionText = ""

          if (item.title.includes("cardiovascular screening")) {
            questionText = "Do you have any family history of heart disease? Any chest pain with exertion?"
          } else if (item.title.includes("BMI")) {
            questionText = "What is your current weight? Any recent weight changes?"
          }

          if (questionText) {
            questions.push({
              id: questionId,
              question: questionText,
              source: `Screening Opportunity: ${item.title}`,
              priority: "low",
              codeRelated: item.title,
              category: "clinical"
            })
          }
        }
      })
    }

    return questions
  }

  React.useEffect(() => {
    if (currentStep === 1 || currentStep === 2) {
      const newQuestions = generatePatientQuestions()
      setPatientQuestions(newQuestions)
    }
  }, [currentStep])

  useEffect(() => {
    if (currentStep !== 3 || !encounterId) return
    if (isComposing) return
    if (composeTraceId) return

    let canceled = false
    const runCompose = async () => {
      setIsComposing(true)
      setComposeError(null)
      setComposeStages((prev) =>
        prev.map((stage, index) => ({ ...stage, status: index === 0 ? "in-progress" : "pending" }))
      )

      try {
        const response = await composeWizard(encounterId, noteContent)
        if (canceled) return
        setBeautifiedContent(response.enhancedNote)
        setPatientSummaryContent(response.patientSummary)
        setComposeStages(response.stages)
        setComposeTraceId(response.traceId)
      } catch (error) {
        if (canceled) return
        setComposeError(error instanceof Error ? error.message : "Compose failed")
      } finally {
        if (!canceled) {
          setIsComposing(false)
        }
      }
    }

    void runCompose()

    return () => {
      canceled = true
    }
  }, [currentStep, encounterId, noteContent, isComposing, composeTraceId])

  useEffect(() => {
    if (currentStep !== 5 || !encounterId) return

    const timeout = setTimeout(async () => {
      try {
        const preview = await previewBillingWizard(encounterId, {
          payerModel: billingInputs.payerModel,
          monthlyRevenueCents: Math.round(billingInputs.monthlyRevenueDollars * 100),
          expectedCoderLiftPct: billingInputs.expectedCoderLiftPct / 100,
          deductibleRemainingCents: Math.round(billingInputs.deductibleRemainingDollars * 100),
          coinsurancePct: billingInputs.coinsurancePct / 100,
          copayCents: Math.round(billingInputs.copayDollars * 100)
        })
        setBillingPreview(preview.billing)
      } catch (error) {
        setFinalizationError(error instanceof Error ? error.message : "Billing preview failed")
      }
    }, 250)

    return () => {
      clearTimeout(timeout)
    }
  }, [
    currentStep,
    encounterId,
    billingInputs.payerModel,
    billingInputs.monthlyRevenueDollars,
    billingInputs.expectedCoderLiftPct,
    billingInputs.deductibleRemainingDollars,
    billingInputs.coinsurancePct,
    billingInputs.copayDollars
  ])

  useEffect(() => {
    if (!encounterId) return

    let canceled = false
    const loadPersistedWizardState = async () => {
      try {
        const response = await fetchWizardState(encounterId)
        if (canceled) return

        const state = response.state
        setCurrentStep(state.suggestedStep)

        if (state.note?.content) {
          setNoteContent(state.note.content)
        }
        if (state.note?.patientSummary) {
          setPatientSummaryContent(state.note.patientSummary)
        }

        if (state.latestComposeVersion?.content) {
          setBeautifiedContent(state.latestComposeVersion.content)
          if (state.latestComposeVersion.patientSummary) {
            setPatientSummaryContent(state.latestComposeVersion.patientSummary)
          }
          if (state.latestComposeVersion.traceId) {
            setComposeTraceId(state.latestComposeVersion.traceId)
          }
        }

        if (state.exportArtifacts.length > 0) {
          setFinalizationArtifacts(state.exportArtifacts.map((artifact) => ({ id: artifact.id, type: artifact.type })))
        }

        const decisionMap: Record<string, "confirmed" | "rejected" | "pending"> = {}
        for (const decision of state.decisions) {
          decisionMap[decision.code] = decision.action === "REMOVE" ? "rejected" : "confirmed"
        }
        setDecisionStatusByCode(decisionMap)
      } catch (error) {
        console.warn("Could not load wizard state", error)
      }
    }

    void loadPersistedWizardState()
    return () => {
      canceled = true
    }
  }, [encounterId])

  const currentStepData = steps.find((step) => step.id === currentStep)

  const getHighlightRanges = () => {
    if (!activeItemData || !noteContent || !isShowingEvidence) return []

    const ranges: any[] = []

    const evidenceMap: { [key: string]: string[] } = {
      "Missing Chief Complaint Details": ["Chest pain for 2 days", "sharp", "precordial region"],
      "Incomplete Social History": ["smoking 1 pack per day for 30 years", "smoking history"],
      "Medication Reconciliation": ["PLAN:", "Consider stress testing"],
      "Follow-up Questions": ["No associated shortness of breath", "cardiac evaluation warranted"],
      "Review of Systems Gap": ["CARDIOVASCULAR:", "RESPIRATORY:", "no murmurs"],
      "Physical Exam Addition": ["Regular rate and rhythm", "no murmurs appreciated"],
      "I25.10 - Atherosclerotic heart disease": ["cardiac evaluation warranted", "smoking history", "age"],
      "Z87.891 - Personal history of nicotine dependence": [
        "smoking 1 pack per day for 30 years",
        "Smoking cessation counseling"
      ],
      "E78.5 - Hyperlipidemia, unspecified": ["lipid profile", "Basic metabolic panel"],
      "I10 - Essential hypertension": ["CARDIOVASCULAR:", "Regular rate and rhythm"],
      "Z13.6 - Encounter for screening for cardiovascular disorders": [
        "EKG to rule out cardiac abnormalities",
        "stress testing"
      ],
      "F17.210 - Nicotine dependence, cigarettes, uncomplicated": [
        "smoking 1 pack per day for 30 years",
        "Smoking cessation counseling"
      ],
      "Z68.36 - Body mass index 36.0-36.9, adult": ["PHYSICAL EXAMINATION:", "GENERAL:"],
      "Z51.81 - Encounter for therapeutic drug level monitoring": ["PLAN:", "Consider stress testing"]
    }

    const evidenceTexts = evidenceMap[activeItemData.title] || []

    evidenceTexts.forEach((evidenceText, index) => {
      const startIndex = noteContent.toLowerCase().indexOf(evidenceText.toLowerCase())
      if (startIndex !== -1) {
        ranges.push({
          start: startIndex,
          end: startIndex + evidenceText.length,
          className: index % 3 === 0 ? "highlight-blue" : index % 3 === 1 ? "highlight-emerald" : "highlight-amber",
          label: `Evidence ${index + 1}`,
          text: evidenceText
        })
      }
    })

    return ranges
  }

  const stepDataForRender =
    currentStepData?.id === 4 && currentStepData.type === "dual-editor"
      ? { ...currentStepData, originalContent: noteContent }
      : currentStepData

  const formatUsd = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)

  const handleDispatch = async () => {
    if (!encounterId) {
      setFinalizationError("Encounter ID is missing; cannot finalize.")
      return
    }
    if (!attestClinicalAccuracy || !attestBillingAccuracy) {
      setFinalizationError("Both attestation checkboxes must be confirmed before dispatch.")
      return
    }

    setIsFinalizing(true)
    setFinalizationError(null)

    try {
      const result = await finalizeWizard(encounterId, {
        finalNote: beautifiedContent || noteContent,
        finalPatientSummary: patientSummaryContent,
        attestClinicalAccuracy,
        attestBillingAccuracy,
        payerModel: billingInputs.payerModel,
        monthlyRevenueCents: Math.round(billingInputs.monthlyRevenueDollars * 100),
        expectedCoderLiftPct: billingInputs.expectedCoderLiftPct / 100,
        deductibleRemainingCents: Math.round(billingInputs.deductibleRemainingDollars * 100),
        coinsurancePct: billingInputs.coinsurancePct / 100,
        copayCents: Math.round(billingInputs.copayDollars * 100)
      })
      setFinalizationArtifacts(result.artifacts)
      setDispatchStatus(result.dispatch?.status ?? "PENDING")
    } catch (error) {
      setFinalizationError(error instanceof Error ? error.message : "Finalize failed")
    } finally {
      setIsFinalizing(false)
    }
  }

  const handleStepItemStatusChange = async (item: any, status: string) => {
    if (!encounterId) return
    if (currentStep !== 1 && currentStep !== 2) return

    const code = typeof item?.title === "string" ? item.title.split(" - ")[0] : undefined
    if (!code) return

    const actionType = status === "completed" || status === "confirmed" ? "keep" : "remove"

    setDecisionStatusByCode((prev) => ({
      ...prev,
      [code]: actionType === "remove" ? "rejected" : "confirmed"
    }))

    try {
      await wizardStepAction(encounterId, currentStep, {
        actionType,
        code,
        codeType: item.codeType ?? "ICD-10",
        category:
          item.category === "CPT"
            ? "CODE"
            : item.category === "Public Health"
              ? "PREVENTION"
              : item.category === "ICD-10"
                ? "DIAGNOSIS"
                : "DIFFERENTIAL",
        reason: `${item.title} marked as ${status}`
      })
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : "Failed to persist wizard decision")
    }
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden relative">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.8 }}
        style={{
          background: "linear-gradient(135deg, #fdfdff 0%, #fcfcff 25%, #fafaff 50%, #f9f9ff 75%, #fdfdff 100%)"
        }}
      />
      <motion.div
        className="relative z-10 h-full flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div
          className="border-b border-white/20 shadow-sm"
          style={{ background: "linear-gradient(135deg, #fefefe 0%, #fdfdfd 50%, #fcfcfc 100%)" }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
        >
          <ProgressIndicator steps={steps} currentStep={currentStep} onStepClick={handleStepChange} />
        </motion.div>

        <motion.div
          className="flex-1 flex overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
        >
          {stepDataForRender?.type === "loading" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #fafcff 0%, #f8faff 25%, #f4f7ff 50%, #f3f5ff 75%, #fafcff 100%)"
              }}
            >
              <div className="text-center max-w-md">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Settings size={32} className="text-white" />
                  </motion.div>
                </div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">AI Enhancement in Progress</h2>
                <p className="text-slate-600 mb-8">Analyzing and beautifying your medical documentation...</p>

                <div className="space-y-4">
                  {stepDataForRender.progressSteps?.map((stepItem: any, index: number) => (
                    <motion.div
                      key={stepItem.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.2 }}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        stepItem.status === "completed"
                          ? "bg-emerald-50 border border-emerald-200"
                          : stepItem.status === "in-progress"
                            ? "bg-blue-50 border border-blue-200"
                            : "bg-slate-50 border border-slate-200"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          stepItem.status === "completed"
                            ? "bg-emerald-500"
                            : stepItem.status === "in-progress"
                              ? "bg-blue-500"
                              : "bg-slate-300"
                        }`}
                      >
                        {stepItem.status === "completed" ? (
                          <Check size={14} className="text-white" />
                        ) : stepItem.status === "in-progress" ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-3 h-3 border-2 border-white border-t-transparent rounded-full"
                          />
                        ) : (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <span
                        className={`font-medium ${
                          stepItem.status === "completed"
                            ? "text-emerald-700"
                            : stepItem.status === "in-progress"
                              ? "text-blue-700"
                              : "text-slate-600"
                        }`}
                      >
                        {stepItem.title}
                      </span>
                    </motion.div>
                  ))}
                </div>
                {composeError && <p className="mt-4 text-sm text-red-600">{composeError}</p>}
                {composeTraceId && <p className="mt-2 text-xs text-slate-500">Trace ID: {composeTraceId}</p>}

                <motion.button
                  onClick={() => setCurrentStep(4)}
                  disabled={isComposing || Boolean(composeError)}
                  className="mt-8 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isComposing ? "Composing..." : "Continue to Compare & Edit"}
                </motion.button>
              </div>
            </motion.div>
          ) : stepDataForRender?.type === "dual-editor" ? (
            <DualRichTextEditor
              originalContent={stepDataForRender.originalContent || ""}
              aiEnhancedContent={stepDataForRender.beautifiedContent || ""}
              patientSummaryContent={stepDataForRender.patientSummaryContent || ""}
              onAcceptAllChanges={() => {
                console.log("Accepting all changes")
              }}
              onReBeautify={async () => {
                if (!encounterId) return
                try {
                  const response = await rebeautifyWizard(encounterId, noteContent)
                  setBeautifiedContent(response.enhancedNote)
                  setPatientSummaryContent(response.patientSummary)
                  setComposeTraceId(response.traceId)
                } catch (error) {
                  setComposeError(error instanceof Error ? error.message : "Re-beautify failed")
                }
              }}
              onContentChange={(content, version) => {
                console.log("Content changed:", version, content)
              }}
              onNavigateNext={() => {
                setCurrentStep(5)
              }}
              onNavigatePrevious={() => {
                setCurrentStep(3)
              }}
            />
          ) : stepDataForRender?.type === "placeholder" || stepDataForRender?.type === "dispatch" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #fafcff 0%, #f8faff 25%, #f4f7ff 50%, #f3f5ff 75%, #fafcff 100%)"
              }}
            >
              <div className="text-center max-w-md">
                <div className="w-24 h-24 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{currentStep}</span>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 mb-2">{stepDataForRender.title}</h2>
                <p className="text-slate-600 mb-8">{stepDataForRender.description}</p>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-8 text-left space-y-2">
                  {stepDataForRender.type === "placeholder" ? (
                    <>
                      <div className="space-y-3">
                        <label className="block text-xs text-slate-600">
                          Payer model
                          <select
                            value={billingInputs.payerModel}
                            onChange={(event) =>
                              setBillingInputs((prev) => ({
                                ...prev,
                                payerModel: event.target.value
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="MEDICARE">Medicare</option>
                            <option value="AETNA_PPO">Aetna PPO</option>
                            <option value="BCBS_PPO">BCBS PPO</option>
                            <option value="SELF_PAY">Self-pay</option>
                          </select>
                        </label>
                        <label className="block text-xs text-slate-600">
                          Monthly baseline revenue (USD)
                          <input
                            type="number"
                            value={billingInputs.monthlyRevenueDollars}
                            onChange={(event) =>
                              setBillingInputs((prev) => ({
                                ...prev,
                                monthlyRevenueDollars: Number(event.target.value || 0)
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block text-xs text-slate-600">
                          Expected coding lift (%)
                          <input
                            type="number"
                            step="0.1"
                            value={billingInputs.expectedCoderLiftPct}
                            onChange={(event) =>
                              setBillingInputs((prev) => ({
                                ...prev,
                                expectedCoderLiftPct: Number(event.target.value || 0)
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block text-xs text-slate-600">
                          Deductible remaining (USD)
                          <input
                            type="number"
                            value={billingInputs.deductibleRemainingDollars}
                            onChange={(event) =>
                              setBillingInputs((prev) => ({
                                ...prev,
                                deductibleRemainingDollars: Number(event.target.value || 0)
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block text-xs text-slate-600">
                          Coinsurance (%)
                          <input
                            type="number"
                            step="0.1"
                            value={billingInputs.coinsurancePct}
                            onChange={(event) =>
                              setBillingInputs((prev) => ({
                                ...prev,
                                coinsurancePct: Number(event.target.value || 0)
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block text-xs text-slate-600">
                          Copay (USD)
                          <input
                            type="number"
                            value={billingInputs.copayDollars}
                            onChange={(event) =>
                              setBillingInputs((prev) => ({
                                ...prev,
                                copayDollars: Number(event.target.value || 0)
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                      </div>

                      {billingPreview && (
                        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs space-y-1">
                          <div>Payer model: {billingPreview.payerModel}</div>
                          <div>Fee schedule: {billingPreview.feeScheduleVersion}</div>
                          <div>Selected CPTs: {billingPreview.selectedCptCodes.join(", ") || "None"}</div>
                          <div>Allowed amount: {formatUsd(billingPreview.allowedAmountCents)}</div>
                          <div>Deductible applied: {formatUsd(billingPreview.deductibleAppliedCents)}</div>
                          <div>Copay: {formatUsd(billingPreview.copayCents)}</div>
                          <div>Coinsurance: {formatUsd(billingPreview.coinsuranceCents)}</div>
                          <div>Estimated charge: {formatUsd(billingPreview.estimatedChargeCents)}</div>
                          <div>Out-of-pocket: {formatUsd(billingPreview.outOfPocketCents)}</div>
                          <div>Expected reimbursement: {formatUsd(billingPreview.expectedReimbursementCents)}</div>
                          <div>Projected revenue delta: {formatUsd(billingPreview.projectedRevenueDeltaCents)}</div>
                        </div>
                      )}

                      <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={attestClinicalAccuracy}
                          onChange={(event) => setAttestClinicalAccuracy(event.target.checked)}
                        />
                        I attest the clinical note is accurate.
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={attestBillingAccuracy}
                          onChange={(event) => setAttestBillingAccuracy(event.target.checked)}
                        />
                        I attest billing selections are accurate and supported.
                      </label>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-700 text-sm">Finalize and dispatch this note package.</p>
                      {finalizationArtifacts.length > 0 && (
                        <ul className="text-xs text-slate-600 space-y-1">
                          {finalizationArtifacts.map((artifact) => (
                            <li key={artifact.id}>
                              {artifact.type}: /api/exports/{artifact.id}
                            </li>
                          ))}
                        </ul>
                      )}
                      {dispatchStatus && <p className="text-xs text-slate-700">Dispatch status: {dispatchStatus}</p>}
                      {finalizationError && <p className="text-xs text-red-600">{finalizationError}</p>}
                    </>
                  )}
                </div>

                <div className="flex justify-center gap-4">
                  <motion.button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={currentStep <= 1}
                  >
                    Back
                  </motion.button>

                  {stepDataForRender.type === "dispatch" ? (
                    <motion.button
                      onClick={() => void handleDispatch()}
                      disabled={isFinalizing}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isFinalizing ? "Dispatching..." : "Dispatch"}
                    </motion.button>
                  ) : (
                    <motion.button
                      onClick={() => setCurrentStep(currentStep + 1)}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={currentStep >= steps.length}
                    >
                      Next
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <>
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                className="w-1/2 bg-white border-r border-slate-200/50 shadow-sm"
              >
                <WorkflowNoteEditor
                  content={noteContent}
                  onChange={setNoteContent}
                  highlightRanges={getHighlightRanges()}
                  disabled={isShowingEvidence}
                  questionsCount={currentStep === 1 || currentStep === 2 ? patientQuestions.length : 0}
                  onShowQuestions={() => setShowPatientQuestions(true)}
                  onInsertText={handleInsertTextToNote}
                />
              </motion.div>

              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
                className="w-1/2 relative overflow-hidden flex flex-col bg-white"
              >
                <motion.div
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 1.0 }}
                  style={{
                    background:
                      activeItemData && activeItemData.gaps && activeItemData.gaps.length > 0
                        ? "linear-gradient(135deg, #fffef9 0%, #fffcf5 25%, #fffaf0 50%, #fef9ec 75%, #fffef9 100%)"
                        : "linear-gradient(135deg, #fafcff 0%, #f8faff 25%, #f4f7ff 50%, #f3f5ff 75%, #fafcff 100%)"
                  }}
                >
                  <motion.div
                    className="absolute inset-0"
                    animate={{
                      background:
                        activeItemData && activeItemData.gaps && activeItemData.gaps.length > 0
                          ? [
                              "linear-gradient(135deg, rgba(255, 248, 220, 0.08) 0%, rgba(255, 253, 235, 0.04) 100%)",
                              "linear-gradient(135deg, rgba(254, 240, 190, 0.10) 0%, rgba(255, 248, 220, 0.06) 100%)",
                              "linear-gradient(135deg, rgba(253, 230, 138, 0.08) 0%, rgba(254, 240, 190, 0.06) 100%)",
                              "linear-gradient(135deg, rgba(252, 211, 77, 0.06) 0%, rgba(253, 230, 138, 0.08) 100%)",
                              "linear-gradient(135deg, rgba(253, 230, 138, 0.06) 0%, rgba(252, 211, 77, 0.04) 100%)",
                              "linear-gradient(135deg, rgba(254, 240, 190, 0.08) 0%, rgba(255, 248, 220, 0.05) 100%)",
                              "linear-gradient(135deg, rgba(255, 248, 220, 0.08) 0%, rgba(255, 253, 235, 0.04) 100%)"
                            ]
                          : [
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)",
                              "linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(129, 140, 248, 0.08) 100%)",
                              "linear-gradient(135deg, rgba(99, 102, 241, 0.10) 0%, rgba(147, 51, 234, 0.08) 100%)",
                              "linear-gradient(135deg, rgba(126, 34, 206, 0.08) 0%, rgba(147, 51, 234, 0.10) 100%)",
                              "linear-gradient(135deg, rgba(147, 51, 234, 0.06) 0%, rgba(126, 34, 206, 0.04) 100%)",
                              "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(79, 70, 229, 0.06) 100%)",
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)"
                            ]
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      times: [0, 0.15, 0.35, 0.55, 0.7, 0.85, 1]
                    }}
                  />
                </motion.div>

                <motion.div
                  className="relative z-20 flex-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.4 }}
                >
                  <AnimatePresence mode="wait">
                    <StepContent
                      key={currentStep}
                      step={currentStepData!}
                      onNext={() => currentStep < 6 && setCurrentStep(currentStep + 1)}
                      onPrevious={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
                      onActiveItemChange={setActiveItemData}
                      onShowEvidence={setIsShowingEvidence}
                      onItemStatusChange={handleStepItemStatusChange}
                      patientQuestions={patientQuestions}
                      onUpdatePatientQuestions={setPatientQuestions}
                      showPatientTray={showPatientQuestions}
                      onShowPatientTray={setShowPatientQuestions}
                      onInsertToNote={handleInsertTextToNote}
                    />
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
