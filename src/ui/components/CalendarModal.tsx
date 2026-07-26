import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarModal({ open, onClose }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = now.getDate()

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-end p-4 pt-16 sm:pt-20 sm:pr-8" onClick={onClose}>
      <div className="absolute inset-0" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/40 dark:border-white/[0.12] bg-white/80 dark:bg-[#1a1d21]/80 backdrop-blur-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 dark:border-white/[0.06]">
          <h2 className="text-base font-semibold text-brand-text-primary">Calendar</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-brand-text-muted hover:text-brand-text-primary hover:bg-white/30 dark:hover:bg-white/[0.08] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-full text-brand-text-muted hover:text-brand-text-primary hover:bg-white/30 dark:hover:bg-white/[0.08] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span className="text-sm font-semibold text-brand-text-primary">{months[month]} {year}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-full text-brand-text-muted hover:text-brand-text-primary hover:bg-white/30 dark:hover:bg-white/[0.08] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((d) => (
              <div key={d} className="text-[10px] font-semibold text-brand-text-muted uppercase py-1">{d.slice(0, 2)}</div>
            ))}
            {cells.map((d, i) => (
              <div
                key={i}
                className={`py-1.5 text-sm rounded-full transition-colors ${
                  d === null ? '' :
                  d === today && month === now.getMonth() && year === now.getFullYear()
                    ? 'bg-[#6B7280] text-white font-semibold'
                    : 'text-brand-text-secondary hover:bg-white/30 dark:hover:bg-white/[0.06]'
                }`}
              >
                {d ?? ''}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
