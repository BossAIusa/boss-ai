'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, Employee, Role } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getInitials, stringToColor } from '@/lib/utils'
import { Save, User, Mail, Phone, MapPin, AlertCircle } from 'lucide-react'

interface ProfileViewProps {
  profile: Profile
  employee: (Employee & { role?: Role }) | null
}

export function ProfileView({ profile: initialProfile, employee }: ProfileViewProps) {
  const [profile, setProfile] = useState(initialProfile)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    full_name: profile.full_name,
    phone: profile.phone || '',
    address: profile.address || '',
    emergency_contact_name: profile.emergency_contact_name || '',
    emergency_contact_phone: profile.emergency_contact_phone || '',
    emergency_contact_relationship: profile.emergency_contact_relationship || '',
  })
  const supabase = createClient()
  const router = useRouter()

  const color = stringToColor(profile.id)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        phone: form.phone || null,
        address: form.address || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        emergency_contact_relationship: form.emergency_contact_relationship || null,
      })
      .eq('id', profile.id)
      .select()
      .single()

    if (data) {
      setProfile(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      router.refresh()
    }

    setSaving(false)
  }

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  })

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[#e8e8f0]">My Profile</h1>
        <p className="text-sm text-[#888899] mt-0.5">Manage your personal information</p>
      </div>

      {/* Profile Header Card */}
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {getInitials(profile.full_name || 'U')}
          </div>
          <div>
            <div className="text-lg font-semibold text-[#e8e8f0]">{profile.full_name || 'Unnamed'}</div>
            <div className="flex items-center gap-2 text-sm text-[#888899]">
              <Mail size={13} /> {profile.email}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge color={profile.role === 'manager' ? '#6366f1' : '#22c55e'}>
                {profile.role === 'manager' ? 'Manager' : 'Employee'}
              </Badge>
              {employee?.role && (
                <Badge color={employee.role.color}>{employee.role.name}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6 space-y-5">
        <Input label="Full Name" placeholder="Your name" {...f('full_name')} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-[#e8e8f0] block mb-1.5">Email</label>
            <div className="px-3 py-2 text-sm rounded-lg border bg-[#0a0a0f] border-[#2a2a3a] text-[#888899]">
              {profile.email}
            </div>
            <span className="text-[10px] text-[#888899] mt-1 block">Email cannot be changed</span>
          </div>
          <Input label="Phone" placeholder="+1 555 000 0000" {...f('phone')} />
        </div>

        <Input label="Address" placeholder="123 Main St, City, State" {...f('address')} />

        {/* Emergency Contact */}
        <div className="border-t border-[#2a2a3a] pt-5">
          <p className="text-xs font-semibold text-[#888899] uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <AlertCircle size={11} /> Emergency Contact
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Name" placeholder="John Smith" {...f('emergency_contact_name')} />
            <Input label="Contact Phone" placeholder="+1 555 000 0000" {...f('emergency_contact_phone')} />
          </div>
          <div className="mt-4">
            <Input label="Relationship" placeholder="Spouse, Parent, etc." {...f('emergency_contact_relationship')} />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} loading={saving}>
            <Save size={14} /> Save Changes
          </Button>
          {saved && (
            <span className="text-sm text-green-400">Profile updated!</span>
          )}
        </div>
      </div>
    </div>
  )
}
