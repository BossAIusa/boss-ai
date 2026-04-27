'use client'
import { cn } from '@/lib/utils'

interface TimePickerProps {
  label?: string
  value: string // HH:MM (24h format)
  onChange: (value: string) => void
}

function to12Hour(time24: string): { hour: string; minute: string; period: 'AM' | 'PM' } {
  const [h, m] = time24.split(':').map(Number)
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return { hour: String(hour), minute: String(m).padStart(2, '0'), period }
}

function to24Hour(hour: string, minute: string, period: 'AM' | 'PM'): string {
  let h = parseInt(hour)
  if (period === 'AM' && h === 12) h = 0
  else if (period === 'PM' && h !== 12) h += 12
  return `${String(h).padStart(2, '0')}:${minute}`
}

const selectClass = cn(
  'px-1.5 py-2 text-xs rounded-lg border outline-none transition-all cursor-pointer appearance-none text-center',
  'bg-[#1a1a24] border-[#2a2a3a] text-[#e8e8f0]',
  'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30'
)

export function TimePicker({ label, value, onChange }: TimePickerProps) {
  const { hour, minute, period } = to12Hour(value)

  const update = (newHour?: string, newMinute?: string, newPeriod?: 'AM' | 'PM') => {
    onChange(to24Hour(
      newHour ?? hour,
      newMinute ?? minute,
      newPeriod ?? period
    ))
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#e8e8f0]">{label}</label>}
      <div className="flex items-center gap-1.5">
        {/* Hour */}
        <select
          value={hour}
          onChange={e => update(e.target.value, undefined, undefined)}
          className={cn(selectClass, 'w-[48px]')}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
            <option key={h} value={String(h)}>{h}</option>
          ))}
        </select>

        <span className="text-[#888899] font-bold text-xs">:</span>

        {/* Minute */}
        <select
          value={minute}
          onChange={e => update(undefined, e.target.value, undefined)}
          className={cn(selectClass, 'w-[48px]')}
        >
          {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* AM/PM */}
        <select
          value={period}
          onChange={e => update(undefined, undefined, e.target.value as 'AM' | 'PM')}
          className={cn(selectClass, 'w-[52px]')}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  )
}
