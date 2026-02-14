import React, { useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Circle,
  AlertCircle,
  Eye,
  EyeOff,
  Filter,
  Shield,
  Zap,
  Target,
  Lightbulb,
  Settings,
  MessageSquare,
  AlertTriangle
} from "lucide-react"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { Badge } from "../ui/badge"
import { PatientQuestionsPopup } from "./PatientQuestionsPopup"

interface Item {
  id: number
  title: string
  status: "pending" | "completed" | "in-progress" | "confirmed" | "rejected"
  details: string
  priority: "high" | "medium" | "low"
  category: "ICD-10" | "CPT" | "Public Health"
  codeType?: string
  confidence?: number
  docSupport?: "strong" | "moderate" | "weak"
  gaps?: string[]
  evidence?: string[]
  why: string
  how: string
  what: string
}

interface PatientQuestion {
  id: number
  question: string
  source: string
  priority: "high" | "medium" | "low"
  codeRelated: string
  category: "clinical" | "administrative" | "documentation"
}

interface Step {
  id: number
  title: string
  description: string
  type?: string
  stepType?: "selected" | "suggested"
  totalSelected?: number
  totalSuggestions?: number
  items?: any[]
  existingCodes?: any[]
  suggestedCodes?: any[]
  patientQuestions?: PatientQuestion[]
}

interface StepContentProps {
  step: Step
  onNext: () => void
  onPrevious: () => void
  onActiveItemChange?: (item: Item | null) => void
  onShowEvidence?: (show: boolean) => void
  onItemStatusChange?: (item: Item, status: Item["status"]) => void
  patientQuestions?: PatientQuestion[]
  onUpdatePatientQuestions?: (questions: PatientQuestion[]) => void
  showPatientTray?: boolean
  onShowPatientTray?: (show: boolean) => void
  onInsertToNote?: (text: string) => void
}

const enhancedItems = (originalItems: any[], stepId: number): Item[] => {
  if (!originalItems || !Array.isArray(originalItems)) return []

  return originalItems
    .map((item, index) => {
      if (!item || !item.id || !item.title) return null

      const priority = (["high", "medium", "low"] as const)[index % 3]

      let category: Item["category"]
      if (item.codeType === "CPT") {
        category = "CPT"
      } else if (item.codeType === "Public Health") {
        category = "Public Health"
      } else {
        category = "ICD-10"
      }

      let why: string
      let how: string
      let what: string

      switch (stepId) {
        case 1:
          why =
            "Accurate diagnostic coding ensures proper billing, supports medical necessity, and provides clear communication with other healthcare providers about the patient's condition."
          how =
            "Verify the code against the patient's documented symptoms, examination findings, and diagnostic results. Confirm the code specificity and ensure it aligns with current ICD-10 guidelines."
          what = `${item.details || "No details available"} — This diagnostic code requires review to ensure accuracy and specificity for optimal patient care documentation and billing compliance.`
          break
        case 2:
          why =
            "AI-suggested codes help ensure comprehensive diagnosis capture and may identify conditions that could be overlooked, improving both patient care and billing accuracy."
          how =
            "Evaluate each suggested code against the patient's presentation and documented findings. Accept codes that are clinically relevant and supported by documentation."
          what = `${item.details || "No details available"} — This AI recommendation should be evaluated for clinical relevance and documentation support before adding to the patient's diagnosis list.`
          break
        default:
          why =
            "This item requires attention to ensure complete and accurate medical documentation that meets clinical and regulatory standards."
          how =
            "Follow established protocols to review and complete this documentation requirement systematically and thoroughly."
          what = `${item.details || "No details available"} — Complete this requirement to maintain documentation integrity and compliance.`
      }

      return {
        ...item,
        priority,
        category,
        codeType: item.codeType || "ICD-10",
        why,
        how,
        what
      }
    })
    .filter(Boolean) as Item[]
}

const isCompletedStatus = (status: Item["status"]) => status === "completed" || status === "confirmed"

