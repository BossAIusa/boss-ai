import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/app/layout-dashboard'
import { SettingsView } from './settings-view'
import { isManagerRole } from '@/lib/utils'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !isManagerRole(profile.role)) redirect('/portal')

  const [
    { data: roles },
    { data: storeSettings },
    { data: storeHours },
    { data: employees },
    { data: availability },
  ] = await Promise.all([
    supabase.from('roles').select('*').order('name'),
    supabase.from('store_settings').select('*').limit(1).maybeSingle(),
    supabase.from('store_hours').select('*').order('day_of_week'),
    supabase.from('employees').select('*, profile:profiles(*), role:roles(*)').order('created_at'),
    supabase.from('availability').select('*').order('day_of_week'),
  ])

  return (
    <DashboardShell>
      <SettingsView
        roles={roles || []}
        storeSettings={storeSettings}
        storeHours={storeHours || []}
        employees={employees || []}
        availability={availability || []}
        meProfileId={profile.id}
      />
    </DashboardShell>
  )
}
