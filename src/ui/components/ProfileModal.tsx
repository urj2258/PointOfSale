import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ProfileModal({ open, onClose }: Props) {
  const { currentUser, logout } = useAuth()

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
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      {/* Invisible backdrop for closing, optional very subtle tint */}
      <div className="absolute inset-0 bg-black/[0.02] dark:bg-black/[0.15]" />

      <div
        className="absolute top-[70px] right-6 w-72 rounded-2xl border border-white/50 dark:border-white/[0.08] bg-white/90 dark:bg-[#1a1d21]/75 backdrop-blur-xl shadow-2xl p-5 hover:border-white/70 dark:hover:border-white/[0.12] transition-all duration-300 animate-in fade-in slide-in-from-top-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-orange to-accent-pink flex items-center justify-center text-lg font-bold text-white shadow-md shrink-0">
            {currentUser?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="text-left min-w-0">
            <h3 className="text-sm font-semibold text-brand-text-primary leading-tight truncate">
              {currentUser?.full_name || 'User'}
            </h3>
            <p className="text-xs text-brand-text-muted truncate">
              @{currentUser?.username || 'username'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/[0.02] border border-[#D1D5DB] dark:border-white/[0.04] text-left">
            <svg className="w-4 h-4 text-brand-text-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-text-muted leading-none mb-0.5">Role</p>
              <p className="text-xs font-semibold text-brand-text-secondary">Administrator</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/[0.02] border border-[#D1D5DB] dark:border-white/[0.04] text-left">
            <svg className="w-4 h-4 text-brand-text-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-text-muted leading-none mb-0.5">Email</p>
              <p className="text-xs font-semibold text-brand-text-secondary truncate">{currentUser?.email || 'user@posits.app'}</p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full mt-4 py-2 rounded-xl border border-red-200/60 dark:border-red-900/20 text-red-500 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>,
    document.body
  )
}

