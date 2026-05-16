'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import {
  Employee,
  EmployeeWriteup,
  EmployeePraise,
  WriteupSeverity,
  PraiseCategory,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPE_COLORS,
  WRITEUP_SEVERITY_LABELS,
  WRITEUP_SEVERITY_COLORS,
  PRAISE_CATEGORY_LABELS,
  PRAISE_CATEGORY_COLOR,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { getInitials, stringToColor, cn } from '@/lib/utils'
import {
  ClipboardList,
  Star,
  Plus,
  CheckCircle2,
  ChevronLeft,
  Search,
} from 'lucide-react'

interface ViewProps {
  employees: Employee[]
  writeups: EmployeeWriteup[]
  praise: EmployeePraise[]
}

type SubTab = 'writeups' | 'praise'

const today = () => new Date().toISOString().slice(0, 10)

export function EmployeePerformanceView({ employees, writeups: initialWriteups, praise: initialPraise }: ViewProps) {
  const supabase = createClient()

  const [writeups, setWriteups] = useState(initialWriteups)
  const [praise, setPraise] = useState(initialPraise)
  const [selectedId, setSelectedId] = useState<string | null>(employees[0]?.id ?? null)
  const [subTab, setSubTab] = useState<SubTab>('writeups')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // Modals
  const [writeupModal, setWriteupModal] = useState(false)
  const [writeupForm, setWriteupForm] = useState({
    title: '',
    incident_date: today(),
    severity: 'minor' as WriteupSeverity,
    description: '',
  })
  const [savingWriteup, setSavingWriteup] = useState(false)

  const [praiseModal, setPraiseModal] = useState(false)
  const [praiseForm, setPraiseForm] = useState({
    title: '',
    incident_date: today(),
    category: 'performance' as PraiseCategory,
    description: '',
  })
  const [savingPraise, setSavingPraise] = useState(false)

  const selected = useMemo(
    () => employees.find(e => e.id === selectedId) || null,
    [employees, selectedId]
  )

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees
    const q = search.toLowerCase()
    return employees.filter(e =>
      (e.profile?.full_name || '').toLowerCase().includes(q) ||
      (e.role?.name || '').toLowerCase().includes(q)
    )
  }, [employees, search])

  const writeupsFor = (empId: string) =>
    writeups.filter(w => w.employee_id === empId).sort((a, b) => b.incident_date.localeCompare(a.incident_date))

  const praiseFor = (empId: string) =>
    praise.filter(p => p.employee_id === empId).sort((a, b) => b.incident_date.localeCompare(a.incident_date))

  const flashToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2400)
  }

  const resetWriteupForm = () => {
    setWriteupForm({ title: '', incident_date: today(), severity: 'minor', description: '' })
  }
  const resetPraiseForm = () => {
    setPraiseForm({ title: '', incident_date: today(), category: 'performance', description: '' })
  }

  const submitWriteup = async () => {
    if (!selected) return
    setSavingWriteup(true)
    const { data, error } = await supabase
      .from('employee_writeups')
      .insert({
        employee_id: selected.id,
        title: writeupForm.title,
        description: writeupForm.description,
        severity: writeupForm.severity,
        incident_date: writeupForm.incident_date,
      })
      .select()
      .single()

    if (!error && data) {
      setWriteups(prev => [data, ...prev])
      await supabase.from('notifications').insert({
        employee_id: selected.id,
        type: 'writeup_received',
        reference_id: data.id,
      })
      flashToast(`Write-up sent to ${selected.profile?.full_name || 'employee'}`)
      setWriteupModal(false)
      resetWriteupForm()
    }
    setSavingWriteup(false)
  }

  const submitPraise = async () => {
    if (!selected) return
    setSavingPraise(true)
    const { data, error } = await supabase
      .from('employee_praise')
      .insert({
        employee_id: selected.id,
        title: praiseForm.title,
        description: praiseForm.description,
        category: praiseForm.category,
        incident_date: praiseForm.incident_date,
      })
      .select()
      .single()

    if (!error && data) {
      setPraise(prev => [data, ...prev])
      await supabase.from('notifications').insert({
        employee_id: selected.id,
        type: 'praise_received',
        reference_id: data.id,
      })
      flashToast(`Praise sent to ${selected.profile?.full_name || 'employee'}`)
      setPraiseModal(false)
      resetPraiseForm()
    }
    setSavingPraise(false)
  }

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      {/* Left panel: employee list */}
      <aside
        className={cn(
          'w-full md:w-[280px] flex-shrink-0 flex flex-col border-r border-[#2a2a3a] bg-[#0d0d14]',
          selected ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="px-4 pt-5 pb-3 border-b border-[#2a2a3a]">
          <h1 className="text-base font-bold text-[#e8e8f0]">Employee Performance</h1>
          <p className="text-xs text-[#888899] mt-0.5">{employees.length} team members</p>
          <div className="relative mt-3">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888899]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-[#1a1a24] border border-[#2a2a3a] text-[#e8e8f0] placeholder-[#888899] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredEmployees.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-[#888899]">
              No employees match your search.
            </div>
          )}
          {filteredEmployees.map(emp => {
            const name = emp.profile?.full_name || 'Unknown'
            const color = stringToColor(emp.id)
            const wCount = writeups.filter(w => w.employee_id === emp.id).length
            const pCount = praise.filter(p => p.employee_id === emp.id).length
            const active = emp.id === selectedId

            return (
              <button
                key={emp.id}
                onClick={() => {
                  setSelectedId(emp.id)
                  setSubTab('writeups')
                  setExpandedId(null)
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                  active
                    ? 'bg-[#6366f118] border border-[#6366f1]/40'
                    : 'border border-transparent hover:bg-[#1a1a24]'
                )}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-medium truncate', active ? 'text-[#e8e8f0]' : 'text-[#e8e8f0]')}>
                    {name}
                  </div>
                  <div className="text-[11px] text-[#888899] truncate">
                    {emp.role?.name || 'No role'}
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end flex-shrink-0">
                  {wCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-red-500/15 text-red-400 border border-red-500/25">
                      {wCount}
                    </span>
                  )}
                  {pCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-green-500/15 text-green-400 border border-green-500/25">
                      {pCount}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Right panel: employee profile */}
      <section
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          selected ? 'flex' : 'hidden md:flex'
        )}
      >
        {selected ? (
          <ProfilePanel
            key={selected.id}
            employee={selected}
            writeups={writeupsFor(selected.id)}
            praise={praiseFor(selected.id)}
            subTab={subTab}
            setSubTab={t => { setSubTab(t); setExpandedId(null) }}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onNewWriteup={() => setWriteupModal(true)}
            onNewPraise={() => setPraiseModal(true)}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <div>
              <ClipboardList size={36} className="text-[#888899] mx-auto mb-3 opacity-50" />
              <p className="text-sm text-[#888899]">Select a team member to view their performance.</p>
            </div>
          </div>
        )}
      </section>

      {/* New Write-Up modal */}
      <Modal
        open={writeupModal}
        onClose={() => { setWriteupModal(false); resetWriteupForm() }}
        title={`New Write-Up${selected ? ` · ${selected.profile?.full_name}` : ''}`}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="Late to scheduled shift"
            value={writeupForm.title}
            onChange={e => setWriteupForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Incident Date"
              type="date"
              value={writeupForm.incident_date}
              onChange={e => setWriteupForm(f => ({ ...f, incident_date: e.target.value }))}
            />
            <Select
              label="Severity"
              value={writeupForm.severity}
              onChange={e => setWriteupForm(f => ({ ...f, severity: e.target.value as WriteupSeverity }))}
            >
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="serious">Serious</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#e8e8f0]">Description</label>
            <textarea
              rows={4}
              placeholder="Describe the incident, context, and expected behavior going forward..."
              value={writeupForm.description}
              onChange={e => setWriteupForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-[#e8e8f0] placeholder-[#888899] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none resize-y min-h-[96px]"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setWriteupModal(false); resetWriteupForm() }}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={savingWriteup}
              disabled={!writeupForm.title.trim() || !writeupForm.description.trim()}
              onClick={submitWriteup}
            >
              Save & Send to Employee
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Praise modal */}
      <Modal
        open={praiseModal}
        onClose={() => { setPraiseModal(false); resetPraiseForm() }}
        title={`New Praise${selected ? ` · ${selected.profile?.full_name}` : ''}`}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="Closed three difficult customer cases"
            value={praiseForm.title}
            onChange={e => setPraiseForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Incident Date"
              type="date"
              value={praiseForm.incident_date}
              onChange={e => setPraiseForm(f => ({ ...f, incident_date: e.target.value }))}
            />
            <Select
              label="Category"
              value={praiseForm.category}
              onChange={e => setPraiseForm(f => ({ ...f, category: e.target.value as PraiseCategory }))}
            >
              <option value="performance">Performance</option>
              <option value="teamwork">Teamwork</option>
              <option value="customer_service">Customer Service</option>
              <option value="attendance">Attendance</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#e8e8f0]">Description</label>
            <textarea
              rows={4}
              placeholder="Describe what the employee did and why it was outstanding..."
              value={praiseForm.description}
              onChange={e => setPraiseForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-[#e8e8f0] placeholder-[#888899] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none resize-y min-h-[96px]"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setPraiseModal(false); resetPraiseForm() }}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={savingPraise}
              disabled={!praiseForm.title.trim() || !praiseForm.description.trim()}
              onClick={submitPraise}
            >
              Save & Send to Employee
            </Button>
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-sm text-[#e8e8f0] shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={15} className="text-green-400" />
          {toast}
        </div>
      )}
    </div>
  )
}

interface ProfilePanelProps {
  employee: Employee
  writeups: EmployeeWriteup[]
  praise: EmployeePraise[]
  subTab: SubTab
  setSubTab: (t: SubTab) => void
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  onNewWriteup: () => void
  onNewPraise: () => void
  onBack: () => void
}

function ProfilePanel({
  employee, writeups, praise, subTab, setSubTab, expandedId, setExpandedId,
  onNewWriteup, onNewPraise, onBack,
}: ProfilePanelProps) {
  const name = employee.profile?.full_name || 'Unknown'
  const color = stringToColor(employee.id)
  const empType = (employee.employment_type as keyof typeof EMPLOYMENT_TYPE_LABELS) || 'full_time'
  const hire = employee.created_at ? format(parseISO(employee.created_at), 'MMM d, yyyy') : '—'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-5 sm:pt-8 pb-5 border-b border-[#2a2a3a]">
        <button
          onClick={onBack}
          className="md:hidden inline-flex items-center gap-1 text-xs text-[#888899] hover:text-[#e8e8f0] mb-3"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {getInitials(name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[#e8e8f0] truncate">{name}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {employee.role && <Badge color={employee.role.color}>{employee.role.name}</Badge>}
              <Badge color={EMPLOYMENT_TYPE_COLORS[empType]}>{EMPLOYMENT_TYPE_LABELS[empType]}</Badge>
              <span className="text-[11px] text-[#888899]">Hired {hire}</span>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-[#111118] border border-[#2a2a3a] rounded-lg p-1 w-fit mt-5">
          <button
            onClick={() => setSubTab('writeups')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
              subTab === 'writeups' ? 'bg-[#1a1a24] text-[#e8e8f0]' : 'text-[#888899] hover:text-[#e8e8f0]'
            )}
          >
            <ClipboardList size={12} />
            Write-ups
            <span className="ml-1 text-[10px] text-[#888899]">{writeups.length}</span>
          </button>
          <button
            onClick={() => setSubTab('praise')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
              subTab === 'praise' ? 'bg-[#1a1a24] text-[#e8e8f0]' : 'text-[#888899] hover:text-[#e8e8f0]'
            )}
          >
            <Star size={12} />
            Praise
            <span className="ml-1 text-[10px] text-[#888899]">{praise.length}</span>
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-8">
        {subTab === 'writeups' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#e8e8f0]">Write-ups</h3>
              <Button size="sm" onClick={onNewWriteup}>
                <Plus size={13} /> New Write-Up
              </Button>
            </div>
            {writeups.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={36} className="text-[#888899]/60" />}
                title="No write-ups on record"
                subtext="Use write-ups to document incidents and keep employees accountable"
              />
            ) : (
              <div className="space-y-2.5">
                {writeups.map(w => {
                  const expanded = expandedId === w.id
                  return (
                    <button
                      key={w.id}
                      onClick={() => setExpandedId(expanded ? null : w.id)}
                      className="w-full text-left bg-[#111118] border border-[#2a2a3a] rounded-xl p-4 hover:border-[#3a3a4a] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge color={WRITEUP_SEVERITY_COLORS[w.severity]}>
                              {WRITEUP_SEVERITY_LABELS[w.severity]}
                            </Badge>
                            <span className="text-[11px] text-[#888899]">
                              {format(parseISO(w.incident_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-[#e8e8f0]">{w.title}</div>
                          <p className={cn('text-xs text-[#888899] mt-1 whitespace-pre-wrap', !expanded && 'line-clamp-2')}>
                            {w.description}
                          </p>
                        </div>
                        <AckBadge ack={w.acknowledged} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {subTab === 'praise' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#e8e8f0]">Praise</h3>
              <Button size="sm" onClick={onNewPraise}>
                <Plus size={13} /> New Praise
              </Button>
            </div>
            {praise.length === 0 ? (
              <EmptyState
                icon={<Star size={36} className="text-[#888899]/60" />}
                title="No praise on record"
                subtext="Recognize outstanding performance with an employee praise"
              />
            ) : (
              <div className="space-y-2.5">
                {praise.map(p => {
                  const expanded = expandedId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setExpandedId(expanded ? null : p.id)}
                      className="w-full text-left bg-[#111118] border border-[#2a2a3a] rounded-xl p-4 hover:border-[#3a3a4a] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge color={PRAISE_CATEGORY_COLOR}>
                              {PRAISE_CATEGORY_LABELS[p.category]}
                            </Badge>
                            <span className="text-[11px] text-[#888899]">
                              {format(parseISO(p.incident_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-[#e8e8f0]">{p.title}</div>
                          <p className={cn('text-xs text-[#888899] mt-1 whitespace-pre-wrap', !expanded && 'line-clamp-2')}>
                            {p.description}
                          </p>
                        </div>
                        <AckBadge ack={p.acknowledged} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AckBadge({ ack }: { ack: boolean }) {
  if (ack) {
    return (
      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
        <CheckCircle2 size={10} />
        Acknowledged
      </span>
    )
  }
  return (
    <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full text-[#888899] border border-[#2a2a3a]">
      Pending review
    </span>
  )
}

function EmptyState({ icon, title, subtext }: { icon: React.ReactNode; title: string; subtext: string }) {
  return (
    <div className="text-center py-16">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-sm font-medium text-[#e8e8f0]">{title}</p>
      <p className="text-xs text-[#888899] mt-1 max-w-xs mx-auto">{subtext}</p>
    </div>
  )
}
