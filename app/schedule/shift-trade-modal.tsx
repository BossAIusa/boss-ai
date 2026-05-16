'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { format, parseISO } from 'date-fns'
import { ArrowLeftRight } from 'lucide-react'
import { Profile, Employee, Shift, Role } from '@/types'
import { formatTime } from '@/lib/utils'

type ShiftRow = Shift & {
  role?: Pick<Role, 'id' | 'name' | 'color'> | null
  employee?: { id: string; profile?: { full_name?: string } | null } | null
}

interface Props {
  open: boolean
  onClose: () => void
  profile: Profile
  employee: Employee
  /** The other employee's shift the user clicked on */
  targetShift: ShiftRow | null
  /** The logged-in employee's published shifts this week (eligible to offer) */
  myShifts: ShiftRow[]
  onSuccess: (recipientName: string) => void
}

export function ShiftTradeModal({
  open, onClose, profile, employee, targetShift, myShifts, onSuccess,
}: Props) {
  const [selectedOwnId, setSelectedOwnId] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const recipientName = targetShift?.employee?.profile?.full_name || 'this employee'

  const selectedOwn = useMemo(
    () => myShifts.find(s => s.id === selectedOwnId) ?? null,
    [myShifts, selectedOwnId]
  )

  const sameDayError = useMemo(() => {
    if (!selectedOwn || !targetShift) return null
    return selectedOwn.date === targetShift.date
      ? "You can't trade shifts on the same day"
      : null
  }, [selectedOwn, targetShift])

  const noEligibleShifts = myShifts.length === 0

  const reset = () => {
    setSelectedOwnId('')
    setMessage('')
    setError(null)
  }

  const submit = async () => {
    if (!targetShift || !selectedOwn || submitting || sameDayError) return
    setSubmitting(true)
    setError(null)

    const { data: row, error: insertError } = await supabase
      .from('shift_trade_requests')
      .insert({
        organization_id: profile.organization_id ?? null,
        requester_id: employee.id,
        requester_shift_id: selectedOwn.id,
        recipient_id: targetShift.employee_id,
        recipient_shift_id: targetShift.id,
        message: message.trim() || null,
        status: 'pending_recipient',
      })
      .select('id')
      .single()

    if (insertError || !row) {
      setSubmitting(false)
      setError(insertError?.message ?? 'Failed to send request')
      return
    }

    // Notify the recipient employee. Look up their profile_id.
    const { data: recipientEmployee } = await supabase
      .from('employees')
      .select('profile_id')
      .eq('id', targetShift.employee_id)
      .maybeSingle()

    if (recipientEmployee?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: recipientEmployee.profile_id,
        employee_id: targetShift.employee_id,
        type: 'shift_trade_request',
        shift_trade_request_id: row.id,
        reference_id: row.id,
      })
    }

    setSubmitting(false)
    onSuccess(recipientName)
  }

  if (!targetShift) return null

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Request Shift Trade"
      size="md"
    >
      <div className="space-y-4">
        {/* Their shift */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#888899] mb-1">Their shift</div>
          <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-3">
            <div className="text-sm font-semibold text-[#e8e8f0]">
              {recipientName}
            </div>
            <div className="text-xs text-[#888899] mt-0.5">
              {format(parseISO(targetShift.date), 'EEE, MMM d')} · {formatTime(targetShift.start_time)} – {formatTime(targetShift.end_time)}
              {targetShift.role?.name && (
                <>
                  {' · '}
                  <span style={{ color: targetShift.role.color }}>{targetShift.role.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center text-[#888899]">
          <ArrowLeftRight size={16} />
        </div>

        {/* Your shift to offer */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#888899] mb-1">Your shift to offer</div>
          {noEligibleShifts ? (
            <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-3 text-xs text-[#888899]">
              You have no shifts this week to offer for a trade.
            </div>
          ) : (
            <select
              value={selectedOwnId}
              onChange={e => setSelectedOwnId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-sm text-[#e8e8f0] focus:outline-none focus:border-indigo-500"
            >
              <option value="" disabled>Select one of your shifts…</option>
              {myShifts.map(s => (
                <option key={s.id} value={s.id}>
                  {format(parseISO(s.date), 'EEE MMM d')} — {formatTime(s.start_time)} to {formatTime(s.end_time)}
                  {s.role?.name ? ` (${s.role.name})` : ''}
                </option>
              ))}
            </select>
          )}
          {sameDayError && (
            <p className="text-xs text-red-400 mt-1.5">{sameDayError}</p>
          )}
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-[#888899] mb-1.5">
            Message (optional)
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            placeholder={`Add a note to ${recipientName}...`}
            className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-sm text-[#e8e8f0] placeholder-[#666677] focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

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
            disabled={submitting || noEligibleShifts || !selectedOwn || !!sameDayError}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Sending…' : 'Send Trade Request'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
