import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const RESET_REDIRECT = 'https://bossaiusa.com/reset-password'

function brandedEmail(actionLink: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset your Boss.AI password</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#111118;border:1px solid #2a2a3a;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:#6366f1;line-height:48px;margin-bottom:16px;">
                <span style="color:#fff;font-size:22px;font-weight:700;">B</span>
              </div>
              <h1 style="color:#e8e8f0;margin:0;font-size:22px;font-weight:700;">Boss.AI</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;color:#e8e8f0;">
              <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;">Reset your password</h2>
              <p style="margin:0 0 24px;color:#888899;font-size:14px;line-height:1.5;">
                We received a request to reset the password for your Boss.AI account. Click the button below to choose a new password. This link expires in one hour.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${actionLink}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">
                  Reset password
                </a>
              </div>
              <p style="margin:0 0 8px;color:#888899;font-size:12px;line-height:1.5;">
                If the button doesn't work, paste this link into your browser:
              </p>
              <p style="margin:0;color:#6366f1;font-size:12px;word-break:break-all;">
                ${actionLink}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #2a2a3a;color:#888899;font-size:12px;line-height:1.5;">
              If you didn't request a password reset, you can safely ignore this email — your password will not be changed.
            </td>
          </tr>
        </table>
        <p style="color:#555566;font-size:11px;margin:16px 0 0;">© Boss.AI</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string }
    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const resendKey = process.env.RESEND_API_KEY
    const fromAddress = process.env.RESET_EMAIL_FROM

    if (!supabaseUrl || !serviceKey || !resendKey || !fromAddress) {
      return Response.json(
        { error: 'Password reset email is not configured on the server' },
        { status: 500 },
      )
    }

    // Admin client mints the recovery link without sending Supabase's
    // default email — we send our own branded one via Resend below.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: RESET_REDIRECT },
    })

    // Don't leak whether the email exists. Always return success.
    if (error || !data?.properties?.action_link) {
      return Response.json({ ok: true })
    }

    const actionLink = data.properties.action_link

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: email,
        subject: 'Reset your Boss.AI password',
        html: brandedEmail(actionLink),
      }),
    })

    if (!resendRes.ok) {
      const body = await resendRes.text()
      console.error('[reset-password] resend failed', resendRes.status, body)
      return Response.json({ error: 'Failed to send email' }, { status: 502 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[reset-password] error', err)
    return Response.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
