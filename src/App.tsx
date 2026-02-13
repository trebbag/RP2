import { useEffect, useState } from "react"
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar"
import { TooltipProvider } from "./components/ui/tooltip"
import { NavigationSidebar } from "./components/NavigationSidebar"
import { Dashboard } from "./components/Dashboard"
import { Analytics } from "./components/Analytics"
import { Settings } from "./components/Settings"
import { ActivityLog } from "./components/ActivityLog"
import { Drafts } from "./components/Drafts"
import { Schedule } from "./components/Schedule"
import { Builder } from "./components/Builder"
import { NoteEditor } from "./components/NoteEditor"
import { SuggestionPanel } from "./components/SuggestionPanel"
import { SelectedCodesBar } from "./components/SelectedCodesBar"
import { StyleGuide } from "./components/StyleGuide"
import { FigmaComponentLibrary } from "./components/FigmaComponentLibrary"
import { FinalizationWizardDemo } from "./components/FinalizationWizardDemo"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./components/ui/resizable"
import { Button } from "./components/ui/button"
import { Badge } from "./components/ui/badge"
import { LoginScreen } from "./components/LoginScreen"
import {
  buildExportUrl,
  fetchAppointments,
  fetchCurrentUser,
  fetchDraft,
  fetchDrafts,
  startEncounter,
  uploadChartFiles,
  type AuthUserRecord,
  type DraftRecord
} from "./lib/api"

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'app' | 'analytics' | 'settings' | 'activity' | 'drafts' | 'schedule' | 'builder' | 'style-guide' | 'figma-library' | 'finalization-demo'>('home')
  const [isSuggestionPanelOpen, setIsSuggestionPanelOpen] = useState(true)
  const [authUser, setAuthUser] = useState<AuthUserRecord | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const userRole: 'admin' | 'user' = authUser?.role === "ADMIN" ? "admin" : "user"

  const currentUser = {
    id: authUser?.id ?? "user-001",
    name: authUser?.name ?? "Dr. Johnson",
    fullName: authUser?.name ?? "Dr. Sarah Johnson",
    role: userRole,
    specialty: "Family Medicine"
  }

  // State for pre-populating patient information when starting a visit
  const [prePopulatedPatient, setPrePopulatedPatient] = useState<{
    patientId: string
    encounterId: string
  } | null>(null)
  const [activeDraftContent, setActiveDraftContent] = useState("")
  const [activeEncounterIdForSuggestions, setActiveEncounterIdForSuggestions] = useState("")
  const [activeNoteForSuggestions, setActiveNoteForSuggestions] = useState("")
  const pilotMode = ((import.meta.env.VITE_PILOT_MODE as string | undefined) ?? "true") !== "false"
  const [backendDrafts, setBackendDrafts] = useState<DraftRecord[]>([])
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  const [isBackendLoading, setIsBackendLoading] = useState(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [appMessage, setAppMessage] = useState<string | null>(null)

  // Shared appointment state between Builder and Schedule components
  const [sharedAppointments, setSharedAppointments] = useState<any[]>([])

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const me = await fetchCurrentUser()
        setAuthUser(me.user)
      } catch {
        setAuthUser(null)
      } finally {
        setAuthReady(true)
      }
    }

    void bootstrapAuth()
  }, [])

  const loadServerState = async () => {
    if (!authUser) return
    setIsBackendLoading(true)
    setAppMessage(null)
    try {
      const [appointments, drafts] = await Promise.all([fetchAppointments(), fetchDrafts()])
      setSharedAppointments(
        appointments.map((appointment) => ({
          id: appointment.id,
          patientId: appointment.patientId,
          encounterId: appointment.encounterId ?? "",
          patientName: appointment.patientName,
          patientPhone: appointment.patientPhone,
          patientEmail: appointment.patientEmail,
          appointmentTime: appointment.appointmentTime,
          duration: appointment.duration,
          appointmentType: appointment.appointmentType as any,
          provider: appointment.provider,
          location: appointment.location,
          status: appointment.status as any,
          notes: appointment.notes,
          fileUpToDate: appointment.fileUpToDate,
          priority: appointment.priority,
          isVirtual: appointment.isVirtual
        }))
      )
      setBackendDrafts(drafts)
      setIsBackendConnected(true)
      setBackendError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backend is unavailable"
      console.warn("Backend unavailable", error)
      setIsBackendConnected(false)
      setBackendError(message)
      if (pilotMode) {
        setSharedAppointments([])
        setBackendDrafts([])
      }
    } finally {
      setIsBackendLoading(false)
    }
  }

  useEffect(() => {
    if (!authReady || !authUser) return
    void loadServerState()
  }, [authReady, authUser?.id])

  const [selectedCodes, setSelectedCodes] = useState({
    codes: 0,
    prevention: 0,
    diagnoses: 0,
    differentials: 0
  })
  const [addedCodes, setAddedCodes] = useState<string[]>([])
  const [selectedCodesList, setSelectedCodesList] = useState<any[]>([])

  const handleAddCode = (code: any) => {
    // Add to the addedCodes array for filtering suggestions
    setAddedCodes(prev => [...prev, code.code])
    
    // Use the category from the code if it exists, otherwise determine based on type
    let category = code.category || "codes"
    let updatedCodes = { ...selectedCodes }
    
    if (code.category) {
      // Code already has a category (from differentials)
      updatedCodes[code.category] = selectedCodes[code.category] + 1
    } else if (code.type === "CPT") {
      // CPT codes go to "codes" category
      category = "codes"
      updatedCodes.codes = selectedCodes.codes + 1
    } else if (code.type === "ICD-10") {
      // ICD-10 codes go to "diagnoses" category
      category = "diagnoses" 
      updatedCodes.diagnoses = selectedCodes.diagnoses + 1
    } else if (code.type === "PREVENTION") {
      // Prevention items go to "prevention" category
      category = "prevention"
      updatedCodes.prevention = selectedCodes.prevention + 1
    }
    
    // Update the selected codes count
    setSelectedCodes(updatedCodes)
    
    // Add to the selectedCodesList for displaying tiles
    const newCodeItem = {
      code: code.code,
      type: code.type,
      category: category,
      description: code.description,
      rationale: code.rationale,
      confidence: code.confidence,
      reimbursement: code.reimbursement || "N/A",
      rvu: code.rvu
    }
    
    setSelectedCodesList(prev => [...prev, newCodeItem])
  }

  const handleRemoveCode = (code: any, action: 'clear' | 'return', reasoning?: string) => {
    // Remove from selectedCodesList
    setSelectedCodesList(prev => prev.filter(item => item.code !== code.code))
    
    // Update counts when removing codes
    const updatedCodes = { ...selectedCodes }
    if (code.category && updatedCodes[code.category] > 0) {
      updatedCodes[code.category] = updatedCodes[code.category] - 1
    }
    setSelectedCodes(updatedCodes)
    
    if (action === 'return') {
      // Remove from addedCodes so it shows up in suggestions again
      setAddedCodes(prev => prev.filter(addedCode => addedCode !== code.code))
    }
    
    // Log the reasoning for AI learning (in a real app, this would be sent to a service)
    if (reasoning) {
      console.log(`Code ${code.code} removed with reasoning: ${reasoning}`)
    }
  }

  const handleChangeCategoryCode = (code: any, newCategory: 'diagnoses' | 'differentials') => {
    // Update the code's category in selectedCodesList
    setSelectedCodesList(prev => 
      prev.map(item => 
        item.code === code.code 
          ? { ...item, category: newCategory }
          : item
      )
    )
    
    // Update counts
    const updatedCodes = { ...selectedCodes }
    
    // Decrease count from old category
    if (code.category && updatedCodes[code.category] > 0) {
      updatedCodes[code.category] = updatedCodes[code.category] - 1
    }
    
    // Increase count for new category
    updatedCodes[newCategory] = updatedCodes[newCategory] + 1
    
    setSelectedCodes(updatedCodes)
  }

  const handleNavigate = (view: string) => {
    switch(view) {
      case 'home':
        setCurrentView('home')
        break
      case 'app':
        setCurrentView('app')
        break
      case 'analytics':
        setCurrentView('analytics')
        break
      case 'settings':
        setCurrentView('settings')
        break
      case 'activity':
        setCurrentView('activity')
        break
      case 'drafts':
        setCurrentView('drafts')
        break
      case 'schedule':
        setCurrentView('schedule')
        break
      case 'builder':
        setCurrentView('builder')
        break
      case 'style-guide':
        setCurrentView('style-guide')
        break
      case 'figma-library':
        setCurrentView('figma-library')
        break
      case 'finalization-demo':
        setCurrentView('finalization-demo')
        break
      default:
        console.log(`Navigate to ${view}`)
    }
  }

  const handleEditDraft = async (draftId: string) => {
    if (draftId === "new") {
      if (pilotMode && !isBackendConnected) {
        setAppMessage("Backend connection is required to create a new draft in pilot mode.")
        return
      }
      setPrePopulatedPatient(null)
      setActiveDraftContent("")
      setActiveEncounterIdForSuggestions("")
      setActiveNoteForSuggestions("")
      setCurrentView("app")
      return
    }

    try {
      if (!isBackendConnected) {
        if (pilotMode) {
          setAppMessage("Backend connection is required to open drafts in pilot mode.")
        }
        return
      }
      const result = await fetchDraft(draftId)
      setPrePopulatedPatient({
        patientId: result.draft.patientId,
        encounterId: result.draft.encounterId
      })
      setActiveDraftContent(result.draft.content)
      setActiveEncounterIdForSuggestions(result.draft.encounterId)
      setActiveNoteForSuggestions(result.draft.content)
    } catch (error) {
      console.warn("Unable to load draft from backend", error)
      setAppMessage(error instanceof Error ? error.message : "Failed to load draft.")
      return
    }

    setCurrentView("app")
  }

  const handleStartVisit = async (patientId: string, encounterId: string) => {
    console.log(`Starting visit for patient ${patientId}, encounter ${encounterId}`)
    if (pilotMode && !isBackendConnected) {
      setAppMessage("Backend connection is required to start encounters in pilot mode.")
      return
    }
    try {
      if (isBackendConnected && encounterId) {
        await startEncounter(encounterId)
      }
    } catch (error) {
      console.warn("Failed to start encounter on backend", error)
      setAppMessage(error instanceof Error ? error.message : "Failed to start encounter.")
      return
    }

    setAppMessage(null)
    setPrePopulatedPatient({ patientId, encounterId })
    setActiveDraftContent("")
    setActiveEncounterIdForSuggestions(encounterId)
    setActiveNoteForSuggestions("")
    setCurrentView('app')
  }

  const handleUploadChart = async (patientId: string) => {
    const matchingAppointment = sharedAppointments.find((appointment) => appointment.patientId === patientId)

    if (!matchingAppointment) {
      setAppMessage(`No appointment found for patient ${patientId}.`)
      return
    }

    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.accept = ".pdf,.txt,.doc,.docx,.json,.jpg,.jpeg,.png"

    input.onchange = async () => {
      const files = Array.from(input.files ?? [])
      if (files.length === 0) return

      if (!isBackendConnected) {
        setAppMessage("Backend is not connected. Start the API server to upload charts.")
        return
      }

      try {
        await uploadChartFiles(matchingAppointment.id, files)
        setAppMessage(`Uploaded ${files.length} chart file(s) for ${matchingAppointment.patientName}.`)
      } catch (error) {
        console.error(error)
        setAppMessage("Chart upload failed. Check API logs and try again.")
      }
    }

    input.click()
  }

  // Calculate user's draft count for navigation badge
  const getUserDraftCount = () => {
    return backendDrafts.filter((draft) => draft.provider === currentUser.name && !draft.isFinal).length
  }

  const handleDownloadArtifact = (artifactId: string) => {
    window.open(buildExportUrl(artifactId), "_blank", "noopener,noreferrer")
  }

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Checking session...</div>
  }

  if (!authUser) {
    return (
      <LoginScreen
        onAuthenticated={(user) => {
          setAuthUser(user)
          setAuthReady(true)
          setCurrentView("home")
        }}
      />
    )
  }

  const backendStatusBanner =
    (pilotMode && !isBackendConnected) || backendError || appMessage ? (
      <div className="m-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="space-y-1">
            {pilotMode && !isBackendConnected && (
              <p className="font-medium">Pilot mode requires a live backend connection.</p>
            )}
            {backendError && <p>Backend error: {backendError}</p>}
            {appMessage && <p>{appMessage}</p>}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isBackendLoading}
            onClick={() => {
              void loadServerState()
            }}
          >
            {isBackendLoading ? "Connecting..." : "Retry Backend Sync"}
          </Button>
        </div>
      </div>
    ) : null

  // Home Dashboard View
  if (currentView === 'home') {
    return (
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-full bg-background">
            <NavigationSidebar 
              currentView="home" 
              onNavigate={handleNavigate}
              currentUser={currentUser}
              userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
            />
            
            <main className="flex-1 flex flex-col min-w-0">
              <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-lg font-medium">RevenuePilot Dashboard</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('style-guide')}>
                    View Style Guide
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('figma-library')}>
                    Figma Library
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {backendStatusBanner}
                <Dashboard onNavigate={handleNavigate} />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  // Analytics View
  if (currentView === 'analytics') {
    return (
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-full bg-background">
            <NavigationSidebar 
              currentView="analytics" 
              onNavigate={handleNavigate}
              currentUser={currentUser}
              userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
            />
            
            <main className="flex-1 flex flex-col min-w-0">
              <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-lg font-medium">Analytics Dashboard</h1>
                  <Badge variant="outline" className="ml-2">
                    {userRole === 'admin' ? 'Admin Access' : 'User Access'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('home')}>
                    Dashboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('app')}>
                    Documentation
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {backendStatusBanner}
                <Analytics userRole={userRole} />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  // Activity Log View
  if (currentView === 'activity') {
    return (
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-full bg-background">
            <NavigationSidebar 
              currentView="activity" 
              onNavigate={handleNavigate}
              currentUser={currentUser}
              userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
            />
            
            <main className="flex-1 flex flex-col min-w-0">
              <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-lg font-medium">Activity Log</h1>
                  <Badge variant="outline" className="ml-2">
                    {userRole === 'admin' ? 'Administrator' : 'User'} Access
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('home')}>
                    Dashboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('analytics')}>
                    Analytics
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('settings')}>
                    Settings
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {backendStatusBanner}
                <ActivityLog 
                  currentUser={currentUser}
                  userRole={userRole}
                />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  // Settings View
  if (currentView === 'settings') {
    return (
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-full bg-background">
            <NavigationSidebar 
              currentView="settings" 
              onNavigate={handleNavigate}
              currentUser={currentUser}
              userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
            />
            
            <main className="flex-1 flex flex-col min-w-0">
              <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-lg font-medium">Settings & Configuration</h1>
                  <Badge variant="outline" className="ml-2">
                    {userRole === 'admin' ? 'Administrator' : 'User'} Access
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('home')}>
                    Dashboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('app')}>
                    Documentation
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {backendStatusBanner}
                <Settings userRole={userRole} />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  // Drafts View
  if (currentView === 'drafts') {
    return (
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-full bg-background">
            <NavigationSidebar 
              currentView="drafts" 
              onNavigate={handleNavigate}
              currentUser={currentUser}
              userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
            />
            
            <main className="flex-1 flex flex-col min-w-0">
              <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-lg font-medium">Draft Notes Management</h1>
                  <Badge variant="outline" className="ml-2">
                    {getUserDraftCount()} My Drafts
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('home')}>
                    Dashboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('app')}>
                    New Note
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {backendStatusBanner}
                <Drafts 
                  onEditDraft={handleEditDraft} 
                  currentUser={currentUser}
                  drafts={backendDrafts}
                  onDownloadArtifact={handleDownloadArtifact}
                />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  // Schedule View
  if (currentView === 'schedule') {
    return (
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-full bg-background">
            <NavigationSidebar 
              currentView="schedule" 
              onNavigate={handleNavigate}
              currentUser={currentUser}
              userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
            />
            
            <main className="flex-1 flex flex-col min-w-0">
              <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-lg font-medium">Patient Schedule</h1>
                  <Badge variant="outline" className="ml-2">
                    Today's Appointments
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('home')}>
                    Dashboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('app')}>
                    Documentation
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('drafts')}>
                    Drafts
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('activity')}>
                    Activity Log
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {backendStatusBanner}
                <Schedule 
                  currentUser={currentUser}
                  onStartVisit={handleStartVisit}
                  onUploadChart={handleUploadChart}
                  appointments={sharedAppointments}
                />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  // Builder View
  if (currentView === 'builder') {
    return (
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-full bg-background">
            <NavigationSidebar 
              currentView="builder" 
              onNavigate={handleNavigate}
              currentUser={currentUser}
              userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
            />
            
            <main className="flex-1 flex flex-col min-w-0">
              <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-lg font-medium">Schedule Builder</h1>
                  <Badge variant="outline" className="ml-2">
                    Template Creator
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('home')}>
                    Dashboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('schedule')}>
                    Schedule
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('app')}>
                    Documentation
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {backendStatusBanner}
                <Builder 
                  currentUser={currentUser}
                  appointments={sharedAppointments}
                  onAppointmentsChange={(appointments) => {
                    if (pilotMode) {
                      setAppMessage("Schedule edits in pilot mode are managed by backend APIs and cannot be changed locally.")
                      return
                    }
                    setSharedAppointments(appointments as any[])
                  }}
                />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  // Style Guide View
  if (currentView === 'style-guide') {
    return (
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-full bg-background">
            <NavigationSidebar 
              currentView="style-guide" 
              onNavigate={handleNavigate}
              currentUser={currentUser}
              userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
            />
            
            <main className="flex-1 flex flex-col min-w-0">
              <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-lg font-medium">RevenuePilot Design System</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('home')}>
                    Back to Dashboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('figma-library')}>
                    Figma Library
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {backendStatusBanner}
                <StyleGuide />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  // Figma Library View
  if (currentView === 'figma-library') {
    return (
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-full bg-background">
            <NavigationSidebar 
              currentView="figma-library" 
              onNavigate={handleNavigate}
              currentUser={currentUser}
              userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
            />
            
            <main className="flex-1 flex flex-col min-w-0">
              <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-lg font-medium">Figma Component Library</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('home')}>
                    Back to Dashboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('style-guide')}>
                    Style Guide
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {backendStatusBanner}
                <FigmaComponentLibrary />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  // Finalization Demo View
  if (currentView === 'finalization-demo') {
    return (
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-full bg-background">
            <NavigationSidebar 
              currentView="finalization-demo" 
              onNavigate={handleNavigate}
              currentUser={currentUser}
              userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
            />
            
            <main className="flex-1 flex flex-col min-w-0">
              <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-lg font-medium">Finalization Wizard Demo</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('home')}>
                    Back to Dashboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentView('app')}>
                    Documentation
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {backendStatusBanner}
                <FinalizationWizardDemo />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  // Main App View (Documentation Editor)
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <div className="flex h-screen w-full bg-background">
          <NavigationSidebar 
            currentView="app" 
            onNavigate={handleNavigate}
            currentUser={currentUser}
            userDraftCount={getUserDraftCount()}
              pilotMode={pilotMode}
          />
          
          <main className="flex-1 flex flex-col min-w-0">
            <div className="border-b bg-background p-4 flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <h1 className="text-lg font-medium">Clinical Documentation Assistant</h1>
                <Badge variant="outline" className="ml-2">
                  Active Session
                </Badge>
                {prePopulatedPatient && (
                  <Badge variant="secondary" className="ml-2">
                    Patient: {prePopulatedPatient.patientId}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentView('home')}>
                  Dashboard
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentView('analytics')}>
                  Analytics
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentView('settings')}>
                  Settings
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentView('drafts')}>
                  Drafts
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentView('schedule')}>
                  Schedule
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentView('activity')}>
                  Activity Log
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentView('style-guide')}>
                  Style Guide
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentView('figma-library')}>
                  Figma Library
                </Button>
              </div>
            </div>
            
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              <ResizablePanel defaultSize={70} minSize={50}>
                <div className="flex flex-col h-full">
                  {backendStatusBanner}
                  <NoteEditor 
                    prePopulatedPatient={prePopulatedPatient}
                    selectedCodes={selectedCodes}
                    selectedCodesList={selectedCodesList}
                    initialNoteContent={activeDraftContent}
                    onEncounterIdChange={setActiveEncounterIdForSuggestions}
                    onNoteContentChange={setActiveNoteForSuggestions}
                  />
                  <SelectedCodesBar 
                    selectedCodes={selectedCodes}
                    onUpdateCodes={setSelectedCodes}
                    selectedCodesList={selectedCodesList}
                    onRemoveCode={handleRemoveCode}
                    onChangeCategoryCode={handleChangeCategoryCode}
                  />
                </div>
              </ResizablePanel>
              
              {isSuggestionPanelOpen && (
                <>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
                    <SuggestionPanel 
                      onClose={() => setIsSuggestionPanelOpen(false)} 
                      encounterId={activeEncounterIdForSuggestions || prePopulatedPatient?.encounterId}
                      noteContent={activeNoteForSuggestions}
                      backendConnected={isBackendConnected}
                      pilotMode={pilotMode}
                      selectedCodes={selectedCodes}
                      onUpdateCodes={setSelectedCodes}
                      onAddCode={handleAddCode}
                      addedCodes={addedCodes}
                    />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
            
            {!isSuggestionPanelOpen && (
              <button
                onClick={() => setIsSuggestionPanelOpen(true)}
                className="fixed right-4 top-4 p-2 bg-primary text-primary-foreground rounded-md shadow-md"
              >
                Show Suggestions
              </button>
            )}
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
