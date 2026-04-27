import Link from 'next/link'
import { Bot } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service — Boss.AI',
}

export default function TermsPage() {
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
      <main className="max-w-3xl mx-auto px-6 py-16 prose prose-invert">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-[#666677] mb-10">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="space-y-6 text-[#888899] leading-relaxed">
          <p>
            This is a placeholder Terms of Service page. Replace with your finalized terms before launch.
          </p>
          <h2 className="text-xl font-semibold text-[#e8e8f0] mt-8">1. Use of service</h2>
          <p>By using Boss.AI, you agree to these terms. You are responsible for the data you upload and for the conduct of users in your workspace.</p>
          <h2 className="text-xl font-semibold text-[#e8e8f0] mt-8">2. Subscriptions</h2>
          <p>Paid plans are billed monthly. You may cancel at any time; access continues through the end of your billing period.</p>
          <h2 className="text-xl font-semibold text-[#e8e8f0] mt-8">3. Contact</h2>
          <p>Questions about these terms? Email <a className="text-indigo-400" href="mailto:hello@bossaiusa.com">hello@bossaiusa.com</a>.</p>
        </div>
      </main>
    </div>
  )
}
