'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, isSameDay, addDays } from 'date-fns'
import {
  Profile, Employee, Role, Shift, Schedule, EmployeeWriteup, EmployeePraise,
} from '@/types'
import {
  Clock, Coffee, CalendarX, Bell, CheckCircle, X,
  CalendarCheck, AlertCircle, Star, MapPin, ArrowLeftRight, CalendarOff,
} from 'lucide-react'
import { cn, formatTime, getShiftDuration } from '@/lib/utils'
import { Toast, ToastState } from '@/components/ui/toast'

type ShiftWithJoins = Shift & {
  schedule?: Pick<Schedule, 'id' | 'published' | 'week_start' | 'week_end'> | null
  role?: Pick<Role, 'id' | 'name' | 'color'> | null
}

type NotificationRow = {
  id: string
  type: string
  schedule_id: string | null
  reference_id: string | null
  shift_drop_request_id?: string | null
  shift_trade_request_id?: string | null
  created_at: string
  schedule?: { week_start: string; week_end: string } | null
}

type TradeRequestRow = {
  id: string
  status: string
  requester_id: string
  recipient_id: string
  message: string | null
  requester_shift?: { id: string; date: string; start_time: string; end_time: string; role?: { name: string; color: string } | null } | null
  recipient_shift?: { id: string; date: string; start_time: string; end_time: string; role?: { name: string; color: string } | null } | null
  requester?: { id: string; profile?: { full_name?: string } | null } | null
  recipient?: { id: string; profile?: { full_name?: string } | null } | null
}

type DropRequestRow = {
  id: string
  status: string
  shift?: { id: string; date: string; start_time: string; end_time: string; role?: { name: string; color: string } | null } | null
}

