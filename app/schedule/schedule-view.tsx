'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Employee, Role, Schedule, Shift } from '@/types'
import {
  getWeekDays, nextWeek, prevWeek, formatDate,
  formatTime, CALENDAR_START_HOUR, CALENDAR_END_HOUR,
  HOUR_HEIGHT, timeToPixels, getShiftDuration, stringToColor, cn, minutesToTime, timeToMinutes, getInitials
} from '@/lib/utils'
import { format, isToday, parseISO, isValid, addDays } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { TimePicker } from '@/components/ui/time-picker'
import { Tooltip } from '@/components/ui/tooltip'
import { AIChatPanel } from '@/components/ai-chat-panel'
import {
  ChevronLeft, ChevronRight, Plus, Eye, EyeOff, Wand2, Pencil, Trash2,
  CheckCircle, AlertCircle, TriangleAlert, Undo2, Redo2, Copy, MoreHorizontal
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
  const searchParams = useSearchParams()
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (!dateParam) return
    const parsed = parseISO(dateParam)
    if (isValid(parsed)) setCurrentDate(parsed)
  }, [searchParams])
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

  const [autoGenerating, setAutoGenerating] = useState(false)
  const [copyingLastWeek, setCopyingLastWeek] = useState(false)
  const [confirmCopyOpen, setConfirmCopyOpen] = useState(false)
  const [copyDayMenu, setCopyDayMenu] = useState<{ sourceIdx: number; stage: 'menu' | 'picker' } | null>(null)
  const [copyingDay, setCopyingDay] = useState(false)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'warning'; message: string } | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const [history, setHistory] = useState<{ past: Shift[][]; future: Shift[][] }>({ past: [], future: [] })
  const shiftsRef = useRef<Shift[]>([])
  useEffect(() => { shiftsRef.current = shifts }, [shifts])

  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragPreview, setDragPreview] = useState<{ top: number; height: number } | null>(null)
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  const [overTrash, setOverTrash] = useState(false)
  const [hoveredShiftId, setHoveredShiftId] = useState<string | null>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const didDrag = useRef(false)

  const supabase = createClient()
  const isManager = profile.role === 'manager' || profile.role === 'admin_manager'

  useEffect(() => {
    setWeekDays(getWeekDays(currentDate))
  }, [currentDate])

  useEffect(() => {
    if (!toast) return
    const enter = requestAnimationFrame(() => setToastVisible(true))
    const hideTimer = setTimeout(() => setToastVisible(false), 4000)
    const clearTimer = setTimeout(() => setToast(null), 4300)
    return () => {
      cancelAnimationFrame(enter)
      clearTimeout(hideTimer)
      clearTimeout(clearTimer)
    }
  }, [toast])

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
        pushHistory()
        await supabase.from('shifts').delete().eq('id', drag.shiftId)
        setShifts(prev => prev.filter(s => s.id !== drag.shiftId))
      } else if (didDrag.current) {
        const newStartTime = pxToTime(dragPreview.top)
        const newEndTime = pxToTime(dragPreview.top + dragPreview.height)

        if (newStartTime !== drag.origStartTime || newEndTime !== drag.origEndTime) {
          pushHistory()
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

    pushHistory()
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
    pushHistory()
    await supabase.from('shifts').delete().eq('id', shiftId)
    setShifts(prev => prev.filter(s => s.id !== shiftId))
    setShiftModal(false)
  }

  const pushHistory = () => {
    setHistory(h => ({ past: [...h.past, shiftsRef.current], future: [] }))
  }

  const applySnapshot = async (target: Shift[]) => {
    if (!schedule) return
    await supabase.from('shifts').delete().eq('schedule_id', schedule.id)
    if (target.length > 0) {
      const rows = target.map(s => ({
        schedule_id: schedule.id,
        employee_id: s.employee_id,
        role_id: s.role_id || null,
        date: s.date,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        notes: s.notes || null,
      }))
      await supabase.from('shifts').insert(rows)
    }
    await loadSchedule()
  }

  const undo = async () => {
    if (history.past.length === 0 || drag) return
    const prev = history.past[history.past.length - 1]
    const current = shiftsRef.current
    setHistory(h => ({ past: h.past.slice(0, -1), future: [current, ...h.future] }))
    setShiftModal(false)
    await applySnapshot(prev)
  }

  const redo = async () => {
    if (history.future.length === 0 || drag) return
    const next = history.future[0]
    const current = shiftsRef.current
    setHistory(h => ({ past: [...h.past, current], future: h.future.slice(1) }))
    setShiftModal(false)
    await applySnapshot(next)
  }

  // Clear history when switching weeks/schedules so undo doesn't apply a snapshot to the wrong week.
  useEffect(() => {
    setHistory({ past: [], future: [] })
  }, [schedule?.id])

  const copyDayShifts = async (sourceDay: Date, targetDay: Date) => {
    if (!schedule || !isManager || copyingDay) return

    const sourceDateStr = formatDate(sourceDay)
    const targetDateStr = formatDate(targetDay)
    const targetDayOfWeek = targetDay.getDay()
    const sourceShifts = shifts.filter(s => s.date === sourceDateStr)

    setCopyDayMenu(null)

    if (sourceShifts.length === 0) {
      setToastVisible(false)
      setToast({
        kind: 'warning',
        message: `No shifts on ${format(sourceDay, 'EEEE')} to copy`,
      })
      return
    }

    setCopyingDay(true)
    try {
      pushHistory()
      const rows = sourceShifts.map(s => ({
        schedule_id: schedule.id,
        employee_id: s.employee_id,
        role_id: s.role_id || null,
        date: targetDateStr,
        day_of_week: targetDayOfWeek,
        start_time: s.start_time,
        end_time: s.end_time,
        notes: s.notes || null,
      }))
      await supabase.from('shifts').insert(rows)
      await loadSchedule()

      setToastVisible(false)
      setToast({
        kind: 'success',
        message: `Copied ${rows.length} shifts to ${format(targetDay, 'EEEE')}`,
      })
    } finally {
      setCopyingDay(false)
    }
  }

  // Close the day-copy menu when clicking anywhere else.
  useEffect(() => {
    if (!copyDayMenu) return
    const onDocClick = () => setCopyDayMenu(null)
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('click', onDocClick)
    }
  }, [copyDayMenu])

  const copyFromLastWeek = async (force = false) => {
    if (!schedule || !isManager || weekDays.length === 0 || copyingLastWeek) return

    if (!force && shifts.length > 0) {
      setConfirmCopyOpen(true)
      return
    }

    setCopyingLastWeek(true)
    try {
      const lastWeekStart = formatDate(addDays(weekDays[0], -7))

      const { data: lastSched } = await supabase
        .from('schedules')
        .select('id')
        .eq('week_start', lastWeekStart)
        .maybeSingle()

      let lastShifts: Shift[] | null = null
      if (lastSched) {
        const { data } = await supabase
          .from('shifts')
          .select('*')
          .eq('schedule_id', lastSched.id)
        lastShifts = data
      }

      if (!lastShifts || lastShifts.length === 0) {
        setToastVisible(false)
        setToast({ kind: 'warning', message: 'No shifts found for last week' })
        return
      }

      pushHistory()

      const newRows = lastShifts.map(s => {
        const newDate = formatDate(addDays(parseISO(s.date), 7))
        const dayOfWeek = new Date(newDate + 'T12:00:00').getDay()
        return {
          schedule_id: schedule.id,
          employee_id: s.employee_id,
          role_id: s.role_id || null,
          date: newDate,
          day_of_week: dayOfWeek,
          start_time: s.start_time,
          end_time: s.end_time,
          notes: s.notes || null,
        }
      })

      await supabase.from('shifts').insert(newRows)
      await loadSchedule()

      setToastVisible(false)
      setToast({ kind: 'success', message: `Copied ${newRows.length} shifts from last week` })
    } finally {
      setCopyingLastWeek(false)
    }
  }

  const togglePublish = async () => {
    if (!schedule) return
    // Unpublishing: skip the confirmation, no notifications.
    if (schedule.published) {
      const { data } = await supabase
        .from('schedules')
        .update({ published: false })
        .eq('id', schedule.id)
        .select()
        .single()
      if (data) setSchedule(data)
      return
    }
    // Publishing: open confirmation modal.
    setPublishConfirmOpen(true)
  }

  const confirmPublish = async () => {
    if (!schedule || publishing) return
    setPublishing(true)
    try {
      const { data } = await supabase
        .from('schedules')
        .update({ published: true })
        .eq('id', schedule.id)
        .select()
        .single()
      if (data) setSchedule(data)

      let notified = 0
      try {
        const res = await fetch('/api/notify-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedule_id: schedule.id }),
        })
        if (res.ok) {
          const json = await res.json()
          notified = json.notified ?? 0
        }
      } catch {
        // Notification failure shouldn't roll back the publish.
      }

      setPublishConfirmOpen(false)
      setToastVisible(false)
      setToast({
        kind: 'success',
        message: `Schedule published — ${notified} ${notified === 1 ? 'employee' : 'employees'} notified`,
      })
    } finally {
      setPublishing(false)
    }
  }

  const autoGenerate = async () => {
    if (!schedule || !isManager || weekDays.length === 0 || autoGenerating) return
    setAutoGenerating(true)
    pushHistory()
    try {

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

    const employeeCount = new Set(newShifts.map(s => s.employee_id)).size
    setToastVisible(false)
    setToast(
      newShifts.length === 0
        ? { kind: 'warning', message: 'No shifts generated — check employee availability and store hours' }
        : { kind: 'success', message: `Schedule generated — ${newShifts.length} shifts created for ${employeeCount} employees` }
    )
    } finally {
      setAutoGenerating(false)
    }
  }

  const shiftConflict = (() => {
    if (!shiftModal || !shiftForm.employee_id || !shiftForm.date) return null
    const conflict = shifts.find(s =>
      s.id !== editingShift?.id &&
      s.employee_id === shiftForm.employee_id &&
      s.date === shiftForm.date &&
      s.start_time < shiftForm.end_time &&
      s.end_time > shiftForm.start_time
    )
    if (!conflict) return null
    const empName = employees.find(e => e.id === conflict.employee_id)?.profile?.full_name || 'This employee'
    return { empName, start: conflict.start_time, end: conflict.end_time }
  })()

  const overtimeWarning = (() => {
    if (!shiftModal || !shiftForm.employee_id || weekDays.length === 0) return null
    const emp = employees.find(e => e.id === shiftForm.employee_id)
    if (!emp) return null
    const max = emp.max_hours_per_week ?? 40
    const weekStart = formatDate(weekDays[0])
    const weekEnd = formatDate(weekDays[6])

    const existing = shifts
      .filter(s =>
        s.employee_id === shiftForm.employee_id &&
        s.id !== editingShift?.id &&
        s.date >= weekStart &&
        s.date <= weekEnd
      )
      .reduce((sum, s) => sum + getShiftDuration(s.start_time, s.end_time), 0)

    const modalDuration = shiftForm.start_time < shiftForm.end_time
      ? getShiftDuration(shiftForm.start_time, shiftForm.end_time)
      : 0

    const total = existing + modalDuration
    const empName = emp.profile?.full_name || 'This employee'

    if (total > max) return { kind: 'over' as const, total, max, empName }
    if (total === max) return { kind: 'at' as const, total, max, empName }
    if (max - total <= 2) return { kind: 'near' as const, total, max, empName }
    return null
  })()

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

  // Cycle Mon→Tue→…→Sun→Mon (per spec: past Sunday wraps to Monday).
  const cycleIdx = (d: Date) => (d.getDay() + 6) % 7
  const goToRelativeDay = (delta: number) => {
    if (!selectedDay || weekDays.length === 0) return
    const targetIdx = (cycleIdx(selectedDay) + delta + 7) % 7
    const target = weekDays.find(d => cycleIdx(d) === targetIdx)
    if (target) setSelectedDay(target)
  }

  const renderDaySlots = (day: Date, isDetail: boolean) => {
    const dayShifts = getShiftsForDay(day)
    const shiftLayout = getShiftLayout(dayShifts)
    const nameClass = isDetail ? 'text-[13px]' : 'text-[10px]'
    const timeClass = isDetail ? 'text-[12px]' : 'text-[10px]'
    const roleClass = isDetail ? 'text-[11px]' : 'text-[9px]'

    return (
      <div
        className="relative"
        style={{ height: HOUR_HEIGHT * (CALENDAR_END_HOUR - CALENDAR_START_HOUR) }}
        onClick={() => isManager && !drag && openAddShift(day)}
      >
        {hours.slice(0, -1).map(h => (
          <div key={h} className="absolute left-0 right-0 border-b border-[#1a1a24]" style={{ top: (h - CALENDAR_START_HOUR) * HOUR_HEIGHT }} />
        ))}

        {dayShifts.map(shift => {
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
                borderLeft: `${isDetail ? 4 : 3}px solid ${color}`,
                zIndex: isDragging ? 50 : isHovered ? 40 : (layout?.column ?? 0) + 1,
              }}
              onMouseEnter={() => !drag && setHoveredShiftId(shift.id)}
              onMouseLeave={() => setHoveredShiftId(null)}
            >
              {isManager && (
                <div
                  className="absolute top-0 left-0 right-0 h-2 cursor-n-resize z-20 group"
                  onPointerDown={e => startDrag(e, shift.id, 'resize-top')}
                >
                  <div className="w-6 h-0.5 bg-white/0 group-hover:bg-white/40 rounded-full mx-auto mt-0.5 transition-colors" />
                </div>
              )}

              <div
                className={cn(
                  'select-none h-full',
                  isDetail ? 'px-3 py-2' : 'px-1.5 py-1',
                  isManager && 'cursor-grab active:cursor-grabbing',
                )}
                onPointerDown={isManager ? e => startDrag(e, shift.id, 'move') : undefined}
                onClick={e => {
                  e.stopPropagation()
                  if (!didDrag.current) openEditShift(shift)
                }}
              >
                <div className={cn('font-semibold truncate mt-0.5', nameClass)} style={{ color }}>
                  {empName}
                </div>
                <div className={cn('text-[#888899] truncate', timeClass)}>
                  {formatTime(displayStart)} – {formatTime(displayEnd)}
                </div>
                {shift.role && height > 40 && (
                  <div className={cn('truncate mt-0.5', roleClass)} style={{ color: `${color}cc` }}>
                    {shift.role.name}
                  </div>
                )}
                {isDetail && shift.notes && height > 80 && (
                  <div className="text-[11px] text-[#888899] truncate mt-1.5 italic">
                    {shift.notes}
                  </div>
                )}
              </div>

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
        })}
      </div>
    )
  }


  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a] bg-[#111118]">
        <div className="flex items-center gap-4">
          {selectedDay ? (
            <>
              <button
                onClick={() => setSelectedDay(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors text-sm font-medium"
              >
                <ChevronLeft size={14} /> Back to week
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToRelativeDay(-1)}
                  className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors"
                  title="Previous day"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => goToRelativeDay(1)}
                  className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors"
                  title="Next day"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <h1 className="text-base font-semibold text-[#e8e8f0]">
                {format(selectedDay, 'EEEE, MMMM d')}
              </h1>
              {schedule && (
                <Badge color={schedule.published ? '#22c55e' : '#888899'}>
                  {schedule.published ? 'Published' : 'Draft'}
                </Badge>
              )}
            </>
          ) : (
            <>
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
            </>
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
              <div className="flex items-center gap-0.5">
                <Tooltip label="Undo">
                  <button
                    onClick={undo}
                    disabled={history.past.length === 0 || !!drag || autoGenerating}
                    aria-label="Undo"
                    className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#888899]"
                  >
                    <Undo2 size={15} />
                  </button>
                </Tooltip>
                <Tooltip label="Redo">
                  <button
                    onClick={redo}
                    disabled={history.future.length === 0 || !!drag || autoGenerating}
                    aria-label="Redo"
                    className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#888899]"
                  >
                    <Redo2 size={15} />
                  </button>
                </Tooltip>
              </div>
              <Button variant="secondary" size="sm" onClick={autoGenerate} loading={autoGenerating}>
                {!autoGenerating && <Wand2 size={13} />} Auto-generate
              </Button>
              <Tooltip label="Copy from last week">
                <button
                  onClick={() => copyFromLastWeek()}
                  disabled={copyingLastWeek || autoGenerating}
                  aria-label="Copy from last week"
                  className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#888899]"
                >
                  <Copy size={15} />
                </button>
              </Tooltip>
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
      <div
        key={selectedDay ? `detail-${formatDate(selectedDay)}` : 'week'}
        className="flex-1 overflow-auto animate-day-detail-fade"
      >
        {selectedDay ? (
          <div className="flex" style={{ minWidth: '600px' }}>
            {/* Time axis */}
            <div className="w-14 flex-shrink-0 border-r border-[#2a2a3a] bg-[#111118]">
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

            {/* Single full-width day */}
            <div className="flex-1">
              {renderDaySlots(selectedDay, true)}
            </div>
          </div>
        ) : (
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
                const today = isToday(day)

                return (
                  <div key={idx} className="border-r border-[#2a2a3a] last:border-r-0">
                    <div
                      className={cn(
                        'group h-12 border-b border-[#2a2a3a] flex flex-col items-center justify-center sticky top-0 cursor-pointer transition-colors',
                        copyDayMenu?.sourceIdx === idx ? 'z-50' : 'z-10',
                        today ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : 'bg-[#111118] hover:bg-[#1a1a24]'
                      )}
                      onClick={() => setSelectedDay(day)}
                      title="Open day detail"
                    >
                      <span className={cn('text-[10px] font-medium uppercase tracking-wider', today ? 'text-indigo-400' : 'text-[#888899]')}>
                        {format(day, 'EEE')}
                      </span>
                      <span className={cn('text-sm font-bold', today ? 'text-indigo-300' : 'text-[#e8e8f0]')}>
                        {format(day, 'd')}
                      </span>

                      {isManager && (
                        <button
                          type="button"
                          aria-label="Day actions"
                          onClick={e => {
                            e.stopPropagation()
                            setCopyDayMenu(prev =>
                              prev?.sourceIdx === idx ? null : { sourceIdx: idx, stage: 'menu' }
                            )
                          }}
                          className={cn(
                            'absolute top-1 right-1 p-1 rounded hover:bg-[#22222f] text-[#888899] hover:text-[#e8e8f0] transition-opacity',
                            copyDayMenu?.sourceIdx === idx
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100'
                          )}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      )}

                      {copyDayMenu?.sourceIdx === idx && (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 w-[200px] rounded-lg border border-[#2a2a3a] bg-[#111118] shadow-lg overflow-hidden"
                        >
                          {copyDayMenu.stage === 'menu' ? (
                            <button
                              type="button"
                              onClick={() => setCopyDayMenu({ sourceIdx: idx, stage: 'picker' })}
                              className="block w-full whitespace-nowrap px-3 py-2 text-left text-xs text-[#e8e8f0] hover:bg-[#1a1a24] transition-colors"
                            >
                              Copy shifts to…
                            </button>
                          ) : (
                            <div className="p-2">
                              <div className="text-[10px] uppercase tracking-wider text-[#888899] mb-1.5 px-0.5">
                                Copy to…
                              </div>
                              <div className="grid grid-cols-3 gap-1">
                                {weekDays.map((d, didx) =>
                                  didx === idx ? null : (
                                    <button
                                      key={didx}
                                      type="button"
                                      onClick={() => copyDayShifts(day, d)}
                                      disabled={copyingDay}
                                      className="w-full text-center py-1.5 text-[11px] font-medium rounded bg-[#1a1a24] text-[#e8e8f0] hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {format(d, 'EEE')}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {renderDaySlots(day, false)}
                  </div>
                )
              })}
            </div>
          </div>
        )}
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

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl border shadow-lg"
          style={{
            backgroundColor: '#111118',
            borderColor: '#2a2a3a',
            color: '#e8e8f0',
            padding: '14px 18px',
            transform: toastVisible ? 'translateX(0)' : 'translateX(110%)',
            transition: 'transform 300ms ease-out',
          }}
        >
          {toast.kind === 'success' ? (
            <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-orange-400 flex-shrink-0" />
          )}
          <span className="text-sm">{toast.message}</span>
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

          <Select
            label="Role"
            value={shiftForm.role_id}
            onChange={e => setShiftForm(f => ({ ...f, role_id: e.target.value }))}
          >
            <option value="">No role assigned</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>

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

          {shiftConflict && (
            <div
              className="flex items-start gap-2 rounded-lg border"
              style={{
                backgroundColor: '#f9731622',
                borderColor: '#f9731644',
                color: '#fb923c',
                padding: '10px 14px',
              }}
            >
              <TriangleAlert size={16} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm">
                Warning: {shiftConflict.empName} already has a shift from {formatTime(shiftConflict.start)} – {formatTime(shiftConflict.end)} on this day.
              </span>
            </div>
          )}

          {overtimeWarning && (
            <div
              className="flex items-start gap-2 rounded-lg border"
              style={{
                backgroundColor: overtimeWarning.kind === 'over' ? '#f43f5e18' : '#f9731618',
                borderColor: overtimeWarning.kind === 'over' ? '#f43f5e44' : '#f9731644',
                color: overtimeWarning.kind === 'over' ? '#f87171' : '#fb923c',
                padding: '10px 14px',
              }}
            >
              <TriangleAlert size={16} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm">
                {overtimeWarning.kind === 'over' && (
                  `⚠ ${overtimeWarning.empName} will be at ${overtimeWarning.total.toFixed(1)}h this week, over their ${overtimeWarning.max}h maximum.`
                )}
                {overtimeWarning.kind === 'at' && (
                  `${overtimeWarning.empName} will be right at capacity — ${overtimeWarning.max}h this week.`
                )}
                {overtimeWarning.kind === 'near' && (
                  `${overtimeWarning.empName} will be at ${overtimeWarning.total.toFixed(1)}h this week, approaching their ${overtimeWarning.max}h limit.`
                )}
              </span>
            </div>
          )}

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

      <Modal open={publishConfirmOpen} onClose={() => !publishing && setPublishConfirmOpen(false)} title="Publish Schedule?" size="md">
        {(() => {
          const distinctEmpIds = Array.from(new Set(shifts.map(s => s.employee_id)))
          const affectedEmps = distinctEmpIds
            .map(id => employees.find(e => e.id === id))
            .filter((e): e is typeof employees[number] => Boolean(e))
          const visible = affectedEmps.slice(0, 5)
          const overflow = affectedEmps.length - visible.length
          const weekLabel = weekDays.length > 0
            ? `${format(weekDays[0], 'EEE MMM d')} – ${format(weekDays[6], 'EEE MMM d')}`
            : ''
          const noShifts = shifts.length === 0

          return (
            <div className="space-y-4">
              <div className="text-sm text-[#e8e8f0]">
                Week of <span className="font-semibold">{weekLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#2a2a3a] bg-[#1a1a24] p-3">
                  <div className="text-xs text-[#888899]">Shifts</div>
                  <div className="text-lg font-semibold text-[#e8e8f0]">{shifts.length}</div>
                </div>
                <div className="rounded-lg border border-[#2a2a3a] bg-[#1a1a24] p-3">
                  <div className="text-xs text-[#888899]">Employees notified</div>
                  <div className="text-lg font-semibold text-[#e8e8f0]">{distinctEmpIds.length}</div>
                </div>
              </div>

              {affectedEmps.length > 0 && (
                <div className="space-y-2">
                  {visible.map(e => {
                    const name = e.profile?.full_name || 'Unknown'
                    const color = stringToColor(e.id)
                    return (
                      <div key={e.id} className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                          style={{ backgroundColor: `${color}22`, color }}
                        >
                          {getInitials(name)}
                        </div>
                        <div className="text-sm text-[#e8e8f0] truncate">{name}</div>
                      </div>
                    )
                  })}
                  {overflow > 0 && (
                    <div className="text-xs text-[#888899] pl-[38px]">+{overflow} more</div>
                  )}
                </div>
              )}

              {noShifts ? (
                <p className="text-xs text-[#888899] italic">Add shifts before publishing</p>
              ) : (
                <p className="text-xs text-[#888899]">
                  All listed employees will receive an in-app notification that their schedule is ready.
                </p>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPublishConfirmOpen(false)}
                  disabled={publishing}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={confirmPublish}
                  loading={publishing}
                  disabled={noShifts}
                >
                  Publish &amp; Notify
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      <Modal open={confirmCopyOpen} onClose={() => setConfirmCopyOpen(false)} title="Copy from last week" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[#888899]">
            This week already has {shifts.length} shifts. Copy from last week anyway? This will add shifts on top of existing ones.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setConfirmCopyOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirmCopyOpen(false)
                copyFromLastWeek(true)
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      <AIChatPanel />
    </div>
  )
}
