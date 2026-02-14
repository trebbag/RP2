import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { AlertCircle, CheckCircle, Bell, X, Clock } from "lucide-react"
import { Badge } from "../ui/badge"
import { Notification, formatTime, getNotificationBorderColor } from "./NotificationUtils"

interface NotificationsPanelProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  buttonRef?: React.RefObject<HTMLElement>
}

export function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  buttonRef
}: NotificationsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef?.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [isOpen, onClose, buttonRef])

  if (!isOpen) return null

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "warning":
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <Bell className="w-4 h-4 text-blue-500" />
    }
  }

  const getNotificationTypeColor = (type: Notification["type"]) => {
    switch (type) {
      case "warning":
        return "text-orange-600 bg-orange-50 border-orange-200"
      case "error":
        return "text-red-600 bg-red-50 border-red-200"
      case "success":
        return "text-green-600 bg-green-50 border-green-200"
      default:
        return "text-blue-600 bg-blue-50 border-blue-200"
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.2 }}
        className="fixed left-20 bottom-20 z-50 w-80 max-h-96 bg-white rounded-xl border border-stone-200/50 shadow-xl overflow-hidden backdrop-blur-sm"
        style={{
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        }}
      >
        {/* Header */}
        <div className="p-3 border-b border-stone-100/80 bg-gradient-to-r from-stone-50/50 to-stone-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800 text-sm">Notifications</h3>
                {unreadCount > 0 && <p className="text-xs text-stone-500">{unreadCount} unread</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors px-2 py-1 rounded-md hover:bg-blue-50"
                >
                  Clear all
                </button>
              )}
              <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-md transition-colors">
                <X className="w-3.5 h-3.5 text-stone-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-5 h-5 text-stone-400" />
              </div>
              <p className="text-sm text-stone-500">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100/80">
              {notifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`relative p-4 transition-all duration-200 cursor-pointer group ${
                    !notification.isRead
                      ? "bg-gradient-to-r from-blue-50/60 to-blue-50/30 hover:from-blue-50/80 hover:to-blue-50/50"
                      : "bg-white hover:bg-stone-50/70"
                  } ${index % 2 === 1 ? "bg-stone-25/30" : ""} border-l-4 ${
                    !notification.isRead
                      ? "border-l-blue-400"
                      : getNotificationBorderColor(notification.type).replace("border-l-", "border-l-")
                  }`}
                  onClick={() => onMarkAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm ${getNotificationTypeColor(notification.type)}`}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4
                          className={`font-semibold text-sm leading-tight ${
                            !notification.isRead ? "text-stone-900" : "text-stone-700"
                          }`}
                        >
                          {notification.title}
                        </h4>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex items-center gap-1 text-xs text-stone-500 bg-stone-100/60 px-2 py-1 rounded-full">
                            <Clock className="w-3 h-3" />
                            {formatTime(notification.timestamp)}
                          </div>
                          {!notification.isRead && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-sm" />}
                        </div>
                      </div>
                      <p
                        className={`text-xs leading-relaxed line-clamp-2 mb-3 ${
                          !notification.isRead ? "text-stone-700" : "text-stone-600"
                        }`}
                      >
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={`text-xs px-2 py-1 font-medium border-2 ${getNotificationTypeColor(notification.type)} border-current shadow-sm`}
                        >
                          {notification.priority.toUpperCase()}
                        </Badge>
                        {!notification.isRead && (
                          <span className="text-xs text-blue-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-blue-100/60 px-2 py-1 rounded-full">
                            Mark as read
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
