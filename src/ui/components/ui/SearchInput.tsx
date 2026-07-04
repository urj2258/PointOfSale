interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchInput({ value, onChange, placeholder = 'Search...' }: SearchInputProps) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm text-brand-text-primary dark:text-white placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
      />
    </div>
  )
}
