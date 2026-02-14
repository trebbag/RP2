import React, { useState, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  RefreshCw,
  Check,
  ToggleRight,
  User,
  Sparkles,
  FileText,
  Eye,
  Edit3,
  Info,
  Brain,
  Plus,
  Stethoscope
} from "lucide-react"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Badge } from "../ui/badge"
import { ScrollArea } from "../ui/scroll-area"
import { Checkbox } from "../ui/checkbox"
import { Textarea } from "../ui/textarea"

interface DualRichTextEditorProps {
  originalContent: string
  aiEnhancedContent: string
  patientSummaryContent: string
  onAcceptAllChanges?: () => void
  onReBeautify?: () => void
  onContentChange?: (content: string, version: "original" | "enhanced" | "summary") => void
  onNavigateNext?: () => void
  onNavigatePrevious?: () => void
}

type EditorVersion = "enhanced" | "summary"

export function DualRichTextEditor({
  originalContent,
  aiEnhancedContent,
  patientSummaryContent,
  onAcceptAllChanges,
  onReBeautify,
  onContentChange,
  onNavigateNext,
  onNavigatePrevious
}: DualRichTextEditorProps) {
  const [rightVersion, setRightVersion] = useState<EditorVersion>("enhanced")
  const [originalText, setOriginalText] = useState(originalContent)
  const [enhancedText, setEnhancedText] = useState(aiEnhancedContent)
  const [summaryText, setSummaryText] = useState(patientSummaryContent)

  const [acceptedVersions, setAcceptedVersions] = useState({
    enhanced: false,
    summary: false
  })

  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [showPlanningPanel, setShowPlanningPanel] = useState(false)
  const [showPatientReviewPanel, setShowPatientReviewPanel] = useState(false)

  const [nextSteps, setNextSteps] = useState([
    { id: 1, text: "Follow-up appointment in 2 weeks", checked: false },
    { id: 2, text: "Lab work - CBC and comprehensive metabolic panel", checked: false },
    { id: 3, text: "Patient education on medication compliance", checked: false },
    { id: 4, text: "Order ECG and cardiac enzymes", checked: false },
    { id: 5, text: "Schedule cardiology consultation", checked: false },
    { id: 6, text: "Order chest X-ray", checked: false }
  ])
  const [customStep, setCustomStep] = useState("")

  const originalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const rightTextareaRef = useRef<HTMLTextAreaElement>(null)

  const handleOriginalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setOriginalText(newContent)
    onContentChange?.(newContent, "original")
  }

  const handleRightChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    if (rightVersion === "enhanced") {
      setEnhancedText(newContent)
      onContentChange?.(newContent, "enhanced")
    } else {
      setSummaryText(newContent)
      onContentChange?.(newContent, "summary")
    }
  }

  const getCurrentRightContent = () => (rightVersion === "enhanced" ? enhancedText : summaryText)

  const styles =
    rightVersion === "enhanced"
      ? {
          background: "linear-gradient(135deg, #fafcff 0%, #f8faff 25%, #f4f7ff 50%, #f3f5ff 75%, #fafcff 100%)",
          headerClass: "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200",
          headerTextClass: "text-blue-800",
          footerClass: "border-blue-200 bg-blue-50/50"
        }
      : {
          background: "linear-gradient(135deg, #fafaff 0%, #f8f8fd 25%, #f6f6fb 50%, #f4f4f9 75%, #fafaff 100%)",
          headerClass: "bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200",
          headerTextClass: "text-violet-800",
          footerClass: "border-violet-200 bg-violet-50/50"
        }

  const handleAcceptVersion = () => {
    setAcceptedVersions((prev) => ({
      ...prev,
      [rightVersion]: !prev[rightVersion]
    }))
  }

  const handleStepToggle = (id: number) => {
    setNextSteps((prev) => prev.map((step) => (step.id === id ? { ...step, checked: !step.checked } : step)))
  }

  const handleAddCustomStep = () => {
    if (customStep.trim()) {
      const newStep = { id: Date.now(), text: customStep.trim(), checked: false }
      setNextSteps((prev) => [...prev, newStep])
      setCustomStep("")
    }
  }

  const isCurrentVersionAccepted = acceptedVersions[rightVersion]
  const areBothVersionsAccepted = acceptedVersions.enhanced && acceptedVersions.summary

  return (
    <>
      <div className="flex h-full w-full">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex-1 bg-white border-r border-slate-200/50 shadow-sm"
        >
          <div className="h-full flex flex-col">
            <div className="bg-slate-50/80 border-b border-slate-200/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                    <Edit3 size={14} className="text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Original Draft</h3>
                    <p className="text-xs text-slate-600 mt-0.5">Your initial medical note</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 px-3 py-2 bg-slate-100/60 rounded-lg border border-slate-200/60">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                      <User size={12} className="text-white" />
                    </div>
                    <div className="text-xs">
                      <div className="font-medium text-slate-800">John Smith</div>
                      <div className="text-slate-600 flex items-center gap-2">
                        <span>ID: PT-789456</span>
                        <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                        <span>Enc: E-2024-0315</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInfoPanel(true)}
                    className="h-8 w-8 p-0 hover:bg-slate-200 text-slate-600 hover:text-slate-800"
                    title="View patient information and visit details"
                  >
                    <Info size={16} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 p-4 bg-white min-h-0">
              <textarea
                ref={originalTextareaRef}
                value={originalText}
                onChange={handleOriginalChange}
                className="w-full h-full resize-none border-none outline-none bg-transparent text-sm leading-relaxed text-slate-900"
                placeholder="Enter your original medical note here..."
                style={{
                  minHeight: "100%",
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif'
                }}
              />
            </div>

            <div className="p-3 border-t border-slate-200/60 bg-slate-50/50">
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Original content</span>
                <span>{originalText.length} characters</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex-1"
          style={{ background: styles.background }}
        >
          <div className="h-full flex flex-col">
            <div className={`${styles.headerClass} border-b p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden"
                    animate={{
                      background:
                        rightVersion === "enhanced"
                          ? "linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6)"
                          : "linear-gradient(135deg, #8b5cf6, #a855f7, #d946ef)",
                      boxShadow:
                        rightVersion === "enhanced"
                          ? "0 4px 20px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                          : "0 4px 20px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                    }}
                    whileHover={{
                      scale: 1.05,
                      boxShadow:
                        rightVersion === "enhanced"
                          ? "0 6px 25px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)"
                          : "0 6px 25px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)"
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatType: "loop", ease: "linear" }}
                    />
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
                    >
                      {rightVersion === "enhanced" ? (
                        <Sparkles size={18} className="text-white drop-shadow-sm" />
                      ) : (
                        <User size={18} className="text-white drop-shadow-sm" />
                      )}
                    </motion.div>
                  </motion.div>
                  <div>
                    <h3 className={`font-semibold ${styles.headerTextClass}`}>
                      {rightVersion === "enhanced" ? "AI Enhanced Version" : "Patient Summary Version"}
                    </h3>
                    <p className="text-xs opacity-70 mt-0.5">
                      {rightVersion === "enhanced"
                        ? "Professionally enhanced medical documentation"
                        : "Patient-friendly summary format"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPlanningPanel(true)}
                    className="h-8 w-8 p-0 hover:bg-blue-100 text-blue-600 hover:text-blue-800"
                    title="AI Planning Assistant"
                  >
                    <Brain size={16} />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPatientReviewPanel(true)}
                    className="h-8 w-8 p-0 hover:bg-violet-100 text-violet-600 hover:text-violet-800"
                    title="Patient Review Panel"
                  >
                    <Eye size={16} />
                  </Button>

                  <motion.button
                    onClick={() => setRightVersion(rightVersion === "enhanced" ? "summary" : "enhanced")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      rightVersion === "enhanced"
                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        : "bg-violet-100 text-violet-700 hover:bg-violet-200"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      animate={{ rotate: rightVersion === "enhanced" ? 0 : 180 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ToggleRight size={14} />
                    </motion.div>
                    Switch to {rightVersion === "enhanced" ? "Summary" : "Enhanced"}
                  </motion.button>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={rightVersion}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 p-4 min-h-0"
              >
                <textarea
                  ref={rightTextareaRef}
                  value={getCurrentRightContent()}
                  onChange={handleRightChange}
                  className="w-full h-full resize-none border-none outline-none bg-white/80 rounded-lg p-4 text-sm leading-relaxed shadow-sm text-slate-900"
                  placeholder={
                    rightVersion === "enhanced"
                      ? "AI-enhanced medical documentation will appear here..."
                      : "Patient-friendly summary will appear here..."
                  }
                  style={{
                    minHeight: "100%",
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif'
                  }}
                />
              </motion.div>
            </AnimatePresence>

            <div className={`p-4 border-t ${styles.footerClass}`}>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Button
                    onClick={handleAcceptVersion}
                    className={`flex-1 font-medium transition-all ${
                      isCurrentVersionAccepted
                        ? "bg-emerald-600 hover:bg-orange-500 text-white"
                        : "bg-emerald-500 hover:bg-emerald-600 text-white"
                    }`}
                    size="sm"
                  >
                    <Check size={14} className="mr-2" />
                    {isCurrentVersionAccepted
                      ? `${rightVersion === "enhanced" ? "Enhanced" : "Summary"} Accepted - Click to Unaccept`
                      : `Accept ${rightVersion === "enhanced" ? "Enhanced" : "Summary"} Version`}
                  </Button>
                  <Button
                    onClick={onReBeautify}
                    variant="outline"
                    size="sm"
                    disabled={isCurrentVersionAccepted}
                    className={`px-4 ${
                      rightVersion === "enhanced"
                        ? "border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        : "border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    }`}
                  >
                    <RefreshCw size={14} className="mr-2" />
                    Re-beautify
                  </Button>
                </div>

                <div className="flex justify-between items-center text-xs opacity-70">
                  <span>{rightVersion === "enhanced" ? "Enhanced content" : "Summary content"}</span>
                  <span>{getCurrentRightContent().length} characters</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${rightVersion === "enhanced" ? "bg-blue-500" : "bg-violet-500"}`}
                    />
                    <span className="opacity-70">
                      Currently viewing: {rightVersion === "enhanced" ? "AI Enhanced" : "Patient Summary"} version
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                        acceptedVersions.enhanced ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Check size={10} />
                      Enhanced
                    </div>
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                        acceptedVersions.summary ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Check size={10} />
                      Summary
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-current/10">
                  <Button variant="outline" size="sm" className="text-xs" onClick={onNavigatePrevious}>
                    ← Back to Compose
                  </Button>
                  <Button
                    size="sm"
                    disabled={!areBothVersionsAccepted}
                    className={`text-xs transition-all ${
                      areBothVersionsAccepted
                        ? "bg-slate-700 hover:bg-slate-800 text-white"
                        : "bg-slate-300 text-slate-500 cursor-not-allowed"
                    }`}
                    onClick={() => {
                      if (areBothVersionsAccepted && onNavigateNext) {
                        onNavigateNext()
                      }
                    }}
                  >
                    {areBothVersionsAccepted ? "Continue to Billing →" : "Accept Both Versions to Continue"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <Dialog open={showInfoPanel} onOpenChange={setShowInfoPanel}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 flex flex-col border-2 border-slate-200/60 shadow-2xl shadow-slate-400/20 bg-white">
          <DialogHeader className="px-6 py-4 border-b-2 border-slate-200/60 bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 flex-shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Info size={22} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Patient Information & Visit Details</h2>
                <p className="text-sm text-slate-600 mt-1">Comprehensive patient data and visit documentation</p>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">Patient information and visit details panel.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="patient-summary" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-3 border-b-2 border-slate-200/40 bg-gradient-to-r from-slate-50/80 via-blue-50/60 to-indigo-50/60 flex-shrink-0">
              <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-white via-blue-50/30 to-indigo-50/30 shadow-md border border-slate-200/60 h-12">
                <TabsTrigger value="patient-summary" className="flex items-center gap-2 px-3 text-sm">
                  <User size={14} />
                  <span className="hidden sm:inline">Patient</span>
                </TabsTrigger>
                <TabsTrigger value="transcript" className="flex items-center gap-2 px-3 text-sm">
                  <FileText size={14} />
                  <span className="hidden sm:inline">Transcript</span>
                </TabsTrigger>
                <TabsTrigger value="codes" className="flex items-center gap-2 px-3 text-sm">
                  <Eye size={14} />
                  <span className="hidden sm:inline">Codes</span>
                </TabsTrigger>
                <TabsTrigger value="unused-suggestions" className="flex items-center gap-2 px-3 text-sm">
                  <Brain size={14} />
                  <span className="hidden sm:inline">Unused AI</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-6">
                  <TabsContent value="patient-summary" className="mt-0 space-y-6">
                    <Card className="p-6 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 text-white">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                          <User size={20} />
                        </div>
                        <div>
                          <div className="text-lg font-semibold">John Smith</div>
                          <div className="text-sm opacity-80">65-year-old male • PT-789456</div>
                        </div>
                      </div>
                    </Card>
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="p-4">
                        <div className="text-xs text-slate-500 mb-1">Primary Provider</div>
                        <div className="text-sm font-medium text-slate-800">Dr. Sarah Johnson</div>
                        <div className="text-xs text-slate-500">Family Medicine</div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-xs text-slate-500 mb-1">Visit Type</div>
                        <div className="text-sm font-medium text-slate-800">Cardiology Follow-up</div>
                        <div className="text-xs text-slate-500">30 min</div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-xs text-slate-500 mb-1">Risk Profile</div>
                        <div className="text-sm font-medium text-slate-800">Moderate Risk</div>
                        <div className="text-xs text-slate-500">Smoking history</div>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="transcript" className="mt-0 space-y-4">
                    <Card className="p-4">
                      <div className="text-sm font-medium text-slate-800 mb-2">Visit Transcript</div>
                      <p className="text-sm text-slate-600">
                        Transcript placeholder. This panel can show a scrollable conversation log.
                      </p>
                    </Card>
                  </TabsContent>

                  <TabsContent value="codes" className="mt-0 space-y-4">
                    <Card className="p-4">
                      <div className="text-sm font-medium text-slate-800 mb-2">Codes Reviewed</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-blue-50 text-blue-700">I25.10</Badge>
                        <Badge className="bg-blue-50 text-blue-700">E78.5</Badge>
                        <Badge className="bg-emerald-50 text-emerald-700">99213</Badge>
                      </div>
                    </Card>
                  </TabsContent>

                  <TabsContent value="unused-suggestions" className="mt-0 space-y-4">
                    <Card className="p-4">
                      <div className="text-sm font-medium text-slate-800 mb-2">Unused AI Suggestions</div>
                      <p className="text-sm text-slate-600">
                        Suggestions not accepted can be reviewed here for future follow-up.
                      </p>
                    </Card>
                  </TabsContent>
                </div>
              </ScrollArea>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlanningPanel} onOpenChange={setShowPlanningPanel}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain size={18} className="text-blue-600" />
              AI Planning Assistant
            </DialogTitle>
            <DialogDescription>Review and customize the recommended next steps for this patient.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {nextSteps.map((step) => (
                <div key={step.id} className="flex items-center gap-3">
                  <Checkbox checked={step.checked} onCheckedChange={() => handleStepToggle(step.id)} />
                  <span className="text-sm text-slate-700">{step.text}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Textarea
                value={customStep}
                onChange={(e) => setCustomStep(e.target.value)}
                placeholder="Add a custom step..."
                className="min-h-[50px]"
              />
              <Button onClick={handleAddCustomStep} className="h-10">
                <Plus size={14} className="mr-1" />
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPatientReviewPanel} onOpenChange={setShowPatientReviewPanel}>
        <DialogContent className="max-w-[96vw] w-[96vw] max-h-[96vh] h-[96vh] p-0 flex flex-col border-0 shadow-2xl bg-gradient-to-br from-slate-50 via-white to-violet-50/30 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Patient Review Dashboard</DialogTitle>
          </DialogHeader>
          <div className="relative px-12 py-8 bg-gradient-to-r from-violet-600/10 via-purple-600/5 to-pink-600/10 backdrop-blur-xl border-b border-white/20">
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #8b5cf6, #a855f7, #d946ef)",
                    boxShadow: "0 8px 32px rgba(139, 92, 246, 0.3), inset 0 2px 0 rgba(255, 255, 255, 0.2)"
                  }}
                >
                  <Eye size={24} className="text-white drop-shadow-lg" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                    Patient Review Dashboard
                  </h2>
                  <p className="text-slate-600 mt-1">AI-assisted clinical insights and summaries</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-full bg-emerald-100 border border-emerald-200">
                  <span className="text-sm font-semibold text-emerald-700">Analysis Complete</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 p-12 overflow-auto">
            <div className="grid grid-cols-12 gap-8 max-w-[1600px] mx-auto">
              <div className="col-span-4 space-y-6">
                <Card className="p-6 bg-gradient-to-br from-white via-blue-50/30 to-violet-50/20 border border-white/40 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800">Health Score</h3>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-slate-800">94</div>
                    <div className="text-sm text-slate-600">/ 100</div>
                    <div className="mt-3 text-emerald-600 font-semibold">Excellent Health Profile</div>
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-white via-amber-50/30 to-orange-50/20 border border-white/40 shadow-xl">
                  <h3 className="font-bold text-slate-800 mb-4">Risk Assessment</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <span className="text-sm font-medium text-slate-700">Cardiovascular</span>
                      <span className="text-sm font-bold text-emerald-600">Low Risk</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-50 border border-yellow-100">
                      <span className="text-sm font-medium text-slate-700">Hypertension</span>
                      <span className="text-sm font-bold text-yellow-600">Monitor</span>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="col-span-5 space-y-6">
                <Card className="p-6 bg-gradient-to-br from-white via-violet-50/30 to-purple-50/20 border border-white/40 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800">AI Insights</h3>
                    <Badge className="bg-violet-100 text-violet-700">Processing</Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    Predictive signals show elevated blood pressure trends and recommend follow-up monitoring.
                  </p>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-white via-emerald-50/30 to-blue-50/20 border border-white/40 shadow-xl">
                  <h3 className="font-bold text-slate-800 mb-4">Recommended Actions</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                      <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center">
                        <Sparkles size={14} className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">Lifestyle Modifications</div>
                        <div className="text-xs text-slate-600">Counseling and follow-up</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">Medication Adherence</div>
                        <div className="text-xs text-slate-600">High likelihood of compliance</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="col-span-3 space-y-6">
                <Card className="p-6 bg-gradient-to-br from-white via-slate-50/30 to-gray-50/20 border border-white/40 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800">Live Vitals</h3>
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Blood Pressure</span>
                      <span className="font-semibold text-red-600">142/88</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Heart Rate</span>
                      <span className="font-semibold text-emerald-600">78 bpm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">O₂ Saturation</span>
                      <span className="font-semibold text-blue-600">97%</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-white via-orange-50/30 to-yellow-50/20 border border-white/40 shadow-xl">
                  <h3 className="font-bold text-slate-800 mb-4">Priority Actions</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
                      <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">1</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">BP Monitoring</p>
                        <p className="text-xs text-slate-600">Schedule follow-up</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">2</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">Patient Education</p>
                        <p className="text-xs text-slate-600">Lifestyle guidance</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>

          <div className="px-12 py-6 bg-gradient-to-r from-white/80 to-violet-50/80 backdrop-blur-xl border-t border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-100 border border-emerald-200">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-sm font-semibold text-emerald-700">Analysis Complete</span>
                </div>
                <span className="text-sm text-slate-600">Generated in 0.847s using 12 AI models</span>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="rounded-full">
                  Export Report
                </Button>
                <Button
                  size="sm"
                  className="rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                >
                  Apply Recommendations
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
