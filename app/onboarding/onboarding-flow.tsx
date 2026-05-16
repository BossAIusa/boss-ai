'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TimePicker } from '@/components/ui/time-picker'
import { Bot, Check, Eye, EyeOff, XCircle } from 'lucide-react'
import { cn, DAY_NAMES_SHORT } from '@/lib/utils'

type Invitation = {
  id: string
  email: string
  role: 'admin_manager' | 'manager' | 'employee'
  organization: { id: string; name: string } | null
  employee: { full_name?: string; phone?: string; address?: string } | null
}

type Step = 1 | 2 | 3
type AvailabilityRow = {
  day_of_week: number
  is_available: boolean
  start_time: string
  end_time: string
}

export function OnboardingFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const supabase = createClient()

  const [phase, setPhase] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1: account
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Step 2: personal info
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [emergencyRelationship, setEmergencyRelationship] = useState('')

  // Step 3: availability — per-day toggle + start/end TimePickers, matching the
  // team-edit modal so onboarding and employee management stay consistent.
  const [availability, setAvailability] = useState<AvailabilityRow[]>(() =>
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      is_available: i >= 1 && i <= 5,
      start_time: '09:00',
      end_time: '17:00',
    }))
  )

  const updateAvailability = (idx: number, patch: Partial<AvailabilityRow>) => {
    setAvailability(prev => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
  }

  useEffect(() => {
    if (!token) {
      setPhase('invalid')
      return
    }
    fetch(`/api/invite/validate?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const json = await res.json()
        if (!res.ok || !json.valid) {
          setPhase('invalid')
          return
        }
        setInvitation(json.invitation)
        setFullName(json.invitation.employee?.full_name || '')
        setPhone(json.invitation.employee?.phone || '')
        setPhase('ready')
      })
      .catch(() => {
        setPhase('invalid')
      })
  }, [token])

  if (phase === 'loading') {
    return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-sm text-[#888899]">Loading…</div>
  }

  if (phase === 'invalid' || !invitation) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <XCircle size={28} className="text-red-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-[#e8e8f0]">Invite link expired or invalid</h1>
          <p className="text-sm text-[#888899] mt-2">
            Ask your manager to send a new invitation.
          </p>
        </div>
      </div>
    )
  }

  const submitStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)

    const { error: signUpErr } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: { data: { full_name: fullName, role: invitation.role } },
    })
    if (signUpErr) {
      // If the user already exists, try signing them in instead
      if (signUpErr.message?.toLowerCase().includes('already')) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: invitation.email,
          password,
        })
        if (signInErr) {
          setError('An account already exists for this email. Try the password you set last time, or use “Forgot password”.')
          setSubmitting(false)
          return
        }
      } else {
        setError(signUpErr.message)
        setSubmitting(false)
        return
      }
    }

    const claim = await fetch('/api/onboarding/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!claim.ok) {
      const body = await claim.json().catch(() => ({}))
      setError(body.error || 'Failed to link your invitation')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setStep(2)
  }

  const submitStep2 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Session lost. Please refresh and try again.')
      setSubmitting(false)
      return
    }

    const { error: profErr } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone || null,
        date_of_birth: dob || null,
        address_street: street || null,
        address_city: city || null,
        address_state: state || null,
        address_zip: zip || null,
        address: [street, city, state, zip].filter(Boolean).join(', ') || null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
        emergency_contact_relationship: emergencyRelationship || null,
      })
      .eq('id', user.id)

    if (profErr) {
      setError(profErr.message)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setStep(3)
  }

  const submitStep3 = async () => {
    setError('')
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Session lost. Please refresh and try again.')
      setSubmitting(false)
      return
    }

    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (employee) {
      for (const day of availability) {
        const { data: existing } = await supabase
          .from('availability')
          .select('id')
          .eq('employee_id', employee.id)
          .eq('day_of_week', day.day_of_week)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('availability')
            .update({
              start_time: day.start_time,
              end_time: day.end_time,
              is_available: day.is_available,
            })
            .eq('id', existing.id)
        } else {
          await supabase.from('availability').insert({
            employee_id: employee.id,
            day_of_week: day.day_of_week,
            start_time: day.start_time,
            end_time: day.end_time,
            is_available: day.is_available,
          })
        }
      }
    }

    await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id)
    await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invitation.id)

    setSubmitting(false)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-10 px-4 flex justify-center">
      <div className="w-full max-w-[600px]">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center mb-3">
            <Bot size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#e8e8f0]">Boss.AI</h1>
          {invitation.organization && (
            <p className="text-sm text-[#888899] mt-1">Joining {invitation.organization.name}</p>
          )}
        </div>

        <StepIndicator step={step} />

        <div className="rounded-2xl border border-[#2a2a3a] bg-[#111118] p-6 mt-6">
          {step === 1 && (
            <form onSubmit={submitStep1} className="space-y-4">
              <h2 className="text-base font-semibold text-[#e8e8f0]">Create your account</h2>
              <Input label="Email" value={invitation.email} disabled />
              <Input
                label="Full name"
                placeholder="Jane Smith"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#e8e8f0]">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 pr-10 text-sm rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-[#e8e8f0] placeholder-[#888899] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#888899] hover:text-[#e8e8f0]"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <Input
                label="Confirm password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" loading={submitting}>
                Continue
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={submitStep2} className="space-y-4">
              <h2 className="text-base font-semibold text-[#e8e8f0]">Personal information</h2>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Phone number" placeholder="+1 555 000 0000" value={phone} onChange={e => setPhone(e.target.value)} />
                <Input label="Date of birth" type="date" value={dob} onChange={e => setDob(e.target.value)} />
              </div>
              <Input label="Street address" placeholder="123 Main St" value={street} onChange={e => setStreet(e.target.value)} />
              <Input label="City" placeholder="San Francisco" value={city} onChange={e => setCity(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="State" placeholder="CA" value={state} onChange={e => setState(e.target.value)} />
                <Input label="Zip" placeholder="94103" value={zip} onChange={e => setZip(e.target.value)} />
              </div>
              <div className="pt-2 border-t border-[#2a2a3a]">
                <p className="text-xs font-semibold text-[#888899] uppercase tracking-wider mb-3 mt-3">Emergency contact</p>
                <Input label="Name" placeholder="John Smith" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Input label="Phone" placeholder="+1 555 000 0000" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} />
                  <Input label="Relationship" placeholder="Spouse" value={emergencyRelationship} onChange={e => setEmergencyRelationship(e.target.value)} />
                </div>
              </div>
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" size="lg" className="flex-1" loading={submitting}>Continue</Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#e8e8f0]">Weekly availability</h2>
              <p className="text-xs text-[#888899]">Set the hours you can typically work each day. You can change this later.</p>
              <div className="space-y-2">
                {availability.map((day, idx) => (
                  <div
                    key={day.day_of_week}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                      day.is_available ? 'bg-[#0d0d14] border-[#2a2a3a]' : 'bg-[#0a0a0f] border-[#2a2a3a]/60'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => updateAvailability(idx, { is_available: !day.is_available })}
                      className={cn(
                        'w-11 h-6 rounded-full relative transition-colors flex-shrink-0',
                        day.is_available ? 'bg-green-500' : 'bg-[#2a2a3a]'
                      )}
                      aria-label={day.is_available ? 'Mark unavailable' : 'Mark available'}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full bg-white absolute top-1 transition-transform',
                          day.is_available ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                    <span className="w-10 text-sm font-medium text-[#e8e8f0] flex-shrink-0">
                      {DAY_NAMES_SHORT[day.day_of_week]}
                    </span>
                    {day.is_available ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TimePicker
                          value={day.start_time}
                          onChange={v => updateAvailability(idx, { start_time: v })}
                        />
                        <span className="text-xs text-[#888899]">to</span>
                        <TimePicker
                          value={day.end_time}
                          onChange={v => updateAvailability(idx, { end_time: v })}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-[#888899]/60 flex-1">Off</span>
                    )}
                  </div>
                ))}
              </div>
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                <Button type="button" size="lg" className="flex-1" loading={submitting} onClick={submitStep3}>
                  Finish &amp; Enter Boss AI
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ step }: { step: Step }) {
  const steps = [1, 2, 3] as const
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, idx) => {
        const done = s < step
        const active = s === step
        return (
          <div key={s} className="flex items-center">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors',
                done && 'bg-indigo-500 border-indigo-500 text-white',
                active && 'bg-[#0a0a0f] border-indigo-500 text-indigo-400',
                !done && !active && 'bg-[#0a0a0f] border-[#2a2a3a] text-[#888899]'
              )}
            >
              {done ? <Check size={12} /> : s}
            </div>
            {idx < steps.length - 1 && (
              <div className={cn('w-8 h-px', done ? 'bg-indigo-500' : 'bg-[#2a2a3a]')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
