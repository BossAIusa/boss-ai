'use client'
import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import {
  Employee, AIConversationMessage, AIMemory,
} from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Bot, Send, User, Brain, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

interface AIAssistantViewProps {
  userId: string
  employees: Employee[]
  history: AIConversationMessage[]
  memories: AIMemory[]
}

function historyToUIMessages(history: AIConversationMessage[]): UIMessage[] {
  return history.map(h => ({
    id: h.id,
    role: h.role,
    parts: [{ type: 'text', text: h.content }],
  }))
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function applyInline(s: string): string {
  let out = escapeHtml(s)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[#e8e8f0] font-semibold">$1</strong>')
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
  out = out.replace(/`([^`]+)`/g, '<span class="px-1 py-0.5 rounded bg-[#1a1a24] text-indigo-300 text-[11px]">$1</span>')
  return out
}

function formatText(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []

  for (let raw of lines) {
    // Drop horizontal rules entirely
    if (/^\s*-{3,}\s*$/.test(raw) || /^\s*_{3,}\s*$/.test(raw) || /^\s*\*{3,}\s*$/.test(raw)) continue

    // Strip leading markdown heading markers (##, ###, etc.) — show as regular text
    raw = raw.replace(/^\s{0,3}#{1,6}\s+/, '')

    const trimmed = raw.trim()
    if (trimmed === '') {
      out.push('<div class="h-2"></div>')
      continue
    }

    // Bullet list item: "- ", "* ", "• "
    const bulletMatch = raw.match(/^\s*[-*•]\s+(.*)$/)
    if (bulletMatch) {
      out.push(
        `<div class="flex gap-2 my-1"><span class="text-indigo-400 mt-0.5 flex-shrink-0">•</span><span class="flex-1">${applyInline(bulletMatch[1])}</span></div>`
      )
      continue
    }

    // Numbered list item: "1. ", "1) "
    const numberedMatch = raw.match(/^\s*(\d+)[.)]\s+(.*)$/)
    if (numberedMatch) {
      out.push(
        `<div class="flex gap-2 my-1"><span class="text-indigo-400 mt-0.5 flex-shrink-0 font-medium">${numberedMatch[1]}.</span><span class="flex-1">${applyInline(numberedMatch[2])}</span></div>`
      )
      continue
    }

    out.push(`<div class="my-0.5">${applyInline(raw)}</div>`)
  }

  return out.join('')
}

export function AIAssistantView({ userId, employees, history, memories }: AIAssistantViewProps) {
  const supabase = createClient()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, setMessages, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    messages: historyToUIMessages(history),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || status !== 'ready') return
    sendMessage({ text: input.trim() })
    setInput('')
  }

  const clearHistory = async () => {
    if (!confirm('Clear the conversation (keeps saved notes)?')) return
    await supabase.from('ai_conversations').delete().eq('user_id', userId)
    setMessages([])
  }

  const suggestions = history.length === 0 && messages.length === 0 ? [
    `Who can cover tomorrow?`,
    `What's the workload this week?`,
    employees[0] ? `Schedule ${employees[0].profile?.full_name?.split(' ')[0]} Monday 10-6` : null,
    `Who has approved time off?`,
  ].filter(Boolean) as string[] : []

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#2a2a3a] bg-[#111118] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <Bot size={16} className="text-indigo-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-[#e8e8f0]">AI Assistant</h1>
          <p className="text-xs text-[#888899]">Schedule access · persistent memory</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#888899]">
          <Brain size={13} /> {memories.length} notes
        </div>
        <button
          onClick={clearHistory}
          title="Clear conversation"
          className="p-1.5 rounded-md hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="max-w-lg mx-auto text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <Bot size={22} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-[#e8e8f0] mb-1">How can I help?</h2>
            <p className="text-sm text-[#888899] mb-6">
              I know your team, schedule, availability, time off, and store hours. I can also edit the schedule directly.
            </p>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage({ text: s })}
                    className="px-3 py-1.5 text-xs rounded-full border border-[#2a2a3a] bg-[#111118] text-[#e8e8f0] hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
              msg.role === 'assistant' ? 'bg-indigo-500/20' : 'bg-[#2a2a3a]'
            }`}>
              {msg.role === 'assistant'
                ? <Bot size={13} className="text-indigo-400" />
                : <User size={13} className="text-[#888899]" />
              }
            </div>
            <div className={`max-w-xl rounded-xl text-sm leading-relaxed ${
              msg.role === 'assistant'
                ? 'bg-[#111118] border border-[#2a2a3a] text-[#e8e8f0]'
                : 'bg-indigo-500/10 border border-indigo-500/20 text-[#e8e8f0]'
            } px-4 py-3 space-y-1`}>
              {msg.parts.map((part, idx) => {
                if (part.type === 'text') {
                  return (
                    <div
                      key={idx}
                      dangerouslySetInnerHTML={{ __html: formatText(part.text) }}
                    />
                  )
                }
                // Tool calls are intentionally hidden from the UI
                return null
              })}
            </div>
          </div>
        ))}

        {(() => {
          if (status !== 'submitted' && status !== 'streaming') return null
          const last = messages[messages.length - 1]
          const lastHasText = last?.role === 'assistant' && last.parts.some(p => p.type === 'text' && 'text' in p && p.text.length > 0)
          if (lastHasText) return null
          return (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Bot size={13} className="text-indigo-400" />
              </div>
              <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )
        })()}

        {error && (
          <div className="mx-auto max-w-lg px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono whitespace-pre-wrap break-all">
            {error.message || String(error)}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="px-6 py-4 border-t border-[#2a2a3a] bg-[#111118]">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about the schedule, or give me changes to make…"
            disabled={status !== 'ready'}
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-[#2a2a3a] bg-[#1a1a24] text-[#e8e8f0] placeholder-[#888899] outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-60"
          />
          {status === 'streaming' || status === 'submitted' ? (
            <Button type="button" variant="secondary" onClick={() => stop()}>Stop</Button>
          ) : (
            <Button type="submit" disabled={!input.trim() || status !== 'ready'}>
              <Send size={14} />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-[#888899]/50 mt-2 text-center">
          Today is {format(new Date(), 'EEEE, MMMM d')}
        </p>
      </form>
    </div>
  )
}
