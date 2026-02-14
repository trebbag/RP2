import { useState } from "react"
import { motion } from "motion/react"
import {
  FileText,
  Stethoscope,
  Bell,
  Settings,
  ChevronRight,
  Calendar,
  Clock,
  Hash,
  Pill,
  Thermometer,
  User,
  Search,
  Bold,
  Italic,
  Underline,
  List,
  Home,
  Mic,
  Square,
  Save,
  Download,
  Check,
  ChevronDown,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle
} from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Separator } from "./ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { Checkbox } from "./ui/checkbox"
import { Switch } from "./ui/switch"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible"

export function FigmaComponentLibrary() {
  const [selectedTab, setSelectedTab] = useState("style-guide")
  const [buttonStates, setButtonStates] = useState<{ [key: string]: "default" | "hover" | "active" | "disabled" }>({
    primary: "default",
    secondary: "default",
    ghost: "default"
  })
  const [inputStates, setInputStates] = useState<{ [key: string]: "default" | "error" | "focus" }>({
    textField: "default",
    dropdown: "default"
  })
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(true)
  const [isDictationActive, setIsDictationActive] = useState(false)

  // Style Guide Data
  const colorPalette = {
    primary: {
      name: "Primary",
      value: "#030213",
      usage: "Main brand color, primary actions"
    },
    secondary: {
      name: "Secondary",
      value: "#ececf0",
      usage: "Supporting elements, subtle backgrounds"
    },
    background: {
      light: { name: "Background Light", value: "#ffffff", usage: "Main background" },
      dark: { name: "Background Dark", value: "oklch(0.145 0 0)", usage: "Dark mode background" }
    },
    text: {
      primary: { name: "Text Primary", value: "oklch(0.145 0 0)", usage: "Primary text content" },
      secondary: { name: "Text Secondary", value: "#717182", usage: "Secondary text, captions" }
    },
    error: {
      name: "Error",
      value: "#d4183d",
      usage: "Error states, destructive actions"
    },
    highlight: {
      name: "Accent",
      value: "#e9ebef",
      usage: "Hover states, highlighted content"
    }
  }

  const typography = {
    h1: { name: "H1", size: "24px", weight: "500", usage: "Page titles" },
    h2: { name: "H2", size: "20px", weight: "500", usage: "Section headers" },
    h3: { name: "H3", size: "18px", weight: "500", usage: "Subsection headers" },
    body: { name: "Body", size: "14px", weight: "400", usage: "Default text content" },
    caption: { name: "Caption", size: "12px", weight: "400", usage: "Small text, metadata" }
  }

  const spacingTokens = [
    { name: "4px", value: "4px", usage: "Fine spacing, borders" },
    { name: "8px", value: "8px", usage: "Small gaps, padding" },
    { name: "16px", value: "16px", usage: "Standard spacing" },
    { name: "24px", value: "24px", usage: "Section spacing" },
    { name: "32px", value: "32px", usage: "Large spacing, margins" }
  ]

  // Component Examples
  const ButtonExample = ({ variant, state, size = "default" }: { variant: string; state: string; size?: string }) => {
    const isDisabled = state === "disabled"
    const isHover = state === "hover"

    return (
      <Button
        variant={variant as any}
        size={size as any}
        disabled={isDisabled}
        className={`${isHover ? "opacity-90" : ""} transition-all`}
      >
        {variant === "ghost" ? <Settings className="w-4 h-4 mr-2" /> : null}
        {variant.charAt(0).toUpperCase() + variant.slice(1)} Button
      </Button>
    )
  }

  const InputExample = ({ type, state }: { type: string; state: string }) => {
    const isError = state === "error"
    const isFocus = state === "focus"

    if (type === "dropdown") {
      return (
        <Select>
          <SelectTrigger
            className={`${isError ? "border-destructive" : ""} ${isFocus ? "border-ring ring-2 ring-ring/50" : ""}`}
          >
            <SelectValue placeholder="Select template..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="soap">SOAP Note</SelectItem>
            <SelectItem value="wellness">Wellness Visit</SelectItem>
            <SelectItem value="followup">Follow-up</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    return (
      <Input
        placeholder="Enter patient ID..."
        className={`${isError ? "border-destructive ring-destructive/20" : ""} ${isFocus ? "border-ring ring-2 ring-ring/50" : ""}`}
      />
    )
  }

  const IconExample = ({ name, icon: Icon, category }: { name: string; icon: any; category: string }) => (
    <div className="flex flex-col items-center p-3 border rounded-lg space-y-2">
      <Icon className="w-6 h-6" />
      <div className="text-center">
        <div className="text-xs font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{category}</div>
      </div>
    </div>
  )

  // Pattern Components
  const EditorToolbar = () => (
    <div className="flex items-center gap-2 p-3 border rounded-lg bg-background">
      <Button variant="ghost" size="sm">
        <Bold className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm">
        <Italic className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm">
        <Underline className="w-4 h-4" />
      </Button>
      <Separator orientation="vertical" className="h-6" />
      <Button variant="ghost" size="sm">
        <List className="w-4 h-4" />
      </Button>
      <Separator orientation="vertical" className="h-6" />
      <Button variant="ghost" size="sm" className="text-destructive">
        <Mic className="w-4 h-4" />
      </Button>
    </div>
  )

  const SmartPhraseDropdown = () => (
    <div className="relative">
      <div className="border rounded-md p-2 bg-popover shadow-lg">
        <div className="space-y-1">
          <div className="px-2 py-1 text-xs text-muted-foreground">Smart Phrases</div>
          <div className="px-2 py-1.5 hover:bg-accent rounded cursor-pointer text-sm">Patient denies chest pain</div>
          <div className="px-2 py-1.5 hover:bg-accent rounded cursor-pointer text-sm">Physical exam unremarkable</div>
          <div className="px-2 py-1.5 hover:bg-accent rounded cursor-pointer text-sm">Return to clinic in 2 weeks</div>
        </div>
      </div>
    </div>
  )

  const CollapsibleNoteSection = ({ isOpen }: { isOpen: boolean }) => (
    <Collapsible open={isOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 border rounded-lg hover:bg-accent">
        <span className="font-medium">Assessment & Plan</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="p-4 border rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            This section contains the clinical assessment and treatment plan details.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )

  const VitalsTable = () => (
    <div className="border rounded-lg">
      <div className="grid grid-cols-3 gap-4 p-4">
        <div className="text-center">
          <div className="text-sm font-medium">BP</div>
          <div className="text-lg">120/80</div>
          <div className="text-xs text-muted-foreground">mmHg</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-medium">HR</div>
          <div className="text-lg">72</div>
          <div className="text-xs text-muted-foreground">bpm</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-medium">Temp</div>
          <div className="text-lg">98.6°</div>
          <div className="text-xs text-muted-foreground">F</div>
        </div>
      </div>
    </div>
  )

  const DictationActive = () => (
    <div className="flex items-center gap-3 p-4 border rounded-lg bg-destructive/10 border-destructive/20">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-destructive rounded-full animate-pulse"></div>
        <span className="text-sm font-medium">Recording Active</span>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="w-0.5 rounded-full bg-destructive"
            style={{
              height: `${8 + (i % 4) * 3}px`,
              animation: `audioWave${i} ${1.2 + (i % 3) * 0.3}s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
      <div className="text-sm font-mono">02:34</div>
      <Button variant="ghost" size="sm">
        <Square className="w-4 h-4" />
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-medium">RevenuePilot Component Library</h1>
              <p className="text-muted-foreground">Modern clinical documentation design system</p>
            </div>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="style-guide">📘 Style Guide</TabsTrigger>
            <TabsTrigger value="components">🔧 Components</TabsTrigger>
            <TabsTrigger value="patterns">🧩 Patterns</TabsTrigger>
          </TabsList>

          {/* Style Guide Page */}
          <TabsContent value="style-guide" className="space-y-12">
            {/* Typography */}
            <section>
              <h2 className="text-xl font-medium mb-6">Typography</h2>
              <div className="space-y-6">
                {Object.entries(typography).map(([key, type]) => (
                  <div key={key} className="flex items-baseline gap-8 p-4 border rounded-lg">
                    <div className="min-w-[100px]">
                      <div className="text-sm font-medium">{type.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {type.size} · {type.weight === "500" ? "Medium" : "Normal"}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div style={{ fontSize: type.size, fontWeight: type.weight }}>
                        The quick brown fox jumps over the lazy dog
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground min-w-[120px]">{type.usage}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Colors */}
            <section>
              <h2 className="text-xl font-medium mb-6">Colors</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Primary */}
                <div className="space-y-3">
                  <div className="w-full h-16 rounded-lg" style={{ backgroundColor: colorPalette.primary.value }}></div>
                  <div>
                    <div className="font-medium">{colorPalette.primary.name}</div>
                    <div className="text-sm text-muted-foreground">{colorPalette.primary.value}</div>
                    <div className="text-xs text-muted-foreground">{colorPalette.primary.usage}</div>
                  </div>
                </div>

                {/* Secondary */}
                <div className="space-y-3">
                  <div
                    className="w-full h-16 rounded-lg border"
                    style={{ backgroundColor: colorPalette.secondary.value }}
                  ></div>
                  <div>
                    <div className="font-medium">{colorPalette.secondary.name}</div>
                    <div className="text-sm text-muted-foreground">{colorPalette.secondary.value}</div>
                    <div className="text-xs text-muted-foreground">{colorPalette.secondary.usage}</div>
                  </div>
                </div>

                {/* Error */}
                <div className="space-y-3">
                  <div className="w-full h-16 rounded-lg" style={{ backgroundColor: colorPalette.error.value }}></div>
                  <div>
                    <div className="font-medium">{colorPalette.error.name}</div>
                    <div className="text-sm text-muted-foreground">{colorPalette.error.value}</div>
                    <div className="text-xs text-muted-foreground">{colorPalette.error.usage}</div>
                  </div>
                </div>

                {/* Text Primary */}
                <div className="space-y-3">
                  <div
                    className="w-full h-16 rounded-lg border"
                    style={{ backgroundColor: colorPalette.text.primary.value }}
                  ></div>
                  <div>
                    <div className="font-medium">{colorPalette.text.primary.name}</div>
                    <div className="text-sm text-muted-foreground">{colorPalette.text.primary.value}</div>
                    <div className="text-xs text-muted-foreground">{colorPalette.text.primary.usage}</div>
                  </div>
                </div>

                {/* Text Secondary */}
                <div className="space-y-3">
                  <div
                    className="w-full h-16 rounded-lg border"
                    style={{ backgroundColor: colorPalette.text.secondary.value }}
                  ></div>
                  <div>
                    <div className="font-medium">{colorPalette.text.secondary.name}</div>
                    <div className="text-sm text-muted-foreground">{colorPalette.text.secondary.value}</div>
                    <div className="text-xs text-muted-foreground">{colorPalette.text.secondary.usage}</div>
                  </div>
                </div>

                {/* Highlight */}
                <div className="space-y-3">
                  <div
                    className="w-full h-16 rounded-lg border"
                    style={{ backgroundColor: colorPalette.highlight.value }}
                  ></div>
                  <div>
                    <div className="font-medium">{colorPalette.highlight.name}</div>
                    <div className="text-sm text-muted-foreground">{colorPalette.highlight.value}</div>
                    <div className="text-xs text-muted-foreground">{colorPalette.highlight.usage}</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Spacing */}
            <section>
              <h2 className="text-xl font-medium mb-6">Spacing System</h2>
              <div className="space-y-4">
                {spacingTokens.map((token) => (
                  <div key={token.name} className="flex items-center gap-6 p-4 border rounded-lg">
                    <div className="min-w-[60px] font-medium">{token.name}</div>
                    <div className="bg-primary h-4 rounded" style={{ width: token.value }}></div>
                    <div className="text-sm text-muted-foreground">{token.usage}</div>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          {/* Components Page */}
          <TabsContent value="components" className="space-y-12">
            {/* Buttons */}
            <section>
              <h2 className="text-xl font-medium mb-6">Buttons</h2>
              <div className="space-y-8">
                {/* Primary Button */}
                <div>
                  <h3 className="font-medium mb-4">Button / Primary</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Default</div>
                      <ButtonExample variant="default" state="default" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Hover</div>
                      <ButtonExample variant="default" state="hover" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Active</div>
                      <ButtonExample variant="default" state="active" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Disabled</div>
                      <ButtonExample variant="default" state="disabled" />
                    </div>
                  </div>
                </div>

                {/* Secondary Button */}
                <div>
                  <h3 className="font-medium mb-4">Button / Secondary</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Default</div>
                      <ButtonExample variant="outline" state="default" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Hover</div>
                      <ButtonExample variant="outline" state="hover" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Active</div>
                      <ButtonExample variant="outline" state="active" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Disabled</div>
                      <ButtonExample variant="outline" state="disabled" />
                    </div>
                  </div>
                </div>

                {/* Ghost Button */}
                <div>
                  <h3 className="font-medium mb-4">Button / Ghost</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Default</div>
                      <ButtonExample variant="ghost" state="default" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Hover</div>
                      <ButtonExample variant="ghost" state="hover" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Active</div>
                      <ButtonExample variant="ghost" state="active" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Disabled</div>
                      <ButtonExample variant="ghost" state="disabled" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Inputs */}
            <section>
              <h2 className="text-xl font-medium mb-6">Inputs</h2>
              <div className="space-y-8">
                {/* Text Field */}
                <div>
                  <h3 className="font-medium mb-4">Input / Text Field</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Default</div>
                      <InputExample type="textfield" state="default" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Focus</div>
                      <InputExample type="textfield" state="focus" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Error</div>
                      <InputExample type="textfield" state="error" />
                    </div>
                  </div>
                </div>

                {/* Dropdown */}
                <div>
                  <h3 className="font-medium mb-4">Input / Dropdown</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Default</div>
                      <InputExample type="dropdown" state="default" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Focus</div>
                      <InputExample type="dropdown" state="focus" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Error</div>
                      <InputExample type="dropdown" state="error" />
                    </div>
                  </div>
                </div>

                {/* Checkbox */}
                <div>
                  <h3 className="font-medium mb-4">Input / Checkbox</h3>
                  <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                      <Checkbox id="unchecked" />
                      <Label htmlFor="unchecked">Unchecked</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="checked" defaultChecked />
                      <Label htmlFor="checked">Checked</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="disabled" disabled />
                      <Label htmlFor="disabled" className="text-muted-foreground">
                        Disabled
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Toggle */}
                <div>
                  <h3 className="font-medium mb-4">Input / Toggle</h3>
                  <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                      <Switch id="off" />
                      <Label htmlFor="off">Off</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="on" defaultChecked />
                      <Label htmlFor="on">On</Label>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Icons */}
            <section>
              <h2 className="text-xl font-medium mb-6">Icons</h2>
              <div className="space-y-8">
                {/* Editor Icons */}
                <div>
                  <h3 className="font-medium mb-4">Icon / Editor</h3>
                  <div className="grid grid-cols-6 gap-4">
                    <IconExample name="Bold" icon={Bold} category="Editor" />
                    <IconExample name="Italic" icon={Italic} category="Editor" />
                    <IconExample name="Underline" icon={Underline} category="Editor" />
                    <IconExample name="List" icon={List} category="Editor" />
                    <IconExample name="Save" icon={Save} category="Editor" />
                    <IconExample name="Download" icon={Download} category="Editor" />
                  </div>
                </div>

                {/* Clinical Icons */}
                <div>
                  <h3 className="font-medium mb-4">Icon / Clinical</h3>
                  <div className="grid grid-cols-6 gap-4">
                    <IconExample name="Pill" icon={Pill} category="Clinical" />
                    <IconExample name="Stethoscope" icon={Stethoscope} category="Clinical" />
                    <IconExample name="Thermometer" icon={Thermometer} category="Clinical" />
                    <IconExample name="Calendar" icon={Calendar} category="Clinical" />
                    <IconExample name="Clock" icon={Clock} category="Clinical" />
                    <IconExample name="Hash" icon={Hash} category="Clinical" />
                  </div>
                </div>

                {/* Navigation Icons */}
                <div>
                  <h3 className="font-medium mb-4">Icon / Navigation</h3>
                  <div className="grid grid-cols-6 gap-4">
                    <IconExample name="Home" icon={Home} category="Navigation" />
                    <IconExample name="FileText" icon={FileText} category="Navigation" />
                    <IconExample name="Settings" icon={Settings} category="Navigation" />
                    <IconExample name="User" icon={User} category="Navigation" />
                    <IconExample name="Bell" icon={Bell} category="Navigation" />
                    <IconExample name="Search" icon={Search} category="Navigation" />
                  </div>
                </div>
              </div>
            </section>

            {/* Containers */}
            <section>
              <h2 className="text-xl font-medium mb-6">Containers</h2>
              <div className="space-y-8">
                {/* Card */}
                <div>
                  <h3 className="font-medium mb-4">Card / Patient Info</h3>
                  <Card className="max-w-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Patient Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Name:</span>
                          <span className="text-sm font-medium">John Doe</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">DOB:</span>
                          <span className="text-sm font-medium">Jan 15, 1985</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">MRN:</span>
                          <span className="text-sm font-medium">12345678</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Panel */}
                <div>
                  <h3 className="font-medium mb-4">Panel / Sidebar</h3>
                  <div className="w-64 h-48 border rounded-lg bg-sidebar p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-2 rounded hover:bg-sidebar-accent">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">Documentation</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded hover:bg-sidebar-accent">
                        <Settings className="w-4 h-4" />
                        <span className="text-sm">Settings</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded hover:bg-sidebar-accent">
                        <User className="w-4 h-4" />
                        <span className="text-sm">Profile</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toolbar */}
                <div>
                  <h3 className="font-medium mb-4">Toolbar / Editor</h3>
                  <EditorToolbar />
                </div>
              </div>
            </section>
          </TabsContent>

          {/* Patterns Page */}
          <TabsContent value="patterns" className="space-y-12">
            {/* Editor Toolbar */}
            <section>
              <h2 className="text-xl font-medium mb-6">Pattern / Editor / Toolbar</h2>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Complete editor toolbar with formatting controls and dictation functionality
                </p>
                <EditorToolbar />
              </div>
            </section>

            {/* Smart Phrase Dropdown */}
            <section>
              <h2 className="text-xl font-medium mb-6">Pattern / Editor / Smart Phrase Dropdown</h2>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Contextual dropdown with medical phrase suggestions</p>
                <SmartPhraseDropdown />
              </div>
            </section>

            {/* Collapsible Note Section */}
            <section>
              <h2 className="text-xl font-medium mb-6">Pattern / Note Section / Collapsible</h2>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Expandable/collapsible sections for organizing note content
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Expanded State</h4>
                    <CollapsibleNoteSection isOpen={true} />
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Collapsed State</h4>
                    <CollapsibleNoteSection isOpen={false} />
                  </div>
                </div>
              </div>
            </section>

            {/* Vitals Table */}
            <section>
              <h2 className="text-xl font-medium mb-6">Pattern / Vitals Table / Compact</h2>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Compact display of patient vital signs</p>
                <VitalsTable />
              </div>
            </section>

            {/* Dictation Active State */}
            <section>
              <h2 className="text-xl font-medium mb-6">Pattern / Dictation / Active State</h2>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Active dictation interface with waveform visualization and controls
                </p>
                <DictationActive />
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
