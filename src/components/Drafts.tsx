import { useState, useMemo, useEffect } from "react"
import { motion } from "motion/react"
import {
  FilePlus,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Eye,
  Edit,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle,
  FileText,
  MoreHorizontal
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { Avatar, AvatarFallback } from "./ui/avatar"

interface CurrentUser {
  id: string
  name: string
  fullName: string
  role: "admin" | "user"
  specialty: string
}

interface DraftNote {
  id: string
  patientId: string
  encounterId: string
  patientName: string
  visitDate: string
  lastEditDate: string
  daysOld: number
  provider: string
  visitType: "SOAP" | "Wellness" | "Follow-up" | "Consultation"
  completionStatus: number
  urgency: "low" | "medium" | "high"
  noteLength: number
  lastEditor: string
  status?: "DRAFT_HIDDEN" | "DRAFT_ACTIVE" | "FINAL"
  isFinal?: boolean
  notePdfArtifactId?: string | null
  summaryPdfArtifactId?: string | null
}

interface DraftsProps {
  onEditDraft?: (draftId: string) => void
  currentUser?: CurrentUser
  drafts?: DraftNote[]
  onDownloadArtifact?: (artifactId: string) => void
}

export function Drafts({ onEditDraft, currentUser, drafts: propDrafts, onDownloadArtifact }: DraftsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [selectedVisitType, setSelectedVisitType] = useState("all")
  const [selectedUrgency, setSelectedUrgency] = useState("all")
  const [sortBy, setSortBy] = useState<"visitDate" | "lastEdit" | "daysOld" | "urgency">("daysOld")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [ageFilter, setAgeFilter] = useState("all")

  const drafts = propDrafts ?? []

  // Set default provider filter to current user if they match
  useEffect(() => {
    if (currentUser?.name && uniqueProviders.includes(currentUser.name)) {
      setSelectedProvider(currentUser.name)
    }
  }, [currentUser])

  // Filtered and sorted drafts
  const filteredDrafts = useMemo(() => {
    let filtered = drafts.filter((draft) => {
      const matchesSearch =
        draft.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        draft.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        draft.encounterId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        draft.provider.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesProvider = selectedProvider === "all" || draft.provider === selectedProvider
      const matchesVisitType = selectedVisitType === "all" || draft.visitType === selectedVisitType
      const matchesUrgency = selectedUrgency === "all" || draft.urgency === selectedUrgency

      let matchesAge = true
      if (ageFilter === "1-3") matchesAge = draft.daysOld >= 1 && draft.daysOld <= 3
      else if (ageFilter === "4-7") matchesAge = draft.daysOld >= 4 && draft.daysOld <= 7
      else if (ageFilter === "8-14") matchesAge = draft.daysOld >= 8 && draft.daysOld <= 14
      else if (ageFilter === "15+") matchesAge = draft.daysOld >= 15

      return matchesSearch && matchesProvider && matchesVisitType && matchesUrgency && matchesAge
    })

    // Sort filtered results
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case "visitDate":
          comparison = new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
          break
        case "lastEdit":
          comparison = new Date(a.lastEditDate).getTime() - new Date(b.lastEditDate).getTime()
          break
        case "daysOld":
          comparison = a.daysOld - b.daysOld
          break
        case "urgency":
          const urgencyOrder = { high: 3, medium: 2, low: 1 }
          comparison = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
          break
      }

      return sortOrder === "asc" ? comparison : -comparison
    })

    return filtered
  }, [drafts, searchTerm, selectedProvider, selectedVisitType, selectedUrgency, ageFilter, sortBy, sortOrder])

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "destructive"
      case "medium":
        return "secondary"
      case "low":
        return "outline"
      default:
        return "outline"
    }
  }

  const getVisitTypeColor = (visitType: string) => {
    switch (visitType) {
      case "SOAP":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "Wellness":
        return "bg-green-50 text-green-700 border-green-200"
      case "Follow-up":
        return "bg-orange-50 text-orange-700 border-orange-200"
      case "Consultation":
        return "bg-purple-50 text-purple-700 border-purple-200"
      default:
        return "bg-slate-50 text-slate-700 border-slate-200"
    }
  }

  const getDaysOldColor = (days: number) => {
    if (days <= 3) return "text-green-600"
    if (days <= 7) return "text-yellow-600"
    if (days <= 14) return "text-orange-600"
    return "text-red-600"
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    })
  }

  const getProviderInitials = (provider: string) => {
    return provider
      .split(" ")
      .map((name) => name[0])
      .join("")
      .toUpperCase()
  }

  const uniqueProviders = Array.from(new Set(drafts.map((draft) => draft.provider)))

  const handleCardClick = (draftId: string) => {
    onEditDraft?.(draftId)
  }

  const handleButtonClick = (event: React.MouseEvent, draftId: string) => {
    event.stopPropagation() // Prevent triggering the card click
    onEditDraft?.(draftId)
  }

  const handleDropdownClick = (event: React.MouseEvent) => {
    event.stopPropagation() // Prevent triggering the card click
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Draft Notes</h1>
          <p className="text-muted-foreground mt-1">
            Manage and continue working on unfinished clinical documentation
            {currentUser && ` • Showing drafts for ${currentUser.name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            {filteredDrafts.length} of {drafts.length} drafts
          </Badge>
          <Button size="sm" onClick={() => onEditDraft?.("new")}>
            <FilePlus className="w-4 h-4 mr-2" />
            New Draft
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search by patient name, ID, encounter, or provider..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
              {sortOrder === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </Button>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {uniqueProviders.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                      {currentUser?.name === provider && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          You
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Visit Type</label>
              <Select value={selectedVisitType} onValueChange={setSelectedVisitType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="SOAP">SOAP Note</SelectItem>
                  <SelectItem value="Wellness">Wellness Visit</SelectItem>
                  <SelectItem value="Follow-up">Follow-up</SelectItem>
                  <SelectItem value="Consultation">Consultation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Urgency</label>
              <Select value={selectedUrgency} onValueChange={setSelectedUrgency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="low">Low Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Age Filter</label>
              <Select value={ageFilter} onValueChange={setAgeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ages</SelectItem>
                  <SelectItem value="1-3">1-3 days old</SelectItem>
                  <SelectItem value="4-7">4-7 days old</SelectItem>
                  <SelectItem value="8-14">8-14 days old</SelectItem>
                  <SelectItem value="15+">15+ days old</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sort By</label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daysOld">Days Old</SelectItem>
                  <SelectItem value="lastEdit">Last Edited</SelectItem>
                  <SelectItem value="visitDate">Visit Date</SelectItem>
                  <SelectItem value="urgency">Urgency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Draft Notes List */}
      <div className="space-y-4">
        {filteredDrafts.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No drafts found</h3>
              <p className="text-muted-foreground">
                {searchTerm ||
                selectedProvider !== "all" ||
                selectedVisitType !== "all" ||
                selectedUrgency !== "all" ||
                ageFilter !== "all"
                  ? "Try adjusting your filters or search criteria"
                  : "All caught up! No draft notes pending completion."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDrafts.map((draft, index) => (
            <motion.div
              key={draft.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="hover:shadow-lg transition-all duration-300 cursor-pointer bg-white border-2 border-stone-100/50 hover:border-stone-200/70 shadow-md hover:bg-stone-50/30"
                onClick={() => handleCardClick(draft.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    {/* Left Section: Patient & Visit Info */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="w-12 h-12 ring-2 ring-white shadow-sm">
                          <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-medium">
                            {draft.patientName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        {draft.urgency === "high" && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-foreground text-lg">{draft.patientName}</h3>
                          <Badge className={`text-xs font-medium ${getVisitTypeColor(draft.visitType)}`}>
                            {draft.visitType}
                          </Badge>
                          {draft.isFinal && (
                            <Badge className="text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Final
                            </Badge>
                          )}
                          <Badge variant={getUrgencyColor(draft.urgency)} className="text-xs font-medium">
                            {draft.urgency} priority
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="font-medium">Patient ID: {draft.patientId}</span>
                          <span>•</span>
                          <span className="font-medium">Encounter: {draft.encounterId}</span>
                          <span>•</span>
                          <span className="font-medium">Provider: {draft.provider}</span>
                          {currentUser?.name === draft.provider && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Center Section: Dates & Progress */}
                    <div className="flex items-center gap-8">
                      <div className="text-center p-3 bg-stone-50/80 rounded-lg border border-stone-200/50">
                        <div className="text-sm font-semibold text-foreground mb-1">Visit Date</div>
                        <div className="text-sm text-muted-foreground">{formatDate(draft.visitDate)}</div>
                      </div>

                      <div className="text-center p-3 bg-stone-50/80 rounded-lg border border-stone-200/50">
                        <div className="text-sm font-semibold text-foreground mb-1">Last Edit</div>
                        <div className="text-sm text-muted-foreground">{formatDate(draft.lastEditDate)}</div>
                        <div className="text-xs text-muted-foreground">{formatTime(draft.lastEditDate)}</div>
                      </div>

                      <div className="text-center p-3 bg-stone-50/80 rounded-lg border border-stone-200/50">
                        <div className="text-sm font-semibold text-foreground mb-2">Completion</div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-3 bg-stone-200 rounded-full overflow-hidden shadow-inner">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 shadow-sm"
                              style={{ width: `${draft.completionStatus}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-foreground">{draft.completionStatus}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Section: Age & Actions */}
                    <div className="flex items-center gap-6">
                      <div className="text-center p-4 bg-gradient-to-br from-stone-50 to-stone-100 rounded-xl border border-stone-200/50 shadow-sm">
                        <div className={`text-3xl font-bold ${getDaysOldColor(draft.daysOld)} mb-1`}>
                          {draft.daysOld}
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">
                          day{draft.daysOld !== 1 ? "s" : ""} old
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          variant={draft.isFinal ? "outline" : "default"}
                          size="sm"
                          onClick={(e) => handleButtonClick(e, draft.id)}
                          className="shadow-sm hover:shadow-md transition-shadow"
                        >
                          {draft.isFinal ? <Eye className="w-4 h-4 mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
                          {draft.isFinal ? "Preview" : "Continue"}
                        </Button>
                        {draft.isFinal && draft.notePdfArtifactId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              onDownloadArtifact?.(draft.notePdfArtifactId!)
                            }}
                            className="shadow-sm"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Note PDF
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="shadow-sm" onClick={handleDropdownClick}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleButtonClick(e, draft.id)}>
                              <Edit className="w-4 h-4 mr-2" />
                              {draft.isFinal ? "Open" : "Edit"}
                            </DropdownMenuItem>
                            {draft.notePdfArtifactId && (
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onDownloadArtifact?.(draft.notePdfArtifactId!)
                                }}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download Note PDF
                              </DropdownMenuItem>
                            )}
                            {draft.summaryPdfArtifactId && (
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onDownloadArtifact?.(draft.summaryPdfArtifactId!)
                                }}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download Summary PDF
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info Row */}
                  <div className="mt-6 pt-4 border-t border-stone-200/50 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {draft.noteLength} words
                      </span>
                      <span>•</span>
                      <span>Last edited by {draft.lastEditor}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {draft.completionStatus < 50 && (
                        <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-200/50">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-xs font-medium">Needs attention</span>
                        </div>
                      )}
                      {draft.completionStatus >= 90 && (
                        <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-200/50">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Nearly complete</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {filteredDrafts.length > 0 && (
        <Card className="shadow-sm bg-gradient-to-r from-stone-50 to-stone-100 border-stone-200/50">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
              <div className="p-4 bg-white rounded-lg shadow-sm border border-stone-200/50">
                <div className="text-3xl font-bold text-foreground mb-1">{filteredDrafts.length}</div>
                <div className="text-sm text-muted-foreground font-medium">Total Drafts</div>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-stone-200/50">
                <div className="text-3xl font-bold text-red-600 mb-1">
                  {filteredDrafts.filter((d) => d.urgency === "high").length}
                </div>
                <div className="text-sm text-muted-foreground font-medium">High Priority</div>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-stone-200/50">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {Math.round(filteredDrafts.reduce((acc, d) => acc + d.completionStatus, 0) / filteredDrafts.length)}%
                </div>
                <div className="text-sm text-muted-foreground font-medium">Avg Completion</div>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-stone-200/50">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {filteredDrafts.filter((d) => d.daysOld > 7).length}
                </div>
                <div className="text-sm text-muted-foreground font-medium">Over 7 Days Old</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
