import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/app/layout-dashboard'
import { ApprovalsView } from './approvals-view'
import { isManagerRole } from '@/lib/utils'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !isManagerRole(profile.role)) redirect('/portal')

  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: timeOffRequests },
    { data: availabilityRequests },
    { data: coverageShifts },
    { data: tradeRequests },
    { data: dropRequests },
  ] = await Promise.all([
    supabase
      .from('time_off_requests')
      .select('*, employee:employees(*, profile:profiles(*))')
      .order('created_at', { ascending: false }),
    supabase
      .from('availability_change_requests')
      .select('*, employee:employees(*, profile:profiles(*))')
      .order('created_at', { ascending: false }),
    supabase
      .from('shifts')
      .select('id, employee_id, date, schedule:schedules!inner(id)')
      .gte('date', today),
    supabase
      .from('shift_trade_requests')
      .select(`
        id, status, requester_id, recipient_id, message, created_at, updated_at,
        requester:employees!shift_trade_requests_requester_id_fkey(id, profile:profiles(full_name)),
        recipient:employees!shift_trade_requests_recipient_id_fkey(id, profile:profiles(full_name)),
        requester_shift:shifts!shift_trade_requests_requester_shift_id_fkey(id, employee_id, date, start_time, end_time, role:roles(name, color)),
        recipient_shift:shifts!shift_trade_requests_recipient_shift_id_fkey(id, employee_id, date, start_time, end_time, role:roles(name, color))
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('shift_drop_requests')
      .select(`
        id, status, reason, employee_id, shift_id, created_at, resolved_at,
        employee:employees(id, profile:profiles(full_name)),
        shift:shifts(id, employee_id, date, start_time, end_time, role:roles(name, color))
      `)
      .order('created_at', { ascending: false }),
  ])

  return (
    <DashboardShell>
      <ApprovalsView
        timeOffRequests={timeOffRequests || []}
        availabilityRequests={availabilityRequests || []}
        coverageShifts={coverageShifts || []}
        tradeRequests={(tradeRequests as never) || []}
        dropRequests={(dropRequests as never) || []}
        managerId={user.id}
      />
    </DashboardShell>
  )
}
