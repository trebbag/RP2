import { useEffect, useMemo, useState } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  AlertCircle,
  Check,
  CheckCircle,
  Copy,
  RefreshCw,
  Save,
  Send,
  ShieldCheck
} from "lucide-react"
import { Alert, AlertDescription } from "./ui/alert"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Switch } from "./ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Textarea } from "./ui/textarea"
import {
  adminResetUserMfa,
  deadLetterDispatchJob,
  disableMfa,
  enableMfa,
  fetchCurrentUser,
  fetchObservabilityTrends,
  fetchDispatchSandboxReadiness,
  fetchObservabilitySummary,
  fetchUserSettings,
  listAdminUsers,
  listDispatchJobs,
  regenerateMfaBackupCodes,
  replayDispatchJob,
  retryDueDispatchJobs,
  setupMfa,
  updateUserSettings,
  validateDispatchContract,
  type AuthUserRecord,
  type DispatchJobRecord,
  type ObservabilitySummaryRecord,
  type ObservabilityTrendsRecord,
  type UserSettingsRecord
} from "../lib/api"

interface SettingsProps {
  userRole?: "admin" | "user"
}

const defaultSettings: UserSettingsRecord = {
  suggestions: {
    codes: true,
    compliance: true,
    publicHealth: false,
    differentials: true,
    followUp: true
  },
  appearance: {
    theme: "modern",
    colorMode: "system"
  },
  clinical: {
    specialty: "family-medicine",
    payer: "medicare",
    region: "us-east",
    guidelines: ["cms", "aafp"]
  },
  language: {
    interfaceLanguage: "en",
    summaryLanguage: "en"
  },
  templates: [
    {
      id: "soap-default",
      name: "Standard SOAP Note",
      type: "SOAP",
      content: "S: \nO: \nA: \nP: ",
      lastModified: "Seeded"
    }
  ],
  clinicalRules: [
    {
      id: "diabetes-eye-exam",
      name: "Diabetes Annual Eye Exam",
      description: "Remind for annual eye exam for diabetic patients",
      condition: "diagnosis:diabetes AND last_eye_exam > 365_days",
      action: "suggest_eye_exam_referral",
      enabled: true
    }
  ],
  advanced: {
    promptOverrides: "{\n  \"suggestion_context\": {\n    \"coding_accuracy_threshold\": 0.85\n  }\n}",
    isOfflineMode: false,
    localModelsDownloaded: false
  },
  mfa: {
    preferredMethod: "totp"
  }
}

