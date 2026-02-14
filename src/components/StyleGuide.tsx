import { useState } from "react"
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
  Plus,
  X
} from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Separator } from "./ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"

export function StyleGuide() {
  const [hoveredColor, setHoveredColor] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-medium">RevenuePilot Design System</h1>
          </div>
          <p className="text-muted-foreground">Clinical AI Assistant Design Guide & Component Library</p>
        </div>

        <Tabs defaultValue="typography" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="typography">Typography</TabsTrigger>
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="spacing">Spacing</TabsTrigger>
            <TabsTrigger value="buttons">Buttons</TabsTrigger>
            <TabsTrigger value="icons">Icons</TabsTrigger>
            <TabsTrigger value="tone">UI Tone</TabsTrigger>
          </TabsList>

          {/* Typography Section */}
          <TabsContent value="typography" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Typography System</CardTitle>
                <CardDescription>
                  Base font size: 14px | Font weights: 400 (normal), 500 (medium) | Line height: 1.5
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Font Hierarchy */}
                <div className="space-y-6">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Font Hierarchy</p>
                    <div className="space-y-4">
                      <div className="flex items-baseline gap-4 p-4 bg-muted/30 rounded-lg">
                        <h1 className="text-2xl font-medium">Heading 1</h1>
                        <code className="text-xs bg-muted px-2 py-1 rounded">text-2xl (24px) · font-medium</code>
                      </div>
                      <div className="flex items-baseline gap-4 p-4 bg-muted/30 rounded-lg">
                        <h2 className="text-xl font-medium">Heading 2</h2>
                        <code className="text-xs bg-muted px-2 py-1 rounded">text-xl (20px) · font-medium</code>
                      </div>
                      <div className="flex items-baseline gap-4 p-4 bg-muted/30 rounded-lg">
                        <h3 className="text-lg font-medium">Heading 3</h3>
                        <code className="text-xs bg-muted px-2 py-1 rounded">text-lg (18px) · font-medium</code>
                      </div>
                      <div className="flex items-baseline gap-4 p-4 bg-muted/30 rounded-lg">
                        <h4 className="text-base font-medium">Heading 4</h4>
                        <code className="text-xs bg-muted px-2 py-1 rounded">text-base (16px) · font-medium</code>
                      </div>
                      <div className="flex items-baseline gap-4 p-4 bg-muted/30 rounded-lg">
                        <p className="text-base">Body Text</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded">text-base (14px) · font-normal</code>
                      </div>
                      <div className="flex items-baseline gap-4 p-4 bg-muted/30 rounded-lg">
                        <p className="text-sm">Body Small</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded">text-sm (13px) · font-normal</code>
                      </div>
                      <div className="flex items-baseline gap-4 p-4 bg-muted/30 rounded-lg">
                        <p className="text-xs">Caption</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded">text-xs (12px) · font-normal</code>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Typography Examples */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">
                      Clinical Context Examples
                    </p>
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <h3 className="font-medium mb-2">Navigation Item</h3>
                        <span className="text-sm font-medium">Documentation</span>
                        <p className="text-xs text-muted-foreground mt-1">Create and manage clinical notes</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h3 className="font-medium mb-2">Section Header</h3>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Tools & Resources
                        </h4>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Colors Section */}
          <TabsContent value="colors" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Color Palette</CardTitle>
                <CardDescription>Professional clinical color system with light/dark mode support</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Primary Colors */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Primary Colors</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className="p-4 bg-primary text-primary-foreground rounded-lg cursor-pointer"
                      onMouseEnter={() => setHoveredColor("primary")}
                      onMouseLeave={() => setHoveredColor(null)}
                    >
                      <div className="font-medium">Primary</div>
                      <div className="text-sm opacity-80">
                        {hoveredColor === "primary" ? "#030213 / oklch(0.145 0 0)" : "Main brand color"}
                      </div>
                    </div>
                    <div
                      className="p-4 bg-secondary text-secondary-foreground rounded-lg cursor-pointer border"
                      onMouseEnter={() => setHoveredColor("secondary")}
                      onMouseLeave={() => setHoveredColor(null)}
                    >
                      <div className="font-medium">Secondary</div>
                      <div className="text-sm opacity-80">
                        {hoveredColor === "secondary" ? "oklch(0.95 0.0058 264.53)" : "Supporting color"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Background Colors */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Background Colors</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div
                      className="p-4 bg-background text-foreground rounded-lg border cursor-pointer"
                      onMouseEnter={() => setHoveredColor("background")}
                      onMouseLeave={() => setHoveredColor(null)}
                    >
                      <div className="font-medium">Background</div>
                      <div className="text-sm opacity-70">
                        {hoveredColor === "background" ? "#ffffff" : "Main background"}
                      </div>
                    </div>
                    <div
                      className="p-4 bg-muted text-foreground rounded-lg cursor-pointer"
                      onMouseEnter={() => setHoveredColor("muted")}
                      onMouseLeave={() => setHoveredColor(null)}
                    >
                      <div className="font-medium">Muted</div>
                      <div className="text-sm opacity-70">
                        {hoveredColor === "muted" ? "#ececf0" : "Subtle background"}
                      </div>
                    </div>
                    <div
                      className="p-4 bg-accent text-accent-foreground rounded-lg cursor-pointer"
                      onMouseEnter={() => setHoveredColor("accent")}
                      onMouseLeave={() => setHoveredColor(null)}
                    >
                      <div className="font-medium">Accent</div>
                      <div className="text-sm opacity-70">{hoveredColor === "accent" ? "#e9ebef" : "Hover states"}</div>
                    </div>
                  </div>
                </div>

                {/* Text Colors */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Text Colors</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-foreground font-medium mb-2">Foreground</div>
                      <div className="text-sm text-muted-foreground">oklch(0.145 0 0) - Primary text</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-muted-foreground font-medium mb-2">Muted Foreground</div>
                      <div className="text-sm text-muted-foreground">#717182 - Secondary text</div>
                    </div>
                  </div>
                </div>

                {/* Sidebar Colors */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Sidebar Colors</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className="p-4 bg-sidebar text-sidebar-foreground rounded-lg border cursor-pointer"
                      onMouseEnter={() => setHoveredColor("sidebar")}
                      onMouseLeave={() => setHoveredColor(null)}
                    >
                      <div className="font-medium">Sidebar Background</div>
                      <div className="text-sm opacity-70">
                        {hoveredColor === "sidebar" ? "oklch(0.985 0 0)" : "Navigation background"}
                      </div>
                    </div>
                    <div
                      className="p-4 bg-sidebar-primary text-sidebar-primary-foreground rounded-lg cursor-pointer"
                      onMouseEnter={() => setHoveredColor("sidebar-primary")}
                      onMouseLeave={() => setHoveredColor(null)}
                    >
                      <div className="font-medium">Sidebar Primary</div>
                      <div className="text-sm opacity-80">
                        {hoveredColor === "sidebar-primary" ? "#030213" : "Active navigation"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* State Colors */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">State Colors</p>
                  <div className="grid grid-cols-1 gap-4">
                    <div
                      className="p-4 bg-destructive text-destructive-foreground rounded-lg cursor-pointer"
                      onMouseEnter={() => setHoveredColor("destructive")}
                      onMouseLeave={() => setHoveredColor(null)}
                    >
                      <div className="font-medium">Destructive</div>
                      <div className="text-sm opacity-80">
                        {hoveredColor === "destructive" ? "#d4183d" : "Error and danger states"}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Spacing Section */}
          <TabsContent value="spacing" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Spacing System</CardTitle>
                <CardDescription>Consistent spacing scale using Tailwind's spacing tokens</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Standard Spacing Scale */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Standard Spacing Scale</p>
                  <div className="space-y-3">
                    {[
                      { size: "0.5", rem: "0.125rem", px: "2px" },
                      { size: "1", rem: "0.25rem", px: "4px" },
                      { size: "2", rem: "0.5rem", px: "8px" },
                      { size: "3", rem: "0.75rem", px: "12px" },
                      { size: "4", rem: "1rem", px: "16px" },
                      { size: "6", rem: "1.5rem", px: "24px" },
                      { size: "8", rem: "2rem", px: "32px" }
                    ].map(({ size, rem, px }) => (
                      <div key={size} className="flex items-center gap-4">
                        <div className={`bg-primary h-4`} style={{ width: rem }}></div>
                        <code className="text-sm font-mono">space-{size}</code>
                        <span className="text-sm text-muted-foreground">
                          {rem} ({px})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Common Layout Patterns */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Common Layout Patterns</p>
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Navigation Item Spacing</h4>
                      <div className="flex items-center p-3 bg-muted/50 rounded-xl">
                        <FileText className="w-6 h-6 mr-3" />
                        <span className="font-medium">Documentation</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Padding: 12px (p-3), Icon margin: 12px (mr-3)
                      </p>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Card Content Spacing</h4>
                      <div className="bg-card border rounded-lg">
                        <div className="p-4 border-b">
                          <h3 className="font-medium">Card Header</h3>
                          <p className="text-sm text-muted-foreground">Header padding: 16px (p-4)</p>
                        </div>
                        <div className="p-4 space-y-4">
                          <p>Card Content</p>
                          <p className="text-sm text-muted-foreground">
                            Content padding: 16px (p-4), Item spacing: 16px (space-y-4)
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Section Spacing</h4>
                      <div className="space-y-6">
                        <div className="bg-muted/50 p-2 rounded">Section 1</div>
                        <div className="bg-muted/50 p-2 rounded">Section 2</div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">Section gap: 24px (space-y-6)</p>
                    </div>
                  </div>
                </div>

                {/* Border Radius */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Border Radius</p>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-primary mx-auto rounded-sm mb-2"></div>
                      <p className="text-sm">Small</p>
                      <p className="text-xs text-muted-foreground">0.375rem</p>
                    </div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-primary mx-auto rounded-md mb-2"></div>
                      <p className="text-sm">Medium</p>
                      <p className="text-xs text-muted-foreground">0.625rem</p>
                    </div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-primary mx-auto rounded-lg mb-2"></div>
                      <p className="text-sm">Large</p>
                      <p className="text-xs text-muted-foreground">0.75rem</p>
                    </div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-primary mx-auto rounded-xl mb-2"></div>
                      <p className="text-sm">XL</p>
                      <p className="text-xs text-muted-foreground">1rem</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Buttons & Inputs Section */}
          <TabsContent value="buttons" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Buttons & Interactive Elements</CardTitle>
                <CardDescription>Button variants, states, and form components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Button Variants */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Button Variants</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <Button className="w-full">Primary Button</Button>
                      <p className="text-sm text-muted-foreground">Default action button</p>
                    </div>
                    <div className="space-y-3">
                      <Button variant="secondary" className="w-full">
                        Secondary Button
                      </Button>
                      <p className="text-sm text-muted-foreground">Alternative actions</p>
                    </div>
                    <div className="space-y-3">
                      <Button variant="outline" className="w-full">
                        Outline Button
                      </Button>
                      <p className="text-sm text-muted-foreground">Less emphasized</p>
                    </div>
                  </div>
                </div>

                {/* Button Sizes */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Button Sizes</p>
                  <div className="flex items-end gap-4">
                    <Button size="sm">Small</Button>
                    <Button size="default">Default</Button>
                    <Button size="lg">Large</Button>
                    <Button size="icon">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground space-y-1">
                    <p>Small: h-8 (32px) · Medium: h-9 (36px) · Large: h-10 (40px) · Icon: 36×36px</p>
                  </div>
                </div>

                {/* Button States */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Button States</p>
                  <div className="grid grid-cols-4 gap-4">
                    <Button>Normal</Button>
                    <Button className="hover:bg-primary/90">Hover</Button>
                    <Button disabled>Disabled</Button>
                    <Button variant="destructive">Destructive</Button>
                  </div>
                </div>

                {/* Ghost Buttons */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Ghost & Link Buttons</p>
                  <div className="flex gap-4">
                    <Button variant="ghost">Ghost Button</Button>
                    <Button variant="link">Link Button</Button>
                  </div>
                </div>

                {/* Form Inputs */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Form Components</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Input Field</label>
                      <Input placeholder="Enter text..." />
                      <p className="text-xs text-muted-foreground">Height: 36px, Border radius: 6px</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Search Input</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Search..." />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Badges & Labels</p>
                  <div className="flex flex-wrap gap-3">
                    <Badge>Default Badge</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Clinical badge examples:</p>
                    <div className="flex gap-2">
                      <Badge className="text-xs px-2 py-0.5">3</Badge>
                      <Badge variant="outline" className="text-xs px-2 py-0.5">
                        2
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Icons Section */}
          <TabsContent value="icons" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Icons & Visual Elements</CardTitle>
                <CardDescription>Lucide React icons with consistent sizing and styling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Icon Sizes */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Icon Sizes</p>
                  <div className="flex items-end gap-8">
                    <div className="text-center">
                      <FileText className="w-3 h-3 mx-auto mb-2" />
                      <p className="text-xs">12px</p>
                      <p className="text-xs text-muted-foreground">w-3 h-3</p>
                    </div>
                    <div className="text-center">
                      <FileText className="w-4 h-4 mx-auto mb-2" />
                      <p className="text-xs">16px</p>
                      <p className="text-xs text-muted-foreground">w-4 h-4</p>
                    </div>
                    <div className="text-center">
                      <FileText className="w-5 h-5 mx-auto mb-2" />
                      <p className="text-xs">20px</p>
                      <p className="text-xs text-muted-foreground">w-5 h-5</p>
                    </div>
                    <div className="text-center">
                      <FileText className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-xs">24px</p>
                      <p className="text-xs text-muted-foreground">w-6 h-6</p>
                    </div>
                  </div>
                </div>

                {/* Clinical Icons */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Clinical Icons</p>
                  <div className="grid grid-cols-6 gap-4">
                    {[
                      { icon: Stethoscope, name: "Stethoscope", usage: "Medical brand" },
                      { icon: FileText, name: "FileText", usage: "Documentation" },
                      { icon: Calendar, name: "Calendar", usage: "Scheduling" },
                      { icon: Clock, name: "Clock", usage: "Time tracking" },
                      { icon: Hash, name: "Hash", usage: "Codes" },
                      { icon: Pill, name: "Pill", usage: "Medications" },
                      { icon: Thermometer, name: "Thermometer", usage: "Vitals" },
                      { icon: User, name: "User", usage: "Patient/Profile" },
                      { icon: Bell, name: "Bell", usage: "Notifications" },
                      { icon: Settings, name: "Settings", usage: "Configuration" },
                      { icon: Plus, name: "Plus", usage: "Add/Create" },
                      { icon: X, name: "X", usage: "Close/Remove" }
                    ].map(({ icon: Icon, name, usage }) => (
                      <div key={name} className="text-center p-3 border rounded-lg">
                        <Icon className="w-6 h-6 mx-auto mb-2" />
                        <p className="text-xs font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{usage}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Icon Context Examples */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Icon Usage Context</p>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Navigation Icons (24px)</h4>
                      <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6" />
                        <span className="font-medium text-sm">Documentation</span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Button Icons (16px)</h4>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Add Code
                      </Button>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Status Icons (12px)</h4>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm">Active</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Icon States */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Icon States & Colors</p>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <FileText className="w-6 h-6 mx-auto mb-2 text-foreground" />
                      <p className="text-xs">Default</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <FileText className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs">Muted</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <FileText className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="text-xs">Primary</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <FileText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Disabled</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* UI Tone Section */}
          <TabsContent value="tone" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>UI Tone & Visual Style</CardTitle>
                <CardDescription>Professional, minimalist design principles for clinical environments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Design Principles */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Design Principles</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">🎯 Clinical Focus</h4>
                        <p className="text-sm text-muted-foreground">
                          Clean, distraction-free interface prioritizing clinical workflow efficiency
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">📊 Information Dense</h4>
                        <p className="text-sm text-muted-foreground">
                          Optimized for displaying complex medical data and coding information
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">🔒 Professional Trust</h4>
                        <p className="text-sm text-muted-foreground">
                          Conservative color palette and typography conveying reliability and professionalism
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">⚡ Performance First</h4>
                        <p className="text-sm text-muted-foreground">
                          Lightweight animations and transitions that enhance without hindering workflow
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visual Style Decisions */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Visual Style Decisions</p>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Minimalist Approach</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">✅ Uses</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Subtle borders and shadows</li>
                            <li>• Generous whitespace</li>
                            <li>• Limited color palette</li>
                            <li>• Consistent typography scale</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">❌ Avoids</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Heavy shadows or gradients</li>
                            <li>• Bright, saturated colors</li>
                            <li>• Complex decorative elements</li>
                            <li>• Aggressive animations</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Flat Design with Subtle Depth</h4>
                      <div className="flex gap-4">
                        <div className="p-4 bg-background border rounded-lg">
                          <div className="w-8 h-8 bg-primary rounded-lg mb-2"></div>
                          <p className="text-sm">Flat elements</p>
                        </div>
                        <div className="p-4 bg-background border rounded-lg shadow-sm">
                          <div className="w-8 h-8 bg-primary rounded-lg mb-2 shadow-sm"></div>
                          <p className="text-sm">Subtle shadows</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Motion Design</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-2 bg-muted/50 rounded transition-all duration-200 hover:bg-muted">
                          <FileText className="w-4 h-4" />
                          <span className="text-sm">Subtle hover transitions (200ms)</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Micro-interactions enhance usability without distraction
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Accessibility Considerations */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">
                    Accessibility & Standards
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Color Contrast</h4>
                      <div className="flex items-center gap-4">
                        <div className="px-3 py-2 bg-primary text-primary-foreground rounded">
                          <span className="text-sm font-medium">AA Compliant</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          High contrast ratios ensure readability in clinical environments
                        </p>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Focus States</h4>
                      <Button className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        Keyboard Accessible
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        Clear focus indicators for keyboard navigation
                      </p>
                    </div>
                  </div>
                </div>

                {/* Layout Philosophy */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Layout Philosophy</p>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3">Information Hierarchy</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-sidebar rounded-lg border-l-4 border-l-primary">
                        <p className="font-medium text-sm">Primary Actions</p>
                        <p className="text-xs text-muted-foreground">Documentation, coding, patient data</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg border-l-4 border-l-muted-foreground">
                        <p className="font-medium text-sm">Secondary Tools</p>
                        <p className="text-xs text-muted-foreground">Templates, settings, support</p>
                      </div>
                      <div className="p-3 bg-background border rounded-lg border-l-4 border-l-border">
                        <p className="font-medium text-sm">Supporting Information</p>
                        <p className="text-xs text-muted-foreground">Metadata, timestamps, system info</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
