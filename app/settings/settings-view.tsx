'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Role } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil, Trash2, Briefcase } from 'lucide-react'

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#d946ef',
]

interface SettingsViewProps {
  roles: Role[]
}

export function SettingsView({ roles: initialRoles }: SettingsViewProps) {
  const [roles, setRoles] = useState(initialRoles)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const openAdd = () => {
    setEditing(null)
    setName('')
    setColor(PRESET_COLORS[0])
    setModal(true)
  }

  const openEdit = (role: Role) => {
    setEditing(role)
    setName(role.name)
    setColor(role.color)
    setModal(true)
  }

  const save = async () => {
    setSaving(true)
    if (editing) {
      const { data } = await supabase.from('roles').update({ name, color }).eq('id', editing.id).select().single()
      if (data) setRoles(prev => prev.map(r => r.id === editing.id ? data : r))
    } else {
      const { data } = await supabase.from('roles').insert({ name, color }).select().single()
      if (data) setRoles(prev => [...prev, data])
    }
    setModal(false)
    setSaving(false)
  }

  const remove = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"?`)) return
    await supabase.from('roles').delete().eq('id', role.id)
    setRoles(prev => prev.filter(r => r.id !== role.id))
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[#e8e8f0]">Settings</h1>
        <p className="text-sm text-[#888899] mt-0.5">Manage your workspace configuration</p>
      </div>

      {/* Roles Section */}
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3a]">
          <div className="flex items-center gap-2">
            <Briefcase size={15} className="text-[#888899]" />
            <span className="font-semibold text-[#e8e8f0] text-sm">Job Roles</span>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus size={13} /> Add Role
          </Button>
        </div>

        <div className="divide-y divide-[#2a2a3a]">
          {roles.map(role => (
            <div key={role.id} className="flex items-center gap-3 px-5 py-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: role.color }}
              />
              <div
                className="px-2 py-0.5 rounded-md text-xs font-medium"
                style={{ backgroundColor: `${role.color}22`, color: role.color }}
              >
                {role.name}
              </div>
              <div className="flex-1" />
              <button
                onClick={() => openEdit(role)}
                className="p-1.5 rounded-md hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => remove(role)}
                className="p-1.5 rounded-md hover:bg-red-500/10 text-[#888899] hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {roles.length === 0 && (
            <div className="px-5 py-8 text-center text-[#888899] text-sm">
              No roles defined. Create your first role.
            </div>
          )}
        </div>
      </div>

      {/* Role Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Role' : 'Add Role'} size="sm">
        <div className="space-y-4">
          <Input
            label="Role Name"
            placeholder="e.g. Sales Associate"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <div>
            <label className="text-sm font-medium text-[#e8e8f0] block mb-2">Color</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111118] scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {name && (
            <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: `${color}22` }}>
              <span className="text-sm font-medium" style={{ color }}>{name}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModal(false)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save} disabled={!name}>
              {editing ? 'Save' : 'Create Role'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
