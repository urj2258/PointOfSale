import { useState, useEffect } from 'react'
import { SidebarToggle } from './Sidebar'
import ProfileModal from './ProfileModal'
import NotificationModal from './NotificationModal'
import CalendarModal from './CalendarModal'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { api } from '../services/api'

// ── Plug-and-play feature flag ──────────────────────────────────
// Set to `true` to re-enable sync inactivity notifications.
const ENABLE_SYNC_SECTION = false
// ────────────────────────────────────────────────────────────────

interface HeaderProps {
  onMenuToggle: () => void
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

let inactivityNotified = false

export default function Header({ onMenuToggle }: HeaderProps) {
  const { currentUser } = useAuth()
  const { addNotification, notifications } = useNotifications()
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const firstName = currentUser?.full_name?.split(' ')[0] || 'User'
  const initial = currentUser?.full_name?.charAt(0) || 'U'

  const hasUnread = notifications.some(n =>
    n.type === 'sync_inactivity' || n.type === 'sync_failure' || n.type === 'sync_partial'
  )

  useEffect(() => {
    if (ENABLE_SYNC_SECTION && !inactivityNotified) {
      checkSyncInactivity()
    }
  }, [])

  const checkSyncInactivity = async () => {
    try {
      const lastSyncTime = await api.sync.getLastSyncTime() as string | null
      if (!lastSyncTime) return

      const elapsed = Date.now() - new Date(lastSyncTime).getTime()
      if (elapsed >= TWO_DAYS_MS) {
        inactivityNotified = true
        const days = Math.floor(elapsed / (24 * 60 * 60 * 1000))
        addNotification({
          type: 'sync_inactivity',
          title: 'Sync overdue',
          desc: `It's been ${days} days since you last synced. Sync now to keep your data safe!`,
          color: 'accent-warning',
        })
      }
    } catch (err) {
      console.error('Failed to check sync inactivity:', err)
    }
  }

  return (
    <header className="relative z-50 flex items-center justify-between h-16 px-6 bg-white/20 dark:bg-white/[0.04] backdrop-blur-2xl border-b border-white/15 dark:border-white/[0.06]">
      <div className="flex items-center gap-4">
        <SidebarToggle onClick={onMenuToggle} />
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-brand-text-primary truncate max-w-[160px] sm:max-w-none">Good morning, {firstName} 👋</h1>
          <p className="hidden sm:block text-sm text-brand-text-muted">Here's what's happening with your store today.</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-brand-surface/70 backdrop-blur-md shadow-premium-sm border border-white/30 dark:border-white/[0.08]">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/40 dark:bg-white/[0.06] text-sm text-brand-text-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search..." className="bg-transparent border-none outline-none text-sm text-brand-text-primary placeholder:text-brand-text-muted w-28 lg:w-40" />
        </div>

        <button onClick={() => setNotifOpen(true)} className="relative p-2 rounded-full text-brand-text-muted hover:text-brand-text-primary hover:bg-white/40 dark:hover:bg-white/[0.08] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {hasUnread && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-warning" />}
        </button>

        <button onClick={() => setCalendarOpen(true)} className="hidden md:flex p-2 rounded-full text-brand-text-muted hover:text-brand-text-primary hover:bg-white/40 dark:hover:bg-white/[0.08] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>

        <div className="relative">
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-orange to-accent-pink flex items-center justify-center text-sm font-semibold text-white cursor-pointer"
            onClick={() => setProfileOpen(true)}
          >
            {initial}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white/70 dark:border-white/[0.04] bg-accent-success" />
        </div>
      </div>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <NotificationModal open={notifOpen} onClose={() => setNotifOpen(false)} />
      <CalendarModal open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </header>
  )
}