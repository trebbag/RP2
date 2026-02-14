import { useState } from "react"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { FinalizationWizard } from "./FinalizationWizard"
import { Shield, FileText, Code2, Heart, Activity, Stethoscope } from "lucide-react"

export function FinalizationWizardDemo() {
  const [showWizard, setShowWizard] = useState(false)

  // Mock data that would typically come from the actual note editor
  const mockSelectedCodes = {
    codes: 2,
    prevention: 1,
    diagnoses: 3,
    differentials: 1
  }

  const mockSelectedCodesList = [
    {
      code: "99213",
      type: "CPT",
      category: "codes",
      description: "Office visit, established patient",
      rationale: "Moderate complexity medical decision making with established patient visit",
      confidence: 87,
      reimbursement: "$127.42",
      rvu: "1.92"
    },
    {
      code: "99214",
      type: "CPT",
      category: "codes",
      description: "Office visit, established patient (moderate complexity)",
      rationale: "High complexity decision making documented with comprehensive assessment",
      confidence: 78,
      reimbursement: "$184.93",
      rvu: "2.80"
    },
    {
      code: "J06.9",
      type: "ICD-10",
      category: "diagnoses",
      description: "Acute upper respiratory infection, unspecified",
      rationale: "Primary diagnosis based on presenting symptoms and clinical findings",
      confidence: 92
    },
    {
      code: "J02.9",
      type: "ICD-10",
      category: "diagnoses",
      description: "Acute pharyngitis, unspecified",
      rationale: "Secondary diagnosis from physical examination findings",
      confidence: 84
    },
    {
      code: "Z23",
      type: "ICD-10",
      category: "diagnoses",
      description: "Encounter for immunization",
      rationale: "Patient received influenza vaccination during visit",
      confidence: 95
    },
    {
      code: "Annual Wellness Visit",
      type: "PREVENTION",
      category: "prevention",
      description: "Annual wellness visit counseling",
      rationale: "Patient counseled on preventive care measures",
      confidence: 88
    },
    {
      code: "Viral URI vs Bacterial Sinusitis",
      type: "DIFFERENTIAL",
      category: "differentials",
      description: "Primary differential diagnosis consideration",
      rationale: "85% confidence viral, 35% bacterial based on symptom pattern",
      confidence: 85
    }
  ]

  const mockComplianceIssues = [
    {
      id: "mdm-1",
      severity: "critical" as const,
      title: "Medical Decision Making complexity not documented",
      description:
        "The note lacks specific documentation of medical decision making complexity required for E/M coding.",
      category: "documentation" as const,
      details:
        "For CPT 99214, you must document moderate level medical decision making. Include number of diagnoses/management options, amount of data reviewed, and risk assessment.",
      suggestion:
        "Add a Medical Decision Making section with: 1) Problem complexity assessment, 2) Data reviewed, 3) Risk stratification table showing moderate complexity.",
      learnMoreUrl:
        "https://www.cms.gov/outreach-and-education/medicare-learning-network-mln/mlnproducts/downloads/eval-mgmt-serv-guide-icn006764.pdf",
      dismissed: false
    },
    {
      id: "ros-1",
      severity: "warning" as const,
      title: "Review of Systems incomplete",
      description: "Extended Review of Systems (ROS) documentation is missing or incomplete for this level of service.",
      category: "documentation" as const,
      details:
        "E/M level 4 visits require extended ROS covering 2-9 systems or complete ROS covering 10+ systems to support the level of service billed.",
      suggestion:
        "Document a systematic review of systems including respiratory, cardiovascular, gastrointestinal, and other relevant systems. Include both positive and negative findings.",
      learnMoreUrl: "https://www.cms.gov/medicare/physician-fee-schedule/physician-fee-schedule",
      dismissed: true
    }
  ]

  const mockNoteContent = `
CHIEF COMPLAINT: Persistent cough for 2 weeks

HISTORY OF PRESENT ILLNESS:
The patient is a 45-year-old established patient who presents with a chief complaint of persistent dry cough lasting approximately 2 weeks. The cough is mostly nonproductive but occasionally brings up small amounts of clear mucus. Patient reports mild dyspnea on exertion, particularly when climbing stairs. Denies fever, chills, or weight loss. Cough seems worse in the morning hours.

REVIEW OF SYSTEMS:
Respiratory: Positive for cough and mild dyspnea on exertion. Negative for chest pain, wheezing, or hemoptysis.
Cardiovascular: Negative for chest pain, palpitations, or syncope.
Constitutional: Negative for fever, chills, night sweats, or unintentional weight loss.

PHYSICAL EXAMINATION:
Vital Signs: BP 118/76, HR 72, RR 16, Temp 98.6°F, O2 Sat 98% on room air
General: Alert, oriented, in no acute distress
Respiratory: Lungs clear to auscultation bilaterally, no wheezes, rales, or rhonchi
Cardiovascular: Regular rate and rhythm, no murmurs
ENT: Mild erythema of posterior pharynx

ASSESSMENT AND PLAN:
1. Acute upper respiratory infection (J06.9) - likely viral etiology given clear lungs and absence of fever
2. Acute pharyngitis (J02.9) - mild erythema noted on examination
3. Immunization encounter (Z23) - administered influenza vaccine per patient request

The patient was counseled on supportive care measures including rest, hydration, and symptomatic treatment. Return if symptoms worsen or persist beyond 7-10 days.
  `

  const mockPatientInfo = {
    patientId: "PAT-12345",
    encounterId: "ENC-67890"
  }

  const wizardSteps = [
    {
      icon: FileText,
      title: "Content Review",
      description: "Review and verify note documentation completeness",
      color: "text-blue-600"
    },
    {
      icon: Code2,
      title: "Code Verification",
      description: "Validate selected CPT and procedure codes",
      color: "text-blue-600"
    },
    {
      icon: Heart,
      title: "Prevention Items",
      description: "Review preventive care recommendations",
      color: "text-red-600"
    },
    {
      icon: Activity,
      title: "Diagnoses Confirmation",
      description: "Confirm primary and secondary diagnoses",
      color: "text-purple-600"
    },
    {
      icon: Stethoscope,
      title: "Differentials Review",
      description: "Review differential diagnosis considerations",
      color: "text-green-600"
    },
    {
      icon: Shield,
      title: "Compliance Checks",
      description: "Final compliance and billing validation",
      color: "text-amber-600"
    }
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-medium">Finalization Wizard Demo</h1>
          <p className="text-muted-foreground">
            The finalization wizard is now isolated as a separate component. This demo shows how it can be used
            independently of the main note editor.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mock Data Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Mock Note Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Selected Codes Summary</div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                    {mockSelectedCodes.codes} CPT Codes
                  </Badge>
                  <Badge variant="secondary" className="bg-red-50 text-red-700">
                    {mockSelectedCodes.prevention} Prevention
                  </Badge>
                  <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                    {mockSelectedCodes.diagnoses} Diagnoses
                  </Badge>
                  <Badge variant="secondary" className="bg-green-50 text-green-700">
                    {mockSelectedCodes.differentials} Differentials
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Compliance Issues</div>
                <div className="text-sm text-muted-foreground">
                  {mockComplianceIssues.filter((issue) => !issue.dismissed).length} active issues (
                  {mockComplianceIssues.filter((issue) => issue.severity === "critical" && !issue.dismissed).length}{" "}
                  critical)
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Note Content</div>
                <div className="text-sm text-muted-foreground">
                  {mockNoteContent.length} characters, ~{Math.ceil(mockNoteContent.length / 5)} words
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Wizard Steps Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                6-Step Finalization Process
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {wizardSteps.map((step, index) => {
                  const StepIcon = step.icon
                  return (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <div className={`p-1.5 rounded-md bg-muted ${step.color}`}>
                        <StepIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{step.title}</div>
                        <div className="text-xs text-muted-foreground">{step.description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Launch Wizard Button */}
        <div className="flex items-center justify-center py-8">
          <Button onClick={() => setShowWizard(true)} size="lg" className="bg-primary hover:bg-primary/90">
            <Shield className="h-4 w-4 mr-2" />
            Launch Finalization Wizard
          </Button>
        </div>

        {/* Usage Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">To integrate back into the main app:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Import the FinalizationWizard component back into NoteEditor.tsx</li>
                <li>Restore the showFinalizationWizard state and related handlers</li>
                <li>Add the wizard JSX back to the bottom of the NoteEditor component</li>
                <li>Pass the real note data, selected codes, and compliance issues as props</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Component Benefits:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Fully isolated and reusable across different parts of the application</li>
                <li>Self-contained with its own state management and validation logic</li>
                <li>Consistent with the established RevenuePilot design system</li>
                <li>Complete 6-step workflow with progress tracking and validation</li>
                <li>Handles all code categories (CPT, ICD-10, Prevention, Differentials)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Finalization Wizard */}
      {showWizard && (
        <FinalizationWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          selectedCodes={mockSelectedCodes}
          selectedCodesList={mockSelectedCodesList}
          complianceIssues={mockComplianceIssues}
          noteContent={mockNoteContent}
          patientInfo={mockPatientInfo}
        />
      )}
    </div>
  )
}
