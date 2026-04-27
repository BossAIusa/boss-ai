'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { ReactNode } from 'react'

export default async function DashboardShell({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: storeSettings } = await supabase
    .from('store_settings')
    .select('store_name')
    .limit(1)
    .maybeSingle()

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      <Sidebar profile={profile} storeName={storeSettings?.store_name || ''} />
      <main className="flex-1 ml-60 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
