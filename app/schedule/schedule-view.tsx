'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Employee, Role, Schedule, Shift } from '@/types'
import {
  getWeekDays, nextWeek, prevWeek, formatDate,
  formatTime, CALENDAR_START_HOUR, CALENDAR_END_HOUR,
  HOUR_HEIGHT, timeToPixels, getShiftDuration, stringToColor, cn, minutesToTime, timeToMinutes
} from '@/lib/utils'
import { format, isToday } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { TimePicker } from '@/components/ui/time-picker'
import {
  ChevronLeft, ChevronRight, Plus, Eye, EyeOff, Wand2, Pencil, Trash2
} from 'lucide-react'

interface ScheduleViewProps {
  profile: Profile
  roles: Role[]
  employees: Employee[]
}

const hours = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
  (_, i) => CALENDAR_START_HOUR + i
)

const SNAP_MINUTES = 15
const SNAP_PX = (SNAP_MINUTES / 60) * HOUR_HEIGHT

function snapToGrid(px: number): number {
  return Math.round(px / SNAP_PX) * SNAP_PX
}

function pxToTime(px: number): string {
  const totalMinutes = (px / HOUR_HEIGHT) * 60 + CALENDAR_START_HOUR * 60
  const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
  const clamped = Math.max(CALENDAR_START_HOUR * 60, Math.min(CALENDAR_END_HOUR * 60, snapped))
  return minutesToTime(clamped)
}

type DragMode = 'move' | 'resize-top' | 'resize-bottom'

interface DragState {
  shiftId: string
  mode: DragMode
  startY: number
  origTop: number
  origHeight: number
  origStartTime: string
  origEndTime: string
  shiftName: string
  shiftColor: string
  shiftTimeDisplay: string
  // For ghost positioning
  mouseX: number
  mouseY: number
  // Offset from top of shift to where mouse grabbed
  grabOffsetY: number
}

