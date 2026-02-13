import { motion } from "motion/react"
import { 
  FileText, 
  FilePlus, 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  Settings, 
  CreditCard,
  ChevronRight,
  Plus,
  CheckCircle,
  Timer,
  Stethoscope,
  Award,
  ArrowUpRight
} from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Progress } from "./ui/progress"
import { Avatar, AvatarFallback } from "./ui/avatar"

interface DashboardProps {
  onNavigate: (view: string) => void
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const currentTime = new Date()
  const currentHour = currentTime.getHours()
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening"

  const todaysStats = {
    notesCompleted: 8,
    patientsScheduled: 12,
    avgConfidence: 92,
    revenueGenerated: 2847.50
  }

  const qualityMeasures = [
    {
      name: "Coding Accuracy",
      current: 94,
      target: 95,
      trend: "+2.1%"
    },
    {
      name: "Documentation Completeness", 
      current: 89,
      target: 90,
      trend: "+1.5%"
    },
    {
      name: "Revenue Optimization",
      current: 87,
      target: 90,
      trend: "+3.2%"
    }
  ]

  const unfinishedDrafts = [
    {
      patient: "Sarah Chen",
      visitType: "Annual Wellness",
      lastModified: "2 hours ago",
      completion: 75,
      urgency: "medium",
      avatar: "SC"
    },
    {
      patient: "Michael Rodriguez",
      visitType: "Follow-up",
      lastModified: "45 minutes ago", 
      completion: 60,
      urgency: "high",
      avatar: "MR"
    },
    {
      patient: "Emily Johnson",
      visitType: "SOAP Note",
      lastModified: "1 hour ago",
      completion: 85,
      urgency: "low",
      avatar: "EJ"
    }
  ]

  const todaysSchedule = [
    {
      time: "9:00 AM",
      patient: "David Wilson",
      type: "Annual Physical",
      status: "completed",
      room: "Room A",
      avatar: "DW",
      color: "emerald" // Completed - green theme
    },
    {
      time: "9:30 AM", 
      patient: "Lisa Thompson",
      type: "Follow-up",
      status: "in-progress",
      room: "Room B",
      avatar: "LT",
      color: "blue" // In progress - blue theme
    },
    {
      time: "10:00 AM",
      patient: "Robert Davis",
      type: "Consultation",
      status: "scheduled",
      room: "Room A",
      avatar: "RD",
      color: "slate" // Scheduled - neutral theme
    },
    {
      time: "10:30 AM",
      patient: "Amanda Miller",
      type: "Wellness Check",
      status: "scheduled", 
      room: "Room C",
      avatar: "AM",
      color: "violet" // Wellness - purple theme
    },
    {
      time: "11:00 AM",
      patient: "James Garcia",
      type: "Follow-up",
      status: "scheduled",
      room: "Room B",
      avatar: "JG",
      color: "slate" // Follow-up - neutral theme
    }
  ]

  const quickActions = [
    {
      title: "New Note",
      description: "Start Documentation",
      icon: FilePlus,
      action: () => onNavigate('app'),
      primary: true,
      stats: "~3 min avg",
      theme: "indigo"
    },
    {
      title: "Schedule Builder",
      description: "Manage Appointments",
      icon: Calendar,
      action: () => onNavigate('builder'),
      primary: false,
      stats: `${todaysSchedule.filter(apt => apt.status === 'scheduled').length} pending`,
      theme: "teal"
    },
    {
      title: "Admin Panel",
      description: "System Controls",
      icon: Settings,
      action: () => onNavigate('settings'),
      primary: false,
      stats: "2 alerts",
      theme: "rose"
    },
    {
      title: "Billing & Coding",
      description: "Revenue Reports",
      icon: CreditCard,
      action: () => console.log("Navigate to Billing"),
      primary: false,
      stats: "$2.8k today",
      theme: "amber"
    }
  ]

