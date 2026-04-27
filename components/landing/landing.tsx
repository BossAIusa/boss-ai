'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Bot, ArrowRight, Sparkles, Wand2, Users2, CalendarRange,
  Plane, Scale, Check, Zap, Clock, Plus, Minus,
} from 'lucide-react'

// --- Pricing model -----------------------------------------------------------
// Numbers are illustrative for v0 — replace once Danish confirms real pricing.

type StoreType = 'single' | 'multi'
type EmpRange = '1-10' | '11-20' | '20+'

const BASE_PRICE: Record<StoreType, Record<EmpRange, number>> = {
  single: { '1-10': 39, '11-20': 79, '20+': 139 },
  multi:  { '1-10': 99, '11-20': 179, '20+': 299 },
}
const AI_ADDON_PRICE = 39
const RANGE_LABEL: Record<EmpRange, string> = {
  '1-10': '1–10 employees',
  '11-20': '11–20 employees',
  '20+': '20+ employees',
}

// --- Page --------------------------------------------------------------------

export function Landing() {
  return (
    <div className="bg-[#0a0a0f] text-[#e8e8f0] min-h-screen">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <PricingBuilder />
      <FAQ />
      <FooterCTA />
      <Footer />
    </div>
  )
}

// --- Nav ---------------------------------------------------------------------

function Nav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[#0a0a0f]/70 border-b border-[#1a1a24]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <span className="font-bold tracking-tight">Boss.AI</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-[#888899]">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how" className="hover:text-white transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm text-[#888899] hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  )
}

// --- Hero --------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute top-40 left-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#2a2a3a] bg-[#111118]/60 text-xs text-[#888899] mb-8">
          <Sparkles size={12} className="text-indigo-400" />
          AI scheduling for shift-based teams
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-4xl mx-auto">
          Schedule your team in
          <span className="bg-gradient-to-r from-indigo-300 via-indigo-400 to-purple-400 bg-clip-text text-transparent"> minutes,</span> not hours.
        </h1>

        <p className="mt-6 text-lg md:text-xl text-[#888899] max-w-2xl mx-auto leading-relaxed">
          Boss.AI auto-generates fair, balanced schedules from your team&apos;s availability —
          and a built-in AI assistant finds shift coverage in seconds.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-all shadow-lg shadow-indigo-500/20"
          >
            Try It Now <ArrowRight size={16} />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#2a2a3a] hover:border-[#3a3a4a] hover:bg-[#111118] font-medium transition-all"
          >
            Login
          </Link>
        </div>

        <p className="mt-4 text-xs text-[#666677]">
          No credit card required · Free trial · Set up in under 5 minutes
        </p>

        {/* Mock product preview */}
        <div className="mt-16 relative">
          <div className="absolute inset-x-0 -top-10 -bottom-10 bg-gradient-to-b from-indigo-500/10 to-transparent blur-3xl -z-10" />
          <SchedulePreview />
        </div>
      </div>
    </section>
  )
}

