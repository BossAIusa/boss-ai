'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Employee, Role } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { getInitials, stringToColor } from '@/lib/utils'
import { Plus, Pencil, Trash2, Phone, Mail, MapPin, User, AlertCircle } from 'lucide-react'

interface TeamViewProps {
  employees: Employee[]
  roles: Role[]
}

interface EmployeeForm {
  full_name: string
  email: string
  password: string
  phone: string
  address: string
  role_id: string
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
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  max_hours_per_week: '40',
}

export function TeamView({ employees: initialEmployees, roles }: TeamViewProps) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [modal, setModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModal(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setForm({
      full_name: emp.profile?.full_name || '',
      email: emp.profile?.email || '',
      password: '',
      phone: emp.profile?.phone || '',
      address: emp.profile?.address || '',
      role_id: emp.role_id || '',
      emergency_contact_name: emp.profile?.emergency_contact_name || '',
      emergency_contact_phone: emp.profile?.emergency_contact_phone || '',
      emergency_contact_relationship: emp.profile?.emergency_contact_relationship || '',
      max_hours_per_week: String(emp.max_hours_per_week || 40),
    })
    setError('')
    setModal(true)
  }

  const save = async () => {
    setSaving(true)
    setError('')

    try {
      if (editing) {
        // Update existing employee
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
          max_hours_per_week: parseInt(form.max_hours_per_week) || 40,
        }).eq('id', editing.id)

        // Refresh
        const { data } = await supabase
          .from('employees')
          .select('*, profile:profiles(*), role:roles(*)')
          .eq('id', editing.id)
          .single()
        if (data) setEmployees(prev => prev.map(e => e.id === editing.id ? data : e))
      } else {
        // Create new employee via signup
        const { data: authData, error: authError } = await supabase.auth.admin
          ? { data: null, error: new Error('Use API') }
          : { data: null, error: new Error('Use API') }

        // Since we can't create users from client, use a different approach
        // We'll create via the regular signup and then update role
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password || 'TempPass123!',
          options: {
            data: {
              full_name: form.full_name,
              role: 'employee',
            }
          }
        })

        if (signupError) throw signupError

        if (signupData.user) {
          // Update profile with extra details
          await supabase.from('profiles').update({
            phone: form.phone,
            address: form.address,
            emergency_contact_name: form.emergency_contact_name,
            emergency_contact_phone: form.emergency_contact_phone,
            emergency_contact_relationship: form.emergency_contact_relationship,
          }).eq('id', signupData.user.id)

          // Update employee record
          await supabase.from('employees').update({
            role_id: form.role_id || null,
            max_hours_per_week: parseInt(form.max_hours_per_week) || 40,
          }).eq('profile_id', signupData.user.id)

          // Reload employees
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
        <Button size="sm" onClick={openAdd}>
          <Plus size={13} /> Add Employee
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map(emp => {
          const name = emp.profile?.full_name || 'Unknown'
          const color = stringToColor(emp.id)
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
                  {emp.role && <Badge color={emp.role.color} className="mt-1">{emp.role.name}</Badge>}
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

          <Input label="Max Hours/Week" type="number" min="0" max="80" {...f('max_hours_per_week')} />

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
        {selected && (
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
                {selected.role && <Badge color={selected.role.color}>{selected.role.name}</Badge>}
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

            {selected.profile?.emergency_contact_name && (
              <div className="border-t border-[#2a2a3a] pt-4">
                <p className="text-xs font-semibold text-[#888899] uppercase tracking-wider mb-2">Emergency Contact</p>
                <div className="text-sm text-[#e8e8f0]">{selected.profile.emergency_contact_name}</div>
                <div className="text-xs text-[#888899]">{selected.profile.emergency_contact_relationship}</div>
                <div className="text-xs text-[#888899]">{selected.profile.emergency_contact_phone}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
