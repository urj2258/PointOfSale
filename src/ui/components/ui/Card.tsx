import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-brand-card dark:bg-white/[0.04] border-brand-border dark:border-white/[0.06] shadow-[0_16px_48px_-12px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.3)] transition-all duration-300 p-5 ${className}`}
    >
      {children}
    </div>
  )
}
