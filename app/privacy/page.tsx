import Link from 'next/link'
import { Bot } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy — Boss.AI',
}

export default function PrivacyPage() {
  return (
    <div className="bg-[#0a0a0f] text-[#e8e8f0] min-h-screen">
      <header className="border-b border-[#1a1a24]">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <span className="font-bold tracking-tight">Boss.AI</span>
          </Link>
          <Link href="/" className="text-sm text-[#888899] hover:text-white transition-colors">
            ← Back
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#666677] mb-10">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="space-y-6 text-[#888899] leading-relaxed">
          <p>
            This is a placeholder Privacy Policy. Replace with your finalized policy before launch.
          </p>
          <h2 className="text-xl font-semibold text-[#e8e8f0] mt-8">Data we collect</h2>
          <p>Your account email, your workspace&apos;s employee and schedule data, and basic usage analytics.</p>
          <h2 className="text-xl font-semibold text-[#e8e8f0] mt-8">How we use it</h2>
          <p>To operate the service, generate schedules, and improve the product. We do not sell your data.</p>
          <h2 className="text-xl font-semibold text-[#e8e8f0] mt-8">Contact</h2>
          <p>Privacy questions? Email <a className="text-indigo-400" href="mailto:hello@bossaiusa.com">hello@bossaiusa.com</a>.</p>
        </div>
      </main>
    </div>
  )
}
