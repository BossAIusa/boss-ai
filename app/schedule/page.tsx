import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ScheduleView } from './schedule-view'
import DashboardShell from '@/app/layout-dashboard'

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
