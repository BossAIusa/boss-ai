import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isManagerRole } from '@/lib/utils'

const PUBLIC_PREFIXES = [
  '/login',           // redirects to /auth/login
  '/signup',          // invite-only notice
  '/auth',            // /auth/login, /auth/forgot-password, /auth/reset-password, /auth/callback
  '/reset-password',  // canonical recovery landing
  '/onboarding',      // invite acceptance flow
  '/terms',
  '/privacy',
  '/preview',
  '/api/auth',        // public auth endpoints (reset-password)
  '/api/invite/validate', // public invite validation
]

// Routes only managers should reach. Employees who hit these get silently
// redirected to /dashboard.
const MANAGER_ONLY_PREFIXES = [
  '/analytics',
  '/inventory',
  '/employee-performance',
  '/team',
  '/ai-assistant',
  '/approvals',
  '/settings',
]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isPublic = path === '/' || PUBLIC_PREFIXES.some(p => path === p || path.startsWith(p + '/'))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', path + (request.nextUrl.search || ''))
    return NextResponse.redirect(url)
  }

  // Authenticated employees can't reach manager-only routes — silently bounce.
  if (user && MANAGER_ONLY_PREFIXES.some(p => path === p || path.startsWith(p + '/'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile && !isManagerRole(profile.role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