export function ScheduleView({ profile, roles, employees }: ScheduleViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [weekDays, setWeekDays] = useState<Date[]>([])
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')

  const [shiftModal, setShiftModal] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [shiftForm, setShiftForm] = useState({
    employee_id: '',
    role_id: '',
    date: '',
    start_time: '09:00',
    end_time: '17:00',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragPreview, setDragPreview] = useState<{ top: number; height: number } | null>(null)
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  const [overTrash, setOverTrash] = useState(false)
  const [hoveredShiftId, setHoveredShiftId] = useState<string | null>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const didDrag = useRef(false)

  const supabase = createClient()
  const isManager = profile.role === 'manager'

  useEffect(() => {
    setWeekDays(getWeekDays(currentDate))
  }, [currentDate])

  const loadSchedule = useCallback(async () => {
    if (weekDays.length === 0) return
    setLoading(true)

    const weekStart = formatDate(weekDays[0])
    const weekEnd = formatDate(weekDays[6])

    let { data: sched } = await supabase
      .from('schedules')
      .select('*')
      .eq('week_start', weekStart)
      .single()

    if (!sched && isManager) {
      const { data: newSched } = await supabase
        .from('schedules')
        .insert({ week_start: weekStart, week_end: weekEnd, created_by: profile.id })
        .select()
        .single()
      sched = newSched
    }

    setSchedule(sched)

    if (sched) {
      const { data: shiftData } = await supabase
        .from('shifts')
        .select('*, employee:employees(*, profile:profiles(*), role:roles(*)), role:roles(*)')
        .eq('schedule_id', sched.id)
      setShifts(shiftData || [])
    } else {
      setShifts([])
    }

    setLoading(false)
  }, [weekDays, isManager, profile.id, supabase])

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  // --- Drag handlers ---
  const startDrag = (e: React.PointerEvent, shiftId: string, mode: DragMode) => {
    if (!isManager) return
    e.preventDefault()
    e.stopPropagation()

    const shift = shifts.find(s => s.id === shiftId)
    if (!shift) return

    const top = timeToPixels(shift.start_time)
    const height = getShiftDuration(shift.start_time, shift.end_time) * HOUR_HEIGHT
    const empName = shift.employee?.profile?.full_name || 'Unknown'
    const color = stringToColor(shift.employee_id)

    // Calculate grab offset within the shift element
    const shiftEl = (e.target as HTMLElement).closest('[data-shift-id]') as HTMLElement
    const shiftRect = shiftEl?.getBoundingClientRect()
    const grabOffsetY = shiftRect ? e.clientY - shiftRect.top : 0

    didDrag.current = false

    setDrag({
      shiftId,
      mode,
      startY: e.clientY,
      origTop: top,
      origHeight: height,
      origStartTime: shift.start_time,
      origEndTime: shift.end_time,
      shiftName: empName,
      shiftColor: color,
      shiftTimeDisplay: `${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}`,
      mouseX: e.clientX,
      mouseY: e.clientY,
      grabOffsetY,
    })
    setDragPreview({ top, height })
    setGhostPos(mode === 'move' ? { x: e.clientX, y: e.clientY } : null)
  }

  useEffect(() => {
    if (!drag) return

    const onMove = (e: PointerEvent) => {
      const delta = e.clientY - drag.startY

      if (Math.abs(delta) > 3) didDrag.current = true

      // Check if over trash
      if (trashRef.current) {
        const r = trashRef.current.getBoundingClientRect()
        setOverTrash(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)
      }

      const minTop = 0
      const maxBottom = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT

      if (drag.mode === 'move') {
        setGhostPos({ x: e.clientX, y: e.clientY })
        let newTop = snapToGrid(drag.origTop + delta)
        newTop = Math.max(minTop, Math.min(maxBottom - drag.origHeight, newTop))
        setDragPreview({ top: newTop, height: drag.origHeight })
      } else if (drag.mode === 'resize-top') {
        let newTop = snapToGrid(drag.origTop + delta)
        const bottom = drag.origTop + drag.origHeight
        newTop = Math.max(minTop, Math.min(bottom - SNAP_PX, newTop))
        setDragPreview({ top: newTop, height: bottom - newTop })
      } else if (drag.mode === 'resize-bottom') {
        let newHeight = snapToGrid(drag.origHeight + delta)
        newHeight = Math.max(SNAP_PX, Math.min(maxBottom - drag.origTop, newHeight))
        setDragPreview({ top: drag.origTop, height: newHeight })
      }
    }

    const onUp = async () => {
      if (!drag || !dragPreview) {
        setDrag(null)
        setDragPreview(null)
        setGhostPos(null)
        setOverTrash(false)
        return
      }

      if (overTrash) {
        await supabase.from('shifts').delete().eq('id', drag.shiftId)
        setShifts(prev => prev.filter(s => s.id !== drag.shiftId))
      } else if (didDrag.current) {
        const newStartTime = pxToTime(dragPreview.top)
        const newEndTime = pxToTime(dragPreview.top + dragPreview.height)

        if (newStartTime !== drag.origStartTime || newEndTime !== drag.origEndTime) {
          await supabase.from('shifts').update({
            start_time: newStartTime,
            end_time: newEndTime,
          }).eq('id', drag.shiftId)

          setShifts(prev => prev.map(s =>
            s.id === drag.shiftId
              ? { ...s, start_time: newStartTime, end_time: newEndTime }
              : s
          ))
        }
      }

      setDrag(null)
      setDragPreview(null)
      setGhostPos(null)
      setOverTrash(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, dragPreview, overTrash, supabase])

  const openAddShift = (date?: Date) => {
    if (drag) return
    setEditingShift(null)
    setShiftForm({
      employee_id: employees[0]?.id || '',
      role_id: employees[0]?.role_id || '',
      date: date ? formatDate(date) : formatDate(weekDays[0] || new Date()),
      start_time: '09:00',
      end_time: '17:00',
      notes: '',
    })
    setShiftModal(true)
  }

  const openEditShift = (shift: Shift) => {
    if (drag || didDrag.current) return
    setEditingShift(shift)
    setShiftForm({
      employee_id: shift.employee_id,
      role_id: shift.role_id || '',
      date: shift.date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      notes: shift.notes || '',
    })
    setShiftModal(true)
  }

  const saveShift = async () => {
    if (!schedule) return
    setSaving(true)

    const dayOfWeek = new Date(shiftForm.date + 'T12:00:00').getDay()
    const payload = {
      schedule_id: schedule.id,
      employee_id: shiftForm.employee_id,
      role_id: shiftForm.role_id || null,
      date: shiftForm.date,
      day_of_week: dayOfWeek,
      start_time: shiftForm.start_time,
      end_time: shiftForm.end_time,
      notes: shiftForm.notes || null,
    }

    if (editingShift) {
      await supabase.from('shifts').update(payload).eq('id', editingShift.id)
    } else {
      await supabase.from('shifts').insert(payload)
    }

    await loadSchedule()
    setShiftModal(false)
    setSaving(false)
  }

  const deleteShift = async (shiftId: string) => {
    await supabase.from('shifts').delete().eq('id', shiftId)
    setShifts(prev => prev.filter(s => s.id !== shiftId))
    setShiftModal(false)
  }

  const togglePublish = async () => {
    if (!schedule) return
    const { data } = await supabase
      .from('schedules')
      .update({ published: !schedule.published })
      .eq('id', schedule.id)
      .select()
      .single()
    if (data) setSchedule(data)
  }

  const autoGenerate = async () => {
    if (!schedule || !isManager || weekDays.length === 0) return

    const weekStart = formatDate(weekDays[0])
    const weekEnd = formatDate(weekDays[6])
    const employeeIds = employees.map(e => e.id)

    const [availRes, exceptionRes, timeOffRes, hoursRes] = await Promise.all([
      supabase.from('availability').select('*').in('employee_id', employeeIds),
      supabase.from('availability_exceptions').select('*')
        .in('employee_id', employeeIds)
        .gte('date', weekStart).lte('date', weekEnd),
      supabase.from('time_off_requests').select('*')
        .in('employee_id', employeeIds)
        .eq('status', 'approved')
        .lte('start_date', weekEnd).gte('end_date', weekStart),
      supabase.from('store_hours').select('*'),
    ])

    const availability = availRes.data || []
    const exceptions = exceptionRes.data || []
    const timeOff = timeOffRes.data || []
    const storeHours = hoursRes.data || []

    const MIN_SHIFT_MINUTES = 2 * 60   // skip slivers shorter than this
    const TARGET_SHIFT_MINUTES = 8 * 60 // typical full shift
    const SNAP_MIN = 15                 // snap start times to 15-minute grid

    const calStart = CALENDAR_START_HOUR * 60
    const calEnd = CALENDAR_END_HOUR * 60

    type Candidate = { empId: string; windowStart: number; windowEnd: number }
    type DayPlan = {
      storeOpen: number
      storeClose: number
      coverage: boolean[] // one slot per SNAP_MIN inside [storeOpen, storeClose)
      candidates: Candidate[]
    }
    const dayPlans: (DayPlan | null)[] = []

    for (let day = 0; day < 7; day++) {
      const date = weekDays[day]
      const dateStr = formatDate(date)
      const dayOfWeek = date.getDay()
      const storeDay = storeHours.find(h => h.day_of_week === dayOfWeek)
      if (!storeDay || !storeDay.is_open) {
        dayPlans.push(null)
        continue
      }
      const storeOpen = timeToMinutes(storeDay.open_time.slice(0, 5))
      const storeClose = timeToMinutes(storeDay.close_time.slice(0, 5))
      const coverage = new Array(Math.max(0, Math.ceil((storeClose - storeOpen) / SNAP_MIN))).fill(false)

      const candidates: Candidate[] = []
      for (const emp of employees) {
        // Approved time-off blocks the whole date.
        const onTimeOff = timeOff.some(t =>
          t.employee_id === emp.id &&
          t.start_date <= dateStr &&
          t.end_date >= dateStr
        )
        if (onTimeOff) continue

        // Date-specific override beats weekly availability.
        const exception = exceptions.find(
          e => e.employee_id === emp.id && e.date === dateStr
        )
        let availStart: number
        let availEnd: number
        if (exception) {
          if (!exception.is_available) continue
          if (!exception.start_time || !exception.end_time) continue
          availStart = timeToMinutes(exception.start_time.slice(0, 5))
          availEnd = timeToMinutes(exception.end_time.slice(0, 5))
        } else {
          const weekly = availability.find(
            a => a.employee_id === emp.id && a.day_of_week === dayOfWeek
          )
          if (!weekly || !weekly.is_available) continue
          availStart = timeToMinutes(weekly.start_time.slice(0, 5))
          availEnd = timeToMinutes(weekly.end_time.slice(0, 5))
        }

        const windowStart = Math.max(availStart, storeOpen, calStart)
        const windowEnd = Math.min(availEnd, storeClose, calEnd)
        if (windowEnd - windowStart < MIN_SHIFT_MINUTES) continue
        candidates.push({ empId: emp.id, windowStart, windowEnd })
      }
      dayPlans.push({ storeOpen, storeClose, coverage, candidates })
    }

    const hoursByEmp = new Map<string, number>()
    employees.forEach(e => hoursByEmp.set(e.id, 0))
    const maxHoursFor = (empId: string) => {
      const e = employees.find(x => x.id === empId)
      return e?.max_hours_per_week ?? 40
    }

    const newShifts: Array<{
      schedule_id: string
      employee_id: string
      role_id: string | null
      date: string
      day_of_week: number
      start_time: string
      end_time: string
      notes: string | null
    }> = []

    for (let day = 0; day < 7; day++) {
      const plan = dayPlans[day]
      if (!plan) continue
      const date = weekDays[day]
      const dateStr = formatDate(date)
      const dayOfWeek = date.getDay()
      const { storeOpen, coverage, candidates } = plan

      // Order employees by least-scheduled-so-far (balance), with random
      // tiebreaker so equal-hour employees rotate across days.
      const ordered = [...candidates].sort((a, b) => {
        const ha = hoursByEmp.get(a.empId) ?? 0
        const hb = hoursByEmp.get(b.empId) ?? 0
        if (ha !== hb) return ha - hb
        return Math.random() - 0.5
      })

      for (const c of ordered) {
        const scheduled = hoursByEmp.get(c.empId) ?? 0
        const remainingHours = maxHoursFor(c.empId) - scheduled
        if (remainingHours * 60 < MIN_SHIFT_MINUTES) continue // weekly cap reached

        const windowMin = c.windowEnd - c.windowStart
        const lengthMin = Math.min(
          TARGET_SHIFT_MINUTES,
          windowMin,
          Math.floor(remainingHours * 60 / SNAP_MIN) * SNAP_MIN
        )
        if (lengthMin < MIN_SHIFT_MINUTES) continue

        // Pick the start within the employee's window that covers the most
        // currently-uncovered store-open minutes. Random tiebreak avoids
        // repetitive patterns when several positions tie.
        const slack = windowMin - lengthMin
        const numSlots = Math.floor(slack / SNAP_MIN) + 1
        let bestStart = c.windowStart
        let bestScore = -1
        let bestTies = 0
        for (let i = 0; i < numSlots; i++) {
          const start = c.windowStart + i * SNAP_MIN
          const end = start + lengthMin
          const covStart = Math.max(0, Math.floor((start - storeOpen) / SNAP_MIN))
          const covEnd = Math.min(coverage.length, Math.ceil((end - storeOpen) / SNAP_MIN))
          let score = 0
          for (let s = covStart; s < covEnd; s++) if (!coverage[s]) score++
          if (score > bestScore) {
            bestScore = score
            bestStart = start
            bestTies = 1
          } else if (score === bestScore) {
            bestTies++
            if (Math.random() < 1 / bestTies) bestStart = start
          }
        }

        const startMin = bestStart
        const endMin = startMin + lengthMin

        // Mark store-hour coverage for this shift.
        const covStart = Math.max(0, Math.floor((startMin - storeOpen) / SNAP_MIN))
        const covEnd = Math.min(coverage.length, Math.ceil((endMin - storeOpen) / SNAP_MIN))
        for (let s = covStart; s < covEnd; s++) coverage[s] = true

        const emp = employees.find(e => e.id === c.empId)
        newShifts.push({
          schedule_id: schedule.id,
          employee_id: c.empId,
          role_id: emp?.role_id || null,
          date: dateStr,
          day_of_week: dayOfWeek,
          start_time: minutesToTime(startMin),
          end_time: minutesToTime(endMin),
          notes: null,
        })
        hoursByEmp.set(c.empId, scheduled + lengthMin / 60)
      }
    }

    await supabase.from('shifts').delete().eq('schedule_id', schedule.id)
    if (newShifts.length > 0) await supabase.from('shifts').insert(newShifts)
    await loadSchedule()
  }

  const filteredShifts = shifts.filter(s => {
    if (filterRole && s.role_id !== filterRole) return false
    if (filterEmployee && s.employee_id !== filterEmployee) return false
    return true
  })

  const getShiftsForDay = (date: Date) => {
    const dateStr = formatDate(date)
    return filteredShifts.filter(s => s.date === dateStr)
  }

  // Calculate horizontal layout for overlapping shifts (Google Calendar style)
  function getShiftLayout(dayShifts: Shift[]): Map<string, { left: string; width: string; column: number; totalColumns: number }> {
    const layout = new Map<string, { left: string; width: string; column: number; totalColumns: number }>()
    if (dayShifts.length === 0) return layout

    // Sort by start time, then by end time descending
    const sorted = [...dayShifts].sort((a, b) => {
      const aStart = timeToMinutes(a.start_time)
      const bStart = timeToMinutes(b.start_time)
      if (aStart !== bStart) return aStart - bStart
      return timeToMinutes(b.end_time) - timeToMinutes(a.end_time)
    })

    // Assign columns using a greedy algorithm
    const columns: { endTime: number; shiftId: string }[][] = []

    for (const shift of sorted) {
      const startMin = timeToMinutes(shift.start_time)
      const endMin = timeToMinutes(shift.end_time)

      // Find the first column where this shift doesn't overlap
      let placed = false
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1]
        if (lastInCol.endTime <= startMin) {
          columns[col].push({ endTime: endMin, shiftId: shift.id })
          layout.set(shift.id, { left: '', width: '', column: col, totalColumns: 0 })
          placed = true
          break
        }
      }

      if (!placed) {
        columns.push([{ endTime: endMin, shiftId: shift.id }])
        layout.set(shift.id, { left: '', width: '', column: columns.length - 1, totalColumns: 0 })
      }
    }

    const totalCols = columns.length
    const padding = 2 // px padding between columns

    for (const [id, info] of layout) {
      const colWidth = 100 / totalCols
      info.totalColumns = totalCols
      info.left = `calc(${info.column * colWidth}% + ${padding}px)`
      info.width = `calc(${colWidth}% - ${padding * 2}px)`
    }

    return layout
  }


  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a] bg-[#111118]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentDate(prevWeek(currentDate))} className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm font-medium text-[#e8e8f0] hover:bg-[#1a1a24] rounded-lg transition-colors">
              Today
            </button>
            <button onClick={() => setCurrentDate(nextWeek(currentDate))} className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#e8e8f0]">
            {weekDays.length > 0 && `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`}
          </h1>
          {schedule && (
            <Badge color={schedule.published ? '#22c55e' : '#888899'}>
              {schedule.published ? 'Published' : 'Draft'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="text-xs py-1.5 px-2 w-36">
            <option value="">All employees</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.profile?.full_name}</option>
            ))}
          </Select>
          <Select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="text-xs py-1.5 px-2 w-32">
            <option value="">All roles</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
          {isManager && (
            <>
              <Button variant="secondary" size="sm" onClick={autoGenerate}>
                <Wand2 size={13} /> Auto-generate
              </Button>
              <Button variant="secondary" size="sm" onClick={togglePublish}>
                {schedule?.published ? <><EyeOff size={13} /> Unpublish</> : <><Eye size={13} /> Publish</>}
              </Button>
              <Button size="sm" onClick={() => openAddShift()}>
                <Plus size={13} /> Add Shift
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ minWidth: '900px' }}>
          {/* Time axis */}
          <div className="w-14 flex-shrink-0 border-r border-[#2a2a3a] bg-[#111118]">
            <div className="h-12 border-b border-[#2a2a3a]" />
            <div className="relative">
              {hours.map(h => (
                <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2.5 right-2 text-[10px] text-[#888899] select-none">
                    {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${weekDays.length}, 1fr)` }}>
            {weekDays.map((day, idx) => {
              const dayShifts = getShiftsForDay(day)
              const today = isToday(day)

              return (
                <div key={idx} className="border-r border-[#2a2a3a] last:border-r-0">
                  <div className={cn(
                    'h-12 border-b border-[#2a2a3a] flex flex-col items-center justify-center sticky top-0 z-10',
                    today ? 'bg-indigo-500/10' : 'bg-[#111118]'
                  )}>
                    <span className={cn('text-[10px] font-medium uppercase tracking-wider', today ? 'text-indigo-400' : 'text-[#888899]')}>
                      {format(day, 'EEE')}
                    </span>
                    <span className={cn('text-sm font-bold', today ? 'text-indigo-300' : 'text-[#e8e8f0]')}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div
                    className="relative"
                    style={{ height: HOUR_HEIGHT * (CALENDAR_END_HOUR - CALENDAR_START_HOUR) }}
                    onClick={() => isManager && !drag && openAddShift(day)}
                  >
                    {hours.slice(0, -1).map(h => (
                      <div key={h} className="absolute left-0 right-0 border-b border-[#1a1a24]" style={{ top: (h - CALENDAR_START_HOUR) * HOUR_HEIGHT }} />
                    ))}

                    {(() => {
                      const shiftLayout = getShiftLayout(dayShifts)
                      return dayShifts.map(shift => {
                        const isDragging = drag?.shiftId === shift.id
                        const top = isDragging && dragPreview ? dragPreview.top : timeToPixels(shift.start_time)
                        const height = isDragging && dragPreview
                          ? dragPreview.height
                          : Math.max(getShiftDuration(shift.start_time, shift.end_time) * HOUR_HEIGHT, 24)
                        const empName = shift.employee?.profile?.full_name || 'Unknown'
                        const color = stringToColor(shift.employee_id)
                        const layout = shiftLayout.get(shift.id)
                        const isHovered = hoveredShiftId === shift.id

                        const displayStart = isDragging && dragPreview ? pxToTime(dragPreview.top) : shift.start_time
                        const displayEnd = isDragging && dragPreview ? pxToTime(dragPreview.top + dragPreview.height) : shift.end_time

                        return (
                          <div
                            key={shift.id}
                            data-shift-id={shift.id}
                            className={cn(
                              'absolute rounded-md overflow-hidden transition-shadow',
                              isDragging && drag?.mode === 'move' ? 'opacity-30' : 'hover:brightness-110 hover:shadow-lg',
                            )}
                            style={{
                              top,
                              height,
                              left: layout?.left ?? '2px',
                              width: layout?.width ?? 'calc(100% - 4px)',
                              backgroundColor: `${color}22`,
                              borderLeft: `3px solid ${color}`,
                              zIndex: isDragging ? 50 : isHovered ? 40 : (layout?.column ?? 0) + 1,
                            }}
                            onMouseEnter={() => !drag && setHoveredShiftId(shift.id)}
                            onMouseLeave={() => setHoveredShiftId(null)}
                          >
                            {/* Resize top handle */}
                            {isManager && (
                              <div
                                className="absolute top-0 left-0 right-0 h-2 cursor-n-resize z-20 group"
                                onPointerDown={e => startDrag(e, shift.id, 'resize-top')}
                              >
                                <div className="w-6 h-0.5 bg-white/0 group-hover:bg-white/40 rounded-full mx-auto mt-0.5 transition-colors" />
                              </div>
                            )}

                            {/* Main body — entire thing is draggable */}
                            <div
                              className={cn('px-1.5 py-1 select-none h-full', isManager && 'cursor-grab active:cursor-grabbing')}
                              onPointerDown={isManager ? e => startDrag(e, shift.id, 'move') : undefined}
                              onClick={e => {
                                e.stopPropagation()
                                if (!didDrag.current) openEditShift(shift)
                              }}
                            >
                              <div className="text-[10px] font-semibold truncate mt-0.5" style={{ color }}>
                                {empName}
                              </div>
                              <div className="text-[10px] text-[#888899] truncate">
                                {formatTime(displayStart)} – {formatTime(displayEnd)}
                              </div>
                              {shift.role && height > 40 && (
                                <div className="text-[9px] truncate mt-0.5" style={{ color: `${color}cc` }}>
                                  {shift.role.name}
                                </div>
                              )}
                            </div>

                            {/* Resize bottom handle */}
                            {isManager && (
                              <div
                                className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize z-20 group"
                                onPointerDown={e => startDrag(e, shift.id, 'resize-bottom')}
                              >
                                <div className="w-6 h-0.5 bg-white/0 group-hover:bg-white/40 rounded-full mx-auto mb-0.5 transition-colors" />
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Floating ghost — follows cursor like dragging a file */}
      {drag && drag.mode === 'move' && ghostPos && (
        <div
          className="fixed pointer-events-none z-[100]"
          style={{
            left: ghostPos.x - 60,
            top: ghostPos.y - 16,
            opacity: overTrash ? 0.4 : 0.9,
            transform: overTrash ? 'scale(0.8)' : 'scale(1)',
            transition: 'opacity 150ms, transform 150ms',
          }}
        >
          <div
            className="rounded-lg px-3 py-2 shadow-2xl border backdrop-blur-sm min-w-[120px]"
            style={{
              backgroundColor: `${drag.shiftColor}33`,
              borderColor: drag.shiftColor,
              boxShadow: `0 8px 32px ${drag.shiftColor}22`,
            }}
          >
            <div className="text-xs font-semibold truncate" style={{ color: drag.shiftColor }}>
              {drag.shiftName}
            </div>
            <div className="text-[10px] text-[#888899] truncate">
              {dragPreview
                ? `${formatTime(pxToTime(dragPreview.top))} – ${formatTime(pxToTime(dragPreview.top + dragPreview.height))}`
                : drag.shiftTimeDisplay}
            </div>
          </div>
        </div>
      )}

      {/* Trash drop zone */}
      {drag && (
        <div
          ref={trashRef}
          className={cn(
            'absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-8 py-4 rounded-2xl border-2 border-dashed transition-all duration-200',
            overTrash
              ? 'bg-red-500/20 border-red-400 text-red-300 scale-110 shadow-lg shadow-red-500/20'
              : 'bg-[#111118]/90 border-[#2a2a3a] text-[#888899] backdrop-blur-sm'
          )}
        >
          <Trash2 size={20} className={overTrash ? 'animate-bounce' : ''} />
          <span className="text-sm font-medium">
            {overTrash ? 'Release to delete' : 'Drop here to delete'}
          </span>
        </div>
      )}

      {/* Shift Modal */}
      <Modal open={shiftModal} onClose={() => setShiftModal(false)} title={editingShift ? 'Edit Shift' : 'Add Shift'}>
        <div className="space-y-4">
          <Select
            label="Employee"
            value={shiftForm.employee_id}
            onChange={e => {
              const empId = e.target.value
              const emp = employees.find(emp => emp.id === empId)
              setShiftForm(f => ({ ...f, employee_id: empId, role_id: emp?.role_id || '' }))
            }}
          >
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.profile?.full_name}</option>
            ))}
          </Select>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#e8e8f0]">Role</label>
            <div className="px-3 py-2 text-sm rounded-lg border bg-[#0a0a0f] border-[#2a2a3a] text-[#888899]">
              {roles.find(r => r.id === shiftForm.role_id)?.name || 'No role assigned'}
            </div>
          </div>

          <Input
            label="Date"
            type="date"
            value={shiftForm.date}
            onChange={e => setShiftForm(f => ({ ...f, date: e.target.value }))}
          />

          <div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <TimePicker label="Start Time" value={shiftForm.start_time} onChange={v => setShiftForm(f => ({ ...f, start_time: v }))} />
              <span className="pb-2.5 text-sm text-[#888899] font-medium">to</span>
              <TimePicker label="End Time" value={shiftForm.end_time} onChange={v => setShiftForm(f => ({ ...f, end_time: v }))} />
            </div>
          </div>

          <Input
            label="Notes (optional)"
            placeholder="Any special notes..."
            value={shiftForm.notes}
            onChange={e => setShiftForm(f => ({ ...f, notes: e.target.value }))}
          />

          <div className="flex gap-2 pt-2">
            {editingShift && (
              <Button variant="danger" size="sm" onClick={() => deleteShift(editingShift.id)}>
                <Trash2 size={13} /> Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="secondary" size="sm" onClick={() => setShiftModal(false)}>Cancel</Button>
            <Button size="sm" onClick={saveShift} loading={saving}>
              {editingShift ? <><Pencil size={13} /> Update</> : <><Plus size={13} /> Add</>}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
