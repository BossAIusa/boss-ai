'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { differenceInCalendarDays, parseISO, format } from 'date-fns'
import { AlertCircle } from 'lucide-react'
import { Profile, Employee, Shift } from '@/types'
import { formatDate } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  profile: Profile
  employee: Employee
  /** Shifts for the employee in the visible range used for overlap detection */
  upcomingShifts: Shift[]
  onSuccess: () => void
}

export function RequestTimeOffModal({
  open, onClose, profile, employee, upcomingShifts, onSuccess,
}: Props) {
  const todayStr = formatDate(new Date())
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0
    const diff = differenceInCalendarDays(parseISO(endDate), parseISO(startDate))
    return diff >= 0 ? diff + 1 : 0
  }, [startDate, endDate])

  const overlappingShifts = useMemo(() => {
    if (!startDate || !endDate) return []
    return upcomingShifts.filter(s => s.date >= startDate && s.date <= endDate)
  }, [upcomingShifts, startDate, endDate])

  const submit = async () => {
    if (submitting) return
    if (days <= 0) {
      setError('End date must be on or after start date')
      return
    }
    setSubmitting(true)
    setError(null)

    const { data: row, error: insertError } = await supabase
      .from('time_off_requests')
      .insert({
        employee_id: employee.id,
        organization_id: profile.organization_id ?? null,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError || !row) {
      setSubmitting(false)
      setError(insertError?.message ?? 'Failed to send request')
      return
    }

    // Notify all managers in the same organization
    if (profile.organization_id) {
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .in('role', ['manager', 'admin_manager'])

      if (managers && managers.length > 0) {
        await supabase.from('notifications').insert(
          managers.map(m => ({
            profile_id: m.id,
            type: 'time_off_request',
            time_off_request_id: row.id,
            reference_id: row.id,
          }))
        )
      }
    }

    setSubmitting(false)
    onSuccess()
  }

  const reset = () => {
    setStartDate(todayStr)
    setEndDate(todayStr)
    setReason('')
    setError(null)
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Request Time Off"
      size="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#888899] mb-1.5">Start date</label>
            <input
              type="date"
              value={startDate}
              min={todayStr}
              onChange={e => {
                setStartDate(e.target.value)
                if (endDate < e.target.value) setEndDate(e.target.value)
              }}
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-sm text-[#e8e8f0] focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#888899] mb-1.5">End date</label>
            <input
              type="date"
              value={endDate}
              min={startDate || todayStr}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-sm text-[#e8e8f0] focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-[#888899] mb-1.5">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Let your manager know why you're requesting this time off..."
            className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-sm text-[#e8e8f0] placeholder-[#666677] focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        {days > 0 && (
          <div className="text-xs text-[#888899]">
            You are requesting <span className="text-[#e8e8f0] font-medium">{days} day{days === 1 ? '' : 's'}</span> off from{' '}
            <span className="text-[#e8e8f0]">{format(parseISO(startDate), 'MMM d')}</span>
            {' to '}
            <span className="text-[#e8e8f0]">{format(parseISO(endDate), 'MMM d')}</span>
          </div>
        )}

        {overlappingShifts.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <p className="text-xs leading-relaxed">
              You have <strong>{overlappingShifts.length} shift{overlappingShifts.length === 1 ? '' : 's'}</strong> scheduled during this period.
              Your manager will review these when deciding your request.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 justify-end pt-2 border-t border-[#2a2a3a]">
          <button
            type="button"
            onClick={() => { reset(); onClose() }}
            className="px-4 py-2 text-sm font-medium rounded-lg text-[#888899] hover:text-[#e8e8f0] hover:bg-[#1a1a24] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || days <= 0}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

