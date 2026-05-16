'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { format, parseISO } from 'date-fns'
import { Profile, Employee, Shift, Role } from '@/types'
import { formatTime } from '@/lib/utils'

type ShiftRow = Shift & {
  role?: Pick<Role, 'id' | 'name' | 'color'> | null
}

interface Props {
  open: boolean
  onClose: () => void
  profile: Profile
  employee: Employee
  shift: ShiftRow | null
  onSuccess: () => void
}

export function ShiftDropModal({ open, onClose, profile, employee, shift, onSuccess }: Props) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingRequestId, setExistingRequestId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!open || !shift) return
    let cancelled = false
    const run = async () => {
      setChecking(true)
      setExistingRequestId(null)
      setError(null)
      const { data } = await supabase
        .from('shift_drop_requests')
        .select('id')
        .eq('shift_id', shift.id)
        .eq('status', 'pending')
        .maybeSingle()
      if (cancelled) return
      setExistingRequestId(data?.id ?? null)
      setChecking(false)
    }
    void run()
    return () => { cancelled = true }
  }, [open, shift, supabase])

  const reset = () => {
    setReason('')
    setError(null)
    setExistingRequestId(null)
  }

  const submit = async () => {
    if (!shift || submitting) return
    setSubmitting(true)
    setError(null)

    const { data: row, error: insertError } = await supabase
      .from('shift_drop_requests')
      .insert({
        shift_id: shift.id,
        employee_id: employee.id,
        organization_id: profile.organization_id ?? null,
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
            type: 'shift_drop_request',
            shift_drop_request_id: row.id,
            reference_id: row.id,
          }))
        )
      }
    }

    setSubmitting(false)
    onSuccess()
  }

  const cancelExisting = async () => {
    if (!existingRequestId) return
    await supabase.from('shift_drop_requests').delete().eq('id', existingRequestId)
    setExistingRequestId(null)
    onClose()
  }

  if (!shift) return null

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Request to Drop Shift" size="md">
      <div className="space-y-4">
        <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-4">
          <div className="text-[10px] uppercase tracking-wider text-[#888899] mb-1">Shift</div>
          <div className="text-base font-semibold text-[#e8e8f0]">
            {format(parseISO(shift.date), 'EEEE, MMM d')}
          </div>
          <div className="text-sm text-[#888899] mt-0.5">
            {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
            {shift.role?.name && (
              <>
                {' · '}
                <span style={{ color: shift.role.color }}>{shift.role.name}</span>
              </>
            )}
          </div>
        </div>

        {checking ? (
          <div className="text-xs text-[#888899]">Checking existing requests…</div>
        ) : existingRequestId ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
              You already have a pending drop request for this shift.
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-[#2a2a3a]">
              <button
                type="button"
                onClick={() => { reset(); onClose() }}
                className="px-4 py-2 text-sm font-medium rounded-lg text-[#888899] hover:text-[#e8e8f0] hover:bg-[#1a1a24] transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={cancelExisting}
                className="px-4 py-2 text-sm font-medium rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Cancel request
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#888899] mb-1.5">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={4}
                placeholder="Let your manager know why you need to drop this shift..."
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
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#f43f5e] text-white hover:bg-[#e11d48] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Sending…' : 'Request Drop'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
