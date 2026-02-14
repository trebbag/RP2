import { useMemo, useState } from "react"
import { motion } from "motion/react"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  User,
  Clock,
  MapPin,
  Phone,
  Mail,
  FileText,
  Upload,
  Search,
  Grid3x3,
  List,
  Edit3,
  Trash2,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Copy,
  Settings
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Separator } from "./ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Switch } from "./ui/switch"
import { Alert, AlertDescription } from "./ui/alert"

interface CurrentUser {
  id: string
  name: string
  fullName: string
  role: "admin" | "user"
  specialty: string
}

interface AppointmentTemplate {
  id: string
  patientId: string
  encounterId: string
  patientName: string
  patientPhone: string
  patientEmail: string
  appointmentTime: string
  duration: number
  appointmentType: "Wellness" | "Follow-up" | "New Patient" | "Urgent" | "Consultation"
  provider: string
  location: string
  status: "Scheduled" | "Checked In" | "In Progress" | "Completed" | "No Show" | "Cancelled"
  notes?: string
  priority: "low" | "medium" | "high"
  isVirtual: boolean
  fileUpToDate: boolean
  // Extended fields for builder
  patientDOB?: string
  patientAddress?: string
  hasChart?: boolean
  chartFiles?: string[]
  medicalHistory?: string
  currentMedications?: string
  allergies?: string
  chiefComplaint?: string
  insuranceInfo?: string
  referralNotes?: string
}

interface BuilderProps {
  currentUser?: CurrentUser
  appointments?: AppointmentTemplate[]
  onAppointmentsChange?: (appointments: AppointmentTemplate[]) => void
}

/**
 * Schedule template builder for creating and editing appointment templates.
 */
