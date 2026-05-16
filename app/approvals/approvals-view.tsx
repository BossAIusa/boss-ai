'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { TimeOffRequest, AvailabilityChangeRequest } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Toast, ToastState } from '@/components/ui/toast'
import { getInitials, stringToColor, DAY_NAMES, formatTime } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import {
  CheckCircle, XCircle, Clock, Calendar, RefreshCw, AlertCircle, ArrowRight,
  ArrowLeftRight, CalendarOff,
} from 'lucide-react'

interface CoverageShift {
  id: string
  employee_id: string
  date: string
}

type ShiftSummary = {
  id: string
  employee_id: string
  date: string
  start_time: string
  end_time: string
  role?: { name: string; color: string } | null
}

type TradeRequest = {
  id: string
  status: string
  requester_id: string
  recipient_id: string
  message: string | null
  created_at: string
  updated_at: string
  requester?: { id: string; profile?: { full_name?: string } | null } | null
  recipient?: { id: string; profile?: { full_name?: string } | null } | null
  requester_shift?: ShiftSummary | null
  recipient_shift?: ShiftSummary | null
}

type DropRequest = {
  id: string
  status: string
  reason: string | null
  employee_id: string
  shift_id: string
  created_at: string
  resolved_at: string | null
  employee?: { id: string; profile?: { full_name?: string } | null } | null
  shift?: ShiftSummary | null
}

interface ApprovalsViewProps {
  timeOffRequests: TimeOffRequest[]
  availabilityRequests: AvailabilityChangeRequest[]
  coverageShifts: CoverageShift[]
  tradeRequests: TradeRequest[]
  dropRequests: DropRequest[]
  managerId: string
}

type Tab = 'time-off' | 'availability' | 'trades' | 'drops'

