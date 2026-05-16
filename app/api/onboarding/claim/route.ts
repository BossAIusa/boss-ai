import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string }
  const token = body.token
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: invitation, error: invErr } = await supabase
    .from('invitations')
    .select('id, organization_id, email, role, employee_id, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (invErr || !invitation) return Response.json({ error: 'Invitation not found' }, { status: 404 })
  if (invitation.status !== 'pending') return Response.json({ error: `Invitation already ${invitation.status}` }, { status: 410 })
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return Response.json({ error: 'Invitation expired' }, { status: 410 })
  }
  if ((user.email || '').toLowerCase() !== invitation.email.toLowerCase()) {
    return Response.json({ error: 'Email does not match invitation' }, { status: 403 })
  }

  // Update the authenticated user's own profile with org + role from invitation.
  // RLS "Users can update own profile" allows this.
  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      organization_id: invitation.organization_id,
      role: invitation.role,
    })
    .eq('id', user.id)

  if (profErr) return Response.json({ error: profErr.message }, { status: 500 })

  // Employee record: link the pre-created row (if any), or create a fresh one.
  // Managers and admin_managers also get an employees row so they can be
  // scheduled and show up alongside their team.
  let employeeId: string | null = null
  if (invitation.employee_id) {
    await supabase
      .from('employees')
      .update({ profile_id: user.id })
      .eq('id', invitation.employee_id)
      .is('profile_id', null)
    employeeId = invitation.employee_id
  } else {
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (existing) {
      employeeId = existing.id
    } else {
      const { data: newEmp } = await supabase
        .from('employees')
        .insert({ profile_id: user.id })
        .select('id')
        .single()
      employeeId = newEmp?.id ?? null
    }
  }

  // Seed default 7-day availability (M–F available 9–5) if none exists yet.
  if (employeeId) {
    const { count } = await supabase
      .from('availability')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', employeeId)
    if ((count ?? 0) === 0) {
      const rows = Array.from({ length: 7 }, (_, i) => ({
        employee_id: employeeId,
        day_of_week: i,
        is_available: i >= 1 && i <= 5,
        start_time: '09:00',
        end_time: '17:00',
      }))
      await supabase.from('availability').insert(rows)
    }
  }

  return Response.json({
    success: true,
    organization_id: invitation.organization_id,
    role: invitation.role,
    employee_id: employeeId,
  })
}