  const getColorClasses = (color: string, type: 'bg' | 'text' | 'border' | 'hover') => {
    const colorMap = {
      blue: {
        bg: 'bg-blue-50/60',
        text: 'text-blue-600',
        border: 'border-blue-200/50',
        hover: 'hover:bg-blue-100/50'
      },
      emerald: {
        bg: 'bg-emerald-50/60',
        text: 'text-emerald-600',
        border: 'border-emerald-200/50',
        hover: 'hover:bg-emerald-100/50'
      },
      violet: {
        bg: 'bg-violet-50/60',
        text: 'text-violet-600',
        border: 'border-violet-200/50',
        hover: 'hover:bg-violet-100/50'
      },
      slate: {
        bg: 'bg-slate-50/60',
        text: 'text-slate-600',
        border: 'border-slate-200/50',
        hover: 'hover:bg-slate-100/50'
      },
      indigo: {
        bg: 'bg-indigo-50/40',
        text: 'text-indigo-600',
        border: 'border-indigo-200/40',
        hover: 'hover:bg-indigo-100/50'
      },
      teal: {
        bg: 'bg-teal-50/40',
        text: 'text-teal-600',
        border: 'border-teal-200/40',
        hover: 'hover:bg-teal-100/50'
      },
      rose: {
        bg: 'bg-rose-50/40',
        text: 'text-rose-600',
        border: 'border-rose-200/40',
        hover: 'hover:bg-rose-100/50'
      },
      amber: {
        bg: 'bg-amber-50/40',
        text: 'text-amber-600',
        border: 'border-amber-200/40',
        hover: 'hover:bg-amber-100/50'
      }
    }
    return colorMap[color]?.[type] || colorMap.slate[type]
  }

  const getQuickActionCardBg = (theme: string, primary: boolean) => {
    if (primary) return 'bg-indigo-50/40 border-indigo-200/40'
    
    const cardBgMap = {
      indigo: 'bg-indigo-50/40 border-indigo-200/40',
      teal: 'bg-teal-50/40 border-teal-200/40',
      rose: 'bg-rose-50/40 border-rose-200/40',
      amber: 'bg-amber-50/40 border-amber-200/40'
    }
    return cardBgMap[theme] || 'bg-stone-50/40 border-stone-200/40'
  }

  const getQuickActionHover = (theme: string, primary: boolean) => {
    if (primary) return 'hover:bg-indigo-100/50 hover:border-indigo-300/50'
    
    const hoverMap = {
      indigo: 'hover:bg-indigo-100/50 hover:border-indigo-300/50',
      teal: 'hover:bg-teal-100/50 hover:border-teal-300/50',
      rose: 'hover:bg-rose-100/50 hover:border-rose-300/50',
      amber: 'hover:bg-amber-100/50 hover:border-amber-300/50'
    }
    return hoverMap[theme] || 'hover:bg-stone-100/50 hover:border-stone-300/50'
  }

