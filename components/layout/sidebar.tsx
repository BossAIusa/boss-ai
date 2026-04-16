'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Calendar, Users, Settings, LogOut, Bot, Bell, User, ChevronRight, LayoutDashboard
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

interface SidebarProps {
  profile: Profile
}

const managerNav = [
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/approvals', label: 'Approvals', icon: Bell },
  { href: '/ai-assistant', label: 'AI Assistant', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const employeeNav = [
  { href: '/portal', label: 'My Portal', icon: LayoutDashboard },
]

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const nav = profile.role === 'manager' ? managerNav : employeeNav

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-screen bg-[#111118] border-r border-[#2a2a3a] fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#2a2a3a]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <span className="text-base font-bold text-[#e8e8f0] tracking-tight">Boss.AI</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-[#888899] hover:text-[#e8e8f0] hover:bg-[#1a1a24]'
              )}
            >
              <Icon size={16} />
              {label}
              {active && <ChevronRight size={12} className="ml-auto opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-[#2a2a3a]">
        <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1a1a24] transition-all group">
          <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <User size={13} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-[#e8e8f0] truncate">{profile.full_name || 'User'}</div>
            <div className="text-[10px] text-[#888899] capitalize">{profile.role}</div>
          </div>
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#888899] hover:text-red-400 hover:bg-red-500/5 transition-all mt-0.5"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
