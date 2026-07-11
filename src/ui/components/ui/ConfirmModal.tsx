import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  danger?: boolean
  icon?: ReactNode
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  danger = false,
  icon,
}: ConfirmModalProps) {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-modal-backdrop"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-sm mx-4 bg-white dark:bg-[#1a1d21] rounded-2xl shadow-2xl border border-white/20 dark:border-white/[0.08] overflow-hidden animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            {icon ?? (
              <div className="w-10 h-10 rounded-full bg-accent-warning/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5B948" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-brand-text-primary">{title}</h3>
            </div>
          </div>

          <p className="text-sm text-brand-text-secondary leading-relaxed mb-6 pl-14">
            {message}
          </p>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-brand-text-muted hover:text-brand-text-primary rounded-xl hover:bg-white/30 dark:hover:bg-white/[0.08] transition-all duration-200 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 ${danger ? 'text-white bg-red-500 hover:bg-red-600' : 'text-gray-900 bg-brand-primary hover:opacity-90'}`}
            >
              {loading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
