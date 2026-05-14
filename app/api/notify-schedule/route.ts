import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const schedule_id = body?.schedule_id as string | undefined
  if (!schedule_id) {
    return NextResponse.json({ error: 'schedule_id required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: shifts, error: shiftsError } = await supabase
    .from('shifts')
    .select('employee_id')
    .eq('schedule_id', schedule_id)
  if (shiftsError) {
    return NextResponse.json({ error: shiftsError.message }, { status: 500 })
  }

  const employeeIds = Array.from(new Set((shifts ?? []).map(s => s.employee_id)))
  if (employeeIds.length === 0) return NextResponse.json({ notified: 0 })

  const rows = employeeIds.map(employee_id => ({
    employee_id,
    schedule_id,
    type: 'schedule_published',
    read: false,
  }))

  const { error: insertError } = await supabase.from('notifications').insert(rows)
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ notified: employeeIds.length })
}