interface Props {
  profile: Profile
  employee: Employee & { role?: Role }
  weekStart: string // ISO YYYY-MM-DD (Sunday start, matches existing convention)
  weekEnd: string
  todayISO: string
  shifts: ShiftWithJoins[]
  notifications: NotificationRow[]
  timeOffCount: number
  storeName: string
  writeups: EmployeeWriteup[]
  praise: EmployeePraise[]
  managersById: Record<string, string>
  monthHours: number
  tradeRequests: TradeRequestRow[]
  dropRequests: DropRequestRow[]
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const DAY_LETTERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function EmployeeDashboard({
  profile, employee, weekStart, weekEnd, todayISO, shifts,
  notifications: initialNotifications, timeOffCount, storeName,
  writeups, praise, managersById, monthHours,
  tradeRequests, dropRequests,
}: Props) {
  const supabase = createClient()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [tradeStateById, setTradeStateById] = useState<Record<string, 'accepted' | 'declined'>>({})
  const [toast, setToast] = useState<ToastState | null>(null)

  const firstName = (profile.full_name || 'there').split(' ')[0]
  const today = useMemo(() => parseISO(todayISO), [todayISO])

  // Today's shift is the published shift on todayISO for this employee
  const todayShift = useMemo(() => {
    return shifts.find(s => s.date === todayISO && s.schedule?.published)
  }, [shifts, todayISO])

  // Today's schedule (any row covering today, published or not) — used to decide between "off today"
  // and "schedule not published yet".
  const todaySchedulePublished = useMemo(() => {
    const sched = shifts.find(s => s.schedule && s.date >= s.schedule.week_start && s.date <= s.schedule.week_end && isSameDay(parseISO(s.date), today))
    if (sched) return sched.schedule?.published ?? false
    // Fallback: check if any shift in the current week is from a published schedule
    return shifts.some(s => s.schedule?.published && s.date >= weekStart && s.date <= weekEnd)
  }, [shifts, today, todayISO, weekStart, weekEnd])

  // Next upcoming shift after today (published only)
  const nextShift = useMemo(() => {
    return shifts
      .filter(s => s.schedule?.published && s.date > todayISO)
      .sort((a, b) => a.date.localeCompare(b.date))[0]
  }, [shifts, todayISO])

  // This week's days (Sun→Sat to match getWeekStart) with optional shift
  const weekDays = useMemo(() => {
    const start = parseISO(weekStart)
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i)
      const iso = format(date, 'yyyy-MM-dd')
      const shift = shifts.find(s => s.date === iso && s.schedule?.published)
      return { date, iso, shift }
    })
  }, [weekStart, shifts])

  // This week hours from published shifts
  const weekHours = useMemo(() => {
    return shifts
      .filter(s => s.schedule?.published && s.date >= weekStart && s.date <= weekEnd)
      .reduce((sum, s) => sum + getShiftDuration(s.start_time, s.end_time), 0)
  }, [shifts, weekStart, weekEnd])

  const markRead = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  const writeupById = useMemo(() => Object.fromEntries(writeups.map(w => [w.id, w])), [writeups])
  const praiseById = useMemo(() => Object.fromEntries(praise.map(p => [p.id, p])), [praise])
  const tradeById = useMemo(() => Object.fromEntries(tradeRequests.map(t => [t.id, t])), [tradeRequests])
  const dropById = useMemo(() => Object.fromEntries(dropRequests.map(d => [d.id, d])), [dropRequests])

  const formatShiftSlot = (s: { date: string; start_time: string; end_time: string } | null | undefined) => {
    if (!s) return '—'
    return `${format(parseISO(s.date), 'EEE')} ${formatTime(s.start_time)}–${formatTime(s.end_time)}`
  }

  const acceptTrade = async (notif: NotificationRow, trade: TradeRequestRow) => {
    const { error } = await supabase
      .from('shift_trade_requests')
      .update({
        status: 'pending_manager',
        recipient_response: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trade.id)
    if (error) {
      setToast({ kind: 'error', message: 'Could not accept trade' })
      return
    }
    setTradeStateById(prev => ({ ...prev, [trade.id]: 'accepted' }))

    if (profile.organization_id) {
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .in('role', ['manager', 'admin_manager'])
      if (managers && managers.length > 0) {
        await supabase.from('notifications').insert(
          managers.map(m => ({
            profile_id: m.id,
            type: 'shift_trade_approval_needed',
            shift_trade_request_id: trade.id,
            reference_id: trade.id,
          }))
        )
      }
    }
    setToast({ kind: 'success', message: 'Trade accepted — your manager will make the final call' })
  }

  const declineTrade = async (notif: NotificationRow, trade: TradeRequestRow) => {
    const { error } = await supabase
      .from('shift_trade_requests')
      .update({
        status: 'denied',
        recipient_response: 'declined',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trade.id)
    if (error) {
      setToast({ kind: 'error', message: 'Could not decline trade' })
      return
    }

    // Notify requester
    const { data: requesterEmp } = await supabase
      .from('employees')
      .select('profile_id')
      .eq('id', trade.requester_id)
      .maybeSingle()
    if (requesterEmp?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: requesterEmp.profile_id,
        employee_id: trade.requester_id,
        type: 'shift_trade_declined',
        shift_trade_request_id: trade.id,
        reference_id: trade.id,
      })
    }

    setNotifications(prev => prev.filter(n => n.id !== notif.id))
    await supabase.from('notifications').update({ read: true }).eq('id', notif.id)
    setToast({ kind: 'success', message: 'Trade request declined' })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 sm:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-[#e8e8f0]">
            {greeting()}, {firstName}
          </h1>
          <p className="text-sm text-[#888899] mt-1">
            {format(today, 'EEEE, MMMM d')}
          </p>
        </div>

        {/* Today's shift */}
        <section>
          {todayShift ? (
            <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-5 border-l-4 border-l-indigo-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock size={20} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-[#888899]">You&apos;re working today</div>
                  <div className="text-lg font-semibold text-[#e8e8f0] mt-0.5">
                    {formatTime(todayShift.start_time)} – {formatTime(todayShift.end_time)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#888899]">
                    {todayShift.role && (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: todayShift.role.color }}
                        />
                        {todayShift.role.name}
                      </span>
                    )}
                    {storeName && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} />
                        {storeName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : !todaySchedulePublished ? (
            <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1a1a24] flex items-center justify-center flex-shrink-0">
                  <CalendarX size={20} className="text-[#888899]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-semibold text-[#e8e8f0]">Schedule not published yet</div>
                  <p className="text-xs text-[#888899] mt-1">Check back once your manager has finalized this week&apos;s schedule.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1a1a24] flex items-center justify-center flex-shrink-0">
                  <Coffee size={20} className="text-[#888899]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-semibold text-[#e8e8f0]">You&apos;re off today</div>
                  {nextShift ? (
                    <p className="text-xs text-[#888899] mt-1">
                      Next shift: <span className="text-[#e8e8f0]">{format(parseISO(nextShift.date), 'EEE, MMM d')}</span> · {formatTime(nextShift.start_time)} – {formatTime(nextShift.end_time)}
                    </p>
                  ) : (
                    <p className="text-xs text-[#888899] mt-1">Nothing scheduled coming up.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Week strip */}
        <section>
          <h2 className="text-sm font-semibold text-[#e8e8f0] mb-3">This week</h2>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(({ date, iso, shift }) => {
              const isTodayCard = iso === todayISO
              return (
                <div
                  key={iso}
                  className={cn(
                    'rounded-xl border bg-[#111118] p-3 flex flex-col items-center text-center',
                    isTodayCard ? 'border-indigo-500' : 'border-[#2a2a3a]'
                  )}
                >
                  <div className={cn('text-[10px] uppercase tracking-wider', isTodayCard ? 'text-indigo-400' : 'text-[#888899]')}>
                    {DAY_LETTERS[date.getDay()]}
                  </div>
                  <div className={cn('text-lg font-bold mt-0.5', isTodayCard ? 'text-indigo-300' : 'text-[#e8e8f0]')}>
                    {format(date, 'd')}
                  </div>
                  {shift ? (
                    <div className="text-[10px] text-[#888899] mt-2 leading-tight">
                      <div>{formatTime(shift.start_time)}</div>
                      <div>{formatTime(shift.end_time)}</div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[#888899]/50 mt-2">Off</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Notifications */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bell size={14} className="text-[#888899]" />
            <h2 className="text-sm font-semibold text-[#e8e8f0]">Notifications</h2>
            {notifications.length > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25">
                {notifications.length}
              </span>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-6 flex items-center justify-center gap-2 text-sm text-[#888899]">
              <CheckCircle size={14} className="text-green-400" />
              You&apos;re all caught up
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map(n => {
                if (n.type === 'schedule_published' && n.schedule) {
                  const start = format(parseISO(n.schedule.week_start), 'MMM d')
                  const end = format(parseISO(n.schedule.week_end), 'MMM d')
                  return (
                    <NotificationCard
                      key={n.id}
                      icon={<CalendarCheck size={16} className="text-green-400" />}
                      iconBg="bg-green-500/10 border-green-500/30"
                      text={<>Your schedule for the week of <strong className="text-[#e8e8f0]">{start} – {end}</strong> has been published.</>}
                      actionLabel="View Schedule"
                      actionHref="/schedule"
                      onDismiss={() => markRead(n.id)}
                    />
                  )
                }
                if (n.type === 'writeup_received') {
                  const w = n.reference_id ? writeupById[n.reference_id] : undefined
                  const managerName = w?.manager_id ? managersById[w.manager_id] || 'a manager' : 'a manager'
                  return (
                    <NotificationCard
                      key={n.id}
                      accent="border-l-4 border-l-rose-500"
                      icon={<AlertCircle size={16} className="text-rose-400" />}
                      iconBg="bg-rose-500/10 border-rose-500/30"
                      text={<>You have a new write-up from <strong className="text-[#e8e8f0]">{managerName}</strong> that requires your acknowledgment.</>}
                      actionLabel="Review & Acknowledge"
                      actionHref={`/portal?tab=performance${n.reference_id ? `&writeup=${n.reference_id}` : ''}`}
                      onDismiss={() => markRead(n.id)}
                    />
                  )
                }
                if (n.type === 'praise_received') {
                  const p = n.reference_id ? praiseById[n.reference_id] : undefined
                  const managerName = p?.manager_id ? managersById[p.manager_id] || 'a manager' : 'a manager'
                  return (
                    <NotificationCard
                      key={n.id}
                      accent="border-l-4 border-l-amber-500"
                      icon={<Star size={16} className="text-amber-400" />}
                      iconBg="bg-amber-500/10 border-amber-500/30"
                      text={<><strong className="text-[#e8e8f0]">{managerName}</strong> recognized you for outstanding performance.</>}
                      actionLabel="View Praise"
                      actionHref={`/portal?tab=performance${n.reference_id ? `&praise=${n.reference_id}` : ''}`}
                      onDismiss={() => markRead(n.id)}
                    />
                  )
                }
                if (n.type === 'shift_trade_request') {
                  const trade = n.shift_trade_request_id ? tradeById[n.shift_trade_request_id] : undefined
                  if (!trade) return null
                  const requesterName = trade.requester?.profile?.full_name || 'A teammate'
                  const localState = tradeStateById[trade.id]
                  return (
                    <div key={n.id} className="relative rounded-xl border border-[#2a2a3a] bg-[#111118] p-4 border-l-4 border-l-indigo-500">
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        aria-label="Mark as read"
                        className="absolute top-2.5 right-2.5 p-1 rounded-md text-[#888899] hover:text-[#e8e8f0] hover:bg-[#1a1a24] transition-colors"
                      >
                        <X size={13} />
                      </button>
                      <div className="flex items-start gap-3 pr-6">
                        <div className="w-9 h-9 rounded-lg border bg-indigo-500/10 border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                          <ArrowLeftRight size={16} className="text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#888899] leading-relaxed">
                            <strong className="text-[#e8e8f0]">{requesterName}</strong> wants to trade shifts with you — they&apos;ll take your{' '}
                            <strong className="text-[#e8e8f0]">{formatShiftSlot(trade.recipient_shift)}</strong> shift and give you their{' '}
                            <strong className="text-[#e8e8f0]">{formatShiftSlot(trade.requester_shift)}</strong> shift.
                          </p>
                          {localState === 'accepted' ? (
                            <p className="text-xs text-[#888899] mt-2 italic">
                              You accepted this trade — waiting for manager approval
                            </p>
                          ) : (
                            <div className="flex gap-2 mt-3">
                              <button
                                type="button"
                                onClick={() => acceptTrade(n, trade)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-green-500/15 text-green-300 border border-green-500/40 hover:bg-green-500/25 transition-colors"
                              >
                                Accept Trade
                              </button>
                              <button
                                type="button"
                                onClick={() => declineTrade(n, trade)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-md text-red-300/80 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }
                if (n.type === 'shift_trade_approved') {
                  return (
                    <NotificationCard
                      key={n.id}
                      icon={<ArrowLeftRight size={16} className="text-green-400" />}
                      iconBg="bg-green-500/10 border-green-500/30"
                      text={<>Your shift trade was approved. Your schedule has been updated.</>}
                      actionLabel="View Schedule"
                      actionHref="/schedule"
                      onDismiss={() => markRead(n.id)}
                    />
                  )
                }
                if (n.type === 'shift_trade_declined') {
                  const trade = n.shift_trade_request_id ? tradeById[n.shift_trade_request_id] : undefined
                  const otherName = trade?.recipient?.profile?.full_name || 'Your teammate'
                  return (
                    <NotificationCard
                      key={n.id}
                      icon={<ArrowLeftRight size={16} className="text-red-400" />}
                      iconBg="bg-red-500/10 border-red-500/30"
                      text={<><strong className="text-[#e8e8f0]">{otherName}</strong> declined your trade request.</>}
                      actionLabel="View Schedule"
                      actionHref="/schedule"
                      onDismiss={() => markRead(n.id)}
                    />
                  )
                }
                if (n.type === 'shift_trade_denied') {
                  return (
                    <NotificationCard
                      key={n.id}
                      icon={<ArrowLeftRight size={16} className="text-red-400" />}
                      iconBg="bg-red-500/10 border-red-500/30"
                      text={<>Your shift trade was denied by your manager.</>}
                      actionLabel="View Schedule"
                      actionHref="/schedule"
                      onDismiss={() => markRead(n.id)}
                    />
                  )
                }
                if (n.type === 'shift_drop_approved') {
                  const drop = n.shift_drop_request_id ? dropById[n.shift_drop_request_id] : undefined
                  const slot = drop?.shift ? formatShiftSlot(drop.shift) : 'that'
                  return (
                    <NotificationCard
                      key={n.id}
                      icon={<CalendarOff size={16} className="text-green-400" />}
                      iconBg="bg-green-500/10 border-green-500/30"
                      text={<>Your request to drop your <strong className="text-[#e8e8f0]">{slot}</strong> shift was approved.</>}
                      actionLabel="View Schedule"
                      actionHref="/schedule"
                      onDismiss={() => markRead(n.id)}
                    />
                  )
                }
                if (n.type === 'shift_drop_denied') {
                  const drop = n.shift_drop_request_id ? dropById[n.shift_drop_request_id] : undefined
                  const slot = drop?.shift ? formatShiftSlot(drop.shift) : 'that'
                  return (
                    <NotificationCard
                      key={n.id}
                      icon={<CalendarOff size={16} className="text-red-400" />}
                      iconBg="bg-red-500/10 border-red-500/30"
                      text={<>Your request to drop your <strong className="text-[#e8e8f0]">{slot}</strong> shift was denied by your manager.</>}
                      actionLabel="View Schedule"
                      actionHref="/schedule"
                      onDismiss={() => markRead(n.id)}
                    />
                  )
                }
                return null
              })}
            </div>
          )}
        </section>

        {/* Quick stats */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="This Week" value={`${weekHours.toFixed(1)} h`} />
            <StatCard label="This Month" value={`${monthHours.toFixed(1)} h`} />
            <StatCard label="Upcoming Days Off" value={String(timeOffCount)} />
          </div>
        </section>
      </div>
      <Toast toast={toast} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-[#888899]">{label}</div>
      <div className="text-lg font-semibold text-[#e8e8f0] mt-1">{value}</div>
    </div>
  )
}

function NotificationCard({
  icon, iconBg, text, actionLabel, actionHref, onDismiss, accent,
}: {
  icon: React.ReactNode
  iconBg: string
  text: React.ReactNode
  actionLabel: string
  actionHref: string
  onDismiss: () => void
  accent?: string
}) {
  return (
    <div className={cn('relative rounded-xl border border-[#2a2a3a] bg-[#111118] p-4', accent)}>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Mark as read"
        title="Mark as read"
        className="absolute top-2.5 right-2.5 p-1 rounded-md text-[#888899] hover:text-[#e8e8f0] hover:bg-[#1a1a24] transition-colors"
      >
        <X size={13} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0', iconBg)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#888899] leading-relaxed">{text}</p>
          <Link
            href={actionHref}
            className="inline-flex items-center text-xs font-semibold text-indigo-400 hover:text-indigo-300 mt-2"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
