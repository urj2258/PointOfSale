import { forwardRef } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

function parseDisplayDate(d: string): Date | null {
  const parts = d.split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts.map((p) => p.trim())
  if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return null
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (isNaN(date.getTime())) return null
  return date
}

function formatDisplayDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

interface DateInputProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  maxDate?: Date
  minDate?: Date
}

const CustomInput = forwardRef<HTMLInputElement, { value?: string; onClick?: () => void; placeholder?: string; className?: string }>(
  ({ value, onClick, placeholder, className }, ref) => (
    <input
      ref={ref}
      type="text"
      readOnly
      value={value}
      onClick={onClick}
      placeholder={placeholder}
      className={className}
    />
  )
)
CustomInput.displayName = 'DateInputCustom'

export default function DateInput({ value, onChange, placeholder = 'dd/mm/yyyy', className = '', maxDate, minDate }: DateInputProps) {
  return (
    <DatePicker
      selected={parseDisplayDate(value)}
      onChange={(date) => onChange(date ? formatDisplayDate(date) : '')}
      dateFormat="dd/MM/yyyy"
      placeholderText={placeholder}
      maxDate={maxDate}
      minDate={minDate}
      className={className}
      customInput={<CustomInput className={className} />}
      portalId="root-portal"
    />
  )
}