export function ApprovalsView({
  timeOffRequests: initial_tor,
  availabilityRequests: initial_ar,
  coverageShifts,
  tradeRequests: initial_trades,
  dropRequests: initial_drops,
  managerId,
}: ApprovalsViewProps) {
  const [tab, setTab] = useState<Tab>('time-off')
  const [timeOffRequests, setTimeOffRequests] = useState(initial_tor)
  const [availabilityRequests, setAvailabilityRequests] = useState(initial_ar)
  const [trades, setTrades] = useState(initial_trades)
  const [drops, setDrops] = useState(initial_drops)
  const [toast, setToast] = useState<ToastState | null>(null)
  const supabase = createClient()

  const pendingTO = timeOffRequests.filter(r => r.status === 'pending')
  const pendingAV = availabilityRequests.filter(r => r.status === 'pending')
  const pendingTrades = trades.filter(t => t.status === 'pending_manager')
  const pendingDrops = drops.filter(d => d.status === 'pending')
  const totalPending = pendingTO.length + pendingAV.length + pendingTrades.length + pendingDrops.length

  const reviewTimeOff = async (id: string, status: 'approved' | 'denied') => {
    await supabase.from('time_off_requests').update({
      status,
      reviewed_by: managerId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)

    if (status === 'approved') {
      const req = timeOffRequests.find(r => r.id === id)
      if (req) {
        const startDate = parseISO(req.start_date)
        const endDate = parseISO(req.end_date)
        const dates = []
        let current = startDate
        while (current <= endDate) {
          dates.push(format(current, 'yyyy-MM-dd'))
          current = new Date(current.setDate(current.getDate() + 1))
        }
        for (const date of dates) {
          await supabase.from('availability_exceptions').upsert({
            employee_id: req.employee_id,
            date,
            is_available: false,
            reason: req.reason || 'Approved time off',
          }, { onConflict: 'employee_id,date' })
        }
      }
    }

    setTimeOffRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const reviewAvailability = async (id: string, status: 'approved' | 'denied') => {
    const req = availabilityRequests.find(r => r.id === id)

    await supabase.from('availability_change_requests').update({
      status,
      reviewed_by: managerId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)

    if (status === 'approved' && req) {
      await supabase.from('availability').upsert({
        employee_id: req.employee_id,
        day_of_week: req.day_of_week,
        start_time: req.new_start_time,
        end_time: req.new_end_time,
        is_available: req.new_is_available,
      }, { onConflict: 'employee_id,day_of_week' })
    }

    setAvailabilityRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const notifyEmployees = async (employeeIds: string[], payload: Record<string, unknown>) => {
    if (employeeIds.length === 0) return
    const { data: emps } = await supabase
      .from('employees')
      .select('id, profile_id')
      .in('id', employeeIds)
    if (!emps || emps.length === 0) return
    await supabase.from('notifications').insert(
      emps
        .filter(e => e.profile_id)
        .map(e => ({ ...payload, employee_id: e.id, profile_id: e.profile_id }))
    )
  }

  const approveTrade = async (trade: TradeRequest) => {
    if (!trade.requester_shift || !trade.recipient_shift) return
    const { error: tradeErr } = await supabase
      .from('shift_trade_requests')
      .update({ status: 'approved', manager_id: managerId, updated_at: new Date().toISOString() })
      .eq('id', trade.id)
    if (tradeErr) {
      setToast({ kind: 'error', message: 'Could not approve trade' })
      return
    }
    // Swap employee_id values
    await Promise.all([
      supabase.from('shifts').update({ employee_id: trade.recipient_id }).eq('id', trade.requester_shift.id),
      supabase.from('shifts').update({ employee_id: trade.requester_id }).eq('id', trade.recipient_shift.id),
    ])

    await notifyEmployees([trade.requester_id, trade.recipient_id], {
      type: 'shift_trade_approved',
      shift_trade_request_id: trade.id,
      reference_id: trade.id,
    })

    setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, status: 'approved' } : t))
    setToast({ kind: 'success', message: 'Shift trade approved — schedule updated' })
  }

  const denyTrade = async (trade: TradeRequest) => {
    const { error } = await supabase
      .from('shift_trade_requests')
      .update({ status: 'denied', manager_id: managerId, updated_at: new Date().toISOString() })
      .eq('id', trade.id)
    if (error) {
      setToast({ kind: 'error', message: 'Could not deny trade' })
      return
    }
    await notifyEmployees([trade.requester_id, trade.recipient_id], {
      type: 'shift_trade_denied',
      shift_trade_request_id: trade.id,
      reference_id: trade.id,
    })
    setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, status: 'denied' } : t))
    setToast({ kind: 'success', message: 'Shift trade denied' })
  }

  const approveDrop = async (drop: DropRequest) => {
    if (!drop.shift) return
    const { error } = await supabase
      .from('shift_drop_requests')
      .update({ status: 'approved', manager_id: managerId, resolved_at: new Date().toISOString() })
      .eq('id', drop.id)
    if (error) {
      setToast({ kind: 'error', message: 'Could not approve drop' })
      return
    }
    await supabase.from('shifts').delete().eq('id', drop.shift.id)
    await notifyEmployees([drop.employee_id], {
      type: 'shift_drop_approved',
      shift_drop_request_id: drop.id,
      reference_id: drop.id,
    })
    setDrops(prev => prev.map(d => d.id === drop.id ? { ...d, status: 'approved' } : d))
    setToast({ kind: 'success', message: 'Shift drop approved — shift removed from schedule' })
  }

  const denyDrop = async (drop: DropRequest) => {
    const { error } = await supabase
      .from('shift_drop_requests')
      .update({ status: 'denied', manager_id: managerId, resolved_at: new Date().toISOString() })
      .eq('id', drop.id)
    if (error) {
      setToast({ kind: 'error', message: 'Could not deny drop' })
      return
    }
    await notifyEmployees([drop.employee_id], {
      type: 'shift_drop_denied',
      shift_drop_request_id: drop.id,
      reference_id: drop.id,
    })
    setDrops(prev => prev.map(d => d.id === drop.id ? { ...d, status: 'denied' } : d))
    setToast({ kind: 'success', message: 'Shift drop request denied' })
  }

  const getCoverage = (req: TimeOffRequest) => {
    const empSet = new Set<string>()
    for (const s of coverageShifts) {
      if (s.date >= req.start_date && s.date <= req.end_date && s.employee_id !== req.employee_id) {
        empSet.add(s.employee_id)
      }
    }
    return empSet.size
  }

  const getDayCoverage = (date: string, excludeEmployeeId: string) => {
    const empSet = new Set<string>()
    for (const s of coverageShifts) {
      if (s.date === date && s.employee_id !== excludeEmployeeId) empSet.add(s.employee_id)
    }
    return empSet.size
  }

  const coverageBadge = (n: number) => {
    if (n === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle size={11} /> Understaffed — no coverage
        </span>
      )
    }
    if (n === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <AlertCircle size={11} /> Thin coverage — 1 employee
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-500/10 border border-green-500/30 text-green-400">
        <CheckCircle size={11} /> Covered
      </span>
    )
  }

  const formatRange = (start: string, end: string) => {
    const s = parseISO(start)
    const e = parseISO(end)
    if (start === end) return format(s, 'EEE MMM d')
    return `${format(s, 'EEE MMM d')} – ${format(e, 'EEE MMM d')}`
  }

  const formatShift = (s: ShiftSummary | null | undefined) => {
    if (!s) return '—'
    return `${format(parseISO(s.date), 'EEE MMM d')} · ${formatTime(s.start_time)} – ${formatTime(s.end_time)}`
  }

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge color="#22c55e">Approved</Badge>
    if (status === 'denied') return <Badge color="#f43f5e">Denied</Badge>
    if (status === 'pending_recipient') return <Badge color="#f97316">Awaiting employee</Badge>
    if (status === 'pending_manager') return <Badge color="#f97316">Pending</Badge>
    return <Badge color="#f97316">Pending</Badge>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#e8e8f0]">Approvals</h1>
          {totalPending > 0 && (
            <p className="text-sm text-[#888899] mt-0.5">{totalPending} pending review</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-[#111118] border border-[#2a2a3a] rounded-lg p-1 w-fit mb-6">
        <TabButton active={tab === 'time-off'} onClick={() => setTab('time-off')} icon={<Calendar size={13} />} label="Time Off" badge={pendingTO.length} />
        <TabButton active={tab === 'availability'} onClick={() => setTab('availability')} icon={<RefreshCw size={13} />} label="Availability" badge={pendingAV.length} />
        <TabButton active={tab === 'trades'} onClick={() => setTab('trades')} icon={<ArrowLeftRight size={13} />} label="Shift Trades" badge={pendingTrades.length} />
        <TabButton active={tab === 'drops'} onClick={() => setTab('drops')} icon={<CalendarOff size={13} />} label="Shift Drops" badge={pendingDrops.length} />
      </div>

      {tab === 'time-off' && (
        <div className="space-y-3">
          {timeOffRequests.length === 0 && (
            <div className="text-center py-16 text-[#888899]">
              <Clock size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No time off requests</p>
            </div>
          )}
          {timeOffRequests.map(req => {
            const name = req.employee?.profile?.full_name || 'Unknown'
            const color = stringToColor(req.employee_id)
            const isPending = req.status === 'pending'
            const coverage = isPending ? getCoverage(req) : null
            return (
              <div key={req.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4 flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#e8e8f0] text-sm">{name}</span>
                    {statusBadge(req.status)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-[#888899]">
                    <span>{formatRange(req.start_date, req.end_date)}</span>
                    <Link
                      href={`/schedule?date=${req.start_date}`}
                      className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      View schedule <ArrowRight size={11} />
                    </Link>
                  </div>
                  {req.reason && <div className="text-xs text-[#888899] mt-1">&ldquo;{req.reason}&rdquo;</div>}
                  {isPending && coverage !== null && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-[#888899]/70">Coverage impact</span>
                      {coverageBadge(coverage)}
                    </div>
                  )}
                  <div className="text-[10px] text-[#888899]/60 mt-1">
                    {format(parseISO(req.created_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                {isPending && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewTimeOff(req.id, 'denied')}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[#888899] hover:text-red-400 transition-colors"
                    >
                      <XCircle size={16} />
                    </button>
                    <button
                      onClick={() => reviewTimeOff(req.id, 'approved')}
                      className="p-2 rounded-lg hover:bg-green-500/10 text-[#888899] hover:text-green-400 transition-colors"
                    >
                      <CheckCircle size={16} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'availability' && (
        <div className="space-y-3">
          {availabilityRequests.length === 0 && (
            <div className="text-center py-16 text-[#888899]">
              <RefreshCw size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No availability change requests</p>
            </div>
          )}
          {availabilityRequests.map(req => {
            const name = req.employee?.profile?.full_name || 'Unknown'
            const color = stringToColor(req.employee_id)
            return (
              <div key={req.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4 flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {getInitials(name)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#e8e8f0] text-sm">{name}</span>
                    {statusBadge(req.status)}
                  </div>
                  <div className="text-xs text-[#888899]">
                    {DAY_NAMES[req.day_of_week]}: {' '}
                    {req.new_is_available
                      ? `${formatTime(req.new_start_time)} – ${formatTime(req.new_end_time)}`
                      : 'Not available'}
                  </div>
                  {req.reason && <div className="text-xs text-[#888899] mt-1">&ldquo;{req.reason}&rdquo;</div>}
                  <div className="text-[10px] text-[#888899]/60 mt-1">
                    {format(parseISO(req.created_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewAvailability(req.id, 'denied')}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[#888899] hover:text-red-400 transition-colors"
                    >
                      <XCircle size={16} />
                    </button>
                    <button
                      onClick={() => reviewAvailability(req.id, 'approved')}
                      className="p-2 rounded-lg hover:bg-green-500/10 text-[#888899] hover:text-green-400 transition-colors"
                    >
                      <CheckCircle size={16} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'trades' && (
        <div className="space-y-3">
          {trades.length === 0 && (
            <div className="text-center py-16 text-[#888899]">
              <ArrowLeftRight size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No shift trade requests</p>
            </div>
          )}
          {trades.map(t => {
            const requesterName = t.requester?.profile?.full_name || 'Unknown'
            const recipientName = t.recipient?.profile?.full_name || 'Unknown'
            const isPending = t.status === 'pending_manager'
            const reqCoverage = isPending && t.requester_shift ? getDayCoverage(t.requester_shift.date, t.requester_id) : null
            const recCoverage = isPending && t.recipient_shift ? getDayCoverage(t.recipient_shift.date, t.recipient_id) : null
            return (
              <div key={t.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {statusBadge(t.status)}
                  {t.status === 'pending_manager' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-500/10 border border-green-500/30 text-green-400">
                      <CheckCircle size={11} /> Both employees agreed
                    </span>
                  )}
                  <span className="text-[10px] text-[#888899]/60 ml-auto">
                    {format(parseISO(t.created_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                  <TradeSide name={requesterName} shift={t.requester_shift} />
                  <div className="flex items-center justify-center text-[#888899]">
                    <ArrowLeftRight size={18} />
                  </div>
                  <TradeSide name={recipientName} shift={t.recipient_shift} />
                </div>
                {t.message && (
                  <div className="mt-3 text-xs text-[#888899] italic">&ldquo;{t.message}&rdquo;</div>
                )}
                {isPending && (reqCoverage !== null || recCoverage !== null) && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    {reqCoverage !== null && t.requester_shift && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-[#888899]/70">
                          {format(parseISO(t.requester_shift.date), 'EEE')} coverage
                        </span>
                        {coverageBadge(reqCoverage)}
                      </div>
                    )}
                    {recCoverage !== null && t.recipient_shift && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-[#888899]/70">
                          {format(parseISO(t.recipient_shift.date), 'EEE')} coverage
                        </span>
                        {coverageBadge(recCoverage)}
                      </div>
                    )}
                  </div>
                )}
                {isPending && (
                  <div className="mt-4 flex gap-2 justify-end">
                    <button
                      onClick={() => denyTrade(t)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md text-red-400 border border-red-500/40 hover:bg-red-500/10 transition-colors"
                    >
                      Deny Trade
                    </button>
                    <button
                      onClick={() => approveTrade(t)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                    >
                      Approve Trade
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'drops' && (
        <div className="space-y-3">
          {drops.length === 0 && (
            <div className="text-center py-16 text-[#888899]">
              <CalendarOff size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No shift drop requests</p>
            </div>
          )}
          {drops.map(d => {
            const name = d.employee?.profile?.full_name || 'Unknown'
            const color = stringToColor(d.employee_id)
            const isPending = d.status === 'pending'
            const coverage = isPending && d.shift ? getDayCoverage(d.shift.date, d.employee_id) : null
            return (
              <div key={d.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4 flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-[#e8e8f0] text-sm">{name}</span>
                    {statusBadge(d.status)}
                  </div>
                  <div className="text-xs text-[#888899]">{formatShift(d.shift)}</div>
                  {d.reason && <div className="text-xs text-[#888899] mt-1">&ldquo;{d.reason}&rdquo;</div>}
                  {isPending && coverage !== null && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-[#888899]/70">Coverage impact</span>
                      {coverageBadge(coverage)}
                    </div>
                  )}
                  <div className="text-[10px] text-[#888899]/60 mt-1">
                    {format(parseISO(d.created_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                {isPending && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => denyDrop(d)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md text-red-400 border border-red-500/40 hover:bg-red-500/10 transition-colors"
                    >
                      Deny
                    </button>
                    <button
                      onClick={() => approveDrop(d)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                    >
                      Approve Drop
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}

function TabButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
        active ? 'bg-[#1a1a24] text-[#e8e8f0]' : 'text-[#888899] hover:text-[#e8e8f0]'
      }`}
    >
      {icon}
      {label}
      {badge > 0 && (
        <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  )
}

function TradeSide({ name, shift }: { name: string; shift: ShiftSummary | null | undefined }) {
  const color = stringToColor(shift?.employee_id || name)
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: `${color}22`, color }}
      >
        {getInitials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#e8e8f0] truncate">{name}</div>
        <div className="text-xs text-[#888899] truncate">
          {shift
            ? `${format(parseISO(shift.date), 'EEE MMM d')} · ${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}${shift.role?.name ? ` · ${shift.role.name}` : ''}`
            : '—'}
        </div>
      </div>
    </div>
  )
}
