import { useState } from "react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "./ui/alert-dialog"
import { Textarea } from "./ui/textarea"
import { FileText, Activity, Pill, Stethoscope, X, ArrowUpDown } from "lucide-react"

interface SelectedCodesBarProps {
  selectedCodes: {
    codes: number
    prevention: number
    diagnoses: number
    differentials: number
  }
  onUpdateCodes: (codes: { codes: number; prevention: number; diagnoses: number; differentials: number }) => void
  selectedCodesList: any[]
  onRemoveCode?: (code: any, action: "clear" | "return", reasoning?: string) => void
  onChangeCategoryCode?: (code: any, newCategory: "diagnoses" | "differentials") => void
}

export function SelectedCodesBar({
  selectedCodes,
  onUpdateCodes,
  selectedCodesList,
  onRemoveCode,
  onChangeCategoryCode
}: SelectedCodesBarProps) {
  const [activeCategories, setActiveCategories] = useState({
    codes: true,
    prevention: true,
    diagnoses: true,
    differentials: true
  })

  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [selectedCodeToRemove, setSelectedCodeToRemove] = useState<any>(null)
  const [removeReasoning, setRemoveReasoning] = useState("")

  const toggleCategory = (category: string) => {
    setActiveCategories((prev) => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const handleRemoveCode = (code: any) => {
    setSelectedCodeToRemove(code)
    setRemoveReasoning("")
    setShowRemoveDialog(true)
  }

  const confirmRemoval = (action: "clear" | "return") => {
    if (selectedCodeToRemove && onRemoveCode) {
      onRemoveCode(selectedCodeToRemove, action, removeReasoning || undefined)

      // Update the counts
      const updatedCodes = { ...selectedCodes }
      if (selectedCodeToRemove.category) {
        updatedCodes[selectedCodeToRemove.category] = Math.max(0, selectedCodes[selectedCodeToRemove.category] - 1)
      }
      onUpdateCodes(updatedCodes)
    }
    setShowRemoveDialog(false)
    setSelectedCodeToRemove(null)
    setRemoveReasoning("")
  }

  // Helper function to get icon and styling for a code
  const getCodeDisplayInfo = (codeItem: any) => {
    const categoryInfo = {
      codes: {
        icon: FileText,
        color: "bg-blue-500",
        lightColor: "bg-blue-50",
        textColor: "text-blue-700"
      },
      prevention: {
        icon: Stethoscope,
        color: "bg-red-500",
        lightColor: "bg-red-50",
        textColor: "text-red-700"
      },
      diagnoses: {
        icon: Activity,
        color: "bg-purple-500",
        lightColor: "bg-purple-50",
        textColor: "text-purple-700"
      },
      differentials: {
        icon: Pill,
        color: "bg-green-500",
        lightColor: "bg-green-50",
        textColor: "text-green-700"
      }
    }

    const categoryStyle = categoryInfo[codeItem.category] || categoryInfo.diagnoses

    return {
      ...codeItem,
      icon: categoryStyle.icon,
      color: categoryStyle.color,
      lightColor: categoryStyle.lightColor,
      textColor: categoryStyle.textColor,
      billingConsiderations: getBillingConsiderations(codeItem),
      treatmentNotes: getTreatmentNotes(codeItem),
      documentationRequirements: getDocumentationRequirements(codeItem)
    }
  }

  // Helper functions for detailed information
  const getBillingConsiderations = (codeItem: any) => {
    if (codeItem.type === "CPT") {
      return codeItem.code.startsWith("992") || codeItem.code.startsWith("993")
        ? "Requires documentation of medically appropriate history/exam and appropriate level of medical decision making."
        : "Ensure proper documentation of medical necessity for billing."
    } else if (codeItem.type === "ICD-10") {
      return "Diagnosis code - ensure specificity and accurate documentation of condition."
    }
    return "Standard billing requirements apply."
  }

  const getTreatmentNotes = (codeItem: any) => {
    return codeItem.rationale || "Clinical assessment and appropriate treatment plan documented."
  }

  const getDocumentationRequirements = (codeItem: any) => {
    if (codeItem.type === "CPT") {
      return "Document clinical findings, time spent, and medical decision making complexity."
    } else if (codeItem.type === "ICD-10") {
      return "Document clinical signs, symptoms, and examination findings supporting diagnosis."
    }
    return "Maintain appropriate clinical documentation."
  }

  // Convert selectedCodesList to display format with styling info
  const selectedCodesDetails = selectedCodesList.map(getCodeDisplayInfo)

  // Filter codes based on active categories
  const filteredCodes = selectedCodesDetails.filter((code) => activeCategories[code.category])

  // Category configurations
  const categoryConfigs = [
    {
      key: "codes",
      title: "Codes",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      borderColor: "border-blue-200",
      count: selectedCodes.codes
    },
    {
      key: "prevention",
      title: "Prevention",
      icon: Stethoscope,
      color: "text-red-600",
      bgColor: "bg-red-100",
      borderColor: "border-red-200",
      count: selectedCodes.prevention
    },
    {
      key: "diagnoses",
      title: "Diagnoses",
      icon: Activity,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      borderColor: "border-purple-200",
      count: selectedCodes.diagnoses
    },
    {
      key: "differentials",
      title: "Differentials",
      icon: Pill,
      color: "text-green-600",
      bgColor: "bg-green-100",
      borderColor: "border-green-200",
      count: selectedCodes.differentials
    }
  ]

  // Calculate total codes
  const totalCodes =
    selectedCodes.codes + selectedCodes.prevention + selectedCodes.diagnoses + selectedCodes.differentials
  const visibleCodes = filteredCodes.length

  // Circular confidence indicator component
  const ConfidenceGauge = ({ confidence, size = 20 }: { confidence: number; size?: number }) => {
    const radius = (size - 4) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (confidence / 100) * circumference

    const getColor = (conf: number) => {
      if (conf >= 80) return "#10b981" // green-500
      if (conf >= 60) return "#eab308" // yellow-500
      return "#ef4444" // red-500
    }

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth="2" fill="none" />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getColor(confidence)}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300"
          />
        </svg>
        {/* Confidence percentage text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">{confidence}</span>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="border-b bg-muted/10 px-4 py-4">
        <div className="space-y-3">
          {/* Header with Category Toggle Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Selected Codes</span>
              <div className="flex items-center gap-2">
                {categoryConfigs.map((category) => {
                  const CategoryIcon = category.icon
                  const isActive = activeCategories[category.key]
                  return (
                    <Button
                      key={category.key}
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCategory(category.key)}
                      className={`
                        h-8 px-3 gap-2 text-xs transition-all
                        ${
                          isActive
                            ? `${category.bgColor} ${category.color} ${category.borderColor} border`
                            : "bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted"
                        }
                      `}
                    >
                      <CategoryIcon className="h-3.5 w-3.5" />
                      <span className="font-medium">{category.title}</span>
                      <Badge
                        variant="secondary"
                        className={`text-xs px-1.5 py-0 h-4 ${isActive ? "bg-white/80" : "bg-muted-foreground/20"}`}
                      >
                        {category.count}
                      </Badge>
                    </Button>
                  )
                })}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {visibleCodes} of {totalCodes} codes
            </div>
          </div>

          {/* Horizontally Scrollable Code Boxes */}
          <div className="relative">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
              {filteredCodes.map((codeDetail, index) => {
                const IconComponent = codeDetail.icon
                return (
                  <div
                    key={index}
                    className={`
                      relative p-3 rounded-lg border cursor-pointer flex-shrink-0 min-w-[140px] group
                      ${codeDetail.lightColor} hover:scale-105 transition-all duration-200
                      border-current/20 hover:shadow-md
                    `}
                  >
                    {/* Remove button - only visible on hover */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveCode(codeDetail)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>

                    {/* Category switch button for diagnoses/differentials - only visible on hover */}
                    {(codeDetail.category === "diagnoses" || codeDetail.category === "differentials") &&
                      codeDetail.type === "ICD-10" &&
                      onChangeCategoryCode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-1 right-6 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 hover:text-blue-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            const newCategory = codeDetail.category === "diagnoses" ? "differentials" : "diagnoses"
                            onChangeCategoryCode(codeDetail, newCategory)
                          }}
                          title={`Change to ${codeDetail.category === "diagnoses" ? "Differential" : "Diagnosis"}`}
                        >
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${codeDetail.color}`}>
                            <IconComponent className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className={`text-sm font-mono font-medium ${codeDetail.textColor}`}>
                              {codeDetail.code}
                            </div>
                            <div className="text-xs text-muted-foreground">{codeDetail.type}</div>
                          </div>
                          {/* Circular Confidence Gauge */}
                          <div className="flex-shrink-0">
                            <ConfidenceGauge confidence={codeDetail.confidence} size={24} />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs p-4" side="top">
                        <div className="space-y-2">
                          <div className="font-medium text-sm">
                            {codeDetail.code} - {codeDetail.description}
                          </div>
                          <div className="text-xs space-y-1">
                            <div>
                              <span className="font-medium">Reason:</span> {codeDetail.rationale}
                            </div>
                            {codeDetail.reimbursement !== "N/A (Diagnosis code)" && (
                              <div>
                                <span className="font-medium">Reimbursement:</span> {codeDetail.reimbursement}
                              </div>
                            )}
                            {codeDetail.rvu && (
                              <div>
                                <span className="font-medium">RVU:</span> {codeDetail.rvu}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Billing:</span> {codeDetail.billingConsiderations}
                            </div>
                            <div>
                              <span className="font-medium">Treatment:</span> {codeDetail.treatmentNotes}
                            </div>
                            <div>
                              <span className="font-medium">Documentation:</span> {codeDetail.documentationRequirements}
                            </div>
                            <div className="pt-1 border-t">
                              <span className="font-medium">Confidence:</span>
                              <span
                                className={`ml-1 ${
                                  codeDetail.confidence >= 80
                                    ? "text-green-600"
                                    : codeDetail.confidence >= 60
                                      ? "text-yellow-600"
                                      : "text-red-600"
                                }`}
                              >
                                {codeDetail.confidence}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Remove Code Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Code</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with code{" "}
              <span className="font-mono font-medium">{selectedCodeToRemove?.code}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">Code:</span> {selectedCodeToRemove?.code} -{" "}
                {selectedCodeToRemove?.description}
              </div>

              <div className="space-y-2">
                <label htmlFor="reasoning" className="text-sm font-medium">
                  Reasoning (Optional)
                </label>
                <Textarea
                  id="reasoning"
                  placeholder="Explain why you're removing this code. This helps the AI learn from your clinical decisions..."
                  value={removeReasoning}
                  onChange={(e) => setRemoveReasoning(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Your feedback helps improve future AI suggestions and clinical decision support.
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => confirmRemoval("return")}
              className="hover:bg-blue-50 hover:text-blue-700"
            >
              Return to Suggestions
            </Button>
            <AlertDialogAction onClick={() => confirmRemoval("clear")} className="bg-red-600 hover:bg-red-700">
              Remove Completely
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
