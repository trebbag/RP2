import React, { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  MessageSquare,
  X,
  Edit3,
  Send,
  Users,
  HelpCircle,
  Plus,
  User,
  AlertTriangle
} from "lucide-react"
import { Button } from "../ui/button"
import { Card } from "../ui/card"

interface PatientQuestion {
  id: number
  question: string
  source: string
  priority: "high" | "medium" | "low"
  codeRelated: string
  category: "clinical" | "administrative" | "documentation"
  explanation?: string
}

interface PatientQuestionsPopupProps {
  questions: PatientQuestion[]
  isOpen: boolean
  onClose: () => void
  onUpdateQuestions: (questions: PatientQuestion[]) => void
  onInsertToNote?: (text: string, questionId: number) => void
}

export function PatientQuestionsPopup({
  questions,
  isOpen,
  onClose,
  onUpdateQuestions,
  onInsertToNote
}: PatientQuestionsPopupProps) {
  const [activeTextEditor, setActiveTextEditor] = useState<number | null>(null)
  const [editorText, setEditorText] = useState("")
  const [hoveredQuestion, setHoveredQuestion] = useState<number | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)

  const handleDismissQuestion = (questionId: number) => {
    const updatedQuestions = questions.filter((q) => q.id !== questionId)
    onUpdateQuestions(updatedQuestions)
  }

  const handleOpenTextEditor = (questionId: number, initialText: string) => {
    setActiveTextEditor(questionId)
    setEditorText(initialText)
  }

  const handleInsertText = (questionId: number) => {
    if (onInsertToNote && editorText.trim()) {
      onInsertToNote(editorText, questionId)
      setActiveTextEditor(null)
      setEditorText("")
      handleDismissQuestion(questionId)
    }
  }

  const getQuestionExplanation = (question: PatientQuestion) => {
    const questionLower = question.question.toLowerCase()
    const sourceLower = question.source.toLowerCase()

    if (questionLower.includes("smoking") || sourceLower.includes("smoking") || questionLower.includes("tobacco")) {
      return {
        gap: "Missing tobacco use documentation",
        clinical:
          "Current smoking status is required for accurate cardiovascular risk stratification, proper ICD-10 coding (Z87.891, F17.210), and quality measure reporting (CMS 165v12).",
        coding:
          "Without smoking history, you may miss billing opportunities for tobacco cessation counseling and risk assessment codes."
      }
    }

    if (questionLower.includes("pack") || questionLower.includes("year")) {
      return {
        gap: "Missing quantitative smoking history",
        clinical:
          "Pack-year calculation is essential for lung cancer screening eligibility, COPD risk assessment, and cardiovascular disease risk stratification.",
        coding:
          "Pack-year history enables proper risk stratification coding and supports preventive screening recommendations."
      }
    }

    if (questionLower.includes("cholesterol") || questionLower.includes("lipid") || questionLower.includes("ldl")) {
      return {
        gap: "Missing recent lipid profile values",
        clinical:
          "Current lipid values are required to confirm hyperlipidemia diagnosis, guide statin therapy decisions, and support quality measures.",
        coding:
          "Without recent lipid values, hyperlipidemia diagnosis may be questioned, and you cannot bill for appropriate lipid management."
      }
    }

    if (questionLower.includes("weight") || questionLower.includes("bmi")) {
      return {
        gap: "Missing current weight/BMI documentation",
        clinical:
          "Current weight is mandatory for BMI calculation, obesity diagnosis coding, medication dosing accuracy, and quality reporting.",
        coding:
          "Missing weight/BMI prevents proper obesity-related diagnosis coding and billing for weight management counseling services."
      }
    }

    if (questionLower.includes("family history") || questionLower.includes("family")) {
      return {
        gap: "Incomplete family history documentation",
        clinical:
          "Family history of cardiovascular disease affects risk stratification and influences screening recommendations.",
        coding:
          "Family history supports enhanced risk factor coding and justifies more frequent monitoring and preventive interventions."
      }
    }

    if (questionLower.includes("blood pressure") || questionLower.includes("hypertension")) {
      return {
        gap: "Missing blood pressure trend documentation",
        clinical:
          "Blood pressure trends are essential for hypertension staging, treatment effectiveness monitoring, and quality measure compliance.",
        coding:
          "Proper BP documentation enables accurate hypertension coding and supports medical necessity for monitoring."
      }
    }

    if (questionLower.includes("medication") || questionLower.includes("drug")) {
      return {
        gap: "Incomplete medication reconciliation",
        clinical:
          "Current medication list is required for drug interaction screening, adherence assessment, and quality reporting.",
        coding:
          "Complete medication documentation enables proper polypharmacy management coding and supports MTM services billing."
      }
    }

    if (questionLower.includes("alcohol") || questionLower.includes("drinking")) {
      return {
        gap: "Missing alcohol use documentation",
        clinical:
          "Alcohol consumption assessment is required for liver function evaluation, drug interaction screening, and quality measures.",
        coding:
          "Alcohol use documentation enables appropriate substance use disorder coding and supports preventive counseling services."
      }
    }

    return {
      gap: "Documentation gap identified",
      clinical:
        "This information helps complete clinical documentation gaps identified during the coding review process.",
      coding: "Addressing this gap ensures comprehensive documentation that supports accurate coding and billing."
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-amber-50/50 to-orange-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <MessageSquare size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Patient Follow-up Questions</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {questions.length} question{questions.length !== 1 ? "s" : ""} to complete documentation
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/60 transition-colors group"
              >
                <X size={18} className="text-slate-400 group-hover:text-slate-600" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative"
                  >
                    <Card className="p-5 hover:shadow-md transition-all duration-200 border border-slate-200/60 bg-gradient-to-r from-white to-slate-50/30">
                      <div className="flex items-start gap-4 mb-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            question.priority === "high"
                              ? "bg-red-100 text-red-600"
                              : question.priority === "medium"
                                ? "bg-amber-100 text-amber-600"
                                : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          <User size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className={`text-xs px-3 py-1 rounded-full font-medium ${
                                question.priority === "high"
                                  ? "bg-red-100 text-red-700"
                                  : question.priority === "medium"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {question.priority} priority
                            </span>
                            <span className="text-xs text-slate-500">{question.source}</span>

                            <div
                              className="relative"
                              onMouseEnter={(e) => {
                                setHoveredQuestion(question.id)
                                const rect = e.currentTarget.getBoundingClientRect()
                                setTooltipPosition({
                                  x: rect.left + rect.width / 2,
                                  y: rect.top - 10
                                })
                              }}
                              onMouseLeave={() => {
                                setHoveredQuestion(null)
                                setTooltipPosition(null)
                              }}
                            >
                              <motion.div
                                className="flex items-center gap-1.5 cursor-help text-slate-400 hover:text-blue-500 transition-colors"
                                whileHover={{ scale: 1.05 }}
                              >
                                <HelpCircle size={12} />
                                <span className="text-xs">Why?</span>
                              </motion.div>

                              <AnimatePresence>
                                {hoveredQuestion === question.id && tooltipPosition && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                    className="fixed w-96 p-4 bg-slate-800/95 text-white text-xs rounded-lg shadow-xl backdrop-blur-sm pointer-events-none"
                                    style={{
                                      zIndex: 10000,
                                      left: tooltipPosition.x,
                                      top: tooltipPosition.y,
                                      transform: "translate(-50%, -100%)",
                                      maxWidth: "24rem"
                                    }}
                                  >
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <div className="font-medium text-amber-300 mb-2">
                                          {getQuestionExplanation(question).gap}
                                        </div>
                                        <div className="leading-relaxed mb-2">
                                          <span className="text-blue-300 font-medium">Clinical Impact:</span>
                                          <br />
                                          {getQuestionExplanation(question).clinical}
                                        </div>
                                        <div className="leading-relaxed">
                                          <span className="text-green-300 font-medium">Coding/Billing Impact:</span>
                                          <br />
                                          {getQuestionExplanation(question).coding}
                                        </div>
                                      </div>
                                    </div>
                                    <div
                                      className="absolute top-full left-1/2 -translate-x-1/2"
                                      style={{
                                        width: 0,
                                        height: 0,
                                        borderLeft: "6px solid transparent",
                                        borderRight: "6px solid transparent",
                                        borderTop: "6px solid rgba(30, 41, 59, 0.95)"
                                      }}
                                    />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          <div className="mb-3">
                            <p className="text-slate-800 font-medium leading-relaxed">"{question.question}"</p>
                          </div>

                          <div className="text-xs text-slate-500">
                            Related to: <span className="font-medium text-slate-700">{question.codeRelated}</span>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {activeTextEditor === question.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 overflow-hidden"
                          >
                            <div className="bg-white rounded-lg border border-slate-200 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Edit3 size={14} className="text-blue-600" />
                                <span className="text-sm font-medium text-slate-700">Patient Response</span>
                              </div>
                              <textarea
                                value={editorText}
                                onChange={(e) => setEditorText(e.target.value)}
                                placeholder="Enter the patient's response to this question..."
                                className="w-full h-24 p-3 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                autoFocus
                              />
                              <div className="flex items-center justify-between mt-3">
                                <div className="text-xs text-slate-500">
                                  This will be inserted into the appropriate section of your note
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setActiveTextEditor(null)}
                                    className="h-8 px-3 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleInsertText(question.id)}
                                    disabled={!editorText.trim()}
                                    className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700"
                                  >
                                    <Plus size={12} className="mr-1" />
                                    Insert to Note
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleOpenTextEditor(question.id, `Patient response: ${question.question.toLowerCase()}`)
                          }
                          disabled={activeTextEditor === question.id}
                          className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 flex-1"
                        >
                          <Edit3 size={12} className="mr-1" />
                          Ask Patient
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => console.log("Sending question to patient portal:", question.id)}
                          className="h-8 px-3 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <Send size={12} className="mr-1" />
                          Send to Portal
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => console.log("Forwarding question to staff:", question.id)}
                          className="h-8 px-3 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                        >
                          <Users size={12} className="mr-1" />
                          Forward to Staff
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDismissQuestion(question.id)}
                          className="h-8 px-3 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          <X size={12} className="mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Address these questions during your patient encounter to improve documentation quality
                </div>
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onUpdateQuestions([])
                      onClose()
                    }}
                    className="h-9 px-4"
                  >
                    Clear All Questions
                  </Button>
                  <Button size="sm" onClick={onClose} className="h-9 px-6 bg-slate-800 hover:bg-slate-900">
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
