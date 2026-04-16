'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TimeOffRequest, AvailabilityChangeRequest } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getInitials, stringToColor, DAY_NAMES, formatTime } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { CheckCircle, XCircle, Clock, Calendar, RefreshCw } from 'lucide-react'

interface ApprovalsViewProps {
  timeOffRequests: TimeOffRequest[]
  availabilityRequests: AvailabilityChangeRequest[]
  managerId: string
}

type Tab = 'time-off' | 'availability'

export function ApprovalsView({ timeOffRequests: initial_tor, availabilityRequests: initial_ar, managerId }: ApprovalsViewProps) {
  const [tab, setTab] = useState<Tab>('time-off')
  const [timeOffRequests, setTimeOffRequests] = useState(initial_tor)
  const [availabilityRequests, setAvailabilityRequests] = useState(initial_ar)
  const supabase = createClient()

  const pendingTO = timeOffRequests.filter(r => r.status === 'pending')
  const pendingAV = availabilityRequests.filter(r => r.status === 'pending')
  const totalPending = pendingTO.length + pendingAV.length

  const reviewTimeOff = async (id: string, status: 'approved' | 'denied') => {
    await supabase.from('time_off_requests').update({
      status,
      reviewed_by: managerId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)

    if (status === 'approved') {
      // Create availability exceptions for the date range
      const req = timeOffRequests.find(r => r.id === id)
      if (req) {
        const startDate = parseISO(req.start_date)
        const endDate = parseISO(req.end_date)
        const dates = []
        let current = startDate
        while (current <= endDate) {
          dates.push(format(current, 'yyyy-MM-dd'))
          current = new Date(current.setDate(current.getDate() + 1))
        }
        for (const date of dates) {
          await supabase.from('availability_exceptions').upsert({
            employee_id: req.employee_id,
            date,
            is_available: false,
            reason: req.reason || 'Approved time off',
          }, { onConflict: 'employee_id,date' })
        }
      }
    }

    setTimeOffRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const reviewAvailability = async (id: string, status: 'approved' | 'denied') => {
    const req = availabilityRequests.find(r => r.id === id)

    await supabase.from('availability_change_requests').update({
      status,
      reviewed_by: managerId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)

    if (status === 'approved' && req) {
      // Update actual availability
      await supabase.from('availability').upsert({
        employee_id: req.employee_id,
        day_of_week: req.day_of_week,
        start_time: req.new_start_time,
        end_time: req.new_end_time,
        is_available: req.new_is_available,
      }, { onConflict: 'employee_id,day_of_week' })
    }

    setAvailabilityRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge color="#22c55e">Approved</Badge>
    if (status === 'denied') return <Badge color="#f43f5e">Denied</Badge>
    return <Badge color="#f97316">Pending</Badge>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#e8e8f0]">Approvals</h1>
          {totalPending > 0 && (
            <p className="text-sm text-[#888899] mt-0.5">{totalPending} pending review</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111118] border border-[#2a2a3a] rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setTab('time-off')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
            tab === 'time-off' ? 'bg-[#1a1a24] text-[#e8e8f0]' : 'text-[#888899] hover:text-[#e8e8f0]'
          }`}
        >
          <Calendar size={13} />
          Time Off
          {pendingTO.length > 0 && (
            <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {pendingTO.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('availability')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
            tab === 'availability' ? 'bg-[#1a1a24] text-[#e8e8f0]' : 'text-[#888899] hover:text-[#e8e8f0]'
          }`}
        >
          <RefreshCw size={13} />
          Availability
          {pendingAV.length > 0 && (
            <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {pendingAV.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'time-off' && (
        <div className="space-y-3">
          {timeOffRequests.length === 0 && (
            <div className="text-center py-16 text-[#888899]">
              <Clock size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No time off requests</p>
            </div>
          )}
          {timeOffRequests.map(req => {
            const name = req.employee?.profile?.full_name || 'Unknown'
            const color = stringToColor(req.employee_id)
            return (
              <div key={req.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4 flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {getInitials(name)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#e8e8f0] text-sm">{name}</span>
                    {statusBadge(req.status)}
                  </div>
                  <div className="text-xs text-[#888899]">
                    {format(parseISO(req.start_date), 'MMM d')} – {format(parseISO(req.end_date), 'MMM d, yyyy')}
                  </div>
                  {req.reason && <div className="text-xs text-[#888899] mt-1">"{req.reason}"</div>}
                  <div className="text-[10px] text-[#888899]/60 mt-1">
                    {format(parseISO(req.created_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewTimeOff(req.id, 'denied')}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[#888899] hover:text-red-400 transition-colors"
                    >
                      <XCircle size={16} />
                    </button>
                    <button
                      onClick={() => reviewTimeOff(req.id, 'approved')}
                      className="p-2 rounded-lg hover:bg-green-500/10 text-[#888899] hover:text-green-400 transition-colors"
                    >
                      <CheckCircle size={16} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'availability' && (
        <div className="space-y-3">
          {availabilityRequests.length === 0 && (
            <div className="text-center py-16 text-[#888899]">
              <RefreshCw size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No availability change requests</p>
            </div>
          )}
          {availabilityRequests.map(req => {
            const name = req.employee?.profile?.full_name || 'Unknown'
            const color = stringToColor(req.employee_id)
            return (
              <div key={req.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4 flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {getInitials(name)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#e8e8f0] text-sm">{name}</span>
                    {statusBadge(req.status)}
                  </div>
                  <div className="text-xs text-[#888899]">
                    {DAY_NAMES[req.day_of_week]}: {' '}
                    {req.new_is_available
                      ? `${formatTime(req.new_start_time)} – ${formatTime(req.new_end_time)}`
                      : 'Not available'}
                  </div>
                  {req.reason && <div className="text-xs text-[#888899] mt-1">"{req.reason}"</div>}
                  <div className="text-[10px] text-[#888899]/60 mt-1">
                    {format(parseISO(req.created_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewAvailability(req.id, 'denied')}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[#888899] hover:text-red-400 transition-colors"
                    >
                      <XCircle size={16} />
                    </button>
                    <button
                      onClick={() => reviewAvailability(req.id, 'approved')}
                      className="p-2 rounded-lg hover:bg-green-500/10 text-[#888899] hover:text-green-400 transition-colors"
                    >
                      <CheckCircle size={16} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
