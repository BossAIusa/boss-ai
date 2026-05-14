'use client'
import { useEffect, useRef, useState, ReactNode } from 'react'
import Link from 'next/link'
import {
  Bot, ArrowRight, Sparkles, Wand2, Users2, CalendarRange,
  Plane, Scale, Check, Zap, Plus, Minus, Send,
} from 'lucide-react'

// ============================================================================
// Reveal hook — fades + slides children in once they enter the viewport.
// ============================================================================

function useReveal<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out will-change-transform ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  )
}

// ============================================================================
// Scroll progress for the sticky nav.
// ============================================================================

function useScrollY() {
  const [y, setY] = useState(0)
  useEffect(() => {
    const onScroll = () => setY(window.scrollY)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return y
}

// ============================================================================
// Page
// ============================================================================

export function LandingV2() {
  return (
    <div className="bg-[#06060b] text-[#e8e8f0] min-h-screen overflow-x-hidden">
      <Mesh />
      <Nav />
      <Hero />
      <StatsStrip />
      <Features />
      <HowItWorks />
      <PricingBuilder />
      <FAQ />
      <FooterCTA />
      <Footer />
    </div>
  )
}

// ============================================================================
// Animated mesh gradient (CSS-only blobs)
// ============================================================================

function Mesh() {
  return (
    <>
      <style jsx global>{`
        @keyframes blobA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(120px,-60px) scale(1.1); } }
        @keyframes blobB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-80px,80px) scale(1.15); } }
        @keyframes blobC { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,40px) scale(0.95); } }
        @keyframes pulse-soft { 0%,100% { opacity: 0.5; } 50% { opacity: 0.9; } }
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
        .text-shimmer {
          background: linear-gradient(110deg, #e8e8f0 30%, #a5b4fc 50%, #e8e8f0 70%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 4s linear infinite;
        }
      `}</style>
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(99,102,241,0.45), transparent 60%)', animation: 'blobA 18s ease-in-out infinite' }}
        />
        <div
          className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle at 70% 50%, rgba(168,85,247,0.32), transparent 60%)', animation: 'blobB 22s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(56,189,248,0.22), transparent 60%)', animation: 'blobC 26s ease-in-out infinite' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>
    </>
  )
}

// ============================================================================
// Nav
// ============================================================================

