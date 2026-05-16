import Link from 'next/link'
import { Bot } from 'lucide-react'

export default function InviteOnlyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center mb-3">
            <Bot size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#e8e8f0]">Boss.AI</h1>
          <p className="text-sm text-[#888899] mt-1">Invite-only access</p>
        </div>

        <div className="px-4 py-5 rounded-xl border border-[#2a2a3a] bg-[#111118] text-sm text-[#e8e8f0]">
          Boss AI is invite-only. Ask your manager to send you an invitation.
        </div>

        <Link
          href="/auth/login"
          className="inline-block mt-6 text-sm text-indigo-400 hover:text-indigo-300"
        >
          Already have an account? Sign in
        </Link>
      </div>
    </div>
  )
}
