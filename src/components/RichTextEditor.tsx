import { useEffect, useState, useRef } from "react"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import { Textarea } from "./ui/textarea"
import { ComplianceAlert } from "./ComplianceAlert"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  ChevronDown
} from "lucide-react"

interface ComplianceIssue {
  id: string
  severity: "critical" | "warning" | "info"
  title: string
  description: string
  category: "documentation" | "coding" | "billing" | "quality"
  details: string
  suggestion: string
  learnMoreUrl?: string
  dismissed?: boolean
}

interface RichTextEditorProps {
  disabled?: boolean
  value?: string
  complianceIssues?: ComplianceIssue[]
  onDismissIssue?: (issueId: string) => void
  onRestoreIssue?: (issueId: string) => void
  onContentChange?: (content: string) => void
}

const DEFAULT_TEMPLATE = `SUBJECTIVE:
Patient presents with...

OBJECTIVE:
Vital signs: BP 120/80, HR 72, Temp 98.6°F
Physical exam:

ASSESSMENT:
Primary diagnosis:
Secondary diagnosis:

PLAN:
Treatment plan:
Follow-up:`

export function RichTextEditor({
  disabled = false,
  value,
  complianceIssues = [],
  onDismissIssue,
  onRestoreIssue,
  onContentChange
}: RichTextEditorProps) {
  const [content, setContent] = useState(value || DEFAULT_TEMPLATE)

  useEffect(() => {
    if (typeof value === "string" && value !== content) {
      setContent(value || DEFAULT_TEMPLATE)
    }
  }, [value, content])

  // Notify parent component when content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    if (onContentChange) {
      onContentChange(newContent)
    }
  }

  const formatButtons = [
    { icon: Bold, label: "Bold" },
    { icon: Italic, label: "Italic" },
    { icon: Underline, label: "Underline" },
    { icon: List, label: "Bullet List" },
    { icon: ListOrdered, label: "Numbered List" },
    { icon: AlignLeft, label: "Align Left" },
    { icon: AlignCenter, label: "Align Center" },
    { icon: AlignRight, label: "Align Right" }
  ]

  // Add ref for textarea to handle text manipulation
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Function to get selected text or insert at cursor position
  const insertTextAtCursor = (beforeText: string, afterText: string = "") => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)

    const newText = content.substring(0, start) + beforeText + selectedText + afterText + content.substring(end)
    handleContentChange(newText)

    // Set cursor position after the inserted text
    setTimeout(() => {
      const newCursorPos = start + beforeText.length + selectedText.length + afterText.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      textarea.focus()
    }, 0)
  }

  // Function to handle bullet list
  const insertBulletList = () => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)

    if (selectedText.trim()) {
      // Convert selected lines to bullet points
      const lines = selectedText.split("\n")
      const bulletLines = lines.map((line) => (line.trim() ? `• ${line.trim()}` : line)).join("\n")
      const newText = content.substring(0, start) + bulletLines + content.substring(end)
      handleContentChange(newText)
    } else {
      // Insert a new bullet point
      insertTextAtCursor("• ", "")
    }
  }

  // Function to handle numbered list
  const insertNumberedList = () => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)

    if (selectedText.trim()) {
      // Convert selected lines to numbered list
      const lines = selectedText.split("\n")
      const numberedLines = lines.map((line, index) => (line.trim() ? `${index + 1}. ${line.trim()}` : line)).join("\n")
      const newText = content.substring(0, start) + numberedLines + content.substring(end)
      handleContentChange(newText)
    } else {
      // Insert a new numbered item
      insertTextAtCursor("1. ", "")
    }
  }

  // Function to handle formatting buttons
  const handleFormat = (type: string) => {
    if (disabled) return

    switch (type) {
      case "Bold":
        insertTextAtCursor("**", "**")
        break
      case "Italic":
        insertTextAtCursor("*", "*")
        break
      case "Underline":
        insertTextAtCursor("_", "_")
        break
      case "Bullet List":
        insertBulletList()
        break
      case "Numbered List":
        insertNumberedList()
        break
      case "Align Left":
      case "Align Center":
      case "Align Right":
        // For plain text, these might not be directly applicable, but we can add indicators
        break
      default:
        break
    }
  }

  // Function to insert template sections
  const insertSection = () => {
    if (disabled) return

    const sections = [
      "CHIEF COMPLAINT:",
      "HISTORY OF PRESENT ILLNESS:",
      "REVIEW OF SYSTEMS:",
      "PAST MEDICAL HISTORY:",
      "MEDICATIONS:",
      "ALLERGIES:",
      "SOCIAL HISTORY:",
      "FAMILY HISTORY:",
      "PHYSICAL EXAMINATION:",
      "LABORATORY RESULTS:",
      "IMAGING:",
      "MEDICAL DECISION MAKING:",
      "PATIENT EDUCATION:",
      "FOLLOW-UP INSTRUCTIONS:"
    ]

    // For now, let's insert a basic section template
    // In a real app, you might show a dropdown to choose from sections
    const sectionText = "\n\nNEW SECTION:\n\n"
    insertTextAtCursor(sectionText, "")
  }

  // Template definitions with descriptions
  const templates = [
    {
      id: "soap",
      name: "SOAP Note",
      description:
        "Structured note format: Subjective, Objective, Assessment, Plan. Ideal for most clinical encounters and problem-focused visits.",
      content: `SUBJECTIVE:
Chief Complaint: 
History of Present Illness:
Review of Systems:
Past Medical History:
Medications:
Allergies:
Social History:

OBJECTIVE:
Vital Signs:
Physical Examination:
Laboratory/Diagnostic Results:

ASSESSMENT:
Primary Diagnosis:
Secondary Diagnoses:
Differential Diagnoses:

PLAN:
Treatment:
Follow-up:
Patient Education:
Return Precautions:`
    },
    {
      id: "history-physical",
      name: "History & Physical",
      description:
        "Comprehensive H&P format for new patients, consultations, or detailed evaluations. Includes comprehensive history and thorough physical examination.",
      content: `HISTORY OF PRESENT ILLNESS:

PAST MEDICAL HISTORY:

PAST SURGICAL HISTORY:

MEDICATIONS:

ALLERGIES:

FAMILY HISTORY:

SOCIAL HISTORY:

REVIEW OF SYSTEMS:
Constitutional:
HEENT:
Cardiovascular:
Respiratory:
Gastrointestinal:
Genitourinary:
Musculoskeletal:
Neurological:
Psychiatric:
Endocrine:
Hematologic/Lymphatic:
Allergic/Immunologic:

PHYSICAL EXAMINATION:
General Appearance:
Vital Signs:
HEENT:
Neck:
Cardiovascular:
Respiratory:
Abdomen:
Extremities:
Neurological:

ASSESSMENT AND PLAN:`
    },
    {
      id: "followup",
      name: "Follow-up Visit",
      description:
        "Streamlined format for established patients returning for routine follow-up or chronic disease management visits.",
      content: `INTERVAL HISTORY:
Since last visit:
Current symptoms:
Medication compliance:
Side effects:

REVIEW OF SYSTEMS:
Pertinent positives:
Pertinent negatives:

OBJECTIVE:
Vital Signs:
Physical Examination:
Recent Tests/Labs:

ASSESSMENT:
1. [Condition] - [Status: improved/stable/worsened]
2. 

PLAN:
Continue current management:
Medication adjustments:
New orders:
Follow-up:
Patient counseling:`
    },
    {
      id: "wellness",
      name: "Wellness/Preventive",
      description:
        "Annual wellness visit or preventive care template. Focuses on health maintenance, screening, and prevention strategies.",
      content: `HEALTH MAINTENANCE REVIEW:
Immunizations:
Cancer Screening:
Cardiovascular Risk Assessment:
Lifestyle Factors:

REVIEW OF SYSTEMS:
Constitutional:
Cardiovascular:
Respiratory:
Other systems as indicated:

OBJECTIVE:
Vital Signs including BMI:
Physical Examination:
Screening Tests Reviewed:

ASSESSMENT:
Overall Health Status:
Risk Factors Identified:
Screening Recommendations:

PLAN:
Health Maintenance:
Immunizations Due:
Screening Schedule:
Lifestyle Counseling:
Follow-up Recommendations:`
    },
    {
      id: "procedure",
      name: "Procedure Note",
      description:
        "Template for documenting minor office procedures, injections, or therapeutic interventions with pre/post care details.",
      content: `PROCEDURE: [Procedure Name]

INDICATION:

CONSENT:
Risks, benefits, and alternatives discussed with patient.
Patient verbalized understanding and consented to procedure.

PRE-PROCEDURE:
Patient positioned:
Area prepped with:
Local anesthesia:

PROCEDURE DETAILS:
Technique:
Findings:
Complications: None

POST-PROCEDURE:
Hemostasis achieved:
Dressing applied:
Patient tolerated procedure well:

PLAN:
Post-procedure care instructions:
Follow-up:
Return precautions:`
    }
  ]

  const handleTemplateSelect = (template: (typeof templates)[0]) => {
    handleContentChange(template.content)
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Compliance Alert positioned absolutely to avoid opacity effects */}
      {complianceIssues.length > 0 && (
        <div className="absolute top-3 right-3 z-50 bg-background rounded-md">
          <div className="p-1">
            <ComplianceAlert
              issues={complianceIssues}
              onDismissIssue={onDismissIssue || (() => {})}
              onRestoreIssue={onRestoreIssue || (() => {})}
              compact={true}
            />
          </div>
        </div>
      )}

      <div className={`flex flex-col h-full ${disabled ? "opacity-50" : ""}`}>
        {/* Formatting Toolbar */}
        <div className="border-b p-3 bg-background">
          <div className="flex items-center gap-1 justify-between">
            <div className="flex items-center gap-1">
              {formatButtons.map((button, index) => (
                <Button
                  key={button.label}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title={button.label}
                  disabled={disabled}
                  onClick={() => handleFormat(button.label)}
                >
                  <button.icon className="h-4 w-4" />
                </Button>
              ))}
              <Separator orientation="vertical" className="mx-2 h-6" />
              <Button
                variant="ghost"
                size="sm"
                title="Insert Template Section"
                disabled={disabled}
                onClick={insertSection}
              >
                <Plus className="h-4 w-4 mr-1" />
                Section
              </Button>

              {/* Template Selector with subtle separation */}
              <Separator orientation="vertical" className="mx-2 h-6" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8" disabled={disabled}>
                    Templates
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-80">
                  {templates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      className="flex items-start gap-3 p-3 cursor-pointer"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">{template.name}</div>
                        <div className="text-xs text-muted-foreground leading-relaxed">{template.description}</div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Empty space where compliance alert used to be */}
            <div className="w-8 h-8"></div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-4 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="min-h-full resize-none border-none shadow-none focus-visible:ring-0"
            placeholder={disabled ? "Start a visit to begin documenting..." : "Start typing your clinical note here..."}
            disabled={disabled}
          />
          {disabled && (
            <div className="absolute inset-0 bg-muted/20 flex items-center justify-center pointer-events-none">
              <div className="text-muted-foreground text-center">
                <p className="font-medium">Visit Not Active</p>
                <p className="text-sm">Start a visit to begin documenting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
