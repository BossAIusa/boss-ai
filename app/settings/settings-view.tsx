'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Role, StoreSettings, StoreHours } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { TimePicker } from '@/components/ui/time-picker'
import { DAY_NAMES_SHORT } from '@/lib/utils'
import { Plus, Pencil, Trash2, Briefcase, Store, Clock } from 'lucide-react'

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#d946ef',
]

interface SettingsViewProps {
  roles: Role[]
  storeSettings: StoreSettings | null
  storeHours: StoreHours[]
}

type HoursDraft = {
  day_of_week: number
  is_open: boolean
  open_time: string
  close_time: string
  id?: string
}

export function SettingsView({ roles: initialRoles, storeSettings, storeHours: initialHours }: SettingsViewProps) {
  const [roles, setRoles] = useState(initialRoles)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)

  const [storeName, setStoreName] = useState(storeSettings?.store_name || '')
  const [storeSaved, setStoreSaved] = useState(false)
  const [savingStore, setSavingStore] = useState(false)

  const [hours, setHours] = useState<HoursDraft[]>(() =>
    Array.from({ length: 7 }, (_, i) => {
      const existing = initialHours.find(h => h.day_of_week === i)
      return {
        day_of_week: i,
        is_open: existing?.is_open ?? true,
        open_time: existing?.open_time?.slice(0, 5) || '09:00',
        close_time: existing?.close_time?.slice(0, 5) || '17:00',
        id: existing?.id,
      }
    })
  )
  const [hoursSaved, setHoursSaved] = useState(false)
  const [savingHours, setSavingHours] = useState(false)

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

  const saveStore = async () => {
    setSavingStore(true)
    setStoreSaved(false)
    if (storeSettings) {
      await supabase.from('store_settings').update({ store_name: storeName, updated_at: new Date().toISOString() }).eq('id', storeSettings.id)
    } else {
      await supabase.from('store_settings').insert({ store_name: storeName })
    }
    setSavingStore(false)
    setStoreSaved(true)
    setTimeout(() => setStoreSaved(false), 1800)
  }

  const saveHours = async () => {
    setSavingHours(true)
    setHoursSaved(false)
    for (const h of hours) {
      if (h.id) {
        await supabase.from('store_hours').update({
          is_open: h.is_open,
          open_time: h.open_time,
          close_time: h.close_time,
          updated_at: new Date().toISOString(),
        }).eq('id', h.id)
      } else {
        const { data } = await supabase.from('store_hours').insert({
          day_of_week: h.day_of_week,
          is_open: h.is_open,
          open_time: h.open_time,
          close_time: h.close_time,
        }).select().single()
        if (data) h.id = data.id
      }
    }
    setSavingHours(false)
    setHoursSaved(true)
    setTimeout(() => setHoursSaved(false), 1800)
  }

  const updateHours = (idx: number, patch: Partial<HoursDraft>) => {
    setHours(prev => prev.map((h, i) => i === idx ? { ...h, ...patch } : h))
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[#e8e8f0]">Settings</h1>
        <p className="text-sm text-[#888899] mt-0.5">Manage your workspace configuration</p>
      </div>

      {/* Store Info */}
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3a]">
          <div className="flex items-center gap-2">
            <Store size={15} className="text-[#888899]" />
            <span className="font-semibold text-[#e8e8f0] text-sm">Store</span>
          </div>
          {storeSaved && <span className="text-xs text-green-400">Saved ✓</span>}
        </div>
        <div className="p-5 space-y-3">
          <Input
            label="Store Name"
            placeholder="e.g. Main Street Coffee"
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={saveStore} loading={savingStore}>Save</Button>
          </div>
        </div>
      </div>

      {/* Hours of Operation */}
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3a]">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-[#888899]" />
            <span className="font-semibold text-[#e8e8f0] text-sm">Hours of Operation</span>
          </div>
          {hoursSaved && <span className="text-xs text-green-400">Saved ✓</span>}
        </div>
        <div className="p-5 space-y-2.5">
          {hours.map((h, idx) => (
            <div key={h.day_of_week} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateHours(idx, { is_open: !h.is_open })}
                className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                  h.is_open ? 'bg-green-500' : 'bg-[#2a2a3a]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  h.is_open ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
              <span className="w-10 text-xs text-[#888899] font-medium flex-shrink-0">
                {DAY_NAMES_SHORT[h.day_of_week]}
              </span>
              {h.is_open ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TimePicker
                    value={h.open_time}
                    onChange={v => updateHours(idx, { open_time: v })}
                  />
                  <span className="text-xs text-[#888899]">to</span>
                  <TimePicker
                    value={h.close_time}
                    onChange={v => updateHours(idx, { close_time: v })}
                  />
                </div>
              ) : (
                <span className="text-xs text-[#888899]/50">Closed</span>
              )}
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={saveHours} loading={savingHours}>Save</Button>
          </div>
        </div>
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
