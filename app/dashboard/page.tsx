import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/app/layout-dashboard'
import {
  Calendar, Users, Bot, Bell, Plus, ArrowRight, Clock, Sparkles, UserCheck
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns'
import { formatDate, getWeekStart, getWeekEnd, getShiftDuration, getInitials, stringToColor, isManagerRole } from '@/lib/utils'
import { EmployeeDashboard } from './employee-dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  if (!isManagerRole(profile.role)) {
    return await renderEmployeeDashboard(supabase, profile)
  }

  const today = new Date()
  const todayISO = formatDate(today)
  const todayDayOfWeek = today.getDay()
  const weekStart = formatDate(getWeekStart(today))
  const weekEnd = formatDate(getWeekEnd(today))

  const [
    todayShifts,
    availabilityToday,
    pendingTimeOff,
    pendingAvailability,
    weekShifts,
    employeesRes,
  ] = await Promise.all([
    supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('date', todayISO),
    supabase
      .from('availability')
      .select('employee_id', { count: 'exact', head: true })
      .eq('day_of_week', todayDayOfWeek)
      .eq('is_available', true),
    supabase
      .from('time_off_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('availability_change_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('shifts')
      .select('employee_id, start_time, end_time')
      .gte('date', weekStart)
      .lte('date', weekEnd),
    supabase
      .from('employees')
      .select('*, profile:profiles(*), role:roles(*)')
      .order('created_at'),
  ])

  const shiftsToday = todayShifts.count ?? 0
  const availableToday = availabilityToday.count ?? 0
  const pendingTotal = (pendingTimeOff.count ?? 0) + (pendingAvailability.count ?? 0)
  const weekShiftsCount = weekShifts.data?.length ?? 0
  const weekHours = (weekShifts.data ?? []).reduce(
    (sum, s) => sum + getShiftDuration(s.start_time, s.end_time),
    0
  )

  const hoursByEmployee = new Map<string, number>()
  for (const s of weekShifts.data ?? []) {
    hoursByEmployee.set(
      s.employee_id,
      (hoursByEmployee.get(s.employee_id) ?? 0) + getShiftDuration(s.start_time, s.end_time)
    )
  }
  const employees = employeesRes.data ?? []

  const firstName = profile.full_name?.split(' ')[0] || 'there'

  return (
    <DashboardShell>
      <div className="min-h-screen bg-[#0a0a0f] px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-bold text-[#e8e8f0]">
              Welcome back, {firstName}
            </h1>
            <p className="text-sm text-[#888899] mt-1">
              {format(today, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Today's Coverage */}
            <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-[#888899]">
                  Today&apos;s Coverage
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <UserCheck size={16} className="text-indigo-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#e8e8f0]">{shiftsToday}</span>
                <span className="text-sm text-[#888899]">/ {availableToday} available</span>
              </div>
              <p className="text-xs text-[#888899] mt-2">
                {shiftsToday === 1 ? '1 shift scheduled' : `${shiftsToday} shifts scheduled`} today
              </p>
            </div>

            {/* Pending Approvals */}
            <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-[#888899]">
                  Pending Approvals
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <Bell size={16} className="text-rose-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-[#e8e8f0]">{pendingTotal}</div>
              <p className="text-xs text-[#888899] mt-2 mb-3">
                {pendingTimeOff.count ?? 0} time off · {pendingAvailability.count ?? 0} availability
              </p>
              <Link
                href="/approvals"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Review approvals <ArrowRight size={12} />
              </Link>
            </div>

            {/* This Week */}
            <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-[#888899]">
                  This Week
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Clock size={16} className="text-emerald-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#e8e8f0]">{weekShiftsCount}</span>
                <span className="text-sm text-[#888899]">shifts</span>
              </div>
              <p className="text-xs text-[#888899] mt-2">
                {weekHours.toFixed(1)} total hours scheduled
              </p>
            </div>
          </div>

          {/* This Week's Hours */}
          <div>
            <h2 className="flex items-center gap-2 text-[#e8e8f0] text-sm font-semibold mb-3">
              <Clock size={14} className="text-[#888899]" />
              This Week&apos;s Hours
            </h2>
            {employees.length === 0 ? (
              <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-6 text-center text-sm text-[#888899]">
                No team members yet — add employees to track hours
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {employees.map(e => {
                  const fullName = e.profile?.full_name || 'Unknown'
                  const firstName = fullName.split(' ')[0]
                  const color = stringToColor(e.id)
                  const max = e.max_hours_per_week ?? 40
                  const hours = hoursByEmployee.get(e.id) ?? 0
                  const pct = max > 0 ? hours / max : 0
                  const overLimit = max > 0 && hours > max
                  const fillColor = overLimit ? '#f43f5e' : pct >= 0.8 ? '#f97316' : '#6366f1'
                  const barWidth = `${Math.min(100, pct * 100)}%`

                  return (
                    <div key={e.id} className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                          style={{ backgroundColor: `${color}22`, color }}
                        >
                          {getInitials(fullName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#e8e8f0] truncate">{firstName}</div>
                          {e.role?.name && (
                            <div className="text-xs text-[#888899] truncate">{e.role.name}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                        <span className="text-lg font-semibold text-[#e8e8f0]">{hours.toFixed(1)}h</span>
                        <span className="text-xs text-[#888899]">/ {max}h max</span>
                        {overLimit && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            Over limit
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#1a1a24] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width]"
                          style={{ width: barWidth, backgroundColor: fillColor }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#888899] mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/schedule"
                className="group flex items-center gap-3 rounded-xl border border-[#2a2a3a] bg-[#111118] p-4 hover:border-indigo-500/50 hover:bg-[#15151f] transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                  <Plus size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#e8e8f0]">Add Shift</div>
                  <div className="text-xs text-[#888899]">Open the schedule</div>
                </div>
                <Calendar size={14} className="text-[#888899] group-hover:text-indigo-400 transition-colors" />
              </Link>

              <Link
                href="/team"
                className="group flex items-center gap-3 rounded-xl border border-[#2a2a3a] bg-[#111118] p-4 hover:border-indigo-500/50 hover:bg-[#15151f] transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                  <Users size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#e8e8f0]">Add Team Member</div>
                  <div className="text-xs text-[#888899]">Invite an employee</div>
                </div>
                <ArrowRight size={14} className="text-[#888899] group-hover:text-indigo-400 transition-colors" />
              </Link>

              <Link
                href="/ai-assistant"
                className="group flex items-center gap-3 rounded-xl border border-[#2a2a3a] bg-[#111118] p-4 hover:border-indigo-500/50 hover:bg-[#15151f] transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                  <Bot size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#e8e8f0]">View AI Assistant</div>
                  <div className="text-xs text-[#888899]">Ask anything</div>
                </div>
                <Sparkles size={14} className="text-[#888899] group-hover:text-indigo-400 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

async function renderEmployeeDashboard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { id: string; full_name: string; email: string; role: string }
) {
  const { data: employee } = await supabase
    .from('employees')
    .select('*, role:roles(*)')
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (!employee) {
    // No employee record yet — likely mid-migration. Send to login rather than loop here.
    redirect('/auth/login')
  }

  const today = new Date()
  const todayISO = formatDate(today)
  const weekStartDate = getWeekStart(today)
  const weekEndDate = getWeekEnd(today)
  const weekStart = formatDate(weekStartDate)
  const weekEnd = formatDate(weekEndDate)
  const monthStart = formatDate(startOfMonth(today))
  const monthEnd = formatDate(endOfMonth(today))
  const sixtyDaysOut = formatDate(addDays(today, 60))
  const thirtyDaysOut = formatDate(addDays(today, 30))

  const [
    { data: shifts },
    { data: ownNotifs },
    { data: profileNotifs },
    { data: timeOff },
    { data: storeSettings },
    { data: writeups },
    { data: praise },
    { data: tradeRequests },
    { data: dropRequests },
  ] = await Promise.all([
    supabase
      .from('shifts')
      .select('*, schedule:schedules(id, published, week_start, week_end), role:roles(id, name, color)')
      .eq('employee_id', employee.id)
      .gte('date', monthStart)
      .lte('date', sixtyDaysOut)
      .order('date'),
    supabase
      .from('notifications')
      .select('id, type, schedule_id, reference_id, shift_drop_request_id, shift_trade_request_id, created_at, schedule:schedules(week_start, week_end)')
      .eq('employee_id', employee.id)
      .eq('read', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('notifications')
      .select('id, type, schedule_id, reference_id, shift_drop_request_id, shift_trade_request_id, created_at, schedule:schedules(week_start, week_end)')
      .eq('profile_id', profile.id)
      .eq('read', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('time_off_requests')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('status', 'approved')
      .gte('start_date', todayISO)
      .lte('start_date', thirtyDaysOut),
    supabase.from('store_settings').select('store_name').maybeSingle(),
    supabase.from('employee_writeups').select('id, manager_id').eq('employee_id', employee.id),
    supabase.from('employee_praise').select('id, manager_id').eq('employee_id', employee.id),
    supabase
      .from('shift_trade_requests')
      .select(`
        id, status, requester_id, recipient_id, message,
        requester_shift:shifts!shift_trade_requests_requester_shift_id_fkey(id, date, start_time, end_time, role:roles(name, color)),
        recipient_shift:shifts!shift_trade_requests_recipient_shift_id_fkey(id, date, start_time, end_time, role:roles(name, color)),
        requester:employees!shift_trade_requests_requester_id_fkey(id, profile:profiles(full_name)),
        recipient:employees!shift_trade_requests_recipient_id_fkey(id, profile:profiles(full_name))
      `)
      .or(`requester_id.eq.${employee.id},recipient_id.eq.${employee.id}`),
    supabase
      .from('shift_drop_requests')
      .select('id, status, shift:shifts(id, date, start_time, end_time, role:roles(name, color))')
      .eq('employee_id', employee.id),
  ])

  const notifications = [...(ownNotifs || []), ...(profileNotifs || [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  // Resolve manager names for writeup/praise notifications
  const managerIds = new Set<string>()
  for (const w of writeups || []) if (w.manager_id) managerIds.add(w.manager_id)
  for (const p of praise || []) if (p.manager_id) managerIds.add(p.manager_id)
  let managersById: Record<string, string> = {}
  if (managerIds.size > 0) {
    const { data: mgrs } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(managerIds))
    managersById = Object.fromEntries((mgrs || []).map(m => [m.id, m.full_name || 'a manager']))
  }

  // Month hours from published shifts in current month
  const monthShifts = (shifts || []).filter(s => s.schedule?.published && s.date >= monthStart && s.date <= monthEnd)
  const monthHours = monthShifts.reduce((sum, s) => sum + getShiftDuration(s.start_time, s.end_time), 0)

  return (
    <DashboardShell>
      <EmployeeDashboard
        profile={profile as never}
        employee={employee as never}
        weekStart={weekStart}
        weekEnd={weekEnd}
        todayISO={todayISO}
        shifts={(shifts as never) || []}
        notifications={(notifications as never) || []}
        timeOffCount={timeOff?.length ?? 0}
        storeName={storeSettings?.store_name || ''}
        writeups={(writeups as never) || []}
        praise={(praise as never) || []}
        managersById={managersById}
        monthHours={monthHours}
        tradeRequests={(tradeRequests as never) || []}
        dropRequests={(dropRequests as never) || []}
      />
    </DashboardShell>
  )
}
