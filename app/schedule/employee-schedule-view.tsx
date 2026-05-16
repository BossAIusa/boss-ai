'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Employee, Role, Schedule, Shift } from '@/types'
import { format, isToday } from 'date-fns'
import {
  getWeekDays, nextWeek, prevWeek, formatDate,
  formatTime, CALENDAR_START_HOUR, CALENDAR_END_HOUR,
  HOUR_HEIGHT, timeToPixels, timeToMinutes, getShiftDuration, stringToColor, cn,
} from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, CalendarX, Lock, CalendarOff } from 'lucide-react'
import { RequestTimeOffModal } from './request-time-off-modal'
import { ShiftDropModal } from './shift-drop-modal'
import { ShiftTradeModal } from './shift-trade-modal'
import { Toast, ToastState } from '@/components/ui/toast'

interface Props {
  profile: Profile
  employee: Employee
}

type ShiftRow = Shift & {
  schedule?: Pick<Schedule, 'id' | 'published' | 'week_start' | 'week_end'> | null
  role?: Pick<Role, 'id' | 'name' | 'color'> | null
  employee?: { id: string; profile?: { full_name?: string } | null } | null
}

const hours = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
  (_, i) => CALENDAR_START_HOUR + i
)

/** Greedy column layout for overlapping shifts within a single day. */
function getShiftLayout(
  dayShifts: ShiftRow[]
): Map<string, { left: string; width: string; column: number; totalColumns: number }> {
  const layout = new Map<string, { left: string; width: string; column: number; totalColumns: number }>()
  if (dayShifts.length === 0) return layout

  const sorted = [...dayShifts].sort((a, b) => {
    const aStart = timeToMinutes(a.start_time)
    const bStart = timeToMinutes(b.start_time)
    if (aStart !== bStart) return aStart - bStart
    return timeToMinutes(b.end_time) - timeToMinutes(a.end_time)
  })

  const columns: { endTime: number; shiftId: string }[][] = []

  for (const shift of sorted) {
    const startMin = timeToMinutes(shift.start_time)
    const endMin = timeToMinutes(shift.end_time)

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
  const padding = 2
  for (const [, info] of layout) {
    const colWidth = 100 / totalCols
    info.totalColumns = totalCols
    info.left = `calc(${info.column * colWidth}% + ${padding}px)`
    info.width = `calc(${colWidth}% - ${padding * 2}px)`
  }
  return layout
}

export function EmployeeScheduleView({ profile, employee }: Props) {
  const supabase = createClient()
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date())
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [timeOffOpen, setTimeOffOpen] = useState(false)
  const [dropShift, setDropShift] = useState<ShiftRow | null>(null)
  const [tradeShift, setTradeShift] = useState<ShiftRow | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [hoveredShiftId, setHoveredShiftId] = useState<string | null>(null)

  const weekDays = useMemo(() => getWeekDays(currentWeek), [currentWeek])
  const weekStart = useMemo(() => formatDate(weekDays[0]), [weekDays])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const { data: sched } = await supabase
        .from('schedules')
        .select('*')
        .eq('week_start', weekStart)
        .maybeSingle()
      if (cancelled) return
      setSchedule(sched ?? null)

      if (sched?.published) {
        const { data: rows } = await supabase
          .from('shifts')
          .select('*, schedule:schedules(id, published, week_start, week_end), role:roles(id, name, color), employee:employees(id, profile:profiles(full_name))')
          .eq('schedule_id', sched.id)
          .order('date')
          .order('start_time')
        if (cancelled) return
        setShifts((rows as ShiftRow[]) ?? [])
      } else {
        setShifts([])
      }
      setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [supabase, weekStart])

  // Leaving a published week resets the day-detail view
  useEffect(() => { setSelectedDay(null) }, [weekStart])

  const goPrev = () => setCurrentWeek(prev => prevWeek(prev))
  const goNext = () => setCurrentWeek(prev => nextWeek(prev))
  const goToday = () => setCurrentWeek(new Date())

  const isPublished = !!schedule?.published

  const myShiftsThisWeek = useMemo(
    () => shifts.filter(s => s.employee_id === employee.id),
    [shifts, employee.id]
  )

  const visibleShifts = useMemo(
    () => (scope === 'mine' ? myShiftsThisWeek : shifts),
    [scope, shifts, myShiftsThisWeek]
  )

  const onShiftClick = (shift: ShiftRow) => {
    if (shift.employee_id === employee.id) {
      setDropShift(shift)
    } else {
      setTradeShift(shift)
    }
  }

  // Same-day cycling for the detail view (Mon→Tue→…→Sun→Mon)
  const cycleIdx = (d: Date) => (d.getDay() + 6) % 7
  const goToRelativeDay = (delta: number) => {
    if (!selectedDay || weekDays.length === 0) return
    const targetIdx = (cycleIdx(selectedDay) + delta + 7) % 7
    const target = weekDays.find(d => cycleIdx(d) === targetIdx)
    if (target) setSelectedDay(target)
  }

  const renderDaySlots = (day: Date, isDetail: boolean) => {
    const dayISO = formatDate(day)
    const dayShifts = visibleShifts.filter(s => s.date === dayISO)
    const layoutMap = getShiftLayout(dayShifts)
    const nameClass = isDetail ? 'text-[13px]' : 'text-[10px]'
    const timeClass = isDetail ? 'text-[12px]' : 'text-[10px]'
    const roleClass = isDetail ? 'text-[11px]' : 'text-[9px]'

    return (
      <div
        className="relative"
        style={{ height: HOUR_HEIGHT * (CALENDAR_END_HOUR - CALENDAR_START_HOUR) }}
      >
        {hours.slice(0, -1).map(h => (
          <div
            key={h}
            className="absolute left-0 right-0 border-b border-[#1a1a24]"
            style={{ top: (h - CALENDAR_START_HOUR) * HOUR_HEIGHT }}
          />
        ))}

        {dayShifts.map(shift => {
          const top = timeToPixels(shift.start_time)
          const height = Math.max(getShiftDuration(shift.start_time, shift.end_time) * HOUR_HEIGHT, 24)
          const empName = shift.employee?.profile?.full_name || 'Unknown'
          const color = stringToColor(shift.employee_id)
          const layout = layoutMap.get(shift.id)
          const isOwn = shift.employee_id === employee.id
          const isHovered = hoveredShiftId === shift.id

          return (
            <div
              key={shift.id}
              role="button"
              tabIndex={0}
              onClick={() => onShiftClick(shift)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onShiftClick(shift)
                }
              }}
              onMouseEnter={() => setHoveredShiftId(shift.id)}
              onMouseLeave={() => setHoveredShiftId(null)}
              className={cn(
                'absolute rounded-md overflow-hidden cursor-pointer select-none transition-shadow hover:brightness-110 hover:shadow-lg',
                isOwn && 'ring-1 ring-indigo-400/70'
              )}
              style={{
                top,
                height,
                left: layout?.left ?? '2px',
                width: layout?.width ?? 'calc(100% - 4px)',
                backgroundColor: `${color}22`,
                borderLeft: `${isDetail ? 4 : 3}px solid ${color}`,
                boxShadow: isOwn ? '0 0 0 1px rgba(129,140,248,0.35)' : undefined,
                zIndex: isHovered ? 40 : (isOwn ? 20 : 10) + (layout?.column ?? 0),
              }}
            >
              <div className={cn('h-full', isDetail ? 'px-3 py-2' : 'px-1.5 py-1')}>
                <div className={cn('font-semibold truncate mt-0.5', nameClass)} style={{ color }}>
                  {empName}
                </div>
                <div className={cn('text-[#888899] truncate', timeClass)}>
                  {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                </div>
                {shift.role && height > 40 && (
                  <div className={cn('truncate mt-0.5', roleClass)} style={{ color: `${color}cc` }}>
                    {shift.role.name}
                  </div>
                )}
              </div>
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
                <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={goToday} className="px-3 py-1.5 text-sm font-medium text-[#e8e8f0] hover:bg-[#1a1a24] rounded-lg transition-colors">
                  Today
                </button>
                <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors">
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
          {isPublished && (
            <div className="inline-flex rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-0.5">
              <button
                onClick={() => setScope('mine')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  scope === 'mine'
                    ? 'bg-indigo-500 text-white'
                    : 'text-[#888899] hover:text-[#e8e8f0]'
                )}
              >
                My Schedule
              </button>
              <button
                onClick={() => setScope('all')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  scope === 'all'
                    ? 'bg-indigo-500 text-white'
                    : 'text-[#888899] hover:text-[#e8e8f0]'
                )}
              >
                Full Schedule
              </button>
            </div>
          )}
          <button
            onClick={() => setTimeOffOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 transition-colors"
          >
            <CalendarOff size={14} />
            Request Time Off
          </button>
        </div>
      </div>

      {/* Read-only banner */}
      {isPublished && (
        <div className="flex items-center gap-2 px-6 py-2 bg-[#0d0d14] border-b border-[#2a2a3a] text-xs text-[#888899]">
          <Lock size={14} />
          Published schedule — read only. Click your own shift to request a drop, or someone else&apos;s to request a trade.
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-[#888899]">Loading…</div>
      ) : !isPublished ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <CalendarX size={48} className="text-indigo-400/40 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#e8e8f0]">Schedule not published yet</h2>
            <p className="text-sm text-[#888899] mt-1">Check back once your manager has finalized this week&apos;s schedule.</p>
            <p className="text-xs text-[#888899]/60 mt-3">
              Week of {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d, yyyy')}
            </p>
          </div>
        </div>
      ) : (
        <div
          key={selectedDay ? `detail-${formatDate(selectedDay)}` : 'week'}
          className="flex-1 overflow-auto"
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
                          'h-12 border-b border-[#2a2a3a] flex flex-col items-center justify-center sticky top-0 cursor-pointer transition-colors z-10',
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
                      </div>

                      {renderDaySlots(day, false)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <RequestTimeOffModal
        open={timeOffOpen}
        onClose={() => setTimeOffOpen(false)}
        profile={profile}
        employee={employee}
        upcomingShifts={myShiftsThisWeek}
        onSuccess={() => {
          setTimeOffOpen(false)
          setToast({ kind: 'success', message: 'Time off request sent — your manager will review it soon' })
        }}
      />

      <ShiftDropModal
        open={!!dropShift}
        onClose={() => setDropShift(null)}
        profile={profile}
        employee={employee}
        shift={dropShift}
        onSuccess={() => {
          setDropShift(null)
          setToast({ kind: 'success', message: 'Drop request sent — your manager will review it' })
        }}
      />

      <ShiftTradeModal
        open={!!tradeShift}
        onClose={() => setTradeShift(null)}
        profile={profile}
        employee={employee}
        targetShift={tradeShift}
        myShifts={myShiftsThisWeek}
        onSuccess={(recipientName) => {
          setTradeShift(null)
          setToast({ kind: 'success', message: `Trade request sent to ${recipientName}` })
        }}
      />

      <Toast toast={toast} />
    </div>
  )
}
