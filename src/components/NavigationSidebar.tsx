import { useState, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  Stethoscope,
  ChevronRight
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar
} from "./ui/sidebar"
import { Badge } from "./ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { Separator } from "./ui/separator"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { getPrimaryNavItems, secondaryNavItems, bottomNavItems } from "./navigation/NavigationConfig"
import { NotificationsPanel } from "./navigation/NotificationsPanel"
import { mockNotifications, Notification } from "./navigation/NotificationUtils"

interface CurrentUser {
  id: string
  name: string
  fullName: string
  role: 'admin' | 'user'
  specialty: string
}

interface NavigationSidebarProps {
  currentView?: string
  onNavigate?: (view: string) => void
  currentUser?: CurrentUser
  userDraftCount?: number
  pilotMode?: boolean
}

interface NavItemProps {
  item: ReturnType<typeof getPrimaryNavItems>[0]
  isCollapsed: boolean
  onClick?: () => void
  isCurrentView?: boolean
  isNotifications?: boolean
  buttonRef?: React.RefObject<HTMLDivElement>
}

function NavItem({ item, isCollapsed, onClick, isCurrentView, isNotifications = false, buttonRef }: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isActive = isCurrentView

  const content = (
    <motion.div
      ref={isNotifications ? buttonRef : undefined}
      className={`relative flex items-center ${isCollapsed ? 'w-12 h-12 p-2 justify-center mx-auto' : 'w-full p-3'} rounded-xl transition-all duration-200 cursor-pointer group ${ 
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md' 
          : 'hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground'
      }`}
      whileHover={{ scale: isCollapsed ? 1.05 : 1.02 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      layout
    >
      <motion.div
        className="relative flex items-center justify-center"
      >
        <item.icon 
          className={`w-5 h-5 transition-all duration-200 ${ 
            isActive ? 'text-sidebar-primary-foreground' : isHovered ? item.accentColor : 'text-sidebar-foreground'
          }`} 
        />
      </motion.div>

      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            className="flex items-center justify-between flex-1 ml-3 overflow-hidden"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex flex-col">
              <motion.span 
                className={`font-medium text-sm leading-tight transition-colors duration-200 ${
                  isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground'
                }`}
                layout="position"
              >
                {item.title}
              </motion.span>
              {isHovered && (
                <motion.span 
                  className={`text-xs mt-0.5 leading-tight transition-colors duration-200 ${
                    isActive ? 'text-sidebar-primary-foreground/80' : 'text-sidebar-foreground/70'
                  }`}
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.15 }}
                >
                  {item.description}
                </motion.span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {item.badge && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <Badge 
                    variant={isActive ? "secondary" : "outline"}
                    className={`text-xs px-2 py-0.5 font-medium transition-colors duration-200 ${
                      isActive 
                        ? 'bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground border-sidebar-primary-foreground/30' 
                        : 'border-border/50'
                    }`}
                  >
                    {item.badge}
                  </Badge>
                </motion.div>
              )}
              
              <motion.div
                animate={{ x: isHovered ? 3 : 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronRight className={`w-4 h-4 transition-colors duration-200 ${
                  isActive ? 'text-sidebar-primary-foreground/70' : 'text-sidebar-foreground/50'
                }`} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isCollapsed && item.badge && (
        <motion.div
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white rounded-full flex items-center justify-center border border-sidebar shadow-sm"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <span className="text-[10px] font-medium px-1">
            {item.badge}
          </span>
        </motion.div>
      )}
    </motion.div>
  )

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right" className="flex flex-col bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary/20">
            <span className="font-medium">{item.title}</span>
            <span className="text-xs opacity-80">{item.description}</span>
            {item.badge && (
              <span className="text-xs mt-1 opacity-90">
                {item.badge} items
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
}

interface NavSectionProps {
  title?: string
  items: ReturnType<typeof getPrimaryNavItems>
  isCollapsed: boolean
  currentView?: string
  onNavigate?: (view: string) => void
  onNotificationClick?: () => void
  notificationButtonRef?: React.RefObject<HTMLDivElement>
}

function NavSection({ title, items, isCollapsed, currentView, onNavigate, onNotificationClick, notificationButtonRef }: NavSectionProps) {
  return (
    <motion.div
      className="space-y-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {title && !isCollapsed && (
        <motion.div
          className="px-3 mb-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h4 className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wide">
            {title}
          </h4>
        </motion.div>
      )}
      
      <div className="space-y-1">
        {items.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              duration: 0.2, 
              delay: index * 0.03,
              ease: "easeOut"
            }}
          >
            <NavItem 
              item={item} 
              isCollapsed={isCollapsed}
              isCurrentView={currentView === item.key}
              isNotifications={item.key === 'notifications'}
              buttonRef={item.key === 'notifications' ? notificationButtonRef : undefined}
              onClick={() => {
                if (item.key === 'notifications') {
                  onNotificationClick?.()
                } else {
                  onNavigate?.(item.key)
                }
              }}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function NavigationSidebarContent({
  currentView,
  onNavigate,
  currentUser,
  userDraftCount = 0,
  pilotMode = true
}: NavigationSidebarProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>(pilotMode ? [] : mockNotifications)
  const [showNotifications, setShowNotifications] = useState(false)
  const notificationButtonRef = useRef<HTMLDivElement>(null)

  const primaryNavItems = getPrimaryNavItems(userDraftCount)
  
  // Update notifications badge count with unread notifications
  const unreadCount = notifications.filter(n => !n.isRead).length
  const bottomNavItemsWithCount = bottomNavItems.map(item => 
    item.key === 'notifications' 
      ? { ...item, badge: unreadCount > 0 ? unreadCount.toString() : null }
      : item
  )

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications)
  }

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true }
          : notification
      )
    )
  }

  const handleMarkAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    )
  }

  const handleCloseNotifications = () => {
    setShowNotifications(false)
  }

  return (
    <>
      <SidebarContent className={`${isCollapsed ? 'p-3' : 'p-5'} space-y-6 bg-sidebar border-sidebar-border/50`}>
        {/* Clean Header */}
        <motion.div
          className={`flex items-center gap-3 ${isCollapsed ? 'px-0 justify-center' : 'px-2'}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, type: "spring" }}
        >
          <div className="w-9 h-9 bg-sidebar-primary rounded-xl flex items-center justify-center shadow-sm">
            <Stethoscope className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="font-semibold text-sidebar-foreground">RevenuePilot</h2>
                <p className="text-xs text-sidebar-foreground/60">
                  {currentUser ? `Welcome, ${currentUser.name}` : 'Clinical AI Assistant'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Primary Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0">
              <NavSection 
                items={primaryNavItems} 
                isCollapsed={isCollapsed}
                currentView={currentView}
                onNavigate={onNavigate}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Clean Separator */}
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Separator className="bg-sidebar-border/60" />
          </motion.div>
        )}

        {/* Secondary Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0">
              <NavSection 
                title="Tools & Resources"
                items={secondaryNavItems} 
                isCollapsed={isCollapsed}
                currentView={currentView}
                onNavigate={onNavigate}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom Navigation */}
        <motion.div 
          className={`mt-auto pt-4 ${!isCollapsed ? 'border-t border-sidebar-border/60' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0">
                <NavSection 
                  items={bottomNavItemsWithCount} 
                  isCollapsed={isCollapsed}
                  currentView={currentView}
                  onNavigate={onNavigate}
                  onNotificationClick={handleNotificationClick}
                  notificationButtonRef={notificationButtonRef}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </motion.div>
      </SidebarContent>
      
      {/* Notifications Panel */}
      <NotificationsPanel
        isOpen={showNotifications}
        onClose={handleCloseNotifications}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        buttonRef={notificationButtonRef}
      />
    </>
  )
}

export function NavigationSidebar({ currentView, onNavigate, currentUser, userDraftCount, pilotMode = true }: NavigationSidebarProps) {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50">
      <NavigationSidebarContent 
        currentView={currentView} 
        onNavigate={onNavigate}
        currentUser={currentUser}
        userDraftCount={userDraftCount}
        pilotMode={pilotMode}
      />
    </Sidebar>
  )
}