  return (
    <div className="min-h-screen bg-stone-50/30">
      {/* Header Section - Warm Neutral */}
      <motion.div 
        className="bg-stone-100/40 border-b border-stone-200/30 shadow-sm"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/95 border border-stone-200/50 rounded-2xl flex items-center justify-center shadow-sm">
                  <Stethoscope className="w-7 h-7 text-stone-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold text-stone-800 mb-1">
                    {greeting}, Dr. Johnson
                  </h1>
                  <p className="text-stone-600">
                    Ready to optimize your clinical workflow
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="flex items-center gap-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="text-right">
                <div className="text-3xl font-bold text-stone-800">
                  {todaysStats.notesCompleted}/{todaysStats.patientsScheduled}
                </div>
                <div className="text-sm text-stone-600">Notes Completed</div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600 font-medium">+15% vs yesterday</span>
                </div>
              </div>
              <Avatar className="w-12 h-12 border-2 border-stone-200/50 shadow-sm">
                <AvatarFallback className="bg-white text-stone-600 font-medium">
                  DJ
                </AvatarFallback>
              </Avatar>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions Section - Light Blue Background */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="bg-blue-50/30 border-b border-blue-100/40 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-stone-800 mb-2">Quick Actions</h2>
            <p className="text-stone-600">Jump into your most important tasks</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <motion.div
                key={action.title}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  delay: 0.4 + index * 0.1,
                  duration: 0.4,
                  ease: "easeOut"
                }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
              >
                <Card 
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg shadow-sm backdrop-blur-sm group ${
                    action.primary ? 'ring-1 ring-indigo-200/40' : ''
                  } ${getQuickActionCardBg(action.theme, action.primary)} ${getQuickActionHover(action.theme, action.primary)}`}
                  onClick={action.action}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-sm ${
                        action.primary 
                          ? `bg-indigo-500 text-white` 
                          : `${getColorClasses(action.theme, 'bg')} ${getColorClasses(action.theme, 'text')}`
                      }`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600 transition-colors" />
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className={`font-semibold text-stone-800 transition-colors ${
                        action.primary 
                          ? 'group-hover:text-indigo-700'
                          : `group-hover:${getColorClasses(action.theme, 'text')}`
                      }`}>
                        {action.title}
                      </h3>
                      <p className="text-sm text-stone-600">
                        {action.description}
                      </p>
                      <p className="text-xs text-stone-500">
                        {action.stats}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Main Content Area - Very Subtle Warm Background */}
      <div className="max-w-7xl mx-auto px-6 py-8 bg-stone-50/20 min-h-screen">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* PRIMARY: Today's Schedule - White Background for Strong Contrast */}
          <div className="xl:col-span-3">
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <div className="bg-white rounded-2xl border border-stone-200/40 p-6 shadow-md">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-stone-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-stone-800">Today's Schedule</h2>
                      <p className="text-stone-600">
                        {todaysSchedule.filter(apt => apt.status === 'scheduled').length} appointments remaining
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-medium bg-stone-50 text-stone-700 border-stone-200/50">
                    {todaysSchedule.filter(apt => apt.status === 'in-progress').length > 0 ? 'In Progress' : 'On Track'}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {todaysSchedule.map((appointment, index) => (
                    <motion.div
                      key={`${appointment.time}-${appointment.patient}`}
                      className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                        getColorClasses(appointment.color, 'border')
                      } ${getColorClasses(appointment.color, 'bg')} ${getColorClasses(appointment.color, 'hover')}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 + index * 0.05 }}
                      whileHover={{ x: 4 }}
                      onClick={() => onNavigate('app')}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`text-sm font-bold text-stone-700 min-w-[70px] px-3 py-1.5 rounded-lg ${
                          appointment.color === 'emerald' ? 'bg-emerald-100' :
                          appointment.color === 'blue' ? 'bg-blue-100' :
                          appointment.color === 'violet' ? 'bg-violet-100' :
                          'bg-stone-100'
                        }`}>
                          {appointment.time}
                        </div>
                        <Avatar className={`w-8 h-8 border ${
                          appointment.color === 'emerald' ? 'border-emerald-200/50' :
                          appointment.color === 'blue' ? 'border-blue-200/50' :
                          appointment.color === 'violet' ? 'border-violet-200/50' :
                          'border-stone-200/50'
                        }`}>
                          <AvatarFallback className={`text-xs font-medium ${
                            appointment.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                            appointment.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                            appointment.color === 'violet' ? 'bg-violet-100 text-violet-700' :
                            'bg-stone-100 text-stone-600'
                          }`}>
                            {appointment.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-stone-800">{appointment.patient}</div>
                          <div className="text-sm text-stone-600">{appointment.type} • {appointment.room}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {appointment.status === 'completed' && (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        )}
                        {appointment.status === 'in-progress' && (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs font-medium text-blue-600">In Progress</span>
                          </div>
                        )}
                        {appointment.status === 'scheduled' && (
                          <Timer className="w-5 h-5 text-stone-400" />
                        )}
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600 transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                  <Button 
                    variant="outline" 
                    className="w-full mt-4 font-medium border-stone-200/60 hover:bg-stone-50 text-stone-700"
                    onClick={() => onNavigate('schedule')}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    View Full Schedule
                  </Button>
                </div>
              </div>
            </motion.section>
          </div>

          {/* Right Column - Toned Down Background Colors */}
          <div className="xl:col-span-1 space-y-6">
            {/* SECONDARY: Unfinished Drafts - Subtle Yellow Background */}
            <motion.section
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0, duration: 0.5 }}
            >
              <div className="bg-yellow-50/50 rounded-2xl border border-yellow-200/40 p-5 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-100/80 rounded-lg flex items-center justify-center">
                      <FilePlus className="w-4 h-4 text-orange-600" />
                    </div>
                    <span className="font-semibold text-stone-800">Drafts</span>
                  </div>
                  <Badge variant="outline" className="font-medium border-yellow-300/50 text-yellow-700 bg-yellow-100/40">
                    {unfinishedDrafts.length}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {unfinishedDrafts.slice(0, 2).map((draft, index) => (
                    <motion.div
                      key={draft.patient}
                      className="group p-3 rounded-lg border border-yellow-200/30 bg-white shadow-sm hover:shadow-md cursor-pointer transition-all duration-200"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.1 + index * 0.1 }}
                      onClick={() => onNavigate('app')}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
                              {draft.avatar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-sm text-stone-800">{draft.patient}</span>
                        </div>
                        <Badge 
                          variant={draft.urgency === 'high' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {draft.urgency}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-stone-600">{draft.visitType}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={draft.completion} className="h-1.5 w-12" />
                          <span className="text-xs text-stone-600">{draft.completion}%</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <Button variant="ghost" size="sm" className="w-full text-xs text-orange-700 hover:bg-yellow-100/40" onClick={() => onNavigate('drafts')}>
                    <Plus className="w-3 h-3 mr-1" />
                    View All Drafts
                  </Button>
                </div>
              </div>
            </motion.section>

            {/* Today's Performance - Subtle Green Background */}
            <motion.section
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <div className="bg-emerald-50/50 rounded-2xl border border-emerald-200/40 p-5 shadow-md">
                <div className="text-center mb-4">
                  <h3 className="font-semibold text-stone-800 mb-1">Today's Performance</h3>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg border border-emerald-200/30 shadow-sm">
                    <div className="text-2xl font-bold text-emerald-700">{todaysStats.avgConfidence}%</div>
                    <div className="text-xs text-stone-600">Avg Confidence</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-emerald-200/30 shadow-sm">
                    <div className="text-xl font-bold text-emerald-700">${todaysStats.revenueGenerated.toLocaleString()}</div>
                    <div className="text-xs text-stone-600">Revenue Today</div>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* TERTIARY: Quality Measures - White Background */}
            <motion.section
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4, duration: 0.5 }}
            >
              <div className="bg-white rounded-2xl border border-purple-200/40 p-5 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span className="font-semibold text-stone-800 text-sm">Quality Metrics</span>
                </div>

                <div className="space-y-3">
                  {qualityMeasures.map((measure, index) => (
                    <motion.div
                      key={measure.name}
                      className="flex items-center justify-between"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.5 + index * 0.05 }}
                    >
                      <span className="text-xs text-stone-600">{measure.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-stone-700">{measure.current}%</span>
                        <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700 border-purple-100/50">
                          {measure.trend}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-xs mt-3 text-purple-700 hover:bg-purple-50/50"
                    onClick={() => onNavigate('analytics')}
                  >
                    <BarChart3 className="w-3 h-3 mr-1" />
                    View Analytics
                  </Button>
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      </div>
    </div>
  )
}
