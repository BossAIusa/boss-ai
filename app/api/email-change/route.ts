import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

function brandedEmail({
  managerName,
  orgName,
  newEmail,
  actionLink,
}: {
  managerName: string
  orgName: string
  newEmail: string
  actionLink: string
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
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;">Confirm your new email</h2>
          <p style="margin:0 0 24px;color:#888899;font-size:14px;line-height:1.5;">
            ${escapeHtml(managerName)} updated the email on your <strong style="color:#e8e8f0;">${escapeHtml(orgName)}</strong> account to <strong style="color:#e8e8f0;">${escapeHtml(newEmail)}</strong>. Click the button below to confirm this change and keep using your account with the new address.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${actionLink}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">
              Confirm new email
            </a>
          </div>
          <p style="margin:0 0 8px;color:#888899;font-size:12px;line-height:1.5;">If the button doesn't work, paste this link:</p>
          <p style="margin:0;color:#6366f1;font-size:12px;word-break:break-all;">${actionLink}</p>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #2a2a3a;color:#888899;font-size:12px;line-height:1.5;">
          If you didn't expect this change, contact your manager. The link expires in 24 hours.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: managerProfile } = await supabase
    .from('profiles')
    .select('id, full_name, role, organization_id')
    .eq('id', user.id)
    .single()

  if (!managerProfile || !['manager', 'admin_manager'].includes(managerProfile.role)) {
    return Response.json({ error: 'Only managers can change emails' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    profile_id?: string
    new_email?: string
  }

  const targetProfileId = body.profile_id?.trim()
  const newEmail = body.new_email?.trim().toLowerCase()
  if (!targetProfileId || !newEmail) {
    return Response.json({ error: 'Missing profile_id or new_email' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return Response.json({ error: 'Invalid email format' }, { status: 400 })
  }

  // Same-org guard
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, email, organization_id')
    .eq('id', targetProfileId)
    .single()

  if (!targetProfile) return Response.json({ error: 'User not found' }, { status: 404 })
  if (targetProfile.organization_id !== managerProfile.organization_id) {
    return Response.json({ error: 'User is not in your organization' }, { status: 403 })
  }
  if (targetProfile.email?.toLowerCase() === newEmail) {
    return Response.json({ error: 'New email matches the current one' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.RESET_EMAIL_FROM
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Server is not configured for admin operations' }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Block conflicts: another auth user already owns this email
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', newEmail)
    .maybeSingle()
  if (existing && existing.id !== targetProfileId) {
    return Response.json({ error: 'Another user already has that email' }, { status: 409 })
  }

  // Stage the email change on the auth user. With Supabase's default behavior,
  // this triggers a confirmation flow — the change is not applied until the
  // user clicks the verification link sent to the new address.
  const { error: updateErr } = await admin.auth.admin.updateUserById(targetProfileId, {
    email: newEmail,
  })
  if (updateErr) {
    return Response.json({ error: updateErr.message }, { status: 500 })
  }

  // Mint the action_link ourselves so we can send a branded email via Resend
  // instead of Supabase's default SMTP.
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    req.headers.get('origin') ||
    `https://${req.headers.get('host')}`
  const redirectTo = `${origin}/auth/callback?next=/profile`

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'email_change_new',
    email: targetProfile.email,
    newEmail,
    options: { redirectTo },
  })

  const actionLink = linkData?.properties?.action_link
  if (linkErr || !actionLink) {
    return Response.json({
      success: true,
      email_sent: false,
      email_error: linkErr?.message || 'Could not generate verification link',
    })
  }

  if (!resendKey || !fromAddress) {
    return Response.json({
      success: true,
      email_sent: false,
      action_link: actionLink,
      email_error: 'Resend not configured — copy the link manually',
    })
  }

  const { data: org } = await admin
    .from('organizations')
    .select('name')
    .eq('id', managerProfile.organization_id || '')
    .maybeSingle()

  let emailSent = false
  let emailError: string | null = null
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: newEmail,
        subject: `Confirm your new email for ${org?.name || 'Boss AI'}`,
        html: brandedEmail({
          managerName: managerProfile.full_name || 'Your manager',
          orgName: org?.name || 'Boss AI',
          newEmail,
          actionLink,
        }),
      }),
    })
    emailSent = res.ok
    if (!res.ok) {
      emailError = `Resend ${res.status}`
      console.error('[email-change] resend failed', res.status, await res.text())
    }
  } catch (e) {
    emailError = String(e)
    console.error('[email-change] resend exception', e)
  }

  return Response.json({
    success: true,
    email_sent: emailSent,
    email_error: emailError,
    action_link: emailSent ? undefined : actionLink,
  })
}
