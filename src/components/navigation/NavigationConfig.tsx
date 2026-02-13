import { 
  Home,
  FileText, 
  FilePlus, 
  BarChart3, 
  ScrollText, 
  Settings, 
  HelpCircle,
  Calendar,
  TrendingUp,
  Archive,
  Bell,
  User,
  Activity
} from "lucide-react"

export const getPrimaryNavItems = (userDraftCount: number = 0) => [
  { 
    title: "Home Dashboard", 
    icon: Home, 
    isActive: false,
    badge: null,
    description: "Overview and quick actions",
    key: "home",
    accentColor: "text-blue-600"
  },
  { 
    title: "Documentation", 
    icon: FileText, 
    isActive: false,
    badge: null,
    description: "Create and manage clinical notes",
    key: "app",
    accentColor: "text-primary"
  },
  { 
    title: "Drafts", 
    icon: FilePlus,
    badge: userDraftCount > 0 ? userDraftCount.toString() : null,
    description: "Continue working on saved drafts",
    key: "drafts",
    accentColor: "text-orange-600"
  },
  { 
    title: "Schedule", 
    icon: Calendar,
    badge: null,
    description: "View and manage patient appointments",
    key: "schedule",
    accentColor: "text-purple-600"
  },
  { 
    title: "Analytics", 
    icon: TrendingUp,
    badge: null,
    description: "Performance metrics and insights",
    key: "analytics",
    accentColor: "text-blue-600"
  }
]

export const secondaryNavItems = [
  { 
    title: "Builder", 
    icon: ScrollText,
    badge: null,
    description: "Build and populate schedules",
    key: "builder",
    accentColor: "text-slate-600"
  },
  { 
    title: "Archive", 
    icon: Archive,
    badge: null,
    description: "Access archived documentation",
    key: "archive",
    accentColor: "text-slate-600"
  },
  { 
    title: "Activity Log", 
    icon: Activity,
    badge: null,
    description: "Review system activity and changes",
    key: "activity",
    accentColor: "text-slate-600"
  }
]

export const bottomNavItems = [
  { 
    title: "Notifications", 
    icon: Bell,
    badge: "2",
    description: "System alerts and updates",
    key: "notifications",
    accentColor: "text-red-600"
  },
  { 
    title: "Profile", 
    icon: User,
    badge: null,
    description: "Account settings and preferences",
    key: "profile",
    accentColor: "text-slate-600"
  },
  { 
    title: "Settings", 
    icon: Settings,
    badge: null,
    description: "Configure application preferences",
    key: "settings",
    accentColor: "text-slate-600"
  },
  { 
    title: "Help & Support", 
    icon: HelpCircle,
    badge: null,
    description: "Documentation and support resources",
    key: "help",
    accentColor: "text-slate-600"
  }
]
