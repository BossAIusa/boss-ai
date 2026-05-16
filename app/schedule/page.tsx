import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ScheduleView } from './schedule-view'
import { EmployeeScheduleView } from './employee-schedule-view'
import DashboardShell from '@/app/layout-dashboard'
import { isManagerRole } from '@/lib/utils'

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  if (!isManagerRole(profile.role)) {
    const { data: employee } = await supabase
      .from('employees')
      .select('*')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (!employee) redirect('/auth/login')
    return (
      <DashboardShell>
        <EmployeeScheduleView profile={profile} employee={employee} />
      </DashboardShell>
    )
  }

  const { data: roles } = await supabase.from('roles').select('*').order('name')
  const { data: employees } = await supabase
    .from('employees')
    .select('*, profile:profiles(*), role:roles(*)')
    .order('created_at')

  return (
    <DashboardShell>
      <ScheduleView profile={profile} roles={roles || []} employees={employees || []} />
    </DashboardShell>
  )
}
