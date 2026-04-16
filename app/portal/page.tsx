import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/app/layout-dashboard'
import { PortalView } from './portal-view'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // If manager, redirect to schedule
  if (profile.role === 'manager') redirect('/schedule')

  const { data: employee } = await supabase
    .from('employees')
    .select('*, role:roles(*)')
    .eq('profile_id', user.id)
    .single()

  if (!employee) redirect('/login')

  // Get published shifts for this employee
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, schedule:schedules(*), role:roles(*)')
    .eq('employee_id', employee.id)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date')

  const { data: availability } = await supabase
    .from('availability')
    .select('*')
    .eq('employee_id', employee.id)
    .order('day_of_week')

  const { data: timeOffRequests } = await supabase
    .from('time_off_requests')
    .select('*')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false })

  const { data: availabilityRequests } = await supabase
    .from('availability_change_requests')
    .select('*')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false })

  const { data: roles } = await supabase.from('roles').select('*')

  return (
    <DashboardShell>
      <PortalView
        profile={profile}
        employee={employee}
        shifts={(shifts || []).filter(s => s.schedule?.published)}
        availability={availability || []}
        timeOffRequests={timeOffRequests || []}
        availabilityRequests={availabilityRequests || []}
        roles={roles || []}
      />
    </DashboardShell>
  )
}
