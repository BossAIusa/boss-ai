'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type AppRole = 'admin_manager' | 'manager' | 'employee'

export type RoleFlags = {
  role: AppRole | null
  isAdminManager: boolean
  isManager: boolean // true for both admin_manager and manager
  isEmployee: boolean
  loading: boolean
}

/**
 * Pure helper — derive role flags from anything that has a `role` field
 * (profile passed down from the server). Prefer this when you already have
 * the profile in scope to avoid an extra Supabase round-trip.
 */
export function roleFlags(input: { role?: string | null } | null | undefined): RoleFlags {
  const role = (input?.role as AppRole | undefined) ?? null
  return {
    role,
    isAdminManager: role === 'admin_manager',
    isManager: role === 'admin_manager' || role === 'manager',
    isEmployee: role === 'employee',
    loading: false,
  }
}

/**
 * Client-side hook — fetches the current user's profile and exposes role flags.
 * Use this in client components that don't already receive a profile prop.
 */
export function useRoleGuard(): RoleFlags {
  const [state, setState] = useState<RoleFlags>({
    role: null,
    isAdminManager: false,
    isManager: false,
    isEmployee: false,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setState(s => ({ ...s, loading: false }))
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      setState({ ...roleFlags(profile), loading: false })
    })()
    return () => { cancelled = true }
  }, [])

  return state
}
