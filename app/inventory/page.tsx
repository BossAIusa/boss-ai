import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/app/layout-dashboard'
import { PackageSearch } from 'lucide-react'
import { isManagerRole } from '@/lib/utils'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (!isManagerRole(profile.role)) redirect('/portal')

  return (
    <DashboardShell>
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-8">
        <div className="flex flex-col items-center text-center">
          <PackageSearch size={48} className="text-indigo-400" />
          <h1 className="mt-4 text-2xl font-bold text-[#e8e8f0]">Inventory</h1>
          <p className="mt-1 text-sm text-[#888899]">Coming soon</p>
        </div>
      </div>
    </DashboardShell>
  )
}
