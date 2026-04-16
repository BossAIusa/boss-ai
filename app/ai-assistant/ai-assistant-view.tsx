'use client'
import { useState, useRef, useEffect } from 'react'
import { Employee, Shift, Availability } from '@/types'
import { Button } from '@/components/ui/button'
import { DAY_NAMES, formatTime, getInitials, stringToColor } from '@/lib/utils'
import { Bot, Send, User } from 'lucide-react'
import { format } from 'date-fns'

interface AIAssistantViewProps {
  employees: Employee[]
  shifts: Shift[]
  availability: Availability[]
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

function analyzeCallOut(
  message: string,
  employees: Employee[],
  shifts: Shift[],
  availability: Availability[]
): string {
  const today = new Date()
  const todayStr = format(today, 'EEEE, MMMM d, yyyy')
  const lowMsg = message.toLowerCase()

  // Parse day references
  const dayRefs: Record<string, number> = {
    today: today.getDay(),
    tomorrow: (today.getDay() + 1) % 7,
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  }

  let targetDay = today.getDay()
  for (const [ref, day] of Object.entries(dayRefs)) {
    if (lowMsg.includes(ref)) {
      targetDay = day
      break
    }
  }

  // Parse employee name references
  const mentionedEmployees = employees.filter(emp => {
    const name = emp.profile?.full_name?.toLowerCase() || ''
    const parts = name.split(' ')
    return parts.some(part => lowMsg.includes(part.toLowerCase()))
  })

  // Find who's scheduled for the target day
  const targetDate = new Date(today)
  while (targetDate.getDay() !== targetDay) {
    targetDate.setDate(targetDate.getDate() + 1)
  }
  const targetDateStr = format(targetDate, 'yyyy-MM-dd')

  const scheduledShifts = shifts.filter(s => s.date === targetDateStr)
  const scheduledEmpIds = new Set(scheduledShifts.map(s => s.employee_id))

  // Find available replacements
  const availableReplacements = employees
    .filter(emp => {
      // Not already scheduled
      if (scheduledEmpIds.has(emp.id)) return false

      // Check availability for target day
      const empAvailability = availability.filter(a =>
        a.employee_id === emp.id &&
        a.day_of_week === targetDay &&
        a.is_available
      )
      return empAvailability.length > 0
    })
    .map(emp => {
      // Score based on scheduled hours this week
      const weeklyShifts = shifts.filter(s => s.employee_id === emp.id)
      const weeklyHours = weeklyShifts.reduce((acc, s) => {
        const start = s.start_time.split(':').map(Number)
        const end = s.end_time.split(':').map(Number)
        return acc + (end[0] * 60 + end[1] - start[0] * 60 - start[1]) / 60
      }, 0)

      const maxHours = emp.max_hours_per_week || 40
      const utilizationScore = 1 - (weeklyHours / maxHours) // Higher = more available
      const dayAvailability = availability.find(a =>
        a.employee_id === emp.id && a.day_of_week === targetDay && a.is_available
      )

      return {
        emp,
        score: utilizationScore,
        weeklyHours,
        maxHours,
        dayAvailability,
      }
    })
    .sort((a, b) => b.score - a.score)

  // Check for workload analysis intent
  if (lowMsg.includes('workload') || lowMsg.includes('hours') || lowMsg.includes('trend')) {
    const analysis = employees.map(emp => {
      const empShifts = shifts.filter(s => s.employee_id === emp.id)
      const hours = empShifts.reduce((acc, s) => {
        const start = s.start_time.split(':').map(Number)
        const end = s.end_time.split(':').map(Number)
        return acc + (end[0] * 60 + end[1] - start[0] * 60 - start[1]) / 60
      }, 0)
      return { name: emp.profile?.full_name || 'Unknown', hours, shifts: empShifts.length }
    }).sort((a, b) => b.hours - a.hours)

    let response = `**Workload Analysis** (past 7 days)\n\nToday is ${todayStr}.\n\n`
    analysis.forEach(({ name, hours, shifts }) => {
      const bar = '█'.repeat(Math.min(Math.round(hours / 2), 20))
      response += `**${name}**: ${hours.toFixed(1)} hrs, ${shifts} shifts  ${bar}\n`
    })

    const avgHours = analysis.reduce((a, b) => a + b.hours, 0) / (analysis.length || 1)
    response += `\n**Average**: ${avgHours.toFixed(1)} hrs/employee`

    const overloaded = analysis.filter(e => e.hours > 35)
    if (overloaded.length > 0) {
      response += `\n\n⚠️ **Heads up**: ${overloaded.map(e => e.name).join(', ')} ${overloaded.length === 1 ? 'is' : 'are'} approaching maximum hours.`
    }
    return response
  }

  // Call-out / replacement scenario
  if (mentionedEmployees.length > 0 || lowMsg.includes('call') || lowMsg.includes('sick') || lowMsg.includes('out') || lowMsg.includes('cover') || lowMsg.includes('replac')) {
    const callingOut = mentionedEmployees[0]
    const dayName = DAY_NAMES[targetDay]
    let response = `**Call-Out Coverage — ${dayName}** (${format(targetDate, 'MMM d')})\n\n`
    response += `Today is ${todayStr}.\n\n`

    if (callingOut) {
      const callerShift = scheduledShifts.find(s => s.employee_id === callingOut.id)
      response += `📋 **${callingOut.profile?.full_name}** is calling out`
      if (callerShift) {
        response += ` for their ${formatTime(callerShift.start_time)} – ${formatTime(callerShift.end_time)} shift`
      }
      response += `.\n\n`
    }

    if (availableReplacements.length === 0) {
      response += `❌ No available replacements found for ${dayName}. All other employees are either scheduled or unavailable.\n\nConsider:\n• Checking if any scheduled employee can extend their shift\n• Offering overtime to available staff\n• Splitting the shift between multiple employees`
    } else {
      response += `**Recommended Replacements** (ranked by availability):\n\n`
      availableReplacements.slice(0, 4).forEach((r, i) => {
        const dayAvail = r.dayAvailability
        const hoursLeft = r.maxHours - r.weeklyHours
        const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣'][i]
        response += `${rankEmoji} **${r.emp.profile?.full_name}**\n`
        if (dayAvail) {
          response += `   Available: ${formatTime(dayAvail.start_time)} – ${formatTime(dayAvail.end_time)}\n`
        }
        response += `   This week: ${r.weeklyHours.toFixed(1)} hrs / ${r.maxHours} max (~${hoursLeft.toFixed(0)} hrs remaining)\n\n`
      })
    }

    return response
  }

  // General help / greeting
  if (lowMsg.includes('hello') || lowMsg.includes('hi') || lowMsg.includes('help') || lowMsg.match(/^(hey|yo|sup)\b/)) {
    return `Hello! I'm your Boss.AI scheduling assistant. Today is **${todayStr}**.\n\nI can help you with:\n\n• **Call-out coverage** — "Sarah is calling out tomorrow, who can cover?"\n• **Workload analysis** — "Show me workload trends this week"\n• **Replacement scoring** — I'll rank candidates by availability, hours, and role\n• **Schedule insights** — Ask about any employee or day\n\nWhat do you need?`
  }

  // Who's scheduled query
  if (lowMsg.includes('who') && (lowMsg.includes('schedule') || lowMsg.includes('working') || lowMsg.includes('shift'))) {
    const dayName = DAY_NAMES[targetDay]
    if (scheduledShifts.length === 0) {
      return `No shifts are scheduled for **${dayName}** (${format(targetDate, 'MMM d')}).`
    }
    let response = `**Scheduled for ${dayName}** (${format(targetDate, 'MMM d')}):\n\n`
    scheduledShifts.forEach(s => {
      const name = s.employee?.profile?.full_name || 'Unknown'
      response += `• **${name}** — ${formatTime(s.start_time)} to ${formatTime(s.end_time)}`
      if (s.role) response += ` (${s.role.name})`
      response += '\n'
    })
    return response
  }

  return `I understood you're asking about scheduling. Today is **${todayStr}**.\n\nTry asking me:\n• "Who's working Monday?"\n• "John called out today, who can cover?"\n• "Show me workload trends"\n• "Who's available Thursday?"`
}

export function AIAssistantView({ employees, shifts, availability }: AIAssistantViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your Boss.AI scheduling assistant. Today is **${format(new Date(), 'EEEE, MMMM d, yyyy')}**.\n\nI can help with call-out coverage, replacement recommendations, workload analysis, and scheduling questions. What do you need?`,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || thinking) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setThinking(true)

    // Simulate thinking delay
    await new Promise(r => setTimeout(r, 600))

    const response = analyzeCallOut(userMsg.content, employees, shifts, availability)
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, assistantMsg])
    setThinking(false)
  }

  const formatContent = (content: string) => {
    return content
      .split('\n')
      .map((line, i) => {
        line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        if (line.startsWith('• ')) {
          return `<div key="${i}" class="flex gap-2 my-0.5"><span class="text-indigo-400 mt-0.5">•</span><span>${line.slice(2)}</span></div>`
        }
        if (line.startsWith('🥇') || line.startsWith('🥈') || line.startsWith('🥉') || line.startsWith('4️⃣')) {
          return `<div key="${i}" class="mt-2">${line}</div>`
        }
        if (line.startsWith('   ')) {
          return `<div key="${i}" class="ml-6 text-[#888899] text-xs">${line.trim()}</div>`
        }
        if (line === '') return `<div key="${i}" class="h-1"></div>`
        return `<div key="${i}">${line}</div>`
      })
      .join('')
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#2a2a3a] bg-[#111118] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <Bot size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[#e8e8f0]">AI Call-Out Assistant</h1>
          <p className="text-xs text-[#888899]">Smart coverage recommendations & workload analysis</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
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
            <div className={`max-w-lg rounded-xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'assistant'
                ? 'bg-[#111118] border border-[#2a2a3a] text-[#e8e8f0]'
                : 'bg-indigo-500/10 border border-indigo-500/20 text-[#e8e8f0]'
            }`}>
              <div
                dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                className="space-y-0.5"
              />
              <div className="text-[10px] text-[#888899]/50 mt-2">
                {format(msg.timestamp, 'h:mm a')}
              </div>
            </div>
          </div>
        ))}

        {thinking && (
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
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-[#2a2a3a] bg-[#111118]">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="e.g. 'Sarah called out today, who can cover?' or 'Show workload trends'"
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-[#2a2a3a] bg-[#1a1a24] text-[#e8e8f0] placeholder-[#888899] outline-none focus:border-indigo-500/50 transition-colors"
          />
          <Button onClick={send} disabled={!input.trim() || thinking}>
            <Send size={14} />
          </Button>
        </div>
        <p className="text-[10px] text-[#888899]/50 mt-2 text-center">
          Press Enter to send · Ask about coverage, availability, workload, or who's scheduled
        </p>
      </div>
    </div>
  )
}
