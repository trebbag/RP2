import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Upload, Undo, Redo } from "lucide-react"

export function BeautifiedView() {
  const beautifiedContent = {
    subjective: "Patient presents with a 3-day history of upper respiratory symptoms including nasal congestion, mild sore throat, and intermittent cough. No fever reported. Symptoms began gradually and have been stable. Patient denies shortness of breath, chest pain, or difficulty swallowing.",
    objective: "Vital Signs: BP 118/76 mmHg, HR 78 bpm, RR 16, Temp 98.4°F, O2 Sat 98% RA\n\nPhysical Examination:\n• General: Alert, comfortable, no acute distress\n• HEENT: Mild erythema of posterior pharynx, clear nasal discharge, TMs clear\n• Neck: No lymphadenopathy, no thyromegaly\n• Lungs: Clear to auscultation bilaterally\n• Heart: RRR, no murmurs",
    assessment: "1. Viral upper respiratory infection (ICD-10: J06.9)\n2. Acute pharyngitis (ICD-10: J02.9)",
    plan: "1. Supportive care with rest, increased fluid intake\n2. OTC acetaminophen 650mg q6h PRN pain/discomfort\n3. Return if symptoms worsen or persist >10 days\n4. Follow-up as needed"
  }

  return (
    <div className="flex flex-col h-full">
      {/* Action Bar */}
      <div className="border-b p-3 bg-background flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Redo className="h-4 w-4" />
          </Button>
        </div>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Export to EHR
        </Button>
      </div>

      {/* Beautified Content */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-blue-700">SUBJECTIVE</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{beautifiedContent.subjective}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-green-700">OBJECTIVE</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {beautifiedContent.objective}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-purple-700">ASSESSMENT</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {beautifiedContent.assessment}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-orange-700">PLAN</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {beautifiedContent.plan}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
