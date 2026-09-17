import { type InputHTMLAttributes } from 'react'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  touched?: boolean
}

export default function FormField({
  label,
  error,
  touched,
  className,
  ...props
}: FormFieldProps) {
  const isError = touched && error
  
  const baseInputClass = `w-full px-3 py-2 rounded-xl border text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 ${className || ''}`
  
  const stateClass = isError
    ? 'border-red-400 focus:ring-red-400/40 bg-red-50 dark:bg-red-900/10'
    : 'border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] focus:ring-brand-primary/40'

  return (
    <div>
      <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">
        {label}
      </label>
      <input className={`${baseInputClass} ${stateClass}`} {...props} />
      {isError && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
