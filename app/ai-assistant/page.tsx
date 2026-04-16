import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/app/layout-dashboard'
import { AIAssistantView } from './ai-assistant-view'

export default async function AIAssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'manager') redirect('/portal')

  const { data: employees } = await supabase
    .from('employees')
    .select('*, profile:profiles(*), role:roles(*)')
    .order('created_at')

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, employee:employees(*, profile:profiles(*)), role:roles(*)')
    .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

  const { data: availability } = await supabase
    .from('availability')
    .select('*')

  return (
    <DashboardShell>
      <AIAssistantView
        employees={employees || []}
        shifts={shifts || []}
        availability={availability || []}
      />
    </DashboardShell>
  )
}