export function StepContent({
  step,
  onNext,
  onPrevious,
  onActiveItemChange,
  onShowEvidence,
  onItemStatusChange,
  patientQuestions = [],
  onUpdatePatientQuestions,
  showPatientTray: externalShowPatientTray,
  onShowPatientTray,
  onInsertToNote
}: StepContentProps) {
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [items, setItems] = useState<Item[]>(step.items ? enhancedItems(step.items, step.id) : [])
  const [hideCompleted, setHideCompleted] = useState(false)
  const [showItemsPanel, setShowItemsPanel] = useState(false)
  const [isCarouselHovered, setIsCarouselHovered] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)

  React.useEffect(() => {
    setItems(step.items ? enhancedItems(step.items, step.id) : [])
    setActiveItemIndex(0)
    setShowEvidence(false)
  }, [step.id])

  React.useEffect(() => {
    onShowEvidence?.(showEvidence)
  }, [showEvidence, onShowEvidence])

  const showPatientTray = externalShowPatientTray !== undefined ? externalShowPatientTray : false
  const setShowPatientTray = onShowPatientTray || (() => {})

  const filteredItems = hideCompleted ? items.filter((item) => item && !isCompletedStatus(item.status)) : items

  const adjustedActiveIndex =
    filteredItems.length > 0 ? Math.min(Math.max(0, activeItemIndex), filteredItems.length - 1) : 0
  const activeItem = filteredItems.length > 0 ? filteredItems[adjustedActiveIndex] : null

  React.useEffect(() => {
    onActiveItemChange?.(activeItem)
  }, [activeItem, onActiveItemChange])

  const updateItemStatus = (itemId: number, status: Item["status"]) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, status } : item)))

    const changed = items.find((item) => item.id === itemId)
    if (changed) {
      onItemStatusChange?.({ ...changed, status }, status)
    }
  }

  const getStatusIcon = (status: Item["status"]) => {
    switch (status) {
      case "completed":
      case "confirmed":
        return <Check size={14} className="text-emerald-600" />
      case "in-progress":
        return <AlertCircle size={14} className="text-amber-500" />
      default:
        return <Circle size={14} className="text-slate-400" />
    }
  }

  const groupedItems = useMemo(() => {
    const groups: Record<string, Item[]> = {}
    filteredItems.forEach((item) => {
      const key = item.category || "Unknown"
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    })
    return groups
  }, [filteredItems])

  const progressValue =
    items.length > 0 ? (items.filter((item) => isCompletedStatus(item.status)).length / items.length) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col"
    >
      <div className="flex-shrink-0 bg-white/95 backdrop-blur-md border-b border-white/30 px-4 py-6 shadow-lg shadow-slate-900/10">
        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-medium ${
                  step.stepType === "selected"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600"
                    : step.stepType === "suggested"
                      ? "bg-gradient-to-r from-violet-500 to-purple-600"
                      : "bg-gradient-to-r from-blue-500 to-indigo-600"
                }`}
              >
                {step.stepType === "selected" ? (
                  "✓"
                ) : step.stepType === "suggested" ? (
                  <Zap size={14} className="text-white" />
                ) : (
                  step.id
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    className={`font-semibold ${
                      step.id === 1
                        ? "text-xl bg-gradient-to-r from-slate-800 to-emerald-700 bg-clip-text text-transparent"
                        : step.id === 2
                          ? "text-xl bg-gradient-to-r from-slate-800 to-purple-600 bg-clip-text text-transparent"
                          : "text-slate-800"
                    }`}
                  >
                    {step.title}
                  </h2>
                  {step.stepType && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        step.stepType === "selected"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-violet-100 text-violet-700"
                      }`}
                    >
                      {step.stepType === "selected" ? "Your Codes" : "AI Suggestions"}
                    </span>
                  )}
                </div>
                {step.id !== 1 && <p className="text-sm text-slate-600">{step.description}</p>}
              </div>
            </div>

            {(step.id === 1 || step.id === 2) && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-emerald-600" />
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-emerald-700">Selected:</span>
                    <span className="text-sm font-bold text-emerald-800">{step.totalSelected || 0}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-violet-600" />
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-violet-700">AI Suggested:</span>
                    <span className="text-sm font-bold text-violet-800">{step.totalSuggestions || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Progress</span>
              <span className="text-slate-500">
                {items.filter((item) => isCompletedStatus(item.status)).length}/{items.length}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <motion.div
                className={`h-1.5 rounded-full ${
                  step.stepType === "selected"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : step.stepType === "suggested"
                      ? "bg-gradient-to-r from-violet-500 to-purple-500"
                      : "bg-gradient-to-r from-blue-500 to-indigo-500"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${progressValue}%` }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      <div
        className="flex-none relative group"
        style={{ height: "30vh" }}
        onMouseEnter={() => setIsCarouselHovered(true)}
        onMouseLeave={() => setIsCarouselHovered(false)}
      >
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowItemsPanel(true)}
              className="font-medium text-slate-700 text-sm bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm hover:bg-white hover:shadow-md transition-all duration-200 cursor-pointer border border-transparent hover:border-slate-200 flex items-center gap-1"
            >
              <Filter size={12} />
              Items ({filteredItems.length}
              {hideCompleted && items.length !== filteredItems.length ? ` of ${items.length}` : ""})
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setHideCompleted(!hideCompleted)
                setActiveItemIndex(0)
              }}
              className="h-7 px-2 bg-white/90 backdrop-blur-sm border-slate-200 hover:bg-white text-xs"
              title={hideCompleted ? "Show completed items" : "Hide completed items"}
            >
              {hideCompleted ? <EyeOff size={12} /> : <Eye size={12} />}
              <span className="ml-1">{hideCompleted ? "Show" : "Hide"} Done</span>
            </Button>
          </div>

          {filteredItems.length > 1 && (
            <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200/50 p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newIndex = adjustedActiveIndex > 0 ? adjustedActiveIndex - 1 : filteredItems.length - 1
                  const originalIndex = items.findIndex((item) => item.id === filteredItems[newIndex].id)
                  setActiveItemIndex(originalIndex)
                }}
                className="h-6 w-6 p-0 hover:bg-slate-100"
                disabled={filteredItems.length <= 1}
              >
                <ChevronLeft size={14} />
              </Button>
              <div className="text-xs text-slate-600 px-2 font-medium min-w-[3rem] text-center">
                {adjustedActiveIndex + 1}/{filteredItems.length}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newIndex = adjustedActiveIndex < filteredItems.length - 1 ? adjustedActiveIndex + 1 : 0
                  const originalIndex = items.findIndex((item) => item.id === filteredItems[newIndex].id)
                  setActiveItemIndex(originalIndex)
                }}
                className="h-6 w-6 p-0 hover:bg-slate-100"
                disabled={filteredItems.length <= 1}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {filteredItems.length > 1 && isCarouselHovered && (
            <>
              <motion.button
                onClick={() => {
                  const newIndex = adjustedActiveIndex > 0 ? adjustedActiveIndex - 1 : filteredItems.length - 1
                  const originalIndex = items.findIndex((item) => item.id === filteredItems[newIndex].id)
                  setActiveItemIndex(originalIndex)
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/95 backdrop-blur-sm border border-slate-200/50 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
                disabled={filteredItems.length <= 1}
                initial={{ opacity: 0, x: -10, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                whileHover={{ scale: 1.05, x: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <ChevronLeft size={18} className="text-slate-600 group-hover:text-slate-800 transition-colors" />
              </motion.button>

              <motion.button
                onClick={() => {
                  const newIndex = adjustedActiveIndex < filteredItems.length - 1 ? adjustedActiveIndex + 1 : 0
                  const originalIndex = items.findIndex((item) => item.id === filteredItems[newIndex].id)
                  setActiveItemIndex(originalIndex)
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/95 backdrop-blur-sm border border-slate-200/50 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
                disabled={filteredItems.length <= 1}
                initial={{ opacity: 0, x: 10, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                whileHover={{ scale: 1.05, x: 2 }}
                whileTap={{ scale: 0.95 }}
              >
                <ChevronRight size={18} className="text-slate-600 group-hover:text-slate-800 transition-colors" />
              </motion.button>
            </>
          )}
        </AnimatePresence>

        <div className="h-full relative">
          {filteredItems.length > 0 ? (
            <div className="absolute inset-x-4 top-4 bottom-0 flex items-center justify-center overflow-visible rounded-xl">
              <div className="relative w-full h-full" style={{ padding: "0 140px" }}>
                {filteredItems.map((item, index) => {
                  const offset = index - adjustedActiveIndex
                  const absOffset = Math.abs(offset)
                  if (absOffset > 2) return null

                  const scale = absOffset === 0 ? 1 : absOffset === 1 ? 0.88 : 0.76
                  const opacity = absOffset === 0 ? 1 : absOffset === 1 ? 0.6 : 0.35
                  const translateX = offset * 180
                  const zIndex = 10 - absOffset

                  return (
                    <motion.div
                      key={item.id}
                      style={{
                        transform: `translateX(${translateX}px) scale(${scale})`,
                        opacity,
                        zIndex
                      }}
                      className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-[420px] transition-all duration-300 ${
                        absOffset === 0 ? "" : "pointer-events-none"
                      }`}
                    >
                      <Card
                        className={`h-full p-5 rounded-2xl border shadow-xl transition-all ${
                          absOffset === 0 ? "bg-white border-slate-200/80" : "bg-white/80 border-slate-200/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusIcon(item.status)}
                              <span className="text-xs text-slate-500 capitalize">{item.status.replace("-", " ")}</span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                              {item.title}
                            </h3>
                          </div>
                          <Badge
                            className={`text-xs ${
                              item.category === "ICD-10"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : item.category === "CPT"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            {item.category}
                          </Badge>
                        </div>

                        <p className="mt-3 text-xs text-slate-600 leading-relaxed line-clamp-3">{item.details}</p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge className="bg-slate-100 text-slate-600">Priority: {item.priority}</Badge>
                          {typeof item.confidence === "number" && (
                            <Badge className="bg-blue-50 text-blue-700">Confidence {item.confidence}%</Badge>
                          )}
                          {item.docSupport && (
                            <Badge
                              className={`${
                                item.docSupport === "strong"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : item.docSupport === "moderate"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                              }`}
                            >
                              {item.docSupport} support
                            </Badge>
                          )}
                        </div>

                        {item.gaps && item.gaps.length > 0 && (
                          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
                              <AlertTriangle size={12} />
                              Documentation gaps
                            </div>
                            <ul className="mt-2 space-y-1 text-xs text-amber-700">
                              {item.gaps.map((gap) => (
                                <li key={gap}>• {gap}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {absOffset === 0 && (
                          <div className="mt-4 flex items-center gap-2">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => updateItemStatus(item.id, "completed")}
                            >
                              <Check size={14} className="mr-1" />
                              Mark Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateItemStatus(item.id, "in-progress")}
                            >
                              <AlertCircle size={14} className="mr-1" />
                              Needs Review
                            </Button>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-slate-500">No items for this step.</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white/95 backdrop-blur-md border-t border-white/30 shadow-lg shadow-slate-900/10 p-6 overflow-hidden">
        {activeItem ? (
          <div className="h-full grid grid-cols-12 gap-6">
            <div className="col-span-7 space-y-4 overflow-auto pr-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-slate-800">Clinical Context</h4>
                  <p className="text-sm text-slate-600">Use this guidance to validate documentation.</p>
                </div>
                <Button
                  variant={showEvidence ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowEvidence(!showEvidence)}
                  className={showEvidence ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  {showEvidence ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />}
                  {showEvidence ? "Hide Evidence" : "Show Evidence"}
                </Button>
              </div>

              <div className="relative pl-5">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-rose-400 to-rose-300 rounded-full"></div>
                <div className="flex items-start gap-3">
                  <Target size={16} className="text-rose-500 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h5 className="font-semibold text-slate-800 mb-1.5">Why This Matters</h5>
                    <p className="text-slate-600 leading-snug text-sm">{activeItem.why}</p>
                  </div>
                </div>
              </div>

              <div className="relative pl-5">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-indigo-300 rounded-full"></div>
                <div className="flex items-start gap-3">
                  <Settings size={16} className="text-blue-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h5 className="font-semibold text-slate-800 mb-1.5">How to Address</h5>
                    <p className="text-slate-600 leading-snug text-sm">{activeItem.how}</p>
                  </div>
                </div>
              </div>

              <div className="relative pl-5">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 to-emerald-300 rounded-full"></div>
                <div className="flex items-start gap-3">
                  <Lightbulb size={16} className="text-emerald-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h5 className="font-semibold text-slate-800 mb-1.5">Details & Next Steps</h5>
                    <div className="space-y-1.5">
                      <p className="text-slate-700 font-medium text-sm">{activeItem.title}</p>
                      <p className="text-slate-600 leading-snug text-sm italic">{activeItem.what}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-5 space-y-4 overflow-auto">
              <Card className="p-4 border border-slate-200/70">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-semibold text-slate-800 text-sm">Evidence Snapshot</h5>
                  <Badge className="bg-slate-100 text-slate-600">{activeItem.codeType || "ICD-10"}</Badge>
                </div>
                {activeItem.evidence && activeItem.evidence.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeItem.evidence.map((evidence) => (
                      <span
                        key={evidence}
                        className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                      >
                        {evidence}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No evidence snippets available.</p>
                )}
              </Card>

              <Card className="p-4 border border-slate-200/70">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-semibold text-slate-800 text-sm">Documentation Status</h5>
                  <span className="text-xs text-slate-500 capitalize">{activeItem.status.replace("-", " ")}</span>
                </div>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Confidence</span>
                    <span className="font-medium text-slate-800">{activeItem.confidence ?? 0}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Support</span>
                    <span className="font-medium text-slate-800">{activeItem.docSupport ?? "moderate"}</span>
                  </div>
                </div>
              </Card>

              {patientQuestions.length > 0 && (
                <Card className="p-4 border border-amber-200 bg-amber-50/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-semibold text-amber-800 text-sm">Patient Questions</h5>
                      <p className="text-xs text-amber-700">
                        {patientQuestions.length} follow-up question{patientQuestions.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => setShowPatientTray(true)}
                    >
                      <MessageSquare size={14} className="mr-1" />
                      Review
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">No active items.</div>
        )}
      </div>

      {(step.id === 1 || step.id === 2) && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="fixed bottom-0 left-1/2 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-white/30 p-4 shadow-lg shadow-slate-900/10"
          style={{ boxShadow: "0 -4px 16px rgba(15, 23, 42, 0.08), 0 -1px 4px rgba(15, 23, 42, 0.04)" }}
        >
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={step.id === 1}
              className="flex items-center gap-2 h-11 px-5"
              size="sm"
            >
              <ChevronLeft size={16} />
              Previous Step
            </Button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Step {step.id} of 6</span>
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              <span>{step.title}</span>
            </div>
            <Button
              onClick={onNext}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white h-11 px-5"
              size="sm"
            >
              Next Step
              <ChevronRight size={16} />
            </Button>
          </div>
        </motion.div>
      )}

      {!(step.id === 1 || step.id === 2) && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl p-3 shadow-lg shadow-slate-900/10 z-30"
        >
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={step.id === 0}
              className="flex items-center gap-2 h-9 px-4"
              size="sm"
            >
              <ChevronLeft size={16} />
              Previous Step
            </Button>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Step {step.id} of 6</span>
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              <span>{step.title}</span>
            </div>

            <Button
              onClick={onNext}
              disabled={step.id === 6}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white h-9 px-4"
              size="sm"
            >
              Next Step
              <ChevronRight size={16} />
            </Button>
          </div>
        </motion.div>
      )}

      <PatientQuestionsPopup
        questions={patientQuestions}
        isOpen={showPatientTray}
        onClose={() => setShowPatientTray(false)}
        onUpdateQuestions={onUpdatePatientQuestions || (() => {})}
        onInsertToNote={(text, questionId) => {
          if (onInsertToNote) {
            onInsertToNote(text)
          }
          console.log("Inserting text to note:", text, "for question:", questionId)
        }}
      />

      <AnimatePresence>
        {showItemsPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            onClick={() => setShowItemsPanel(false)}
          >
            <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-1/2 left-[75%] -translate-x-1/2 -translate-y-1/2 w-[30vw] h-[60vh] bg-white rounded-xl shadow-2xl border border-slate-200/50 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-full">
                <div className="w-32 bg-slate-50/80 border-r border-slate-200/50 flex flex-col">
                  <div className="p-3 border-b border-slate-200/50">
                    <div className="text-xs font-medium text-slate-600 mb-3">Filter Items</div>
                    <div className="space-y-1">
                      {Object.keys(groupedItems).map((key) => (
                        <button
                          key={key}
                          onClick={() => {
                            const originalIndex = items.findIndex((item) => item.category === key)
                            if (originalIndex >= 0) setActiveItemIndex(originalIndex)
                            setShowItemsPanel(false)
                          }}
                          className="w-full text-left px-2 py-2 text-xs rounded-lg transition-all text-slate-600 hover:bg-white hover:text-slate-800 hover:shadow-sm"
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 p-3 text-xs text-slate-500 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Total Items</span>
                      <span className="font-medium text-slate-700">{items.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Filtered</span>
                      <span className="font-medium text-slate-700">{filteredItems.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Completed</span>
                      <span className="font-medium text-emerald-600">
                        {items.filter((item) => isCompletedStatus(item.status)).length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b border-slate-100/50 bg-white/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                        <Filter size={14} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">Items Overview</h3>
                        <p className="text-sm text-slate-500">
                          {filteredItems.length} of {items.length} items
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowItemsPanel(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <ChevronRight size={16} className="text-slate-400" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filteredItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          const originalIndex = items.findIndex((originalItem) => originalItem.id === item.id)
                          setActiveItemIndex(originalIndex)
                          setHideCompleted(false)
                          setShowItemsPanel(false)
                        }}
                        className="w-full text-left p-3 rounded-lg bg-white hover:bg-gradient-to-r hover:from-slate-50 hover:to-white border border-slate-200/50 hover:border-slate-300/50 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-slate-100 text-slate-500">
                            {getStatusIcon(item.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h6 className="font-medium text-sm text-slate-800 mb-2 line-clamp-1">{item.title}</h6>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-2">{item.details}</p>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    item.priority === "high"
                                      ? "bg-red-400"
                                      : item.priority === "medium"
                                        ? "bg-amber-400"
                                        : "bg-green-400"
                                  }`}
                                />
                                <span className="text-xs text-slate-500 capitalize">{item.priority}</span>
                              </div>
                              <span className="text-slate-300">•</span>
                              <span className="text-xs text-slate-500">{item.category}</span>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
