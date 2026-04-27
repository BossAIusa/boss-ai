import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Landing } from '@/components/landing/landing'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'manager') redirect('/schedule')
    redirect('/portal')
  }

  return <Landing />
}
