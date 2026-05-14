'use client'
import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot, Send, User, X } from 'lucide-react'
import { format } from 'date-fns'

export function AIChatPanel() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || status !== 'ready') return
    sendMessage({ text: input.trim() })
    setInput('')
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open AI assistant"
        style={{ width: 48, height: 48, bottom: 24, right: 24 }}
        className="fixed z-50 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-colors"
      >
        <Bot size={20} />
      </button>

      {/* Slide-in panel */}
      <div
        className="fixed top-0 right-0 z-50 h-screen w-full md:w-[380px] bg-[#111118] border-l border-[#2a2a3a] flex flex-col"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms ease',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[#2a2a3a]">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Bot size={16} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-[#e8e8f0]">AI Assistant</h2>
            <p className="text-[11px] text-[#888899]">{format(new Date(), 'EEEE, MMM d')}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close AI assistant"
            className="p-1.5 rounded-md hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-3">
                <Bot size={18} className="text-indigo-400" />
              </div>
              <p className="text-sm text-[#888899]">
                Ask about the schedule, coverage, or make changes.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                msg.role === 'assistant' ? 'bg-indigo-500/20' : 'bg-[#2a2a3a]'
              }`}>
                {msg.role === 'assistant'
                  ? <Bot size={11} className="text-indigo-400" />
                  : <User size={11} className="text-[#888899]" />
                }
              </div>
              <div className={`max-w-[80%] rounded-lg text-[13px] leading-relaxed px-3 py-2 ${
                msg.role === 'assistant'
                  ? 'bg-[#1a1a24] border border-[#2a2a3a] text-[#e8e8f0]'
                  : 'bg-indigo-500/10 border border-indigo-500/20 text-[#e8e8f0]'
              }`}>
                {msg.parts.map((part, idx) =>
                  part.type === 'text' ? (
                    <div key={idx} className="whitespace-pre-wrap break-words">{part.text}</div>
                  ) : null
                )}
              </div>
            </div>
          ))}

          {(status === 'submitted' || status === 'streaming') && (() => {
            const last = messages[messages.length - 1]
            const lastHasText = last?.role === 'assistant' && last.parts.some(p => p.type === 'text' && 'text' in p && p.text.length > 0)
            if (lastHasText) return null
            return (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center">
                  <Bot size={11} className="text-indigo-400" />
                </div>
                <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2">
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
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error.message || String(error)}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={send} className="flex-shrink-0 px-4 py-3 border-t border-[#2a2a3a]">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask the assistant…"
              disabled={status !== 'ready'}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#2a2a3a] bg-[#1a1a24] text-[#e8e8f0] placeholder-[#888899] outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-60"
            />
            {status === 'streaming' || status === 'submitted' ? (
              <button
                type="button"
                onClick={() => stop()}
                className="px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-[#e8e8f0] hover:bg-[#22222f] transition-colors text-xs font-medium"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || status !== 'ready'}
                aria-label="Send message"
                className="px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  )
}
