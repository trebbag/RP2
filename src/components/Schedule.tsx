import { useState, useMemo } from "react"
import { motion } from "motion/react"
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Users, 
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle,
  Play,
  Upload,
  Search,
  Grid3x3,
  List,
  Settings
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Separator } from "./ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Label } from "./ui/label"
import { Switch } from "./ui/switch"

interface CurrentUser {
  id: string
  name: string
  fullName: string
  role: 'admin' | 'user'
  specialty: string
}

interface Appointment {
  id: string
  patientId: string
  encounterId: string
  patientName: string
  patientPhone: string
  patientEmail: string
  appointmentTime: string
  duration: number
  appointmentType: 'Wellness' | 'Follow-up' | 'New Patient' | 'Urgent' | 'Consultation'
  provider: string
  location: string
  status: 'Scheduled' | 'Checked In' | 'In Progress' | 'Completed' | 'No Show' | 'Cancelled'
  notes?: string
  fileUpToDate: boolean
  priority: 'low' | 'medium' | 'high'
  isVirtual: boolean
}

interface ScheduleProps {
  currentUser?: CurrentUser
  onStartVisit?: (patientId: string, encounterId: string) => void
  onUploadChart?: (patientId: string) => void
  appointments?: Appointment[]
}

export function Schedule({ currentUser, onStartVisit, onUploadChart, appointments: propAppointments }: ScheduleProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')
  const [providerFilter, setProviderFilter] = useState('me') // 'me', 'everyone', specific provider
  const [statusFilter, setStatusFilter] = useState('all')
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [calendarView, setCalendarView] = useState<'grid' | 'list'>('grid')
  const [showSettings, setShowSettings] = useState(false)

  // Settings state
  const [settings, setSettings] = useState({
    defaultView: 'day' as 'day' | 'week' | 'month',
    showWeekends: true,
    workingHoursStart: '08:00',
    workingHoursEnd: '18:00',
    timeSlotDuration: 30,
    showVirtualMeeting: true,
    autoRefresh: true,
    showPatientPhotos: true,
    enableNotifications: true,
    defaultAppointmentDuration: 30
  })

  // Use appointments from props, fallback to empty array if not provided
  const appointments = propAppointments || []

  // Filter appointments based on current filters and view mode
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchesProvider = providerFilter === 'everyone' || 
                             (providerFilter === 'me' && currentUser?.name === apt.provider) ||
                             apt.provider === providerFilter

      const matchesStatus = statusFilter === 'all' || apt.status === statusFilter
      const matchesType = appointmentTypeFilter === 'all' || apt.appointmentType === appointmentTypeFilter
      const matchesSearch = searchTerm === '' || 
                           apt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           apt.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           apt.encounterId.toLowerCase().includes(searchTerm.toLowerCase())

      // Date filtering based on view mode
      const aptDate = new Date(apt.appointmentTime)
      const today = new Date(currentDate)
      
      let matchesDateRange = true
      if (viewMode === 'day') {
        matchesDateRange = aptDate.toDateString() === today.toDateString()
      } else if (viewMode === 'week') {
        const startOfWeek = new Date(today)
        const dayOfWeek = startOfWeek.getDay()
        startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        matchesDateRange = aptDate >= startOfWeek && aptDate <= endOfWeek
      } else if (viewMode === 'month') {
        matchesDateRange = aptDate.getMonth() === today.getMonth() && aptDate.getFullYear() === today.getFullYear()
      }

      return matchesProvider && matchesStatus && matchesType && matchesSearch && matchesDateRange
    })
  }, [appointments, providerFilter, statusFilter, appointmentTypeFilter, searchTerm, currentUser, currentDate, viewMode])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'Checked In': return 'bg-green-100 text-green-700 border-green-200'
      case 'In Progress': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'Completed': return 'bg-slate-100 text-slate-700 border-slate-200'
      case 'No Show': return 'bg-red-100 text-red-700 border-red-200'
      case 'Cancelled': return 'bg-orange-100 text-orange-700 border-orange-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const getAppointmentTypeColor = (type: string) => {
    switch (type) {
      case 'Wellness': return 'bg-green-50 text-green-700 border-green-200'
      case 'Follow-up': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'New Patient': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'Urgent': return 'bg-red-50 text-red-700 border-red-200'
      case 'Consultation': return 'bg-orange-50 text-orange-700 border-orange-200'
      default: return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500'
      case 'medium': return 'border-l-yellow-500'
      case 'low': return 'border-l-green-500'
      default: return 'border-l-slate-300'
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateRange = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } else if (viewMode === 'week') {
      const startOfWeek = new Date(currentDate)
      const dayOfWeek = startOfWeek.getDay()
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else {
      return currentDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
      })
    }
  }

  const canStartVisit = (appointment: Appointment) => {
    return appointment.status === 'Checked In' || appointment.status === 'Scheduled'
  }

  const uniqueProviders = Array.from(new Set(appointments.map(apt => apt.provider)))

  // Navigation functions
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleScheduleSettings = () => {
    setShowSettings(true)
  }

  const handleSaveSettings = () => {
    // Here you would typically save settings to your backend or local storage
    console.log('Saving schedule settings:', settings)
    setShowSettings(false)
  }

  // Helper functions for different views
  const generateTimeSlots = () => {
    const slots = []
    const startHour = parseInt(settings.workingHoursStart.split(':')[0])
    const endHour = parseInt(settings.workingHoursEnd.split(':')[0])
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += settings.timeSlotDuration) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
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
    const maxDays = settings.showWeekends ? 7 : 5
    
    for (let i = 0; i < maxDays; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      days.push(date)
    }
    return days
  }

  const generateMonthCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days = []
    for (let i = 0; i < 42; i++) { // 6 weeks x 7 days
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      days.push(date)
    }
    return days
  }

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toDateString()
    return filteredAppointments.filter(apt => {
      const aptDate = new Date(apt.appointmentTime)
      return aptDate.toDateString() === dateStr
    })
  }

  const getAppointmentsForTimeSlot = (date: Date, timeSlot: string) => {
    const [hour, minute] = timeSlot.split(':').map(Number)
    return getAppointmentsForDate(date).filter(apt => {
      const aptDate = new Date(apt.appointmentTime)
      const aptHour = aptDate.getHours()
      const aptMinute = aptDate.getMinutes()
      return aptHour === hour && aptMinute === minute
    })
  }

  // Appointment Card Component
  const AppointmentCard = ({ appointment, compact = false }: { appointment: Appointment, compact?: boolean }) => (
    <Card className={`hover:shadow-lg transition-all duration-300 cursor-pointer bg-white border-2 border-stone-100/50 hover:border-stone-200/70 shadow-md hover:bg-stone-50/30 border-l-4 ${getPriorityColor(appointment.priority)} ${compact ? 'p-2' : ''}`}>
      <CardContent className={compact ? "p-3" : "p-6"}>
        <div className={`flex items-center ${compact ? 'gap-2' : 'gap-4'} ${compact ? 'flex-col sm:flex-row' : ''}`}>
          <div className="flex items-center gap-2">
            {settings.showPatientPhotos && (
              <Avatar className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} ring-2 ring-white shadow-sm`}>
                <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-medium text-xs">
                  {appointment.patientName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
            )}
            {appointment.priority === 'high' && (
              <div className={`absolute ${compact ? '-top-0.5 -right-0.5 w-3 h-3' : '-top-1 -right-1 w-4 h-4'} bg-red-500 rounded-full border-2 border-white`} />
            )}
          </div>
          
          <div className={`${compact ? 'text-center sm:text-left' : ''}`}>
            <h3 className={`font-semibold text-foreground ${compact ? 'text-sm' : 'text-lg'}`}>{appointment.patientName}</h3>
            <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-muted-foreground ${compact ? 'flex-col sm:flex-row' : ''}`}>
              <div className="flex items-center gap-1">
                <Clock className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                <span>{formatTime(appointment.appointmentTime)}</span>
                <span>({appointment.duration} min)</span>
              </div>
              {appointment.isVirtual && settings.showVirtualMeeting && (
                <Badge variant="outline" className="text-xs">Virtual</Badge>
              )}
            </div>
          </div>

          <div className={`flex gap-1 ${compact ? 'flex-col' : 'flex-wrap'}`}>
            <Badge className={`text-xs font-medium ${getStatusColor(appointment.status)}`}>
              {appointment.status}
            </Badge>
            <Badge className={`text-xs font-medium ${getAppointmentTypeColor(appointment.appointmentType)}`}>
              {appointment.appointmentType}
            </Badge>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {!appointment.fileUpToDate && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onUploadChart?.(appointment.patientId)}
              >
                <Upload className="w-4 h-4 mr-2" />
                {compact ? 'Upload' : 'Upload Chart'}
              </Button>
            )}
            
            {canStartVisit(appointment) && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => onStartVisit?.(appointment.patientId, appointment.encounterId)}
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                <Play className="w-4 h-4 mr-2" />
                {compact ? 'Start' : 'Start Visit'}
              </Button>
            )}
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
          <h2 className="text-xl font-semibold">
            {currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>
          <Badge variant="outline">{dayAppointments.length} appointments</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Time Grid */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Time Slots</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {timeSlots.map(time => {
                  const hasAppointment = getAppointmentsForTimeSlot(currentDate, time).length > 0
                  
                  return (
                    <div key={time} className={`p-2 rounded border ${hasAppointment ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-sm font-medium">{time}</span>
                      {hasAppointment && (
                        <div className="text-xs text-blue-600 mt-1">
                          {getAppointmentsForTimeSlot(currentDate, time).length} appointment(s)
                        </div>
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
                  <h3 className="text-lg font-medium text-foreground mb-2">No appointments today</h3>
                  <p className="text-muted-foreground">This day is free from scheduled appointments.</p>
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
          <h2 className="text-xl font-semibold">
            Week of {weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekDays[weekDays.length - 1].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>
          <Badge variant="outline">
            {weekDays.reduce((total, day) => total + getAppointmentsForDate(day).length, 0)} appointments this week
          </Badge>
        </div>

        <div className={`grid grid-cols-1 gap-4 ${settings.showWeekends ? 'md:grid-cols-7' : 'md:grid-cols-5'}`}>
          {weekDays.map((day, index) => {
            const dayAppointments = getAppointmentsForDate(day)
            const isToday = day.toDateString() === new Date().toDateString()

            return (
              <Card key={day.toISOString()} className={`${isToday ? 'ring-2 ring-blue-500' : ''}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-center">
                    <div className={`font-medium ${isToday ? 'text-blue-600' : ''}`}>
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-lg ${isToday ? 'text-blue-600 font-bold' : ''}`}>
                      {day.getDate()}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {dayAppointments.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No appointments
                    </div>
                  ) : (
                    dayAppointments
                      .sort((a, b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime())
                      .map(appointment => (
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

  // Month View Component
  const MonthView = () => {
    const monthDays = generateMonthCalendar()
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{monthName}</h2>
          <Badge variant="outline">
            {monthDays.reduce((total, day) => total + getAppointmentsForDate(day).length, 0)} appointments this month
          </Badge>
        </div>

        <Card>
          <CardContent className="p-4">
            {/* Week day headers */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center font-medium text-sm text-muted-foreground p-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-2">
              {monthDays.map((day) => {
                const dayAppointments = getAppointmentsForDate(day)
                const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                const isToday = day.toDateString() === new Date().toDateString()

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[100px] p-2 border rounded ${
                      isCurrentMonth ? 'bg-white' : 'bg-slate-50'
                    } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday ? 'text-blue-600 font-bold' : 
                      isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {day.getDate()}
                    </div>
                    
                    <div className="space-y-1">
                      {dayAppointments.slice(0, 3).map(appointment => (
                        <div
                          key={appointment.id}
                          className={`text-xs p-1 rounded border-l-2 ${getPriorityColor(appointment.priority).replace('border-l-', 'border-l-')} bg-blue-50 text-blue-700 cursor-pointer hover:bg-blue-100 transition-colors`}
                          onClick={() => onStartVisit?.(appointment.patientId, appointment.encounterId)}
                        >
                          <div className="font-medium truncate">{appointment.patientName}</div>
                          <div className="text-[10px] opacity-75">{formatTime(appointment.appointmentTime)}</div>
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayAppointments.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with controls */}
      <div className="flex flex-col space-y-4">
        {/* Top row - Date navigation and view controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateDate('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-lg font-medium">{formatDateRange()}</div>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'day' | 'week' | 'month')}>
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="outline" size="sm" onClick={() => setCalendarView(calendarView === 'grid' ? 'list' : 'grid')}>
              {calendarView === 'grid' ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Second row - Filters and actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patients, IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>

            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-48">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">My Appointments</SelectItem>
                <SelectItem value="everyone">All Providers</SelectItem>
                <Separator />
                {uniqueProviders.map(provider => (
                  <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Checked In">Checked In</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="No Show">No Show</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={appointmentTypeFilter} onValueChange={setAppointmentTypeFilter}>
              <SelectTrigger className="w-48">
                <FileText className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Wellness">Wellness</SelectItem>
                <SelectItem value="Follow-up">Follow-up</SelectItem>
                <SelectItem value="New Patient">New Patient</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
                <SelectItem value="Consultation">Consultation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleScheduleSettings}>
              <Settings className="w-4 h-4 mr-2" />
              Schedule Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="min-h-[600px]">
        {viewMode === 'day' && <DayView />}
        {viewMode === 'week' && <WeekView />}
        {viewMode === 'month' && <MonthView />}
      </div>

      {/* Schedule Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule Settings</DialogTitle>
            <DialogDescription>
              Configure your schedule preferences and display options.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultView">Default View</Label>
                  <Select 
                    value={settings.defaultView} 
                    onValueChange={(value) => setSettings({...settings, defaultView: value as 'day' | 'week' | 'month'})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day View</SelectItem>
                      <SelectItem value="week">Week View</SelectItem>
                      <SelectItem value="month">Month View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workingHoursStart">Working Hours Start</Label>
                  <Input
                    id="workingHoursStart"
                    type="time"
                    value={settings.workingHoursStart}
                    onChange={(e) => setSettings({...settings, workingHoursStart: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workingHoursEnd">Working Hours End</Label>
                  <Input
                    id="workingHoursEnd"
                    type="time"
                    value={settings.workingHoursEnd}
                    onChange={(e) => setSettings({...settings, workingHoursEnd: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeSlotDuration">Time Slot Duration (minutes)</Label>
                  <Select 
                    value={settings.timeSlotDuration.toString()} 
                    onValueChange={(value) => setSettings({...settings, timeSlotDuration: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="showWeekends">Show Weekends</Label>
                  <Switch
                    id="showWeekends"
                    checked={settings.showWeekends}
                    onCheckedChange={(checked) => setSettings({...settings, showWeekends: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="showVirtualMeeting">Show Virtual Meeting Badge</Label>
                  <Switch
                    id="showVirtualMeeting"
                    checked={settings.showVirtualMeeting}
                    onCheckedChange={(checked) => setSettings({...settings, showVirtualMeeting: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="autoRefresh">Auto Refresh</Label>
                  <Switch
                    id="autoRefresh"
                    checked={settings.autoRefresh}
                    onCheckedChange={(checked) => setSettings({...settings, autoRefresh: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="showPatientPhotos">Show Patient Photos</Label>
                  <Switch
                    id="showPatientPhotos"
                    checked={settings.showPatientPhotos}
                    onCheckedChange={(checked) => setSettings({...settings, showPatientPhotos: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="enableNotifications">Enable Notifications</Label>
                  <Switch
                    id="enableNotifications"
                    checked={settings.enableNotifications}
                    onCheckedChange={(checked) => setSettings({...settings, enableNotifications: checked})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultAppointmentDuration">Default Appointment Duration (minutes)</Label>
                  <Select 
                    value={settings.defaultAppointmentDuration.toString()} 
                    onValueChange={(value) => setSettings({...settings, defaultAppointmentDuration: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>
              Save Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
