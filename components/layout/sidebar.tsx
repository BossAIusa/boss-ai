'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  CalendarDays,
  BarChart2,
  PackageSearch,
  TrendingUp,
  Bot,
  LogOut,
  User,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { isManagerRole } from '@/lib/utils'

interface SidebarProps {
  profile: Profile
  storeName?: string
}

type NavItem = { href: string; label: string; icon: LucideIcon }

const managerNavGroups: NavItem[][] = [
  [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  ],
  [
    { href: '/analytics', label: 'Analytics', icon: BarChart2 },
    { href: '/inventory', label: 'Inventory', icon: PackageSearch },
    { href: '/employee-performance', label: 'Employee Performance', icon: TrendingUp },
  ],
  [
    { href: '/ai-assistant', label: 'AI Assistant', icon: Bot },
  ],
]

const employeeNavGroups: NavItem[][] = [
  [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  ],
]

export function Sidebar({ profile, storeName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const groups = isManagerRole(profile.role) ? managerNavGroups : employeeNavGroups

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
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold text-[#e8e8f0] tracking-tight leading-tight">Boss AI</span>
            {storeName && (
              <span className="text-[11px] text-[#888899] truncate leading-tight">{storeName}</span>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {groups.map((items, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 && (
              <div className="my-2 mx-1 border-t border-[#2a2a3a]/60" />
            )}
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 pr-3 py-2.5 rounded-lg text-sm font-medium border-l-2 transition-all duration-150',
                      // left padding shrinks by 2px to compensate for the border so labels stay aligned
                      'pl-[10px]',
                      active
                        ? 'bg-[#6366f118] text-[#818cf8] border-[#6366f1]'
                        : 'text-[#888899] border-transparent hover:text-[#e8e8f0] hover:bg-[#1a1a24]'
                    )}
                  >
                    <Icon size={18} />
                    <span className="truncate">{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-[#2a2a3a]">
        <div className="flex items-center gap-1">
          <Link href="/profile" className="flex-1 flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[#1a1a24] transition-all min-w-0">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <User size={13} className="text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#e8e8f0] truncate">{profile.full_name || 'User'}</div>
              <div className="text-[10px] text-[#888899] capitalize">{profile.role}</div>
            </div>
          </Link>
          {isManagerRole(profile.role) && (
            <Link
              href="/settings"
              aria-label="Settings"
              title="Settings"
              className="p-2 rounded-lg text-[#888899] hover:text-[#e8e8f0] hover:bg-[#1a1a24] transition-colors"
            >
              <Settings size={16} />
            </Link>
          )}
        </div>
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