function Nav() {
  const y = useScrollY()
  const scrolled = y > 12
  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${
      scrolled ? 'backdrop-blur-md bg-[#06060b]/70 border-b border-[#1a1a24]' : 'bg-transparent border-b border-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform">
            <Bot size={16} className="text-white" />
          </div>
          <span className="font-bold tracking-tight">Boss.AI</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {[
            ['Features', '#features'],
            ['How it works', '#how'],
            ['Pricing', '#pricing'],
            ['FAQ', '#faq'],
          ].map(([label, href]) => (
            <a key={href} href={href} className="px-3 py-1.5 rounded-lg text-[#888899] hover:text-white hover:bg-white/5 transition-all">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="text-sm text-[#888899] hover:text-white px-3 py-1.5 rounded-lg transition-colors">
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium px-4 py-1.5 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 hover:brightness-110 text-white shadow-lg shadow-indigo-500/30 transition-all"
          >
            Get started
          </Link>
        </div>
      </div>
      {/* scroll progress bar */}
      <div className="absolute bottom-0 left-0 h-px bg-gradient-to-r from-indigo-400 to-purple-500 transition-all"
        style={{ width: typeof window !== 'undefined'
          ? `${Math.min(100, (y / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)) * 100)}%`
          : '0%' }}
      />
    </header>
  )
}

// ============================================================================
// Hero — split layout with interactive AI demo
// ============================================================================

function Hero() {
  return (
    <section className="relative pt-20 pb-24 md:pt-28 md:pb-32">
      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
        <div>
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/5 text-xs text-indigo-300 mb-7">
              <Sparkles size={12} />
              Now with conversational AI scheduling
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.02]">
              Schedule smarter.{' '}
              <span className="text-shimmer">Work fairer.</span>{' '}
              <span className="text-[#888899]">Stop late-night spreadsheets.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-lg text-[#888899] max-w-lg leading-relaxed">
              Boss.AI auto-builds balanced weekly schedules from real availability, then helps you adjust on the fly with a built-in scheduling assistant.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 hover:brightness-110 text-white font-medium shadow-xl shadow-indigo-500/30 transition-all"
              >
                Try It Now
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#2a2a3a] hover:border-indigo-400/50 hover:bg-white/[0.02] font-medium transition-all"
              >
                Login
              </Link>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div className="mt-6 flex items-center gap-6 text-xs text-[#666677]">
              <div className="flex items-center gap-1.5"><Check size={12} className="text-indigo-400" /> No credit card</div>
              <div className="flex items-center gap-1.5"><Check size={12} className="text-indigo-400" /> 14-day trial</div>
              <div className="flex items-center gap-1.5"><Check size={12} className="text-indigo-400" /> Set up in 5 min</div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <AIDemo />
        </Reveal>
      </div>
    </section>
  )
}

// ============================================================================
// Animated AI demo — cycles prompts + types responses
// ============================================================================

const SCRIPT: { q: string; a: string }[] = [
  {
    q: 'Who can cover Saturday 10am–2pm?',
    a: 'Maya is your best option — she\'s under hours this week and available Saturday. Jordan is a backup but already at 32h.',
  },
  {
    q: 'Rebalance hours for next week.',
    a: 'Done. Moved 6h from Lex to Priya and shifted Sam\'s Friday to even out the week. Everyone is now within 2h of the average.',
  },
  {
    q: 'Anyone scheduled past their cap?',
    a: 'No — the auto-generator caps at each employee\'s max_hours_per_week. Sam is closest at 28h of 30h.',
  },
]

function AIDemo() {
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<'typing-q' | 'thinking' | 'typing-a' | 'rest'>('typing-q')
  const [qText, setQText] = useState('')
  const [aText, setAText] = useState('')

  const current = SCRIPT[step]

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    if (phase === 'typing-q') {
      if (qText.length < current.q.length) {
        t = setTimeout(() => setQText(current.q.slice(0, qText.length + 1)), 28)
      } else {
        t = setTimeout(() => setPhase('thinking'), 350)
      }
    } else if (phase === 'thinking') {
      t = setTimeout(() => setPhase('typing-a'), 750)
    } else if (phase === 'typing-a') {
      if (aText.length < current.a.length) {
        t = setTimeout(() => setAText(current.a.slice(0, aText.length + 1)), 14)
      } else {
        t = setTimeout(() => setPhase('rest'), 2400)
      }
    } else if (phase === 'rest') {
      t = setTimeout(() => {
        setStep((s) => (s + 1) % SCRIPT.length)
        setQText('')
        setAText('')
        setPhase('typing-q')
      }, 600)
    }
    return () => clearTimeout(t)
  }, [phase, qText, aText, current])

  return (
    <div className="relative">
      {/* glow */}
      <div className="absolute -inset-8 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent rounded-3xl blur-2xl -z-10" />

      <div className="rounded-2xl border border-[#2a2a3a] bg-[#0d0d14]/90 backdrop-blur-md shadow-2xl shadow-black/40 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1f1f2c]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2a2a3a]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#2a2a3a]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#2a2a3a]" />
          </div>
          <div className="ml-3 flex items-center gap-2 text-xs text-[#888899]">
            <Bot size={12} className="text-indigo-400" />
            Boss.AI Assistant
          </div>
        </div>

        <div className="p-5 min-h-[300px] flex flex-col gap-4 text-sm">
          {/* user bubble */}
          <div className="self-end max-w-[80%] px-3 py-2 rounded-xl rounded-br-sm bg-indigo-500 text-white">
            {qText}
            {phase === 'typing-q' && <Caret />}
          </div>

          {/* AI bubble */}
          {(phase === 'thinking' || phase === 'typing-a' || phase === 'rest') && (
            <div className="self-start max-w-[88%] px-3 py-2.5 rounded-xl rounded-bl-sm bg-[#13131c] border border-[#2a2a3a]">
              {phase === 'thinking' ? (
                <div className="flex items-center gap-1.5 text-[#888899]">
                  <Dot delay={0} /><Dot delay={120} /><Dot delay={240} />
                </div>
              ) : (
                <span className="text-[#e8e8f0] leading-relaxed">
                  {aText}
                  {phase === 'typing-a' && <Caret />}
                </span>
              )}
            </div>
          )}
        </div>

        {/* mock input row */}
        <div className="border-t border-[#1f1f2c] p-3 flex items-center gap-2">
          <div className="flex-1 px-3 py-2 rounded-lg bg-[#13131c] border border-[#2a2a3a] text-xs text-[#666677]">
            Ask anything about your schedule…
          </div>
          <button className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* prompt chip indicators */}
      <div className="flex gap-1.5 mt-4 justify-center">
        {SCRIPT.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all ${
              i === step ? 'w-8 bg-indigo-400' : 'w-1.5 bg-[#2a2a3a]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function Caret() {
  return <span className="inline-block w-1.5 h-4 bg-current ml-0.5 align-middle" style={{ animation: 'blink 0.9s steps(1) infinite' }} />
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-[#888899]"
      style={{ animation: 'pulse-soft 1.2s ease-in-out infinite', animationDelay: `${delay}ms` }}
    />
  )
}

// ============================================================================
// Stats strip with count-up
// ============================================================================

function StatsStrip() {
  const stats = [
    { value: 12, suffix: 'h', label: 'Saved per manager / week' },
    { value: 95, suffix: '%', label: 'Shifts auto-filled correctly' },
    { value: 5,  suffix: 'min', label: 'From signup to first schedule' },
    { value: 0,  suffix: '',   label: 'Spreadsheets required' },
  ]
  return (
    <section className="border-y border-[#1a1a24] bg-[#08080d]/60 backdrop-blur-sm py-10">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <Reveal key={i} delay={i * 80}>
            <Stat value={s.value} suffix={s.suffix} label={s.label} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Stat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!visible) return
    const start = performance.now()
    const dur = 1000
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      setN(Math.round(value * (1 - Math.pow(1 - t, 3))))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [visible, value])
  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl md:text-4xl font-bold tracking-tight">
        {n}{suffix}
      </div>
      <div className="mt-1 text-xs text-[#888899] uppercase tracking-wider">{label}</div>
    </div>
  )
}

// ============================================================================
// Features — bento grid with hover lift
// ============================================================================

function Features() {
  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <SectionHeader
            eyebrow="Features"
            title="Everything you need. Nothing you don't."
            subtitle="Each feature is built around the messiness of real shift work."
          />
        </Reveal>

        <div className="mt-16 grid md:grid-cols-3 gap-4 auto-rows-[200px]">
          <FeatureCard
            className="md:col-span-2 md:row-span-2"
            icon={Wand2}
            title="Auto-generate balanced schedules"
            body="One click builds a fair, balanced week — respecting availability, time-off, store hours, and weekly hour caps. Re-run it as often as you like; results stay coverage-aware."
            delay={0}
          >
            <MiniSchedule />
          </FeatureCard>
          <FeatureCard icon={Bot} title="AI shift coverage" body="Ask the assistant who can cover. It ranks by availability and current hours." delay={80} />
          <FeatureCard icon={Scale} title="Workload balancing" body="Distribute hours fairly. No more cliques stacking up overtime." delay={160} />
          <FeatureCard icon={Plane} title="Time-off requests" body="Approve in one tap. Honored by every future schedule." delay={0} />
          <FeatureCard icon={Users2} title="Availability self-service" body="Employees set their own weekly availability and exceptions." delay={80} />
          <FeatureCard icon={Zap} title="Coverage-aware shifts" body="Spreads shifts across your store hours so you're never thin on staff." delay={160} />
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  icon: Icon, title, body, className = '', delay = 0, children,
}: {
  icon: typeof Bot; title: string; body: string; className?: string; delay?: number; children?: ReactNode
}) {
  return (
    <Reveal delay={delay} className={`${className} h-full`}>
      <div className="group relative h-full rounded-2xl border border-[#2a2a3a] bg-gradient-to-br from-[#0f0f17] to-[#0a0a13] p-6 overflow-hidden transition-all duration-300 hover:border-indigo-500/40 hover:-translate-y-0.5">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-all duration-500" />
        <div className="relative flex flex-col h-full">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <Icon size={18} className="text-indigo-400" />
          </div>
          <h3 className="font-semibold text-[#e8e8f0] mb-1.5">{title}</h3>
          <p className="text-sm text-[#888899] leading-relaxed">{body}</p>
          {children && <div className="mt-5 flex-1 min-h-0">{children}</div>}
        </div>
      </div>
    </Reveal>
  )
}

