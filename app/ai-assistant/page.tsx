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

  const [
    { data: employees },
    { data: history },
    { data: memories },
  ] = await Promise.all([
    supabase.from('employees').select('*, profile:profiles(*), role:roles(*)').order('created_at'),
    supabase.from('ai_conversations').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(200),
    supabase.from('ai_memories').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
  ])

  return (
    <DashboardShell>
      <AIAssistantView
        userId={user.id}
        employees={employees || []}
        history={history || []}
        memories={memories || []}
      />
    </DashboardShell>
  )
}
