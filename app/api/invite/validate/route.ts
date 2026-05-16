import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return Response.json({ valid: false, reason: 'missing_token' }, { status: 400 })

  const supabase = await createClient()

  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('id, organization_id, email, role, employee_id, recipient_name, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !invitation) {
    return Response.json({ valid: false, reason: 'not_found' }, { status: 404 })
  }
  if (invitation.status !== 'pending') {
    return Response.json({ valid: false, reason: invitation.status }, { status: 410 })
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return Response.json({ valid: false, reason: 'expired' }, { status: 410 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', invitation.organization_id)
    .single()

  let employee: { full_name?: string; phone?: string; address?: string } | null = null
  if (invitation.employee_id) {
    const { data: emp } = await supabase
      .from('employees')
      .select('id, profile:profiles(full_name, phone, address)')
      .eq('id', invitation.employee_id)
      .maybeSingle()
    if (emp?.profile) {
      const p = Array.isArray(emp.profile) ? emp.profile[0] : emp.profile
      employee = { full_name: p?.full_name, phone: p?.phone, address: p?.address }
    }
  }
  // Fall back to the manager-entered recipient_name if no linked profile yet.
  if (!employee?.full_name && invitation.recipient_name) {
    employee = { ...(employee || {}), full_name: invitation.recipient_name }
  }

  return Response.json({
    valid: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organization: org ? { id: org.id, name: org.name } : null,
      employee,
    },
  })
}
