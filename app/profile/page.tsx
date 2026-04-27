import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/app/layout-dashboard'
import { ProfileView } from './profile-view'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('*, role:roles(*)')
    .eq('profile_id', user.id)
    .single()

  return (
    <DashboardShell>
      <ProfileView profile={profile} employee={employee} />
    </DashboardShell>
  )
}
