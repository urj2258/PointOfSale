import { useState, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export default function PasswordInput({ label, className = '', ...props }: Props) {
  const [show, setShow] = useState(false)

  return (
    <div>
      {label && <label className="block text-sm font-medium text-brand-text-secondary mb-1">{label}</label>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={`w-full px-4 py-2.5 pr-11 rounded-input bg-white/20 dark:bg-white/[0.08] border border-white/40 dark:border-white/[0.12] text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary focus:bg-white/30 dark:focus:bg-white/[0.12] transition-colors caret-brand-primary ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text-primary transition-colors"
          tabIndex={-1}
        >
          {show ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
