import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/app/layout-dashboard'
import { ApprovalsView } from './approvals-view'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'manager') redirect('/portal')

  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: timeOffRequests },
    { data: availabilityRequests },
    { data: coverageShifts },
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
  ])

  return (
    <DashboardShell>
      <ApprovalsView
        timeOffRequests={timeOffRequests || []}
        availabilityRequests={availabilityRequests || []}
        coverageShifts={coverageShifts || []}
        managerId={user.id}
      />
    </DashboardShell>
  )
}
