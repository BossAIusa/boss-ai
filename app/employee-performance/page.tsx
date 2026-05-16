import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/app/layout-dashboard'
import { EmployeePerformanceView } from './employee-performance-view'
import { isManagerRole } from '@/lib/utils'

export default async function EmployeePerformancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (!isManagerRole(profile.role)) redirect('/portal')

  const [
    { data: employees },
    { data: writeups },
    { data: praise },
  ] = await Promise.all([
    supabase.from('employees').select('*, profile:profiles(*), role:roles(*)').order('created_at'),
    supabase.from('employee_writeups').select('*').order('incident_date', { ascending: false }),
    supabase.from('employee_praise').select('*').order('incident_date', { ascending: false }),
  ])

  return (
    <DashboardShell>
      <EmployeePerformanceView
        employees={employees || []}
        writeups={writeups || []}
        praise={praise || []}
      />
    </DashboardShell>
  )
}
