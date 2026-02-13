export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  timestamp: string
  isRead: boolean
  priority: 'high' | 'medium' | 'low'
}

export const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'Patient Chart Upload Required',
    message: 'Michael Rodriguez (PT-2024-0143) chart needs to be uploaded before visit.',
    type: 'warning',
    timestamp: '2024-03-14T08:30:00Z',
    isRead: false,
    priority: 'high'
  },
  {
    id: '2',
    title: 'Coding Accuracy Alert',
    message: 'Review suggested ICD-10 code J06.9 for improved reimbursement.',
    type: 'info',
    timestamp: '2024-03-14T07:45:00Z',
    isRead: false,
    priority: 'medium'
  },
  {
    id: '3',
    title: 'Draft Auto-Saved',
    message: 'Your note for Sarah Chen has been automatically saved.',
    type: 'success',
    timestamp: '2024-03-14T07:15:00Z',
    isRead: true,
    priority: 'low'
  },
  {
    id: '4',
    title: 'System Maintenance',
    message: 'Scheduled maintenance window tonight 11 PM - 2 AM EST.',
    type: 'info',
    timestamp: '2024-03-14T06:00:00Z',
    isRead: true,
    priority: 'medium'
  },
  {
    id: '5',
    title: 'Quality Score Update',
    message: 'Your documentation quality score increased to 94%.',
    type: 'success',
    timestamp: '2024-03-13T18:30:00Z',
    isRead: true,
    priority: 'low'
  }
]

export const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 1) {
    return `${Math.floor(diffInHours * 60)}m ago`
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

export const getNotificationBorderColor = (type: Notification['type']) => {
  switch (type) {
    case 'warning':
      return 'border-l-orange-400'
    case 'error':
      return 'border-l-red-400'
    case 'success':
      return 'border-l-green-400'
    default:
      return 'border-l-blue-400'
  }
}
