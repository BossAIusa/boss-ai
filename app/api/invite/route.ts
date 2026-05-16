import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

type InviteRole = 'admin_manager' | 'manager' | 'employee'

function brandedEmail({
  managerName,
  orgName,
  roleLabel,
  acceptUrl,
}: {
  managerName: string
  orgName: string
  roleLabel: string
  acceptUrl: string
}) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#111118;border:1px solid #2a2a3a;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;text-align:center;">
          <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:#6366f1;line-height:48px;margin-bottom:16px;">
            <span style="color:#fff;font-size:22px;font-weight:700;">B</span>
          </div>
          <h1 style="color:#e8e8f0;margin:0;font-size:22px;font-weight:700;">Boss.AI</h1>
        </td></tr>
        <tr><td style="padding:0 32px 24px;color:#e8e8f0;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;">You've been invited</h2>
          <p style="margin:0 0 24px;color:#888899;font-size:14px;line-height:1.5;">
            ${escapeHtml(managerName)} has invited you to join <strong style="color:#e8e8f0;">${escapeHtml(orgName)}</strong> on Boss AI as a <strong style="color:#e8e8f0;">${escapeHtml(roleLabel)}</strong>. Click the button below to create your account and get started. This link expires in 7 days.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${acceptUrl}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">
              Accept Invitation
            </a>
          </div>
          <p style="margin:0 0 8px;color:#888899;font-size:12px;line-height:1.5;">If the button doesn't work, paste this link:</p>
          <p style="margin:0;color:#6366f1;font-size:12px;word-break:break-all;">${acceptUrl}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

const ROLE_LABELS: Record<InviteRole, string> = {
  admin_manager: 'Admin Manager',
  manager: 'Manager',
  employee: 'Employee',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    email?: string
    role?: InviteRole
    employee_id?: string | null
    organization_id?: string
    name?: string
  }

  const email = body.email?.trim().toLowerCase()
  const role = body.role
  const recipientName = body.name?.trim() || null
  if (!email || !role || !['admin_manager', 'manager', 'employee'].includes(role)) {
    return Response.json({ error: 'Invalid email or role' }, { status: 400 })
  }

  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('id, full_name, role, organization_id')
    .eq('id', user.id)
    .single()

  if (!inviterProfile) return Response.json({ error: 'Profile not found' }, { status: 403 })

  // Role permissions: managers can only invite employees; admin_managers can invite managers + employees; no one invites admin_manager.
  if (role === 'admin_manager') {
    return Response.json({ error: 'Cannot invite another admin manager' }, { status: 403 })
  }
  if (inviterProfile.role === 'manager' && role !== 'employee') {
    return Response.json({ error: 'Managers can only invite employees' }, { status: 403 })
  }
  if (inviterProfile.role !== 'manager' && inviterProfile.role !== 'admin_manager') {
    return Response.json({ error: 'Only managers can invite' }, { status: 403 })
  }

  const orgId = body.organization_id || inviterProfile.organization_id
  if (!orgId) {
    return Response.json(
      { error: 'You are not linked to an organization yet. Ask an admin to set this up.' },
      { status: 400 }
    )
  }

  // Block duplicate pending invitations
  const { data: existing } = await supabase
    .from('invitations')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('email', email)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return Response.json({ error: 'A pending invitation already exists for this email' }, { status: 409 })
  }

  const { data: invitation, error: insertErr } = await supabase
    .from('invitations')
    .insert({
      organization_id: orgId,
      email,
      role,
      employee_id: body.employee_id || null,
      invited_by: user.id,
      recipient_name: recipientName,
    })
    .select('id, token, email, role')
    .single()

  if (insertErr || !invitation) {
    return Response.json({ error: insertErr?.message || 'Failed to create invitation' }, { status: 500 })
  }

  const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    req.headers.get('origin') ||
    `https://${req.headers.get('host')}`
  const acceptUrl = `${origin}/onboarding?token=${invitation.token}`

  // Send email via Resend if configured. Otherwise return the URL so it can be shared manually.
  const resendKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.RESET_EMAIL_FROM
  let emailSent = false
  let emailError: string | null = null

  if (resendKey && fromAddress) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: email,
          subject: `You've been invited to join ${org?.name || 'Boss AI'} on Boss AI`,
          html: brandedEmail({
            managerName: inviterProfile.full_name || 'Your manager',
            orgName: org?.name || 'Boss AI',
            roleLabel: ROLE_LABELS[role],
            acceptUrl,
          }),
        }),
      })
      emailSent = res.ok
      if (!res.ok) {
        emailError = `Resend ${res.status}`
        console.error('[invite] resend failed', res.status, await res.text())
      }
    } catch (e) {
      emailError = String(e)
      console.error('[invite] resend exception', e)
    }
  } else {
    emailError = 'Resend not configured — copy the URL manually'
  }

  return Response.json({
    success: true,
    invitation_id: invitation.id,
    accept_url: acceptUrl,
    email_sent: emailSent,
    email_error: emailError,
  })
}
