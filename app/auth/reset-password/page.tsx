import { redirect } from 'next/navigation'

// Canonical reset-password page remains at /reset-password so existing Supabase
// recovery email links keep working. This is just a friendly redirect for users
// who land on /auth/reset-password.
export default function AuthResetPasswordRedirect() {
  redirect('/reset-password')
}
