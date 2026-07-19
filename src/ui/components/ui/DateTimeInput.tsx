import { forwardRef, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

function parseDisplayDatetime(dt: string): Date | null {
  if (!dt) return null
  const [datePart, timePart] = dt.split(' ')
  const parts = datePart.split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts.map((p) => p.trim())
  if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return null
  const time = timePart || '00:00'
  const date = new Date(`${yyyy}-${mm}-${dd}T${time}`)
  if (isNaN(date.getTime())) return null
  return date
}

function formatDisplayDatetime(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
}

function nowDisplayDatetime(): string {
  return formatDisplayDatetime(new Date())
}

interface DateTimeInputProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
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
CustomInput.displayName = 'DateTimeInputCustom'

export default function DateTimeInput({ value, onChange, placeholder = 'dd/mm/yyyy HH:MM', className = '' }: DateTimeInputProps) {
  useEffect(() => {
    if (!value) {
      onChange(nowDisplayDatetime())
    }
  }, [])

  return (
    <DatePicker
      selected={parseDisplayDatetime(value)}
      onChange={(date: Date | null) => onChange(date ? formatDisplayDatetime(date) : '')}
      showTimeSelect
      timeFormat="HH:mm"
      timeIntervals={15}
      dateFormat="dd/MM/yyyy HH:mm"
      placeholderText={placeholder}
      className={className}
      customInput={<CustomInput className={className} />}
      portalId="root-portal"
    />
  )
}