// Stylized weekly schedule preview — pure CSS mock, no real data.
function SchedulePreview() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  type Block = { day: number; top: number; height: number; name: string; time: string; color: string }
  const blocks: Block[] = [
    { day: 0, top: 8,  height: 56, name: 'Maya',   time: '9–3',  color: 'indigo' },
    { day: 0, top: 56, height: 64, name: 'Jordan', time: '12–6', color: 'purple' },
    { day: 1, top: 16, height: 48, name: 'Priya',  time: '10–2', color: 'pink' },
    { day: 1, top: 64, height: 56, name: 'Lex',    time: '2–7',  color: 'cyan' },
    { day: 2, top: 8,  height: 64, name: 'Maya',   time: '9–4',  color: 'indigo' },
    { day: 2, top: 80, height: 48, name: 'Sam',    time: '4–8',  color: 'amber' },
    { day: 3, top: 24, height: 56, name: 'Jordan', time: '11–4', color: 'purple' },
    { day: 4, top: 8,  height: 48, name: 'Priya',  time: '9–1',  color: 'pink' },
    { day: 4, top: 64, height: 56, name: 'Lex',    time: '2–7',  color: 'cyan' },
    { day: 5, top: 32, height: 64, name: 'Sam',    time: '12–7', color: 'amber' },
    { day: 6, top: 24, height: 48, name: 'Maya',   time: '11–3', color: 'indigo' },
  ]
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    indigo: { bg: 'bg-indigo-500/15', border: 'border-l-indigo-400', text: 'text-indigo-300' },
    purple: { bg: 'bg-purple-500/15', border: 'border-l-purple-400', text: 'text-purple-300' },
    pink:   { bg: 'bg-pink-500/15',   border: 'border-l-pink-400',   text: 'text-pink-300' },
    cyan:   { bg: 'bg-cyan-500/15',   border: 'border-l-cyan-400',   text: 'text-cyan-300' },
    amber:  { bg: 'bg-amber-500/15',  border: 'border-l-amber-400',  text: 'text-amber-300' },
  }

  return (
    <div className="rounded-2xl border border-[#2a2a3a] bg-[#0d0d14] shadow-2xl shadow-indigo-500/10 overflow-hidden text-left">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a3a] bg-[#111118]">
        <div className="flex items-center gap-2 text-sm text-[#888899]">
          <CalendarRange size={14} />
          <span className="text-[#e8e8f0] font-medium">This week</span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20">Published</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#888899]">
          <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <Wand2 size={11} /> Auto-generate
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-[#2a2a3a] bg-[#0f0f17]">
        {days.map(d => (
          <div key={d} className="px-2 py-2 text-center border-r border-[#1a1a24] last:border-r-0">
            <div className="text-[10px] uppercase tracking-wider text-[#888899]">{d}</div>
          </div>
        ))}
      </div>
      <div className="relative grid grid-cols-7" style={{ height: 200 }}>
        {/* hour grid lines */}
        {[0, 50, 100, 150].map(t => (
          <div key={t} className="absolute left-0 right-0 border-t border-[#1a1a24]" style={{ top: t }} />
        ))}
        {days.map((_, i) => (
          <div key={i} className="border-r border-[#1a1a24] last:border-r-0 relative" />
        ))}
        {blocks.map((b, idx) => {
          const col = colorMap[b.color]
          return (
            <div
              key={idx}
              className={`absolute rounded-md ${col.bg} ${col.border} border-l-[3px] px-1.5 py-1 overflow-hidden`}
              style={{
                left: `calc(${(b.day / 7) * 100}% + 3px)`,
                width: `calc(${(1 / 7) * 100}% - 6px)`,
                top: b.top,
                height: b.height,
              }}
            >
              <div className={`text-[10px] font-semibold truncate ${col.text}`}>{b.name}</div>
              <div className="text-[9px] text-[#888899]">{b.time}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Features ----------------------------------------------------------------

function Features() {
  const items = [
    {
      icon: Wand2,
      title: 'Auto-generate schedules',
      body: 'Build a balanced weekly schedule in one click — respecting availability, time-off, store hours, and weekly hour limits.',
    },
    {
      icon: Bot,
      title: 'AI shift replacements',
      body: 'Someone calls out? Ask the AI assistant who can cover. It ranks options by availability, current hours, and fairness.',
    },
    {
      icon: Users2,
      title: 'Availability management',
      body: 'Employees set weekly availability and one-off exceptions. Schedules adapt automatically.',
    },
    {
      icon: Plane,
      title: 'Time-off requests',
      body: 'Approve or deny in one tap. Approved time-off is honored by every schedule the AI generates.',
    },
    {
      icon: Scale,
      title: 'Workload balancing',
      body: 'Distribute hours fairly across the team — no more cliques or favorites stacking up overtime.',
    },
    {
      icon: Zap,
      title: 'Smart scheduling',
      body: 'Coverage-aware placement spreads shifts across your store hours so you’re never understaffed.',
    },
  ]
  return (
    <section id="features" className="border-t border-[#1a1a24] py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeader
          eyebrow="Features"
          title="Built for the messiness of real shift work"
          subtitle="Every feature is designed around one truth: schedules change. Boss.AI keeps up."
        />
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-[#2a2a3a] bg-[#0f0f17] p-6 hover:border-[#3a3a4a] hover:bg-[#111118] transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                <Icon size={18} className="text-indigo-400" />
              </div>
              <h3 className="font-semibold text-[#e8e8f0] mb-1.5">{title}</h3>
              <p className="text-sm text-[#888899] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// --- How it works ------------------------------------------------------------

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Add your team',         body: 'Invite employees and set roles, hourly rates, and weekly hour caps.' },
    { n: '02', title: 'Set availability',      body: 'Each employee sets when they can work. Time-off and exceptions are baked in.' },
    { n: '03', title: 'Auto-generate',         body: 'One click builds a balanced week that respects every constraint.' },
    { n: '04', title: 'Optimize with AI',      body: 'Ask the assistant to find coverage, swap shifts, or rebalance hours.' },
  ]
  return (
    <section id="how" className="border-t border-[#1a1a24] py-24 bg-[#08080d]">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeader
          eyebrow="How it works"
          title="Four steps from chaos to a published schedule"
        />
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map(s => (
            <div key={s.n} className="relative rounded-xl border border-[#2a2a3a] bg-[#0f0f17] p-6">
              <div className="text-xs font-mono text-indigo-400 mb-3">{s.n}</div>
              <h3 className="font-semibold text-[#e8e8f0] mb-1.5">{s.title}</h3>
              <p className="text-sm text-[#888899] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// --- Pricing builder ---------------------------------------------------------

function PricingBuilder() {
  const [storeType, setStoreType] = useState<StoreType>('single')
  const [empRange, setEmpRange] = useState<EmpRange>('1-10')
  const [aiAddon, setAiAddon] = useState(true)

  const base = BASE_PRICE[storeType][empRange]
  const total = base + (aiAddon ? AI_ADDON_PRICE : 0)

  return (
    <section id="pricing" className="border-t border-[#1a1a24] py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeader
          eyebrow="Pricing"
          title="Build your plan"
          subtitle="Pay only for what you need. No per-seat surprises."
        />

        <div className="mt-14 grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
          {/* Left: configurator */}
          <div className="rounded-2xl border border-[#2a2a3a] bg-[#0f0f17] p-6 md:p-8 space-y-7">
            <Choice
              label="Store type"
              options={[
                { value: 'single', title: 'Single store',  body: 'One location' },
                { value: 'multi',  title: 'Multi store',   body: 'Two or more locations' },
              ]}
              value={storeType}
              onChange={v => setStoreType(v as StoreType)}
            />
            <Choice
              label="Team size"
              options={(['1-10', '11-20', '20+'] as EmpRange[]).map(r => ({
                value: r, title: RANGE_LABEL[r], body: '',
              }))}
              value={empRange}
              onChange={v => setEmpRange(v as EmpRange)}
            />

            <div>
              <div className="text-sm font-medium text-[#e8e8f0] mb-3">Add-ons</div>
              <div className="space-y-2">
                <Toggle
                  active={aiAddon}
                  onClick={() => setAiAddon(v => !v)}
                  title="AI Scheduling Assistant"
                  body="Conversational AI that finds shift coverage, swaps, and saved preferences."
                  price={AI_ADDON_PRICE}
                />
                <ComingSoon
                  title="Advanced Reporting"
                  body="Labor cost forecasts, attendance analytics, and exports."
                />
                <ComingSoon
                  title="Multi-location scheduling"
                  body="Move staff between stores and roll up reporting across locations."
                />
              </div>
            </div>
          </div>

          {/* Right: total */}
          <div className="rounded-2xl border border-[#2a2a3a] bg-gradient-to-b from-[#13131c] to-[#0f0f17] p-6 md:p-8 sticky top-24">
            <div className="text-xs uppercase tracking-wider text-[#888899] mb-3">Your plan</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-bold text-[#e8e8f0]">${total}</span>
              <span className="text-[#888899]">/month</span>
            </div>
            <p className="text-sm text-[#888899] mb-6">Billed monthly. Cancel anytime.</p>

            <div className="space-y-2 mb-6 text-sm">
              <Line label={storeType === 'single' ? 'Single store' : 'Multi store'} value={`$${base}`} />
              <Line label={RANGE_LABEL[empRange]} value="Included" />
              {aiAddon && <Line label="AI Scheduling Assistant" value={`$${AI_ADDON_PRICE}`} />}
            </div>

            <Link
              href="/signup"
              className="block text-center w-full px-5 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
            >
              Start free trial
            </Link>
            <p className="text-center text-xs text-[#666677] mt-3">14-day free trial · No credit card required</p>

            <div className="mt-6 pt-6 border-t border-[#2a2a3a] space-y-2 text-sm text-[#888899]">
              <Bullet>Unlimited schedules</Bullet>
              <Bullet>Auto-generation with workload balancing</Bullet>
              <Bullet>Employee self-service portal</Bullet>
              <Bullet>Time-off & availability management</Bullet>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Choice({
  label, options, value, onChange,
}: {
  label: string
  options: { value: string; title: string; body: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div className="text-sm font-medium text-[#e8e8f0] mb-3">{label}</div>
      <div className={`grid gap-2 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {options.map(o => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`text-left p-4 rounded-xl border transition-all ${
                active
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-[#2a2a3a] bg-[#13131c] hover:border-[#3a3a4a]'
              }`}
            >
              <div className={`text-sm font-medium ${active ? 'text-white' : 'text-[#e8e8f0]'}`}>
                {o.title}
              </div>
              {o.body && <div className="text-xs text-[#888899] mt-0.5">{o.body}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Toggle({ active, onClick, title, body, price }: {
  active: boolean
  onClick: () => void
  title: string
  body: string
  price: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        active ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#2a2a3a] bg-[#13131c] hover:border-[#3a3a4a]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-[#e8e8f0]">
            {title}
            {active && <Check size={13} className="text-indigo-400" />}
          </div>
          <div className="text-xs text-[#888899] mt-0.5">{body}</div>
        </div>
        <div className="text-sm font-medium text-[#e8e8f0] whitespace-nowrap">
          +${price}<span className="text-[#888899] font-normal">/mo</span>
        </div>
      </div>
    </button>
  )
}

function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <div className="w-full p-4 rounded-xl border border-dashed border-[#2a2a3a] bg-[#0a0a13]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[#888899]">{title}</div>
          <div className="text-xs text-[#666677] mt-0.5">{body}</div>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-[#666677] bg-[#1a1a24] px-2 py-0.5 rounded">
          Soon
        </span>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-[#888899]">{label}</span>
      <span className="text-[#e8e8f0]">{value}</span>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Check size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  )
}

// --- FAQ ---------------------------------------------------------------------

function FAQ() {
  const items = [
    {
      q: 'How long does setup take?',
      a: 'Most teams are scheduling within 5 minutes. Add your store hours, invite employees, and Boss.AI handles the rest.',
    },
    {
      q: 'How does the AI assistant work?',
      a: 'It has direct access to your schedule, availability, and time-off data. Ask it natural-language questions like "who can cover Saturday morning?" and it will recommend replacements ranked by availability and current hours.',
    },
    {
      q: 'Can employees see each other’s schedules?',
      a: 'Yes. Once you publish a schedule, every employee can see the full week — their shifts and their teammates’.',
    },
    {
      q: 'Do you support multiple locations?',
      a: 'The Multi store plan supports two or more locations today. Cross-location features (moving staff between stores, unified reporting) are on the roadmap.',
    },
    {
      q: 'Is there a free trial?',
      a: 'Yes — 14 days, no credit card required. You can cancel anytime.',
    },
    {
      q: 'How is my data protected?',
      a: 'Your data is encrypted in transit and at rest. Only managers in your workspace can see schedules and employee data.',
    },
  ]
  return (
    <section id="faq" className="border-t border-[#1a1a24] py-24 bg-[#08080d]">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHeader eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-14 space-y-2">
          {items.map((it, idx) => <FAQItem key={idx} {...it} />)}
        </div>
      </div>
    </section>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-[#2a2a3a] bg-[#0f0f17] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[#111118] transition-colors"
      >
        <span className="font-medium text-[#e8e8f0]">{q}</span>
        {open ? <Minus size={16} className="text-[#888899]" /> : <Plus size={16} className="text-[#888899]" />}
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-[#888899] leading-relaxed">
          {a}
        </div>
      )}
    </div>
  )
}

// --- Footer CTA --------------------------------------------------------------

function FooterCTA() {
  return (
    <section className="border-t border-[#1a1a24] py-24 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-indigo-500/15 blur-[120px]" />
      </div>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
          Stop wrestling with spreadsheets.
        </h2>
        <p className="mt-4 text-lg text-[#888899]">
          Try Boss.AI free for 14 days. Set up in minutes, schedule in seconds.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-all shadow-lg shadow-indigo-500/20"
          >
            Try It Now <ArrowRight size={16} />
          </Link>
          <a
            href="https://cal.com/bossaiusa/demo"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#2a2a3a] hover:border-[#3a3a4a] hover:bg-[#111118] font-medium transition-all"
          >
            <Clock size={16} /> Book a demo
          </a>
        </div>
      </div>
    </section>
  )
}

// --- Footer ------------------------------------------------------------------

function Footer() {
  return (
    <footer className="border-t border-[#1a1a24] py-12">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-[1fr_auto] gap-8 items-start">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <span className="font-semibold">Boss.AI</span>
          </div>
          <p className="text-sm text-[#666677] max-w-md">
            AI-powered workforce management for shift-based businesses.
          </p>
        </div>
        <nav className="grid grid-cols-2 md:grid-cols-3 gap-x-12 gap-y-2 text-sm">
          <FooterLink href="mailto:hello@bossaiusa.com">Contact</FooterLink>
          <FooterLink href="https://cal.com/bossaiusa/demo">Book a demo</FooterLink>
          <FooterLink href="#faq">FAQ</FooterLink>
          <FooterLink href="/terms">Terms</FooterLink>
          <FooterLink href="/privacy">Privacy</FooterLink>
          <FooterLink href="/login">Login</FooterLink>
        </nav>
      </div>
      <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t border-[#1a1a24] text-xs text-[#666677]">
        © {new Date().getFullYear()} Boss.AI. All rights reserved.
      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[#888899] hover:text-white transition-colors">
      {children}
    </Link>
  )
}

// --- Shared ------------------------------------------------------------------

function SectionHeader({
  eyebrow, title, subtitle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="text-xs font-medium uppercase tracking-wider text-indigo-400 mb-3">{eyebrow}</div>
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-[#888899]">{subtitle}</p>}
    </div>
  )
}