function MiniSchedule() {
  // tiny stylized schedule preview that animates in
  type Block = { col: number; row: number; w: number; color: string }
  const blocks: Block[] = [
    { col: 0, row: 0, w: 1, color: 'indigo' },
    { col: 0, row: 1, w: 1, color: 'purple' },
    { col: 1, row: 0, w: 1, color: 'pink' },
    { col: 2, row: 1, w: 1, color: 'cyan' },
    { col: 3, row: 0, w: 1, color: 'amber' },
    { col: 3, row: 1, w: 1, color: 'indigo' },
    { col: 4, row: 0, w: 1, color: 'purple' },
    { col: 5, row: 1, w: 1, color: 'pink' },
    { col: 6, row: 0, w: 1, color: 'cyan' },
  ]
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-400/40 border-indigo-300',
    purple: 'bg-purple-400/40 border-purple-300',
    pink:   'bg-pink-400/40 border-pink-300',
    cyan:   'bg-cyan-400/40 border-cyan-300',
    amber:  'bg-amber-400/40 border-amber-300',
  }
  return (
    <div className="rounded-lg border border-[#1f1f2c] bg-[#0a0a13] p-2.5 h-full flex flex-col">
      <div className="grid grid-cols-7 gap-1 mb-1.5 text-[9px] uppercase tracking-wider text-[#666677] text-center">
        {['M','T','W','T','F','S','S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 grid-rows-2 gap-1 flex-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="rounded-sm bg-[#13131c]/60" />
        ))}
        {blocks.map((b, i) => (
          <div
            key={i}
            className={`rounded-sm border-l-2 ${colorMap[b.color]}`}
            style={{
              gridColumn: `${b.col + 1} / span ${b.w}`,
              gridRow: `${b.row + 1} / span 1`,
              animation: `pulse-soft 4s ease-in-out infinite`,
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// How it works — vertical timeline with progress line
// ============================================================================

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Add your team',     body: 'Invite employees, set roles and weekly hour caps.' },
    { n: '02', title: 'Set availability',  body: 'Each employee declares when they can work. Time-off and exceptions are baked in.' },
    { n: '03', title: 'Auto-generate',     body: 'One click builds a balanced week that respects every constraint.' },
    { n: '04', title: 'Optimize with AI',  body: 'Ask the assistant to find coverage, swap shifts, or rebalance hours.' },
  ]
  return (
    <section id="how" className="py-24 md:py-32 border-y border-[#1a1a24] bg-[#08080d]/60">
      <div className="max-w-5xl mx-auto px-6">
        <Reveal>
          <SectionHeader eyebrow="How it works" title="From chaos to a published schedule in four steps" />
        </Reveal>
        <div className="mt-16 relative">
          {/* vertical line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/0 via-indigo-500/40 to-purple-500/0 md:-translate-x-1/2" />
          <div className="space-y-12">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className={`relative flex flex-col md:flex-row md:items-center gap-6 ${
                  i % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}>
                  {/* dot */}
                  <div className="absolute left-6 md:left-1/2 -translate-x-1/2 -translate-y-1 md:translate-y-0 w-3 h-3 rounded-full bg-indigo-400 ring-4 ring-[#06060b] shadow-lg shadow-indigo-500/40" />

                  {/* card */}
                  <div className="md:w-1/2 ml-14 md:ml-0 md:px-8">
                    <div className="rounded-2xl border border-[#2a2a3a] bg-[#0f0f17] p-5">
                      <div className="text-xs font-mono text-indigo-400 mb-2">{s.n}</div>
                      <h3 className="font-semibold text-[#e8e8f0] mb-1.5">{s.title}</h3>
                      <p className="text-sm text-[#888899] leading-relaxed">{s.body}</p>
                    </div>
                  </div>
                  <div className="hidden md:block md:w-1/2" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// Pricing builder
// ============================================================================

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

function PricingBuilder() {
  const [storeType, setStoreType] = useState<StoreType>('single')
  const [empRange, setEmpRange] = useState<EmpRange>('1-10')
  const [aiAddon, setAiAddon] = useState(true)

  const base = BASE_PRICE[storeType][empRange]
  const total = base + (aiAddon ? AI_ADDON_PRICE : 0)
  const display = useAnimatedNumber(total)

  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <SectionHeader
            eyebrow="Pricing"
            title="Build your plan, see your price"
            subtitle="Pay only for what you need. Cancel anytime."
          />
        </Reveal>

        <div className="mt-16 grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
          <Reveal>
            <div className="rounded-2xl border border-[#2a2a3a] bg-[#0f0f17] p-6 md:p-8 space-y-7">
              <ChoiceGroup
                label="Store type"
                value={storeType}
                onChange={v => setStoreType(v as StoreType)}
                options={[
                  { value: 'single', title: 'Single store', body: 'One location' },
                  { value: 'multi',  title: 'Multi store',  body: 'Two or more locations' },
                ]}
              />
              <ChoiceGroup
                label="Team size"
                value={empRange}
                onChange={v => setEmpRange(v as EmpRange)}
                options={(['1-10','11-20','20+'] as EmpRange[]).map(r => ({ value: r, title: RANGE_LABEL[r], body: '' }))}
              />
              <div>
                <div className="text-sm font-medium text-[#e8e8f0] mb-3">Add-ons</div>
                <div className="space-y-2">
                  <Toggle
                    active={aiAddon}
                    onClick={() => setAiAddon(v => !v)}
                    title="AI Scheduling Assistant"
                    body="Conversational AI that finds coverage, swaps, and remembers preferences."
                    price={AI_ADDON_PRICE}
                  />
                  <ComingSoon title="Advanced Reporting" body="Labor cost forecasts, attendance analytics, exports." />
                  <ComingSoon title="Multi-location scheduling" body="Move staff between stores; unified reporting." />
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="lg:sticky lg:top-24 rounded-2xl border border-[#2a2a3a] bg-gradient-to-br from-[#13131c] via-[#0f0f17] to-[#0a0a13] p-6 md:p-8 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-indigo-500/20 blur-3xl" />
              <div className="relative">
                <div className="text-xs uppercase tracking-wider text-indigo-300 mb-3">Your plan</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-6xl font-bold tracking-tight tabular-nums">${display}</span>
                  <span className="text-[#888899]">/month</span>
                </div>
                <p className="text-sm text-[#888899] mb-7">Billed monthly. Cancel anytime.</p>
                <div className="space-y-2 mb-7 text-sm">
                  <Line label={storeType === 'single' ? 'Single store' : 'Multi store'} value={`$${base}`} />
                  <Line label={RANGE_LABEL[empRange]} value="Included" />
                  {aiAddon && <Line label="AI Scheduling Assistant" value={`$${AI_ADDON_PRICE}`} />}
                </div>
                <Link
                  href="/signup"
                  className="block text-center w-full px-5 py-3 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 hover:brightness-110 text-white font-medium shadow-lg shadow-indigo-500/30 transition-all"
                >
                  Start 14-day free trial
                </Link>
                <p className="text-center text-xs text-[#666677] mt-3">No credit card required</p>
                <div className="mt-6 pt-6 border-t border-[#2a2a3a] space-y-2 text-sm text-[#888899]">
                  <Bullet>Unlimited schedules</Bullet>
                  <Bullet>Auto-generation with workload balancing</Bullet>
                  <Bullet>Employee self-service portal</Bullet>
                  <Bullet>Time-off & availability management</Bullet>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function useAnimatedNumber(target: number) {
  const [n, setN] = useState(target)
  useEffect(() => {
    const start = n
    const delta = target - start
    if (delta === 0) return
    const dur = 320
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      setN(Math.round(start + delta * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
  return n
}

function ChoiceGroup({
  label, options, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; title: string; body: string }[]
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
              className={`relative text-left p-4 rounded-xl border transition-all duration-200 ${
                active
                  ? 'border-indigo-500/60 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                  : 'border-[#2a2a3a] bg-[#13131c] hover:border-[#3a3a4a]'
              }`}
            >
              <div className={`text-sm font-medium ${active ? 'text-white' : 'text-[#e8e8f0]'}`}>{o.title}</div>
              {o.body && <div className="text-xs text-[#888899] mt-0.5">{o.body}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Toggle({ active, onClick, title, body, price }: {
  active: boolean; onClick: () => void; title: string; body: string; price: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
        active ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-[#2a2a3a] bg-[#13131c] hover:border-[#3a3a4a]'
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
        <span className="text-[10px] uppercase tracking-wider text-[#666677] bg-[#1a1a24] px-2 py-0.5 rounded">Soon</span>
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

function Bullet({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Check size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  )
}

// ============================================================================
// FAQ
// ============================================================================

function FAQ() {
  const items = [
    { q: 'How long does setup take?',                a: 'Most teams are scheduling within 5 minutes — add store hours, invite employees, and Boss.AI handles the rest.' },
    { q: 'How does the AI assistant work?',          a: 'It has direct access to your schedule, availability, and time-off data. Ask it questions like "who can cover Saturday morning?" and it ranks replacements by availability and current hours.' },
    { q: 'Can employees see each other\'s schedules?', a: 'Yes — once you publish a schedule, every employee sees the full week.' },
    { q: 'Do you support multiple locations?',       a: 'The Multi store plan supports two or more locations today. Cross-location features are on the roadmap.' },
    { q: 'Is there a free trial?',                   a: 'Yes — 14 days, no credit card required. Cancel anytime.' },
    { q: 'How is my data protected?',                a: 'Your data is encrypted in transit and at rest. Only managers in your workspace can see schedules and employee data.' },
  ]
  return (
    <section id="faq" className="py-24 md:py-32 border-y border-[#1a1a24] bg-[#08080d]/60">
      <div className="max-w-3xl mx-auto px-6">
        <Reveal>
          <SectionHeader eyebrow="FAQ" title="Questions, answered" />
        </Reveal>
        <div className="mt-14 space-y-2">
          {items.map((it, idx) => (
            <Reveal key={idx} delay={idx * 60}>
              <FAQItem {...it} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    setH(ref.current.scrollHeight)
  }, [open, a])
  return (
    <div className="rounded-xl border border-[#2a2a3a] bg-[#0f0f17] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="font-medium text-[#e8e8f0]">{q}</span>
        <span className="text-[#888899] transition-transform duration-300" style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>
          {open ? <Minus size={16} /> : <Plus size={16} />}
        </span>
      </button>
      <div
        style={{ maxHeight: open ? h : 0 }}
        className="transition-[max-height] duration-300 ease-out overflow-hidden"
      >
        <div ref={ref} className="px-5 pb-5 text-sm text-[#888899] leading-relaxed">
          {a}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Footer CTA + Footer
// ============================================================================

function FooterCTA() {
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-3xl" />
      </div>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <Reveal>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
            Stop wrestling with{' '}
            <span className="text-shimmer">spreadsheets.</span>
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-5 text-lg text-[#888899]">
            Try Boss.AI free for 14 days. Set up in minutes, schedule in seconds.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 hover:brightness-110 text-white font-medium shadow-xl shadow-indigo-500/30 transition-all"
            >
              Try It Now
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="https://cal.com/bossaiusa/demo"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-[#2a2a3a] hover:border-indigo-400/50 hover:bg-white/[0.02] font-medium transition-all"
            >
              <CalendarRange size={16} /> Book a demo
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-[#1a1a24] py-12">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-[1fr_auto] gap-8 items-start">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
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

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[#888899] hover:text-white transition-colors">
      {children}
    </Link>
  )
}

// ============================================================================
// Shared
// ============================================================================

function SectionHeader({
  eyebrow, title, subtitle,
}: {
  eyebrow: string; title: string; subtitle?: string
}) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="text-xs font-medium uppercase tracking-wider text-indigo-400 mb-3">{eyebrow}</div>
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-[#888899]">{subtitle}</p>}
    </div>
  )
}