function SettingsSaveBar(props: {
  onReload: () => Promise<void> | void
  onSave: () => Promise<void> | void
  isLoading: boolean
  isSaving: boolean
  hasChanges: boolean
  error: string | null
  message: string | null
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="text-sm text-muted-foreground">
            {props.hasChanges ? "Unsaved settings changes" : "Settings are in sync with backend"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={props.onReload} disabled={props.isLoading || props.isSaving}>
              <RefreshCw className={`w-4 h-4 mr-2 ${props.isLoading ? "animate-spin" : ""}`} />
              Reload
            </Button>
            <Button onClick={props.onSave} disabled={!props.hasChanges || props.isSaving || props.isLoading}>
              <Save className="w-4 h-4 mr-2" />
              {props.isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
        {props.error && (
          <Alert variant="destructive">
            <AlertDescription>{props.error}</AlertDescription>
          </Alert>
        )}
        {props.message && (
          <Alert>
            <AlertDescription>{props.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function SuggestionsPanel(props: {
  settings: UserSettingsRecord
  update: (next: UserSettingsRecord["suggestions"]) => void
}) {
  const items: Array<{ key: keyof UserSettingsRecord["suggestions"]; label: string; description: string }> = [
    { key: "codes", label: "Coding Suggestions", description: "CPT, ICD-10, and billing support" },
    { key: "compliance", label: "Compliance Alerts", description: "Denial-risk and documentation warnings" },
    { key: "publicHealth", label: "Public Health", description: "Preventive care reminders" },
    { key: "differentials", label: "Differential Diagnoses", description: "Alternative clinical possibilities" },
    { key: "followUp", label: "Follow-up Recommendations", description: "Post-visit coordination prompts" }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Suggestion Categories</CardTitle>
        <CardDescription>Control which suggestion streams are active.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between rounded-md border px-3 py-3">
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Switch
              checked={props.settings.suggestions[item.key]}
              onCheckedChange={(checked) =>
                props.update({
                  ...props.settings.suggestions,
                  [item.key]: checked
                })
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ClinicalPanel(props: {
  settings: UserSettingsRecord
  updateClinical: (next: UserSettingsRecord["clinical"]) => void
  updateLanguage: (next: UserSettingsRecord["language"]) => void
}) {
  const guidelineOptions = ["cms", "aafp", "ama", "uspstf", "cdc"]
  const { settings } = props

  const toggleGuideline = (guideline: string) => {
    const exists = settings.clinical.guidelines.includes(guideline)
    props.updateClinical({
      ...settings.clinical,
      guidelines: exists
        ? settings.clinical.guidelines.filter((item) => item !== guideline)
        : [...settings.clinical.guidelines, guideline]
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clinical Defaults</CardTitle>
          <CardDescription>Persisted provider-level clinical configuration.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Specialty</Label>
            <Select
              value={settings.clinical.specialty}
              onValueChange={(specialty) =>
                props.updateClinical({
                  ...settings.clinical,
                  specialty
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="family-medicine">Family Medicine</SelectItem>
                <SelectItem value="internal-medicine">Internal Medicine</SelectItem>
                <SelectItem value="pediatrics">Pediatrics</SelectItem>
                <SelectItem value="urgent-care">Urgent Care</SelectItem>
                <SelectItem value="emergency-medicine">Emergency Medicine</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Primary Payer</Label>
            <Select
              value={settings.clinical.payer}
              onValueChange={(payer) =>
                props.updateClinical({
                  ...settings.clinical,
                  payer
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medicare">Medicare</SelectItem>
                <SelectItem value="medicaid">Medicaid</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Region</Label>
            <Select
              value={settings.clinical.region}
              onValueChange={(region) =>
                props.updateClinical({
                  ...settings.clinical,
                  region
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us-east">US East</SelectItem>
                <SelectItem value="us-west">US West</SelectItem>
                <SelectItem value="us-central">US Central</SelectItem>
                <SelectItem value="us-south">US South</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3 space-y-2">
            <Label>Guideline Sources</Label>
            <div className="flex flex-wrap gap-2">
              {guidelineOptions.map((guideline) => {
                const enabled = settings.clinical.guidelines.includes(guideline)
                return (
                  <Button
                    key={guideline}
                    variant={enabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleGuideline(guideline)}
                  >
                    {guideline.toUpperCase()}
                  </Button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Interface Language</Label>
            <Select
              value={settings.language.interfaceLanguage}
              onValueChange={(interfaceLanguage) =>
                props.updateLanguage({
                  ...settings.language,
                  interfaceLanguage
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Summary Language</Label>
            <Select
              value={settings.language.summaryLanguage}
              onValueChange={(summaryLanguage) =>
                props.updateLanguage({
                  ...settings.language,
                  summaryLanguage
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InterfacePanel(props: {
  settings: UserSettingsRecord
  updateAppearance: (next: UserSettingsRecord["appearance"]) => void
  updateAdvanced: (next: UserSettingsRecord["advanced"]) => void
}) {
  const { settings } = props

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select
              value={settings.appearance.theme}
              onValueChange={(theme: UserSettingsRecord["appearance"]["theme"]) =>
                props.updateAppearance({
                  ...settings.appearance,
                  theme
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="accessible">Accessible</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Color Mode</Label>
            <Select
              value={settings.appearance.colorMode}
              onValueChange={(colorMode: UserSettingsRecord["appearance"]["colorMode"]) =>
                props.updateAppearance({
                  ...settings.appearance,
                  colorMode
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
          <CardDescription>These values are persisted server-side.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Prompt Overrides (JSON)</Label>
            <Textarea
              value={settings.advanced.promptOverrides}
              onChange={(event) =>
                props.updateAdvanced({
                  ...settings.advanced,
                  promptOverrides: event.target.value
                })
              }
              className="font-mono min-h-[150px]"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Offline Mode</p>
              <p className="text-xs text-muted-foreground">Use local inference fallback where supported.</p>
            </div>
            <Switch
              checked={settings.advanced.isOfflineMode}
              onCheckedChange={(checked) =>
                props.updateAdvanced({
                  ...settings.advanced,
                  isOfflineMode: checked
                })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Local Models Downloaded</p>
              <p className="text-xs text-muted-foreground">Operational marker for fallback readiness.</p>
            </div>
            <Switch
              checked={settings.advanced.localModelsDownloaded}
              onCheckedChange={(checked) =>
                props.updateAdvanced({
                  ...settings.advanced,
                  localModelsDownloaded: checked
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TemplateAndRulesPanel(props: {
  settings: UserSettingsRecord
  updateTemplates: (templates: UserSettingsRecord["templates"]) => void
  updateRules: (rules: UserSettingsRecord["clinicalRules"]) => void
}) {
  const [newTemplateOpen, setNewTemplateOpen] = useState(false)
  const [newRuleOpen, setNewRuleOpen] = useState(false)
  const [templateDraft, setTemplateDraft] = useState({
    name: "",
    type: "SOAP" as UserSettingsRecord["templates"][number]["type"],
    content: ""
  })
  const [ruleDraft, setRuleDraft] = useState({
    name: "",
    description: "",
    condition: "",
    action: ""
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>Persisted note templates shared across sessions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
            <DialogTrigger asChild>
              <Button>New Template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Template</DialogTitle>
                <DialogDescription>Template data will be saved in backend settings.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Template name"
                  value={templateDraft.name}
                  onChange={(event) => setTemplateDraft((prev) => ({ ...prev, name: event.target.value }))}
                />
                <Select
                  value={templateDraft.type}
                  onValueChange={(value: UserSettingsRecord["templates"][number]["type"]) =>
                    setTemplateDraft((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOAP">SOAP</SelectItem>
                    <SelectItem value="Wellness">Wellness</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={templateDraft.content}
                  onChange={(event) => setTemplateDraft((prev) => ({ ...prev, content: event.target.value }))}
                  className="min-h-[140px]"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewTemplateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const next = [
                      ...props.settings.templates,
                      {
                        id: `template-${Date.now()}`,
                        name: templateDraft.name,
                        type: templateDraft.type,
                        content: templateDraft.content,
                        lastModified: "Just now"
                      }
                    ]
                    props.updateTemplates(next)
                    setTemplateDraft({ name: "", type: "SOAP", content: "" })
                    setNewTemplateOpen(false)
                  }}
                  disabled={!templateDraft.name || !templateDraft.content}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {props.settings.templates.map((template) => (
            <div key={template.id} className="rounded-md border px-3 py-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{template.name}</p>
                <p className="text-xs text-muted-foreground">
                  {template.type} • {template.lastModified}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => props.updateTemplates(props.settings.templates.filter((item) => item.id !== template.id))}
              >
                Delete
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clinical Rules</CardTitle>
          <CardDescription>Persisted decision support rules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Dialog open={newRuleOpen} onOpenChange={setNewRuleOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">New Rule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Input
                  placeholder="Rule name"
                  value={ruleDraft.name}
                  onChange={(event) => setRuleDraft((prev) => ({ ...prev, name: event.target.value }))}
                />
                <Input
                  placeholder="Description"
                  value={ruleDraft.description}
                  onChange={(event) => setRuleDraft((prev) => ({ ...prev, description: event.target.value }))}
                />
                <Textarea
                  placeholder="Condition"
                  value={ruleDraft.condition}
                  onChange={(event) => setRuleDraft((prev) => ({ ...prev, condition: event.target.value }))}
                />
                <Input
                  placeholder="Action"
                  value={ruleDraft.action}
                  onChange={(event) => setRuleDraft((prev) => ({ ...prev, action: event.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewRuleOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!ruleDraft.name || !ruleDraft.condition || !ruleDraft.action}
                  onClick={() => {
                    props.updateRules([
                      ...props.settings.clinicalRules,
                      {
                        id: `rule-${Date.now()}`,
                        name: ruleDraft.name,
                        description: ruleDraft.description || "Custom rule",
                        condition: ruleDraft.condition,
                        action: ruleDraft.action,
                        enabled: true
                      }
                    ])
                    setRuleDraft({ name: "", description: "", condition: "", action: "" })
                    setNewRuleOpen(false)
                  }}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {props.settings.clinicalRules.map((rule) => (
            <div key={rule.id} className="rounded-md border px-3 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                </div>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(enabled) =>
                    props.updateRules(
                      props.settings.clinicalRules.map((item) => (item.id === rule.id ? { ...item, enabled } : item))
                    )
                  }
                />
              </div>
              <div className="text-xs rounded bg-muted px-2 py-1 font-mono">
                IF {rule.condition} THEN {rule.action}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function MfaSelfServicePanel(props: {
  user: AuthUserRecord | null
  onUserRefresh: () => Promise<void>
}) {
  const [setupSecret, setSetupSecret] = useState<string | null>(null)
  const [setupUri, setSetupUri] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState("")
  const [backupCode, setBackupCode] = useState("")
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  const mfaEnabled = Boolean(props.user?.mfaEnabled)

  const copyBackupCodes = async () => {
    if (generatedBackupCodes.length === 0) return
    await navigator.clipboard.writeText(generatedBackupCodes.join("\n"))
    setMessage("Backup codes copied to clipboard.")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-700" />
          MFA Self-Service
        </CardTitle>
        <CardDescription>Set up, rotate, or disable MFA for your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p className="font-medium">Current Status</p>
            <p className="text-xs text-muted-foreground">{mfaEnabled ? "MFA enabled" : "MFA disabled"}</p>
          </div>
          <Badge variant={mfaEnabled ? "secondary" : "outline"}>{mfaEnabled ? "Enabled" : "Disabled"}</Badge>
        </div>

        {!mfaEnabled && (
          <Button
            variant="outline"
            disabled={isWorking}
            onClick={async () => {
              setIsWorking(true)
              setError(null)
              setMessage(null)
              try {
                const response = await setupMfa()
                setSetupSecret(response.setup.secret)
                setSetupUri(response.setup.otpAuthUrl)
                setMessage("MFA setup initialized. Add the secret to your authenticator and verify code.")
              } catch (requestError) {
                setError(requestError instanceof Error ? requestError.message : "Failed to initialize MFA setup.")
              } finally {
                setIsWorking(false)
              }
            }}
          >
            Initialize MFA Setup
          </Button>
        )}

        {setupSecret && !mfaEnabled && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Manual setup secret</p>
            <code className="text-xs break-all">{setupSecret}</code>
            {setupUri && (
              <a href={setupUri} className="text-xs underline" target="_blank" rel="noreferrer">
                Open otpauth URI
              </a>
            )}
            <div className="flex items-center gap-2">
              <Input value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="Enter 6-digit code" />
              <Button
                disabled={isWorking || mfaCode.trim().length < 6}
                onClick={async () => {
                  setIsWorking(true)
                  setError(null)
                  setMessage(null)
                  try {
                    const result = await enableMfa(mfaCode.trim())
                    setGeneratedBackupCodes(result.backupCodes)
                    setSetupSecret(null)
                    setSetupUri(null)
                    setMfaCode("")
                    await props.onUserRefresh()
                    setMessage("MFA enabled. Store your backup codes securely.")
                  } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : "Failed to enable MFA.")
                  } finally {
                    setIsWorking(false)
                  }
                }}
              >
                Enable MFA
              </Button>
            </div>
          </div>
        )}

        {mfaEnabled && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                placeholder="MFA code for sensitive actions"
              />
              <Input
                value={backupCode}
                onChange={(event) => setBackupCode(event.target.value)}
                placeholder="Backup code (optional)"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={isWorking || mfaCode.trim().length < 6}
                onClick={async () => {
                  setIsWorking(true)
                  setError(null)
                  try {
                    const result = await regenerateMfaBackupCodes(mfaCode.trim())
                    setGeneratedBackupCodes(result.backupCodes)
                    setMessage("Backup codes regenerated.")
                  } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : "Failed to regenerate backup codes.")
                  } finally {
                    setIsWorking(false)
                  }
                }}
              >
                Regenerate Backup Codes
              </Button>
              <Button
                variant="outline"
                disabled={isWorking || (!mfaCode.trim() && !backupCode.trim())}
                onClick={async () => {
                  setIsWorking(true)
                  setError(null)
                  try {
                    await disableMfa({
                      mfaCode: mfaCode.trim() || undefined,
                      backupCode: backupCode.trim() || undefined
                    })
                    await props.onUserRefresh()
                    setGeneratedBackupCodes([])
                    setMessage("MFA disabled.")
                  } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : "Failed to disable MFA.")
                  } finally {
                    setIsWorking(false)
                  }
                }}
              >
                Disable MFA
              </Button>
            </div>
          </div>
        )}

        {generatedBackupCodes.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
            <p className="text-sm font-medium">Backup Codes</p>
            <div className="text-xs grid grid-cols-2 gap-1">
              {generatedBackupCodes.map((code) => (
                <code key={code}>{code}</code>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={copyBackupCodes}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Codes
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function AdminMfaRecoveryPanel() {
  const [users, setUsers] = useState<Array<{
    id: string
    email: string
    name: string
    role: "ADMIN" | "MA" | "CLINICIAN"
    mfaEnabled: boolean
  }>>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [resetReason, setResetReason] = useState("Account recovery approved by admin")

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listAdminUsers(100)
      setUsers(response.users)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load users")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin MFA Recovery</CardTitle>
        <CardDescription>Reset MFA for locked-out users with an explicit reason.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input value={resetReason} onChange={(event) => setResetReason(event.target.value)} placeholder="Reset reason for audit log" />
          <Button variant="outline" onClick={load} disabled={isLoading}>
            {isLoading ? "Loading..." : "Refresh Users"}
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {users.map((user) => (
          <div key={user.id} className="rounded-md border p-3 flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">
                {user.name} <span className="text-xs text-muted-foreground">({user.role})</span>
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={user.mfaEnabled ? "secondary" : "outline"}>{user.mfaEnabled ? "MFA Enabled" : "MFA Off"}</Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={busyUserId === user.id || !user.mfaEnabled || resetReason.trim().length < 6}
                onClick={async () => {
                  setBusyUserId(user.id)
                  setError(null)
                  try {
                    await adminResetUserMfa(user.id, resetReason.trim())
                    await load()
                  } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : "Failed to reset MFA")
                  } finally {
                    setBusyUserId(null)
                  }
                }}
              >
                Reset MFA
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function DispatchOpsPanel() {
  const [jobs, setJobs] = useState<DispatchJobRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<"ALL" | DispatchJobRecord["status"]>("ALL")
  const [isLoading, setIsLoading] = useState(false)
  const [isRetryingDue, setIsRetryingDue] = useState(false)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadJobs = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listDispatchJobs({
        status: statusFilter,
        limit: 100
      })
      setJobs(response.jobs)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load dispatch jobs")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadJobs()
  }, [statusFilter])

  const statusVariant = (status: DispatchJobRecord["status"]) => {
    if (status === "DISPATCHED") return "secondary"
    if (status === "DEAD_LETTER") return "destructive"
    return "outline"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-600" />
          Dispatch Replay & Dead Letter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="RETRYING">Retrying</SelectItem>
              <SelectItem value="DISPATCHED">Dispatched</SelectItem>
              <SelectItem value="DEAD_LETTER">Dead Letter</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadJobs} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={async () => {
              setIsRetryingDue(true)
              try {
                await retryDueDispatchJobs(50)
                await loadJobs()
              } catch (requestError) {
                setError(requestError instanceof Error ? requestError.message : "Retry due failed")
              } finally {
                setIsRetryingDue(false)
              }
            }}
            disabled={isRetryingDue}
          >
            {isRetryingDue ? "Retrying..." : "Retry Due Jobs"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {jobs.length === 0 && <div className="text-sm text-muted-foreground">No jobs found.</div>}

        {jobs.map((job) => (
          <div key={job.id} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-medium text-sm">Job {job.id}</p>
                <p className="text-xs text-muted-foreground">
                  Encounter {job.encounterId} • {job.target} • {job.contractType ?? "N/A"}
                </p>
              </div>
              <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
            </div>
            {job.lastError && <p className="text-xs text-red-700">{job.lastError}</p>}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busyJobId === job.id || job.status === "DISPATCHED"}
                onClick={async () => {
                  setBusyJobId(job.id)
                  try {
                    await replayDispatchJob(job.id)
                    await loadJobs()
                  } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : "Replay failed")
                  } finally {
                    setBusyJobId(null)
                  }
                }}
              >
                Replay
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyJobId === job.id || job.status === "DEAD_LETTER"}
                onClick={async () => {
                  setBusyJobId(job.id)
                  try {
                    await deadLetterDispatchJob(job.id, "Manually moved to dead-letter queue")
                    await loadJobs()
                  } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : "Dead-letter update failed")
                  } finally {
                    setBusyJobId(null)
                  }
                }}
              >
                Dead-Letter
              </Button>
              <span className="text-xs text-muted-foreground">
                Attempt {job.attemptCount}/{job.maxAttempts}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function DispatchContractValidationPanel() {
  const [target, setTarget] = useState<"FHIR_R4" | "HL7_V2" | "VENDOR_API" | "NONE">("NONE")
  const [vendor, setVendor] = useState<"GENERIC" | "ATHENAHEALTH" | "NEXTGEN" | "ECLINICALWORKS">("GENERIC")
  const [isValidating, setIsValidating] = useState(false)
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    ok: boolean
    contractType: string
    contentType: string
    errors: string[]
  } | null>(null)
  const [readiness, setReadiness] = useState<{
    configuredTarget: "FHIR_R4" | "HL7_V2" | "VENDOR_API" | "NONE"
    configuredVendor: "GENERIC" | "ATHENAHEALTH" | "NEXTGEN" | "ECLINICALWORKS"
    authMode: "NONE" | "API_KEY" | "BEARER" | "HMAC"
    readiness: {
      ready: boolean
      checks: Array<{ key: string; ok: boolean; detail: string }>
    }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadReadiness = async () => {
    setIsLoadingReadiness(true)
    setError(null)
    try {
      const response = await fetchDispatchSandboxReadiness()
      setReadiness(response)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load sandbox readiness")
    } finally {
      setIsLoadingReadiness(false)
    }
  }

  useEffect(() => {
    void loadReadiness()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispatch Contract Validation</CardTitle>
        <CardDescription>Preflight contract checks before running against EHR sandbox endpoints.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Select value={target} onValueChange={(value) => setTarget(value as typeof target)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">NONE</SelectItem>
              <SelectItem value="FHIR_R4">FHIR_R4</SelectItem>
              <SelectItem value="HL7_V2">HL7_V2</SelectItem>
              <SelectItem value="VENDOR_API">VENDOR_API</SelectItem>
            </SelectContent>
          </Select>
          <Select value={vendor} onValueChange={(value) => setVendor(value as typeof vendor)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GENERIC">GENERIC</SelectItem>
              <SelectItem value="ATHENAHEALTH">ATHENAHEALTH</SelectItem>
              <SelectItem value="NEXTGEN">NEXTGEN</SelectItem>
              <SelectItem value="ECLINICALWORKS">ECLINICALWORKS</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={async () => {
              setIsValidating(true)
              setError(null)
              try {
                const response = await validateDispatchContract({ target, vendor })
                setValidationResult(response.validation)
              } catch (requestError) {
                setError(requestError instanceof Error ? requestError.message : "Validation failed")
              } finally {
                setIsValidating(false)
              }
            }}
            disabled={isValidating}
          >
            {isValidating ? "Validating..." : "Validate Contract"}
          </Button>
        </div>

        <Button variant="outline" onClick={loadReadiness} disabled={isLoadingReadiness}>
          {isLoadingReadiness ? "Loading readiness..." : "Refresh Sandbox Readiness"}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {validationResult && (
          <div className="rounded-md border p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={validationResult.ok ? "secondary" : "destructive"}>
                {validationResult.ok ? "Valid" : "Invalid"}
              </Badge>
              <span className="text-muted-foreground">
                {validationResult.contractType} • {validationResult.contentType}
              </span>
            </div>
            {validationResult.errors.length > 0 && (
              <ul className="list-disc pl-5 text-red-700">
                {validationResult.errors.map((errorItem) => (
                  <li key={errorItem}>{errorItem}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {readiness && (
          <div className="rounded-md border p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={readiness.readiness.ready ? "secondary" : "destructive"}>
                {readiness.readiness.ready ? "Ready" : "Not Ready"}
              </Badge>
              <span className="text-muted-foreground">
                Target {readiness.configuredTarget} • Vendor {readiness.configuredVendor} • Auth {readiness.authMode}
              </span>
            </div>
            <div className="space-y-1">
              {readiness.readiness.checks.map((check) => (
                <div key={check.key} className="text-xs">
                  <span className={check.ok ? "text-emerald-700" : "text-red-700"}>
                    {check.ok ? "OK" : "FAIL"}
                  </span>{" "}
                  {check.key}: {check.detail}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ObservabilityPanel() {
  const [summary, setSummary] = useState<ObservabilitySummaryRecord | null>(null)
  const [trends, setTrends] = useState<ObservabilityTrendsRecord | null>(null)
  const [windowMinutes, setWindowMinutes] = useState("60")
  const [bucketMinutes, setBucketMinutes] = useState("15")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chartData = useMemo(() => {
    if (!trends) return []
    return trends.points.map((point) => {
      const start = new Date(point.bucketStart)
      const label = `${String(start.getMonth() + 1).padStart(2, "0")}/${String(start.getDate()).padStart(2, "0")} ${String(
        start.getHours()
      ).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`
      return {
        label,
        suggestionAcceptancePct: Number((point.aiQuality.suggestions.acceptanceRate * 100).toFixed(1)),
        transcriptCorrectionPct: Number((point.aiQuality.transcript.correctionRate * 100).toFixed(1)),
        complianceFalsePositivePct: Number((point.aiQuality.compliance.falsePositiveRate * 100).toFixed(1)),
        sttFallbackPct: Number((point.stt.fallbackRate * 100).toFixed(1)),
        authFailures: point.auth.failureCount,
        deadLetters: point.dispatch.deadLetterCount
      }
    })
  }, [trends])

  const latestTrendPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const parsedWindowMinutes = Number(windowMinutes) || 60
      const parsedBucketMinutes = Number(bucketMinutes) || Math.max(1, Math.floor(parsedWindowMinutes / 4))
      const [summaryResponse, trendsResponse] = await Promise.all([
        fetchObservabilitySummary(parsedWindowMinutes),
        fetchObservabilityTrends(parsedWindowMinutes, parsedBucketMinutes)
      ])
      setSummary(summaryResponse.summary)
      setTrends(trendsResponse.trends)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load observability dashboards")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pilot Observability</CardTitle>
        <CardDescription>Dispatch, STT, auth, and AI quality drift signals for on-call.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-center">
          <Input
            value={windowMinutes}
            onChange={(event) => setWindowMinutes(event.target.value)}
            className="w-[140px]"
            placeholder="Window min"
          />
          <Input
            value={bucketMinutes}
            onChange={(event) => setBucketMinutes(event.target.value)}
            className="w-[140px]"
            placeholder="Bucket min"
          />
          <Button variant="outline" onClick={load} disabled={isLoading}>
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {summary && (
          <div className="space-y-2 text-sm">
            <div className="rounded-md border p-3">
              <p className="font-medium">Dispatch</p>
              <p className="text-muted-foreground">
                Dead-letter (window): {summary.dispatch.deadLetterRecentCount} • Retrying: {summary.dispatch.retryingCount} • Pending:{" "}
                {summary.dispatch.pendingCount}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium">STT</p>
              <p className="text-muted-foreground">
                Fallback rate: {(summary.stt.fallbackRate * 100).toFixed(1)}% ({summary.stt.fallbackCount}/{summary.stt.ingestCount})
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium">Auth</p>
              <p className="text-muted-foreground">Failures in window: {summary.auth.failureCount}</p>
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <p className="font-medium">AI Quality Drift</p>
              <p className="text-muted-foreground">
                Suggestion acceptance: {(summary.aiQuality.suggestions.acceptanceRate * 100).toFixed(1)}% (
                {summary.aiQuality.suggestions.acceptedCount}/{summary.aiQuality.suggestions.decisionCount})
              </p>
              <p className="text-muted-foreground">
                Transcript correction: {(summary.aiQuality.transcript.correctionRate * 100).toFixed(1)}% (
                {summary.aiQuality.transcript.correctionCount}/{summary.aiQuality.transcript.segmentCount})
              </p>
              <p className="text-muted-foreground">
                Compliance false-positive: {(summary.aiQuality.compliance.falsePositiveRate * 100).toFixed(1)}% (
                {summary.aiQuality.compliance.dismissedCount}/{summary.aiQuality.compliance.reviewedCount} reviewed)
              </p>
              <p className="text-muted-foreground">
                Active compliance backlog: {summary.aiQuality.compliance.activeCount}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={summary.alerts.dlqThresholdBreached ? "destructive" : "secondary"}>
                DLQ {summary.alerts.dlqThresholdBreached ? "Alert" : "OK"}
              </Badge>
              <Badge variant={summary.alerts.sttFallbackHigh ? "destructive" : "secondary"}>
                STT {summary.alerts.sttFallbackHigh ? "Alert" : "OK"}
              </Badge>
              <Badge variant={summary.alerts.authFailureBurst ? "destructive" : "secondary"}>
                Auth {summary.alerts.authFailureBurst ? "Alert" : "OK"}
              </Badge>
              <Badge variant={summary.alerts.suggestionAcceptanceLow ? "destructive" : "secondary"}>
                Suggestion Acceptance {summary.alerts.suggestionAcceptanceLow ? "Alert" : "OK"}
              </Badge>
              <Badge variant={summary.alerts.transcriptCorrectionHigh ? "destructive" : "secondary"}>
                Transcript Correction {summary.alerts.transcriptCorrectionHigh ? "Alert" : "OK"}
              </Badge>
              <Badge variant={summary.alerts.complianceFalsePositiveHigh ? "destructive" : "secondary"}>
                Compliance FP {summary.alerts.complianceFalsePositiveHigh ? "Alert" : "OK"}
              </Badge>
            </div>
            <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
              <p>Dispatch incident path: `docs/ON_CALL_PLAYBOOK.md` → "Runbook: Dispatch Incident"</p>
              <p>STT incident path: `docs/ON_CALL_PLAYBOOK.md` → "Runbook: STT/Diarization Incident"</p>
              <p>Auth incident path: `docs/ON_CALL_PLAYBOOK.md` → "Runbook: Auth/MFA Incident"</p>
              <p>AI quality drift path: `docs/ON_CALL_PLAYBOOK.md` → "Runbook: AI Quality Drift Incident"</p>
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <p className="font-medium">AI Drift Timeseries</p>
              <p className="text-xs text-muted-foreground">
                Window: {(trends?.windowMinutes ?? (Number(windowMinutes) || 60))}m • Bucket: {(trends?.bucketMinutes ?? (Number(bucketMinutes) || 15))}m
              </p>
              {chartData.length > 0 ? (
                <div className="space-y-3">
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" minTickGap={28} />
                        <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={44} />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            if (name.includes("%")) return [`${value}%`, name]
                            return [value, name]
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="suggestionAcceptancePct"
                          name="Suggestion Acceptance %"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="transcriptCorrectionPct"
                          name="Transcript Correction %"
                          stroke="#ea580c"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="complianceFalsePositivePct"
                          name="Compliance False Positive %"
                          stroke="#9333ea"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {latestTrendPoint && (
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      <p>Latest bucket ({latestTrendPoint.label})</p>
                      <p>
                        STT fallback: {latestTrendPoint.sttFallbackPct.toFixed(1)}% • Auth failures: {latestTrendPoint.authFailures} • Dead letters:{" "}
                        {latestTrendPoint.deadLetters}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No trend points available for the selected window.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function Settings({ userRole = "user" }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettingsRecord>(defaultSettings)
  const [persistedFingerprint, setPersistedFingerprint] = useState<string>(JSON.stringify(defaultSettings))
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUserRecord | null>(null)

  const hasChanges = useMemo(() => JSON.stringify(settings) !== persistedFingerprint, [settings, persistedFingerprint])

  const loadSettings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [settingsResult, userResult] = await Promise.all([fetchUserSettings(), fetchCurrentUser()])
      setSettings(settingsResult.settings)
      setPersistedFingerprint(JSON.stringify(settingsResult.settings))
      setUser(userResult.user)
      setMessage(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load settings")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  const saveSettings = async () => {
    setIsSaving(true)
    setError(null)
    setMessage(null)
    try {
      const response = await updateUserSettings(settings)
      setSettings(response.settings)
      setPersistedFingerprint(JSON.stringify(response.settings))
      setMessage("Settings saved.")
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Persisted account settings, security controls, and pilot operations.</p>
        </div>
        <Badge variant="outline">{userRole === "admin" ? "Administrator" : "User"}</Badge>
      </div>

      <SettingsSaveBar
        onReload={loadSettings}
        onSave={saveSettings}
        isLoading={isLoading}
        isSaving={isSaving}
        hasChanges={hasChanges}
        error={error}
        message={message}
      />

      <Tabs defaultValue="suggestions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="clinical">Clinical</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="interface">Interface</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="ops">Ops</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions">
          <SuggestionsPanel
            settings={settings}
            update={(next) => setSettings((prev) => ({ ...prev, suggestions: next }))}
          />
        </TabsContent>

        <TabsContent value="clinical">
          <ClinicalPanel
            settings={settings}
            updateClinical={(next) => setSettings((prev) => ({ ...prev, clinical: next }))}
            updateLanguage={(next) => setSettings((prev) => ({ ...prev, language: next }))}
          />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateAndRulesPanel
            settings={settings}
            updateTemplates={(templates) => setSettings((prev) => ({ ...prev, templates }))}
            updateRules={(clinicalRules) => setSettings((prev) => ({ ...prev, clinicalRules }))}
          />
        </TabsContent>

        <TabsContent value="interface">
          <InterfacePanel
            settings={settings}
            updateAppearance={(appearance) => setSettings((prev) => ({ ...prev, appearance }))}
            updateAdvanced={(advanced) => setSettings((prev) => ({ ...prev, advanced }))}
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <MfaSelfServicePanel
            user={user}
            onUserRefresh={async () => {
              const me = await fetchCurrentUser()
              setUser(me.user)
            }}
          />
          {userRole === "admin" && <AdminMfaRecoveryPanel />}
          <Card>
            <CardHeader>
              <CardTitle>Security Notes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Use MFA for all production users and store backup codes outside this system.</p>
              <p>Secret rotation and incident procedures are documented in `docs/SECURITY_RUNBOOK.md`.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ops" className="space-y-6">
          {userRole === "admin" ? (
            <>
              <DispatchContractValidationPanel />
              <ObservabilityPanel />
              <DispatchOpsPanel />
            </>
          ) : (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>Operations dashboards are restricted to administrators.</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
