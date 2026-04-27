import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/app/layout-dashboard'
import { SettingsView } from './settings-view'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'manager') redirect('/portal')

  const { data: roles } = await supabase.from('roles').select('*').order('name')
  const { data: storeSettings } = await supabase.from('store_settings').select('*').limit(1).maybeSingle()
  const { data: storeHours } = await supabase.from('store_hours').select('*').order('day_of_week')

  return (
    <DashboardShell>
      <SettingsView
        roles={roles || []}
        storeSettings={storeSettings}
        storeHours={storeHours || []}
      />
    </DashboardShell>
  )
}
