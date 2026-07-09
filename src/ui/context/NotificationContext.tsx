import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface AppNotification {
  id: string
  type: 'sync_inactivity' | 'sync_failure' | 'sync_partial' | 'sync_success' | 'general'
  title: string
  desc: string
  time: string
  color: string
  timestamp: number
}

interface NotificationContextType {
  notifications: AppNotification[]
  addNotification: (n: Omit<AppNotification, 'id' | 'time' | 'timestamp'>) => void
  dismissNotification: (id: string) => void
  clearNotifications: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

const TIME_COLORS: Record<AppNotification['type'], string> = {
  sync_inactivity: 'accent-warning',
  sync_failure: 'accent-orange',
  sync_partial: 'accent-warning',
  sync_success: 'accent-success',
  general: 'accent-cyan',
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'time' | 'timestamp'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()
    setNotifications(prev => [{
      ...n,
      id,
      time: 'just now',
      timestamp: now,
      color: n.color || TIME_COLORS[n.type],
    }, ...prev.slice(0, 49)])
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, dismissNotification, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}