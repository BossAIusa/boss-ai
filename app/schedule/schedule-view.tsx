'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Employee, Role, Schedule, Shift } from '@/types'
import {
  getWeekDays, getWeekStart, nextWeek, prevWeek, formatDate,
  formatDisplayDate, formatTime, CALENDAR_START_HOUR, CALENDAR_END_HOUR,
  HOUR_HEIGHT, timeToPixels, pixelsToTime, getShiftDuration, stringToColor, cn
} from '@/lib/utils'
import { format, isToday } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft, ChevronRight, Plus, Eye, EyeOff, Wand2, Filter, X, Pencil, Trash2
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

export function ScheduleView({ profile, roles, employees }: ScheduleViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [weekDays, setWeekDays] = useState<Date[]>([])
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')

  // Shift modal
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

  const supabase = createClient()
  const isManager = profile.role === 'manager'

  useEffect(() => {
    const days = getWeekDays(currentDate)
    setWeekDays(days)
  }, [currentDate])

  const loadSchedule = useCallback(async () => {
    if (weekDays.length === 0) return
    setLoading(true)

    const weekStart = formatDate(weekDays[0])
    const weekEnd = formatDate(weekDays[6])

    // Get or create schedule for this week
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

  const openAddShift = (date?: Date) => {
    setEditingShift(null)
    setShiftForm({
      employee_id: employees[0]?.id || '',
      role_id: '',
      date: date ? formatDate(date) : formatDate(weekDays[0] || new Date()),
      start_time: '09:00',
      end_time: '17:00',
      notes: '',
    })
    setShiftModal(true)
  }

  const openEditShift = (shift: Shift) => {
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

    const dayOfWeek = new Date(shiftForm.date).getDay()
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
    if (!schedule || !isManager) return
    // Simple auto-generation: assign employees to shifts based on availability
    const weekStart = weekDays[0]
    const newShifts = []

    for (let day = 0; day < 7; day++) {
      const date = weekDays[day]
      const dayOfWeek = date.getDay()

      // Assign 2-3 employees per day
      const availableEmployees = employees.slice(0, Math.min(3, employees.length))
      for (const emp of availableEmployees) {
        newShifts.push({
          schedule_id: schedule.id,
          employee_id: emp.id,
          role_id: emp.role_id || null,
          date: formatDate(date),
          day_of_week: dayOfWeek,
          start_time: '09:00',
          end_time: '17:00',
          notes: null,
        })
      }
    }

    // Delete existing shifts and insert new ones
    await supabase.from('shifts').delete().eq('schedule_id', schedule.id)
    if (newShifts.length > 0) {
      await supabase.from('shifts').insert(newShifts)
    }
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

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a] bg-[#111118]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(prevWeek(currentDate))}
              className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-sm font-medium text-[#e8e8f0] hover:bg-[#1a1a24] rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(nextWeek(currentDate))}
              className="p-1.5 rounded-lg hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors"
            >
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
          {/* Filters */}
          <Select
            value={filterEmployee}
            onChange={e => setFilterEmployee(e.target.value)}
            className="text-xs py-1.5 px-2 w-36"
          >
            <option value="">All employees</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.profile?.full_name}</option>
            ))}
          </Select>
          <Select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="text-xs py-1.5 px-2 w-32"
          >
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
                <div
                  key={h}
                  className="relative"
                  style={{ height: HOUR_HEIGHT }}
                >
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
                  {/* Day header */}
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

                  {/* Hour grid */}
                  <div
                    className="relative"
                    style={{ height: HOUR_HEIGHT * (CALENDAR_END_HOUR - CALENDAR_START_HOUR) }}
                    onClick={() => isManager && openAddShift(day)}
                  >
                    {/* Grid lines */}
                    {hours.slice(0, -1).map(h => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-b border-[#1a1a24]"
                        style={{ top: (h - CALENDAR_START_HOUR) * HOUR_HEIGHT }}
                      />
                    ))}

                    {/* Shifts */}
                    {dayShifts.map(shift => {
                      const top = timeToPixels(shift.start_time)
                      const height = Math.max(
                        getShiftDuration(shift.start_time, shift.end_time) * HOUR_HEIGHT,
                        24
                      )
                      const empName = shift.employee?.profile?.full_name || 'Unknown'
                      const color = stringToColor(shift.employee_id)

                      return (
                        <div
                          key={shift.id}
                          className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 cursor-pointer overflow-hidden group transition-opacity hover:opacity-90"
                          style={{ top, height, backgroundColor: `${color}22`, borderLeft: `3px solid ${color}` }}
                          onClick={e => { e.stopPropagation(); if (isManager) openEditShift(shift) }}
                        >
                          <div className="text-[10px] font-semibold truncate" style={{ color }}>
                            {empName}
                          </div>
                          <div className="text-[10px] text-[#888899] truncate">
                            {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                          </div>
                          {shift.role && (
                            <div className="text-[9px] truncate mt-0.5" style={{ color: `${color}cc` }}>
                              {shift.role.name}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Shift Modal */}
      <Modal
        open={shiftModal}
        onClose={() => setShiftModal(false)}
        title={editingShift ? 'Edit Shift' : 'Add Shift'}
      >
        <div className="space-y-4">
          <Select
            label="Employee"
            value={shiftForm.employee_id}
            onChange={e => setShiftForm(f => ({ ...f, employee_id: e.target.value }))}
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
            <option value="">No specific role</option>
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

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Time"
              type="time"
              value={shiftForm.start_time}
              onChange={e => setShiftForm(f => ({ ...f, start_time: e.target.value }))}
            />
            <Input
              label="End Time"
              type="time"
              value={shiftForm.end_time}
              onChange={e => setShiftForm(f => ({ ...f, end_time: e.target.value }))}
            />
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
