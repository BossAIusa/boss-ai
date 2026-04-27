'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Employee, Role, Availability, EmploymentType, EMPLOYMENT_TYPE_LABELS, EMPLOYMENT_TYPE_COLORS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { TimePicker } from '@/components/ui/time-picker'
import { getInitials, stringToColor, DAY_NAMES, DAY_NAMES_SHORT, formatTime } from '@/lib/utils'
import { Plus, Pencil, Trash2, Phone, Mail, MapPin, User, AlertCircle, Clock } from 'lucide-react'

interface TeamViewProps {
  employees: Employee[]
  roles: Role[]
  availability: Availability[]
}

interface EmployeeForm {
  full_name: string
  email: string
  password: string
  phone: string
  address: string
  role_id: string
  employment_type: EmploymentType
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  max_hours_per_week: string
}

const emptyForm: EmployeeForm = {
  full_name: '',
  email: '',
  password: '',
  phone: '',
  address: '',
  role_id: '',
  employment_type: 'full_time',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  max_hours_per_week: '40',
}

export function TeamView({ employees: initialEmployees, roles, availability }: TeamViewProps) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [modal, setModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [availModal, setAvailModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editAvailability, setEditAvailability] = useState<{ day_of_week: number; is_available: boolean; start_time: string; end_time: string }[]>([])
  const supabase = createClient()

  const defaultAvailability = () =>
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      is_available: i >= 1 && i <= 5,
      start_time: '09:00',
      end_time: '17:00',
    }))

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setEditAvailability(defaultAvailability())
    setError('')
    setModal(true)
  }

  const openEdit = async (emp: Employee) => {
    setEditing(emp)
    setForm({
      full_name: emp.profile?.full_name || '',
      email: emp.profile?.email || '',
      password: '',
      phone: emp.profile?.phone || '',
      address: emp.profile?.address || '',
      role_id: emp.role_id || '',
      employment_type: (emp.employment_type as EmploymentType) || 'full_time',
      emergency_contact_name: emp.profile?.emergency_contact_name || '',
      emergency_contact_phone: emp.profile?.emergency_contact_phone || '',
      emergency_contact_relationship: emp.profile?.emergency_contact_relationship || '',
      max_hours_per_week: String(emp.max_hours_per_week || 40),
    })

    // Load fresh availability for this employee
    const empAvail = availability.filter(a => a.employee_id === emp.id)
    const availMap = Array.from({ length: 7 }, (_, i) => {
      const existing = empAvail.find(a => a.day_of_week === i)
      return {
        day_of_week: i,
        is_available: existing?.is_available ?? (i >= 1 && i <= 5),
        start_time: existing?.start_time || '09:00',
        end_time: existing?.end_time || '17:00',
      }
    })
    setEditAvailability(availMap)

    setError('')
    setModal(true)
  }

  const save = async () => {
    setSaving(true)
    setError('')

    try {
      if (editing) {
        await supabase.from('profiles').update({
          full_name: form.full_name,
          phone: form.phone,
          address: form.address,
          emergency_contact_name: form.emergency_contact_name,
          emergency_contact_phone: form.emergency_contact_phone,
          emergency_contact_relationship: form.emergency_contact_relationship,
        }).eq('id', editing.profile_id)

        await supabase.from('employees').update({
          role_id: form.role_id || null,
          employment_type: form.employment_type,
          max_hours_per_week: parseInt(form.max_hours_per_week) || 40,
        }).eq('id', editing.id)

        // Save availability changes
        for (const avail of editAvailability) {
          const existing = availability.find(
            a => a.employee_id === editing.id && a.day_of_week === avail.day_of_week
          )
          if (existing) {
            await supabase.from('availability').update({
              is_available: avail.is_available,
              start_time: avail.start_time,
              end_time: avail.end_time,
            }).eq('id', existing.id)
          } else {
            await supabase.from('availability').insert({
              employee_id: editing.id,
              day_of_week: avail.day_of_week,
              is_available: avail.is_available,
              start_time: avail.start_time,
              end_time: avail.end_time,
            })
          }
        }

        const { data } = await supabase
          .from('employees')
          .select('*, profile:profiles(*), role:roles(*)')
          .eq('id', editing.id)
          .single()
        if (data) setEmployees(prev => prev.map(e => e.id === editing.id ? data : e))
      } else {
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password || 'TempPass123!',
          options: {
            data: { full_name: form.full_name, role: 'employee' }
          }
        })

        if (signupError) throw signupError

        if (signupData.user) {
          await supabase.from('profiles').update({
            phone: form.phone,
            address: form.address,
            emergency_contact_name: form.emergency_contact_name,
            emergency_contact_phone: form.emergency_contact_phone,
            emergency_contact_relationship: form.emergency_contact_relationship,
          }).eq('id', signupData.user.id)

          await supabase.from('employees').update({
            role_id: form.role_id || null,
            employment_type: form.employment_type,
            max_hours_per_week: parseInt(form.max_hours_per_week) || 40,
          }).eq('profile_id', signupData.user.id)

          const { data: empList } = await supabase
            .from('employees')
            .select('*, profile:profiles(*), role:roles(*)')
            .order('created_at')
          setEmployees(empList || [])
        }
      }

      setModal(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    }
    setSaving(false)
  }

  const remove = async (emp: Employee) => {
    if (!confirm(`Remove ${emp.profile?.full_name} from the team?`)) return
    await supabase.from('employees').delete().eq('id', emp.id)
    setEmployees(prev => prev.filter(e => e.id !== emp.id))
  }

  const getEmployeeAvailability = (empId: string) => {
    return availability.filter(a => a.employee_id === empId).sort((a, b) => a.day_of_week - b.day_of_week)
  }

  const f = (key: keyof EmployeeForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#e8e8f0]">Team</h1>
          <p className="text-sm text-[#888899] mt-0.5">{employees.length} members</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAvailModal(true)}>
            <Clock size={13} /> Availability
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus size={13} /> Add Employee
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map(emp => {
          const name = emp.profile?.full_name || 'Unknown'
          const color = stringToColor(emp.id)
          const empType = (emp.employment_type as EmploymentType) || 'full_time'
          return (
            <div
              key={emp.id}
              className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4 hover:border-[#3a3a4a] transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#e8e8f0] truncate">{name}</div>
                  <div className="text-xs text-[#888899] truncate">{emp.profile?.email}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {emp.role && <Badge color={emp.role.color}>{emp.role.name}</Badge>}
                    <Badge color={EMPLOYMENT_TYPE_COLORS[empType]}>
                      {EMPLOYMENT_TYPE_LABELS[empType]}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setSelected(emp); setDetailModal(true) }}
                    className="p-1.5 rounded-md hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors"
                  >
                    <User size={13} />
                  </button>
                  <button
                    onClick={() => openEdit(emp)}
                    className="p-1.5 rounded-md hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => remove(emp)}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-[#888899] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {emp.profile?.phone && (
                  <div className="flex items-center gap-2 text-xs text-[#888899]">
                    <Phone size={11} /> {emp.profile.phone}
                  </div>
                )}
                {emp.profile?.address && (
                  <div className="flex items-center gap-2 text-xs text-[#888899]">
                    <MapPin size={11} /> <span className="truncate">{emp.profile.address}</span>
                  </div>
                )}
                <div className="text-xs text-[#888899]">
                  Max {emp.max_hours_per_week || 40} hrs/week
                </div>
              </div>
            </div>
          )
        })}

        {employees.length === 0 && (
          <div className="col-span-3 text-center py-16 text-[#888899]">
            <User size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No team members yet. Add your first employee.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Employee' : 'Add Employee'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name" placeholder="Jane Smith" {...f('full_name')} />
            {!editing && <Input label="Email" type="email" placeholder="jane@example.com" {...f('email')} />}
          </div>

          {!editing && (
            <Input
              label="Temporary Password"
              type="password"
              placeholder="Min 6 characters"
              {...f('password')}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" placeholder="+1 555 000 0000" {...f('phone')} />
            <Select label="Role" {...f('role_id')}>
              <option value="">No role assigned</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Employment Type" value={form.employment_type} onChange={e => setForm(prev => ({ ...prev, employment_type: e.target.value as EmploymentType }))}>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="seasonal">Seasonal</option>
              <option value="temporary">Temporary</option>
            </Select>
            <Input label="Max Hours/Week" type="number" min="0" max="80" {...f('max_hours_per_week')} />
          </div>

          <Input label="Address" placeholder="123 Main St, City, State" {...f('address')} />

          <div className="border-t border-[#2a2a3a] pt-4">
            <p className="text-xs font-semibold text-[#888899] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlertCircle size={11} /> Emergency Contact
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Contact Name" placeholder="John Smith" {...f('emergency_contact_name')} />
              <Input label="Contact Phone" placeholder="+1 555 000 0000" {...f('emergency_contact_phone')} />
            </div>
            <div className="mt-3">
              <Input label="Relationship" placeholder="Spouse, Parent, etc." {...f('emergency_contact_relationship')} />
            </div>
          </div>

          {/* Availability */}
          <div className="border-t border-[#2a2a3a] pt-4">
            <p className="text-xs font-semibold text-[#888899] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock size={11} /> Weekly Availability
            </p>
            <div className="space-y-2">
              {editAvailability.map((avail, idx) => (
                <div key={avail.day_of_week} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...editAvailability]
                      updated[idx] = { ...updated[idx], is_available: !updated[idx].is_available }
                      setEditAvailability(updated)
                    }}
                    className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                      avail.is_available ? 'bg-green-500' : 'bg-[#2a2a3a]'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      avail.is_available ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                  <span className="w-10 text-xs text-[#888899] font-medium flex-shrink-0">
                    {DAY_NAMES_SHORT[avail.day_of_week]}
                  </span>
                  {avail.is_available ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <TimePicker
                        value={avail.start_time}
                        onChange={v => {
                          const updated = [...editAvailability]
                          updated[idx] = { ...updated[idx], start_time: v }
                          setEditAvailability(updated)
                        }}
                      />
                      <span className="text-xs text-[#888899]">to</span>
                      <TimePicker
                        value={avail.end_time}
                        onChange={v => {
                          const updated = [...editAvailability]
                          updated[idx] = { ...updated[idx], end_time: v }
                          setEditAvailability(updated)
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-[#888899]/50">Off</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModal(false)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save}>
              {editing ? 'Save Changes' : 'Add Employee'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={detailModal}
        onClose={() => setDetailModal(false)}
        title="Employee Profile"
        size="md"
      >
        {selected && (() => {
          const empType = (selected.employment_type as EmploymentType) || 'full_time'
          const empAvail = getEmployeeAvailability(selected.id)
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold"
                  style={{ backgroundColor: `${stringToColor(selected.id)}22`, color: stringToColor(selected.id) }}
                >
                  {getInitials(selected.profile?.full_name || 'U')}
                </div>
                <div>
                  <div className="text-lg font-semibold text-[#e8e8f0]">{selected.profile?.full_name}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {selected.role && <Badge color={selected.role.color}>{selected.role.name}</Badge>}
                    <Badge color={EMPLOYMENT_TYPE_COLORS[empType]}>{EMPLOYMENT_TYPE_LABELS[empType]}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-[#888899]">
                  <Mail size={13} /> {selected.profile?.email}
                </div>
                {selected.profile?.phone && (
                  <div className="flex items-center gap-2 text-sm text-[#888899]">
                    <Phone size={13} /> {selected.profile.phone}
                  </div>
                )}
                {selected.profile?.address && (
                  <div className="flex items-center gap-2 text-sm text-[#888899]">
                    <MapPin size={13} /> {selected.profile.address}
                  </div>
                )}
              </div>

              {/* Availability */}
              <div className="border-t border-[#2a2a3a] pt-4">
                <p className="text-xs font-semibold text-[#888899] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Clock size={11} /> Weekly Availability
                </p>
                <div className="space-y-1.5">
                  {Array.from({ length: 7 }, (_, i) => {
                    const dayAvail = empAvail.find(a => a.day_of_week === i)
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-10 text-[#888899] text-xs font-medium">{DAY_NAMES_SHORT[i]}</span>
                        {dayAvail?.is_available ? (
                          <span className="text-[#e8e8f0] text-xs">
                            {formatTime(dayAvail.start_time)} – {formatTime(dayAvail.end_time)}
                          </span>
                        ) : (
                          <span className="text-[#888899]/50 text-xs">Off</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {selected.profile?.emergency_contact_name && (
                <div className="border-t border-[#2a2a3a] pt-4">
                  <p className="text-xs font-semibold text-[#888899] uppercase tracking-wider mb-2">Emergency Contact</p>
                  <div className="text-sm text-[#e8e8f0]">{selected.profile.emergency_contact_name}</div>
                  <div className="text-xs text-[#888899]">{selected.profile.emergency_contact_relationship}</div>
                  <div className="text-xs text-[#888899]">{selected.profile.emergency_contact_phone}</div>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Team Availability Modal */}
      <Modal
        open={availModal}
        onClose={() => setAvailModal(false)}
        title="Team Availability"
        size="xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2a2a3a]">
                <th className="text-left py-2 pr-3 text-[#888899] font-medium">Employee</th>
                {DAY_NAMES_SHORT.map(d => (
                  <th key={d} className="text-center py-2 px-1.5 text-[#888899] font-medium">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const empAvail = getEmployeeAvailability(emp.id)
                const color = stringToColor(emp.id)
                return (
                  <tr key={emp.id} className="border-b border-[#2a2a3a]/50">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                          style={{ backgroundColor: `${color}22`, color }}
                        >
                          {getInitials(emp.profile?.full_name || 'U')}
                        </div>
                        <span className="text-[#e8e8f0] font-medium truncate">{emp.profile?.full_name}</span>
                      </div>
                    </td>
                    {Array.from({ length: 7 }, (_, i) => {
                      const dayAvail = empAvail.find(a => a.day_of_week === i)
                      return (
                        <td key={i} className="py-2.5 px-1 text-center">
                          {dayAvail?.is_available ? (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-md px-1 py-1">
                              <div className="text-green-400 text-[10px] leading-tight">
                                {formatTime(dayAvail.start_time)}
                              </div>
                              <div className="text-green-400 text-[10px] leading-tight">
                                {formatTime(dayAvail.end_time)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[#888899]/40 text-[10px]">Off</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  )
}
