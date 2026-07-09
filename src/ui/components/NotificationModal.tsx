import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNotifications, type AppNotification } from '../context/NotificationContext'

interface Props {
  open: boolean
  onClose: () => void
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  return `${days} day ago`
}

export default function NotificationModal({ open, onClose }: Props) {
  const { notifications } = useNotifications()

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-end p-4 pt-16 sm:pt-20 sm:pr-8" onClick={onClose}>
      <div className="absolute inset-0" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/40 dark:border-white/[0.12] bg-white/80 dark:bg-[#1a1d21]/80 backdrop-blur-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 dark:border-white/[0.06]">
          <h2 className="text-base font-semibold text-brand-text-primary">
            Notifications
            {notifications.length > 0 && (
              <span className="ml-2 text-xs font-normal text-brand-text-muted">({notifications.length})</span>
            )}
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-brand-text-muted hover:text-brand-text-primary hover:bg-white/30 dark:hover:bg-white/[0.08] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-brand-text-muted">
              No notifications yet
            </div>
          ) : (
            notifications.slice(0, 5).map((n: AppNotification) => (
              <div key={n.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors cursor-pointer border-b border-white/10 dark:border-white/[0.04] last:border-0">
                <div className={`w-8 h-8 rounded-full bg-${n.color}/20 flex items-center justify-center shrink-0 mt-0.5`}>
                  <div className={`w-2 h-2 rounded-full bg-${n.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-text-primary">{n.title}</p>
                  <p className="text-xs text-brand-text-muted mt-0.5 whitespace-pre-wrap break-words">{n.desc}</p>
                  <p className="text-[10px] text-brand-text-muted/60 mt-1">{relativeTime(n.timestamp)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}