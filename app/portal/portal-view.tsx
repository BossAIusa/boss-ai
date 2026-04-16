'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Employee, Shift, Availability, TimeOffRequest, AvailabilityChangeRequest, Role } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { DAY_NAMES, DAY_NAMES_SHORT, formatTime, formatDisplayDate } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { Calendar, Clock, Coffee, Plus, CheckCircle, XCircle } from 'lucide-react'

interface PortalViewProps {
  profile: Profile
  employee: Employee & { role?: Role }
  shifts: (Shift & { schedule?: { published: boolean } })[]
  availability: Availability[]
  timeOffRequests: TimeOffRequest[]
  availabilityRequests: AvailabilityChangeRequest[]
  roles: Role[]
}

type Tab = 'schedule' | 'availability' | 'time-off'

export function PortalView({
  profile, employee, shifts: initialShifts,
  availability: initialAvailability,
  timeOffRequests: initialTOR,
  availabilityRequests: initialAVR,
}: PortalViewProps) {
  const [tab, setTab] = useState<Tab>('schedule')
  const [shifts] = useState(initialShifts)
  const [availability, setAvailability] = useState(initialAvailability)
  const [timeOffRequests, setTimeOffRequests] = useState(initialTOR)
  const [availabilityRequests, setAvailabilityRequests] = useState(initialAVR)

  // Time off modal
  const [torModal, setTorModal] = useState(false)
  const [torForm, setTorForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [torSaving, setTorSaving] = useState(false)

  // Availability change modal
  const [avrModal, setAvrModal] = useState(false)
  const [avrDay, setAvrDay] = useState(0)
  const [avrForm, setAvrForm] = useState({ new_start_time: '09:00', new_end_time: '17:00', new_is_available: true, reason: '' })
  const [avrSaving, setAvrSaving] = useState(false)

  const supabase = createClient()

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
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#e8e8f0]">My Portal</h1>
        <p className="text-sm text-[#888899]">Welcome back, {profile.full_name}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111118] border border-[#2a2a3a] rounded-lg p-1 w-fit mb-6">
        {([
          { id: 'schedule', label: 'My Schedule', icon: Calendar },
          { id: 'availability', label: 'Availability', icon: Clock },
          { id: 'time-off', label: 'Time Off', icon: Coffee },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
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
          {shifts.map(shift => (
            <div key={shift.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 text-center">
                <div className="text-xs text-[#888899] uppercase">{format(parseISO(shift.date), 'EEE')}</div>
                <div className="text-xl font-bold text-[#e8e8f0]">{format(parseISO(shift.date), 'd')}</div>
                <div className="text-xs text-[#888899]">{format(parseISO(shift.date), 'MMM')}</div>
              </div>
              <div className="w-px h-10 bg-[#2a2a3a]" />
              <div className="flex-1">
                <div className="font-medium text-[#e8e8f0] text-sm">
                  {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                </div>
                {shift.role && <Badge color={shift.role.color} className="mt-1">{shift.role.name}</Badge>}
                {shift.notes && <div className="text-xs text-[#888899] mt-1">{shift.notes}</div>}
              </div>
              <div className="text-sm text-[#888899]">
                {(() => {
                  const start = shift.start_time.split(':').map(Number)
                  const end = shift.end_time.split(':').map(Number)
                  const hours = (end[0] * 60 + end[1] - start[0] * 60 - start[1]) / 60
                  return `${hours}h`
                })()}
              </div>
            </div>
          ))}
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
                <div key={i} className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3 flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-[#e8e8f0]">{DAY_NAMES[i]}</div>
                  <div className="flex-1 text-sm text-[#888899]">
                    {dayAvail?.is_available
                      ? `${formatTime(dayAvail.start_time)} – ${formatTime(dayAvail.end_time)}`
                      : 'Not available'}
                  </div>
                  {pendingReq && <Badge color="#f97316">Change pending</Badge>}
                  <button
                    onClick={() => openAvrModal(i)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Request change
                  </button>
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