export function Builder({ currentUser, appointments: propAppointments, onAppointmentsChange }: BuilderProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"day" | "week">("day")
  const [selectedProvider, setSelectedProvider] = useState(currentUser?.name || "Dr. Johnson")
  const [calendarView, setCalendarView] = useState<"grid" | "list">("grid")
  const [showNewAppointmentDialog, setShowNewAppointmentDialog] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<AppointmentTemplate | null>(null)
  const [showChartUpload, setShowChartUpload] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Available providers
  const providers = ["All Providers", "Dr. Johnson", "Dr. Smith", "NP Williams", "Dr. Brown"]

  // Use appointments from props or empty array
  const appointmentTemplates = propAppointments || []

  const setAppointmentTemplates = (
    next: AppointmentTemplate[] | ((prev: AppointmentTemplate[]) => AppointmentTemplate[])
  ) => {
    const updatedAppointments =
      typeof next === "function"
        ? (next as (prev: AppointmentTemplate[]) => AppointmentTemplate[])(appointmentTemplates)
        : next
    onAppointmentsChange?.(updatedAppointments)
  }

  // New appointment form state
  const [newAppointment, setNewAppointment] = useState<Partial<AppointmentTemplate>>({
    patientName: "",
    patientPhone: "",
    patientEmail: "",
    patientDOB: "",
    patientAddress: "",
    appointmentTime: "",
    duration: 30,
    appointmentType: "New Patient",
    provider: selectedProvider,
    location: "Room 101",
    status: "Scheduled",
    notes: "",
    priority: "medium",
    isVirtual: false,
    hasChart: false,
    chartFiles: [],
    medicalHistory: "",
    currentMedications: "",
    allergies: "",
    chiefComplaint: "",
    insuranceInfo: "",
    referralNotes: ""
  })

  // Filter appointments based on current filters and view mode
  const filteredAppointments = useMemo(() => {
    return appointmentTemplates.filter((apt) => {
      const matchesProvider = selectedProvider === "All Providers" || apt.provider === selectedProvider

      const matchesSearch =
        searchTerm.trim() === "" ||
        apt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.encounterId.toLowerCase().includes(searchTerm.toLowerCase())

      // Date filtering based on view mode
      const aptDate = new Date(apt.appointmentTime)
      const today = new Date(currentDate)

      let matchesDateRange = true
      if (viewMode === "day") {
        matchesDateRange = aptDate.toDateString() === today.toDateString()
      } else if (viewMode === "week") {
        const startOfWeek = new Date(today)
        const dayOfWeek = startOfWeek.getDay()
        startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        matchesDateRange = aptDate >= startOfWeek && aptDate <= endOfWeek
      }

      return matchesProvider && matchesDateRange && matchesSearch
    })
  }, [appointmentTemplates, selectedProvider, currentDate, viewMode, searchTerm])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Scheduled":
        return "bg-blue-100 text-blue-700 border-blue-200"
      case "Checked In":
        return "bg-green-100 text-green-700 border-green-200"
      case "In Progress":
        return "bg-purple-100 text-purple-700 border-purple-200"
      case "Completed":
        return "bg-slate-100 text-slate-700 border-slate-200"
      case "No Show":
        return "bg-red-100 text-red-700 border-red-200"
      case "Cancelled":
        return "bg-orange-100 text-orange-700 border-orange-200"
      default:
        return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  const getAppointmentTypeColor = (type: string) => {
    switch (type) {
      case "Wellness":
        return "bg-green-50 text-green-700 border-green-200"
      case "Follow-up":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "New Patient":
        return "bg-purple-50 text-purple-700 border-purple-200"
      case "Urgent":
        return "bg-red-50 text-red-700 border-red-200"
      case "Consultation":
        return "bg-orange-50 text-orange-700 border-orange-200"
      default:
        return "bg-slate-50 text-slate-700 border-slate-200"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500"
      case "medium":
        return "border-l-yellow-500"
      case "low":
        return "border-l-green-500"
      default:
        return "border-l-slate-300"
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  const formatDateRange = () => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    }

    const weekDays = generateWeekDays()
    return `${weekDays[0].toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })} - ${weekDays[6].toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })}`
  }

  // Navigation functions
  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1))
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7))
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleSaveAppointment = () => {
    if (editingAppointment) {
      // Update existing appointment
      setAppointmentTemplates((prev) =>
        prev.map((apt) => (apt.id === editingAppointment.id ? editingAppointment : apt))
      )
      setEditingAppointment(null)
    } else {
      // Create new appointment
      const newId = `template-${Date.now()}`
      const encounterId = `ENC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
        Math.random() * 1000
      )
        .toString()
        .padStart(3, "0")}`
      const patientId = `PT-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")}`

      const appointment: AppointmentTemplate = {
        ...(newAppointment as AppointmentTemplate),
        id: newId,
        encounterId,
        patientId,
        status: "Scheduled"
      }

      setAppointmentTemplates((prev) => [...prev, appointment])
      setNewAppointment({
        patientName: "",
        patientPhone: "",
        patientEmail: "",
        patientDOB: "",
        patientAddress: "",
        appointmentTime: "",
        duration: 30,
        appointmentType: "New Patient",
        provider: selectedProvider,
        location: "Room 101",
        status: "Scheduled",
        notes: "",
        priority: "medium",
        isVirtual: false,
        fileUpToDate: false,
        hasChart: false,
        chartFiles: [],
        medicalHistory: "",
        currentMedications: "",
        allergies: "",
        chiefComplaint: "",
        insuranceInfo: "",
        referralNotes: ""
      })
      setShowNewAppointmentDialog(false)
    }
  }

  const handleDeleteAppointment = (appointmentId: string) => {
    setAppointmentTemplates((prev) => prev.filter((apt) => apt.id !== appointmentId))
  }

  const handleDuplicateAppointment = (appointment: AppointmentTemplate) => {
    const newId = `template-${Date.now()}`
    const newAppointment = {
      ...appointment,
      id: newId,
      patientName: `${appointment.patientName} (Copy)`,
      appointmentTime: new Date(new Date(appointment.appointmentTime).getTime() + 60 * 60 * 1000).toISOString()
    }
    setAppointmentTemplates((prev) => [...prev, newAppointment])
  }

  const handleChartUpload = (appointmentId: string, files: string[]) => {
    setAppointmentTemplates((prev) =>
      prev.map((apt) =>
        apt.id === appointmentId
          ? { ...apt, hasChart: files.length > 0, chartFiles: files, fileUpToDate: files.length > 0 }
          : apt
      )
    )
    setShowChartUpload(null)
  }

  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 8; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        slots.push(time)
      }
    }
    return slots
  }

  const generateWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day
    startOfWeek.setDate(diff)

    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      days.push(date)
    }
    return days
  }

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toDateString()
    return filteredAppointments.filter((apt) => {
      const aptDate = new Date(apt.appointmentTime)
      return aptDate.toDateString() === dateStr
    })
  }

  const getAppointmentsForTimeSlot = (date: Date, timeSlot: string) => {
    const [hour, minute] = timeSlot.split(":").map(Number)
    return getAppointmentsForDate(date).filter((apt) => {
      const aptDate = new Date(apt.appointmentTime)
      const aptHour = aptDate.getHours()
      const aptMinute = aptDate.getMinutes()
      return aptHour === hour && aptMinute === minute
    })
  }

  const isDialogOpen = showNewAppointmentDialog || editingAppointment !== null

  // Appointment Card Component
  const AppointmentCard = ({
    appointment,
    compact = false
  }: {
    appointment: AppointmentTemplate
    compact?: boolean
  }) => (
    <Card
      className={`hover:shadow-lg transition-all duration-300 cursor-pointer bg-white border-2 border-stone-100/50 hover:border-stone-200/70 shadow-md hover:bg-stone-50/30 border-l-4 ${getPriorityColor(appointment.priority)} ${
        compact ? "p-2" : ""
      }`}
    >
      <CardContent className={compact ? "p-3" : "p-6"}>
        <div className={`flex items-start ${compact ? "gap-2" : "gap-4"} ${compact ? "flex-col sm:flex-row" : ""}`}>
          <div className="flex items-center gap-2">
            <Avatar className={`${compact ? "w-8 h-8" : "w-12 h-12"} ring-2 ring-white shadow-sm`}>
              <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-medium text-xs">
                {appointment.patientName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            {appointment.priority === "high" && (
              <div
                className={`absolute ${
                  compact ? "-top-0.5 -right-0.5 w-3 h-3" : "-top-1 -right-1 w-4 h-4"
                } bg-red-500 rounded-full border-2 border-white`}
              />
            )}
          </div>

          <div className={`flex-1 ${compact ? "text-center sm:text-left" : ""}`}>
            <h3 className={`font-semibold text-foreground ${compact ? "text-sm" : "text-lg"}`}>
              {appointment.patientName}
            </h3>
            <div
              className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"} text-muted-foreground ${compact ? "flex-col sm:flex-row" : ""}`}
            >
              <div className="flex items-center gap-1">
                <Clock className={`${compact ? "w-3 h-3" : "w-4 h-4"}`} />
                <span>{formatTime(appointment.appointmentTime)}</span>
                <span>({appointment.duration} min)</span>
              </div>
              {appointment.isVirtual && (
                <Badge variant="outline" className="text-xs">
                  Virtual
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {appointment.patientPhone}
              </div>
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {appointment.patientEmail}
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {appointment.location}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className={`text-xs font-medium ${getStatusColor(appointment.status)}`}>
                {appointment.status}
              </Badge>
              <Badge className={`text-xs font-medium ${getAppointmentTypeColor(appointment.appointmentType)}`}>
                {appointment.appointmentType}
              </Badge>
              {appointment.fileUpToDate ? (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Chart Ready
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Needs Chart
                </Badge>
              )}
            </div>
          </div>

          <div className={`flex gap-1 ${compact ? "flex-col" : "flex-wrap"}`}>
            <Button variant="ghost" size="sm" onClick={() => setShowChartUpload(appointment.id)}>
              <Upload className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="sm" onClick={() => setEditingAppointment({ ...appointment })}>
              <Edit3 className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="sm" onClick={() => handleDuplicateAppointment(appointment)}>
              <Copy className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteAppointment(appointment.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Day View Component
  const DayView = () => {
    const timeSlots = generateTimeSlots()
    const dayAppointments = getAppointmentsForDate(currentDate)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{formatDate(currentDate.toISOString())}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{dayAppointments.length} appointments</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Time Grid */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Available Time Slots</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {timeSlots.map((time) => {
                  const hasAppointment = getAppointmentsForTimeSlot(currentDate, time).length > 0

                  return (
                    <div
                      key={time}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        hasAppointment
                          ? "bg-blue-50 border-blue-200"
                          : "bg-slate-50 border-slate-200 hover:bg-blue-50/60 hover:border-blue-100"
                      }`}
                      onClick={() => {
                        if (!hasAppointment) {
                          const selectedDateTime = new Date(currentDate)
                          const [hour, minute] = time.split(":").map(Number)
                          selectedDateTime.setHours(hour, minute, 0, 0)
                          setNewAppointment((prev) => ({
                            ...prev,
                            appointmentTime: selectedDateTime.toISOString()
                          }))
                          setShowNewAppointmentDialog(true)
                        }
                      }}
                    >
                      <span className="text-sm font-medium">{time}</span>
                      {hasAppointment ? (
                        <div className="text-xs text-blue-600 mt-1">
                          {getAppointmentsForTimeSlot(currentDate, time).length} appointment(s)
                        </div>
                      ) : (
                        <div className="text-xs text-green-600 mt-1">Available</div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* Appointments */}
          <div className="lg:col-span-3 space-y-4">
            {dayAppointments.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No appointments scheduled</h3>
                  <p className="text-muted-foreground mb-4">Click on a time slot to create a new appointment.</p>
                </CardContent>
              </Card>
            ) : (
              dayAppointments
                .sort((a, b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime())
                .map((appointment, index) => (
                  <motion.div
                    key={appointment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <AppointmentCard appointment={appointment} />
                  </motion.div>
                ))
            )}
          </div>
        </div>
      </div>
    )
  }

  // Week View Component
  const WeekView = () => {
    const weekDays = generateWeekDays()

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{formatDateRange()}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {weekDays.reduce((total, day) => total + getAppointmentsForDate(day).length, 0)} appointments this week
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const dayAppointments = getAppointmentsForDate(day)
            const isToday = day.toDateString() === new Date().toDateString()

            return (
              <Card key={day.toISOString()} className={`${isToday ? "ring-2 ring-blue-500" : ""} min-h-[300px]`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-center">
                    <div className={`font-medium ${isToday ? "text-blue-600" : ""}`}>
                      {day.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div className={`text-lg ${isToday ? "text-blue-600 font-bold" : ""}`}>{day.getDate()}</div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {dayAppointments.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-sm text-muted-foreground mb-2">No appointments</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const selectedDateTime = new Date(day)
                          selectedDateTime.setHours(9, 0, 0, 0)
                          setNewAppointment((prev) => ({
                            ...prev,
                            appointmentTime: selectedDateTime.toISOString()
                          }))
                          setShowNewAppointmentDialog(true)
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  ) : (
                    dayAppointments
                      .sort((a, b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime())
                      .map((appointment) => (
                        <motion.div
                          key={appointment.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <AppointmentCard appointment={appointment} compact={true} />
                        </motion.div>
                      ))
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  const ListView = () => {
    if (filteredAppointments.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No matching templates</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filters.</p>
          </CardContent>
        </Card>
      )
    }

    if (viewMode === "day") {
      const dayAppointments = getAppointmentsForDate(currentDate)
      return (
        <div className="space-y-4">
          {dayAppointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )
    }

    const weekDays = generateWeekDays()
    return (
      <div className="space-y-6">
        {weekDays.map((day) => {
          const dayAppointments = getAppointmentsForDate(day)
          return (
            <div key={day.toISOString()} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-medium">
                    {day.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric"
                    })}
                  </h3>
                </div>
                <Badge variant="outline">{dayAppointments.length} templates</Badge>
              </div>
              {dayAppointments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No templates for this day.</div>
              ) : (
                <div className="space-y-3">
                  {dayAppointments.map((appointment) => (
                    <AppointmentCard key={appointment.id} appointment={appointment} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with controls */}
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {viewMode === "day" ? "Daily view" : "Weekly view"}
              </div>
              <div className="text-lg font-semibold">{formatDateRange()}</div>
            </div>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "day" | "week")}>
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-1">
              <button
                className={`px-2 py-1 rounded ${calendarView === "grid" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setCalendarView("grid")}
                type="button"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                className={`px-2 py-1 rounded ${calendarView === "list" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setCalendarView("list")}
                type="button"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <Select
              value={selectedProvider}
              onValueChange={(value) => {
                setSelectedProvider(value)
                setNewAppointment((prev) => ({
                  ...prev,
                  provider: value
                }))
              }}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-1" />
              Settings
            </Button>

            <Button onClick={() => setShowNewAppointmentDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search patient, ID, or encounter"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <User className="w-3 h-3 mr-1" />
              {selectedProvider === "All Providers" ? "All providers" : selectedProvider}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {filteredAppointments.length} template{filteredAppointments.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      {/* Calendar View */}
      {calendarView === "grid" ? viewMode === "day" ? <DayView /> : <WeekView /> : <ListView />}

      {/* New/Edit Appointment Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewAppointmentDialog(false)
            setEditingAppointment(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingAppointment ? "Edit Appointment Template" : "Create Appointment Template"}
            </DialogTitle>
            <DialogDescription>
              {editingAppointment
                ? "Update template details and clinical information."
                : "Build a reusable appointment template for scheduling and documentation workflows."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Tabs defaultValue="patient">
              <TabsList>
                <TabsTrigger value="patient">Patient</TabsTrigger>
                <TabsTrigger value="appointment">Appointment</TabsTrigger>
                <TabsTrigger value="medical">Medical</TabsTrigger>
                <TabsTrigger value="notes">Notes & Files</TabsTrigger>
              </TabsList>

              <TabsContent value="patient" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="patientName">Patient Name *</Label>
                    <Input
                      id="patientName"
                      value={editingAppointment?.patientName || newAppointment.patientName}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, patientName: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, patientName: event.target.value })
                        }
                      }}
                      placeholder="Enter patient full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="patientDOB">Date of Birth</Label>
                    <Input
                      id="patientDOB"
                      type="date"
                      value={editingAppointment?.patientDOB || newAppointment.patientDOB}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, patientDOB: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, patientDOB: event.target.value })
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="patientPhone">Phone Number</Label>
                    <Input
                      id="patientPhone"
                      value={editingAppointment?.patientPhone || newAppointment.patientPhone}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, patientPhone: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, patientPhone: event.target.value })
                        }
                      }}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="patientEmail">Email Address</Label>
                    <Input
                      id="patientEmail"
                      type="email"
                      value={editingAppointment?.patientEmail || newAppointment.patientEmail}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, patientEmail: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, patientEmail: event.target.value })
                        }
                      }}
                      placeholder="patient@email.com"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="patientAddress">Address</Label>
                    <Input
                      id="patientAddress"
                      value={editingAppointment?.patientAddress || newAppointment.patientAddress}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, patientAddress: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, patientAddress: event.target.value })
                        }
                      }}
                      placeholder="123 Main St, City, State 12345"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="insuranceInfo">Insurance Information</Label>
                    <Input
                      id="insuranceInfo"
                      value={editingAppointment?.insuranceInfo || newAppointment.insuranceInfo}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, insuranceInfo: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, insuranceInfo: event.target.value })
                        }
                      }}
                      placeholder="Insurance provider and plan"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="appointment" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appointmentTime">Appointment Date & Time *</Label>
                    <Input
                      id="appointmentTime"
                      type="datetime-local"
                      value={
                        editingAppointment?.appointmentTime
                          ? new Date(editingAppointment.appointmentTime).toISOString().slice(0, 16)
                          : newAppointment.appointmentTime
                            ? new Date(newAppointment.appointmentTime).toISOString().slice(0, 16)
                            : ""
                      }
                      onChange={(event) => {
                        const isoString = new Date(event.target.value).toISOString()
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, appointmentTime: isoString })
                        } else {
                          setNewAppointment({ ...newAppointment, appointmentTime: isoString })
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Select
                      value={(editingAppointment?.duration || newAppointment.duration || 30).toString()}
                      onValueChange={(value) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, duration: parseInt(value, 10) })
                        } else {
                          setNewAppointment({ ...newAppointment, duration: parseInt(value, 10) })
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">60 minutes</SelectItem>
                        <SelectItem value="90">90 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appointmentType">Appointment Type</Label>
                    <Select
                      value={editingAppointment?.appointmentType || newAppointment.appointmentType || "New Patient"}
                      onValueChange={(value) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, appointmentType: value as any })
                        } else {
                          setNewAppointment({ ...newAppointment, appointmentType: value as any })
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Wellness">Wellness</SelectItem>
                        <SelectItem value="Follow-up">Follow-up</SelectItem>
                        <SelectItem value="New Patient">New Patient</SelectItem>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                        <SelectItem value="Consultation">Consultation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={editingAppointment?.priority || newAppointment.priority || "medium"}
                      onValueChange={(value) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, priority: value as any })
                        } else {
                          setNewAppointment({ ...newAppointment, priority: value as any })
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Select
                      value={editingAppointment?.provider || newAppointment.provider || selectedProvider}
                      onValueChange={(value) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, provider: value })
                        } else {
                          setNewAppointment({ ...newAppointment, provider: value })
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providers
                          .filter((provider) => provider !== "All Providers")
                          .map((provider) => (
                            <SelectItem key={provider} value={provider}>
                              {provider}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={editingAppointment?.location || newAppointment.location}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, location: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, location: event.target.value })
                        }
                      }}
                      placeholder="Room 101 or Virtual"
                    />
                  </div>

                  <div className="flex items-center space-x-2 md:col-span-2">
                    <Switch
                      id="isVirtual"
                      checked={editingAppointment?.isVirtual || newAppointment.isVirtual || false}
                      onCheckedChange={(checked) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, isVirtual: checked })
                        } else {
                          setNewAppointment({ ...newAppointment, isVirtual: checked })
                        }
                      }}
                    />
                    <Label htmlFor="isVirtual">Virtual Appointment</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="medical" className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="chiefComplaint">Chief Complaint</Label>
                    <Textarea
                      id="chiefComplaint"
                      value={editingAppointment?.chiefComplaint || newAppointment.chiefComplaint}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, chiefComplaint: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, chiefComplaint: event.target.value })
                        }
                      }}
                      placeholder="Patient's primary concern or reason for visit"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="medicalHistory">Medical History</Label>
                    <Textarea
                      id="medicalHistory"
                      value={editingAppointment?.medicalHistory || newAppointment.medicalHistory}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, medicalHistory: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, medicalHistory: event.target.value })
                        }
                      }}
                      placeholder="Past medical history, surgeries, chronic conditions"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currentMedications">Current Medications</Label>
                    <Textarea
                      id="currentMedications"
                      value={editingAppointment?.currentMedications || newAppointment.currentMedications}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, currentMedications: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, currentMedications: event.target.value })
                        }
                      }}
                      placeholder="List current medications with dosages"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allergies">Allergies</Label>
                    <Textarea
                      id="allergies"
                      value={editingAppointment?.allergies || newAppointment.allergies}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, allergies: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, allergies: event.target.value })
                        }
                      }}
                      placeholder="Known allergies and reactions"
                      rows={2}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Appointment Notes</Label>
                    <Textarea
                      id="notes"
                      value={editingAppointment?.notes || newAppointment.notes}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, notes: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, notes: event.target.value })
                        }
                      }}
                      placeholder="Additional notes about the appointment"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referralNotes">Referral Notes</Label>
                    <Textarea
                      id="referralNotes"
                      value={editingAppointment?.referralNotes || newAppointment.referralNotes}
                      onChange={(event) => {
                        if (editingAppointment) {
                          setEditingAppointment({ ...editingAppointment, referralNotes: event.target.value })
                        } else {
                          setNewAppointment({ ...newAppointment, referralNotes: event.target.value })
                        }
                      }}
                      placeholder="Referral information and notes"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Medical Chart Files</Label>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm">
                          {(editingAppointment?.chartFiles?.length || newAppointment.chartFiles?.length || 0) === 0
                            ? "No files uploaded"
                            : `${editingAppointment?.chartFiles?.length || newAppointment.chartFiles?.length} file(s) uploaded`}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const files = ["medical_history.pdf", "lab_results.pdf", "previous_visit_notes.pdf"]
                          if (editingAppointment) {
                            setEditingAppointment({ ...editingAppointment, hasChart: true, chartFiles: files })
                          } else {
                            setNewAppointment({ ...newAppointment, hasChart: true, chartFiles: files })
                          }
                        }}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Files
                      </Button>
                    </div>

                    {(editingAppointment?.chartFiles?.length || newAppointment.chartFiles?.length || 0) > 0 && (
                      <div className="space-y-2">
                        {(editingAppointment?.chartFiles || newAppointment.chartFiles || []).map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600" />
                              <span className="text-sm">{file}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updatedFiles = (
                                  editingAppointment?.chartFiles ||
                                  newAppointment.chartFiles ||
                                  []
                                ).filter((_, i) => i !== index)
                                if (editingAppointment) {
                                  setEditingAppointment({
                                    ...editingAppointment,
                                    chartFiles: updatedFiles,
                                    hasChart: updatedFiles.length > 0
                                  })
                                } else {
                                  setNewAppointment({
                                    ...newAppointment,
                                    chartFiles: updatedFiles,
                                    hasChart: updatedFiles.length > 0
                                  })
                                }
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewAppointmentDialog(false)
                setEditingAppointment(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveAppointment}>
              <Save className="w-4 h-4 mr-2" />
              {editingAppointment ? "Update" : "Create"} Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chart Upload Dialog */}
      <Dialog open={showChartUpload !== null} onOpenChange={(open) => !open && setShowChartUpload(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Medical Chart</DialogTitle>
            <DialogDescription>Upload medical chart files for this appointment template.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                You can upload multiple files including medical history, lab results, imaging, and previous visit notes.
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">Drag and drop files here, or click to select files</p>
              <Button variant="outline">Select Files</Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChartUpload(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const files = ["medical_history.pdf", "lab_results.pdf", "imaging_results.pdf"]
                if (showChartUpload) {
                  handleChartUpload(showChartUpload, files)
                }
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
