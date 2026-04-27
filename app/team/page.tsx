import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/app/layout-dashboard'
import { TeamView } from './team-view'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'manager') redirect('/portal')

  const { data: employees } = await supabase
    .from('employees')
    .select('*, profile:profiles(*), role:roles(*)')
    .order('created_at')

  const { data: roles } = await supabase.from('roles').select('*').order('name')

  const { data: availability } = await supabase
    .from('availability')
    .select('*')
    .order('day_of_week')

  return (
    <DashboardShell>
      <TeamView employees={employees || []} roles={roles || []} availability={availability || []} />
    </DashboardShell>
  )
}
