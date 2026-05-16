'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Profile, Employee, Shift, Availability, TimeOffRequest, AvailabilityChangeRequest, Role,
  EmployeeWriteup, EmployeePraise,
  WRITEUP_SEVERITY_LABELS, WRITEUP_SEVERITY_COLORS,
  PRAISE_CATEGORY_LABELS, PRAISE_CATEGORY_COLOR,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { DAY_NAMES, formatTime } from '@/lib/utils'
import { format, parseISO, isToday } from 'date-fns'
import { Calendar, Clock, Coffee, Plus, Award, ClipboardList, Star, CheckCircle2 } from 'lucide-react'

interface PortalViewProps {
  profile: Profile
  employee: Employee & { role?: Role }
  shifts: (Shift & { schedule?: { published: boolean } })[]
  availability: Availability[]
  timeOffRequests: TimeOffRequest[]
  availabilityRequests: AvailabilityChangeRequest[]
  roles: Role[]
  writeups: EmployeeWriteup[]
  praise: EmployeePraise[]
}

type Tab = 'schedule' | 'availability' | 'time-off' | 'performance'

export function PortalView({
  profile, employee, shifts: initialShifts,
  availability: initialAvailability,
  timeOffRequests: initialTOR,
  availabilityRequests: initialAVR,
  writeups: initialWriteups,
  praise: initialPraise,
}: PortalViewProps) {
  const [tab, setTab] = useState<Tab>('schedule')
  const [shifts] = useState(initialShifts)
  const [availability, setAvailability] = useState(initialAvailability)
  const [timeOffRequests, setTimeOffRequests] = useState(initialTOR)
  const [availabilityRequests, setAvailabilityRequests] = useState(initialAVR)
  const [writeups, setWriteups] = useState(initialWriteups)
  const [praise, setPraise] = useState(initialPraise)

  const supabase = createClient()

  const acknowledgeWriteup = async (id: string) => {
    const now = new Date().toISOString()
    setWriteups(prev => prev.map(w => w.id === id ? { ...w, acknowledged: true, acknowledged_at: now } : w))
    await supabase
      .from('employee_writeups')
      .update({ acknowledged: true, acknowledged_at: now })
      .eq('id', id)
  }

  const acknowledgePraise = async (id: string) => {
    const now = new Date().toISOString()
    setPraise(prev => prev.map(p => p.id === id ? { ...p, acknowledged: true, acknowledged_at: now } : p))
    await supabase
      .from('employee_praise')
      .update({ acknowledged: true, acknowledged_at: now })
      .eq('id', id)
  }

  // Time off modal
  const [torModal, setTorModal] = useState(false)
  const [torForm, setTorForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [torSaving, setTorSaving] = useState(false)

  // Availability change modal
  const [avrModal, setAvrModal] = useState(false)
  const [avrDay, setAvrDay] = useState(0)
  const [avrForm, setAvrForm] = useState({ new_start_time: '09:00', new_end_time: '17:00', new_is_available: true, reason: '' })
  const [avrSaving, setAvrSaving] = useState(false)

  const submitTimeOff = async () => {
    setTorSaving(true)
    const { data } = await supabase.from('time_off_requests').insert({
      employee_id: employee.id,
      start_date: torForm.start_date,
      end_date: torForm.end_date,
      reason: torForm.reason,
    }).select().single()
    if (data) setTimeOffRequests(prev => [data, ...prev])
    setTorModal(false)
    setTorSaving(false)
  }

  const submitAvailabilityChange = async () => {
    setAvrSaving(true)
    const { data } = await supabase.from('availability_change_requests').insert({
      employee_id: employee.id,
      day_of_week: avrDay,
      new_start_time: avrForm.new_start_time,
      new_end_time: avrForm.new_end_time,
      new_is_available: avrForm.new_is_available,
      reason: avrForm.reason,
    }).select().single()
    if (data) setAvailabilityRequests(prev => [data, ...prev])
    setAvrModal(false)
    setAvrSaving(false)
  }

  const openAvrModal = (dayOfWeek: number) => {
    setAvrDay(dayOfWeek)
    const current = availability.find(a => a.day_of_week === dayOfWeek)
    setAvrForm({
      new_start_time: current?.start_time || '09:00',
      new_end_time: current?.end_time || '17:00',
      new_is_available: current?.is_available ?? true,
      reason: '',
    })
    setAvrModal(true)
  }

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge color="#22c55e">Approved</Badge>
    if (status === 'denied') return <Badge color="#f43f5e">Denied</Badge>
    return <Badge color="#f97316">Pending</Badge>
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#e8e8f0]">My Portal</h1>
        <p className="text-sm text-[#888899]">Welcome back, {profile.full_name}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111118] border border-[#2a2a3a] rounded-lg p-1 w-full sm:w-fit mb-6">
        {([
          { id: 'schedule', label: 'My Schedule', icon: Calendar },
          { id: 'availability', label: 'Availability', icon: Clock },
          { id: 'time-off', label: 'Time Off', icon: Coffee },
          { id: 'performance', label: 'Performance', icon: Award },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 sm:flex-initial justify-center sm:justify-start px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center gap-1.5 sm:gap-2 ${
              tab === id ? 'bg-[#1a1a24] text-[#e8e8f0]' : 'text-[#888899] hover:text-[#e8e8f0]'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* My Schedule Tab */}
      {tab === 'schedule' && (
        <div className="space-y-3">
          {shifts.length === 0 && (
            <div className="text-center py-16 text-[#888899]">
              <Calendar size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No upcoming shifts. Your manager hasn't published the schedule yet.</p>
            </div>
          )}
          {shifts.map(shift => {
            const shiftDate = parseISO(shift.date)
            const todayShift = isToday(shiftDate)
            const start = shift.start_time.split(':').map(Number)
            const end = shift.end_time.split(':').map(Number)
            const hours = (end[0] * 60 + end[1] - start[0] * 60 - start[1]) / 60

            return (
              <div
                key={shift.id}
                className={`bg-[#111118] border border-[#2a2a3a] rounded-xl p-4 flex items-center gap-3 sm:gap-4 ${
                  todayShift ? 'border-l-4 border-l-indigo-500' : ''
                }`}
              >
                <div className="w-12 text-center flex-shrink-0">
                  <div className={`text-[10px] sm:text-xs uppercase ${todayShift ? 'text-indigo-400' : 'text-[#888899]'}`}>
                    {format(shiftDate, 'EEE')}
                  </div>
                  <div className={`text-xl font-bold ${todayShift ? 'text-indigo-300' : 'text-[#e8e8f0]'}`}>
                    {format(shiftDate, 'd')}
                  </div>
                  <div className="text-[10px] sm:text-xs text-[#888899]">{format(shiftDate, 'MMM')}</div>
                </div>
                <div className="w-px h-10 bg-[#2a2a3a] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#e8e8f0] text-sm">
                    {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                  </div>
                  {shift.role && <Badge color={shift.role.color} className="mt-1">{shift.role.name}</Badge>}
                  {shift.notes && <div className="text-xs text-[#888899] mt-1 truncate">{shift.notes}</div>}
                </div>
                <div className="text-sm text-[#888899] flex-shrink-0">
                  {hours}h
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Availability Tab */}
      {tab === 'availability' && (
        <div>
          <div className="grid gap-2 mb-6">
            {Array.from({ length: 7 }, (_, i) => {
              const dayAvail = availability.find(a => a.day_of_week === i)
              const pendingReq = availabilityRequests.find(r => r.day_of_week === i && r.status === 'pending')

              return (
                <div
                  key={i}
                  className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                >
                  <div className="flex items-center justify-between sm:contents">
                    <div className="w-24 text-sm font-medium text-[#e8e8f0]">{DAY_NAMES[i]}</div>
                    <div className="flex-1 text-sm text-[#888899] text-right sm:text-left">
                      {dayAvail?.is_available
                        ? `${formatTime(dayAvail.start_time)} – ${formatTime(dayAvail.end_time)}`
                        : 'Not available'}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:contents gap-3">
                    {pendingReq && <Badge color="#f97316">Change pending</Badge>}
                    <button
                      onClick={() => openAvrModal(i)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap"
                    >
                      Request change
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {availabilityRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#e8e8f0] mb-3">Change Requests</h3>
              <div className="space-y-2">
                {availabilityRequests.map(req => (
                  <div key={req.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm text-[#e8e8f0]">
                        {DAY_NAMES[req.day_of_week]}: {req.new_is_available
                          ? `${formatTime(req.new_start_time)} – ${formatTime(req.new_end_time)}`
                          : 'Not available'}
                      </div>
                      {req.reason && <div className="text-xs text-[#888899] mt-0.5">"{req.reason}"</div>}
                    </div>
                    {statusBadge(req.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Time Off Tab */}
      {tab === 'time-off' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setTorModal(true)}>
              <Plus size={13} /> Request Time Off
            </Button>
          </div>

          <div className="space-y-3">
            {timeOffRequests.length === 0 && (
              <div className="text-center py-16 text-[#888899]">
                <Coffee size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No time off requests yet.</p>
              </div>
            )}
            {timeOffRequests.map(req => (
              <div key={req.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm text-[#e8e8f0]">
                    {format(parseISO(req.start_date), 'MMM d')} – {format(parseISO(req.end_date), 'MMM d, yyyy')}
                  </div>
                  {req.reason && <div className="text-xs text-[#888899] mt-0.5">"{req.reason}"</div>}
                  <div className="text-[10px] text-[#888899]/60 mt-1">
                    Submitted {format(parseISO(req.created_at), 'MMM d')}
                  </div>
                </div>
                {statusBadge(req.status)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {tab === 'performance' && (
        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={14} className="text-[#888899]" />
              <h3 className="text-sm font-semibold text-[#e8e8f0]">Write-ups</h3>
              <span className="text-xs text-[#888899]">{writeups.length}</span>
            </div>
            {writeups.length === 0 ? (
              <div className="text-center py-10 bg-[#111118] border border-[#2a2a3a] rounded-xl">
                <ClipboardList size={28} className="mx-auto mb-2 text-[#888899]/50" />
                <p className="text-sm text-[#e8e8f0]">No write-ups on record</p>
                <p className="text-xs text-[#888899] mt-0.5">You&apos;re all clear.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {writeups.map(w => (
                  <div key={w.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge color={WRITEUP_SEVERITY_COLORS[w.severity]}>
                        {WRITEUP_SEVERITY_LABELS[w.severity]}
                      </Badge>
                      <span className="text-[11px] text-[#888899]">
                        {format(parseISO(w.incident_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#e8e8f0]">{w.title}</div>
                    {w.description && (
                      <p className="text-xs text-[#888899] mt-1 whitespace-pre-wrap">{w.description}</p>
                    )}
                    <div className="mt-3">
                      {w.acknowledged ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
                          <CheckCircle2 size={11} /> Acknowledged
                        </span>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => acknowledgeWriteup(w.id)}>
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Star size={14} className="text-[#888899]" />
              <h3 className="text-sm font-semibold text-[#e8e8f0]">Praise received</h3>
              <span className="text-xs text-[#888899]">{praise.length}</span>
            </div>
            {praise.length === 0 ? (
              <div className="text-center py-10 bg-[#111118] border border-[#2a2a3a] rounded-xl">
                <Star size={28} className="mx-auto mb-2 text-[#888899]/50" />
                <p className="text-sm text-[#e8e8f0]">No praise on record yet</p>
                <p className="text-xs text-[#888899] mt-0.5">Keep crushing it.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {praise.map(p => (
                  <div key={p.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge color={PRAISE_CATEGORY_COLOR}>
                        {PRAISE_CATEGORY_LABELS[p.category]}
                      </Badge>
                      <span className="text-[11px] text-[#888899]">
                        {format(parseISO(p.incident_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#e8e8f0]">{p.title}</div>
                    {p.description && (
                      <p className="text-xs text-[#888899] mt-1 whitespace-pre-wrap">{p.description}</p>
                    )}
                    <div className="mt-3">
                      {p.acknowledged ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
                          <CheckCircle2 size={11} /> Acknowledged
                        </span>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => acknowledgePraise(p.id)}>
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Time Off Modal */}
      <Modal open={torModal} onClose={() => setTorModal(false)} title="Request Time Off" size="sm">
        <div className="space-y-4">
          <Input
            label="Start Date"
            type="date"
            value={torForm.start_date}
            onChange={e => setTorForm(f => ({ ...f, start_date: e.target.value }))}
          />
          <Input
            label="End Date"
            type="date"
            value={torForm.end_date}
            onChange={e => setTorForm(f => ({ ...f, end_date: e.target.value }))}
          />
          <Input
            label="Reason (optional)"
            placeholder="Vacation, appointment, etc."
            value={torForm.reason}
            onChange={e => setTorForm(f => ({ ...f, reason: e.target.value }))}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setTorModal(false)}>Cancel</Button>
            <Button size="sm" loading={torSaving} onClick={submitTimeOff} disabled={!torForm.start_date || !torForm.end_date}>
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* Availability Change Modal */}
      <Modal open={avrModal} onClose={() => setAvrModal(false)} title={`Change ${DAY_NAMES[avrDay]} Availability`} size="sm">
        <div className="space-y-4">
          <div className="flex gap-3">
            <button
              onClick={() => setAvrForm(f => ({ ...f, new_is_available: true }))}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                avrForm.new_is_available
                  ? 'bg-green-500/10 border-green-500 text-green-400'
                  : 'bg-[#1a1a24] border-[#2a2a3a] text-[#888899]'
              }`}
            >
              Available
            </button>
            <button
              onClick={() => setAvrForm(f => ({ ...f, new_is_available: false }))}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                !avrForm.new_is_available
                  ? 'bg-red-500/10 border-red-500 text-red-400'
                  : 'bg-[#1a1a24] border-[#2a2a3a] text-[#888899]'
              }`}
            >
              Not Available
            </button>
          </div>

          {avrForm.new_is_available && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start Time"
                type="time"
                value={avrForm.new_start_time}
                onChange={e => setAvrForm(f => ({ ...f, new_start_time: e.target.value }))}
              />
              <Input
                label="End Time"
                type="time"
                value={avrForm.new_end_time}
                onChange={e => setAvrForm(f => ({ ...f, new_end_time: e.target.value }))}
              />
            </div>
          )}

          <Input
            label="Reason (optional)"
            placeholder="Why are you changing availability?"
            value={avrForm.reason}
            onChange={e => setAvrForm(f => ({ ...f, reason: e.target.value }))}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setAvrModal(false)}>Cancel</Button>
            <Button size="sm" loading={avrSaving} onClick={submitAvailabilityChange}>
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
