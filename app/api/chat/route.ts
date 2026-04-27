import { convertToModelMessages, streamText, stepCountIs, tool, UIMessage } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { format, startOfWeek, addDays } from 'date-fns'

export const maxDuration = 60

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export async function POST(req: Request) {
  try {
    return await handleChat(req)
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error('[api/chat] error:', err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

async function handleChat(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'manager') {
    return new Response('Forbidden', { status: 403 })
  }

  // Load context for the system prompt
  const [
    { data: employees },
    { data: memories },
    { data: storeHours },
    { data: storeSettings },
  ] = await Promise.all([
    supabase.from('employees').select('*, profile:profiles(*), role:roles(*)').order('created_at'),
    supabase.from('ai_memories').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('store_hours').select('*').order('day_of_week'),
    supabase.from('store_settings').select('store_name').limit(1).maybeSingle(),
  ])

  const employeeList = (employees || []).map(e => ({
    id: e.id,
    name: e.profile?.full_name || 'Unknown',
    role: e.role?.name || null,
    max_hours_per_week: e.max_hours_per_week || 40,
  }))

  const storeHoursSummary = (storeHours || []).map(h =>
    `${DAY_NAMES[h.day_of_week]}: ${h.is_open ? `${h.open_time.slice(0, 5)}–${h.close_time.slice(0, 5)}` : 'Closed'}`
  ).join(', ')

  const memorySection = memories && memories.length > 0
    ? memories.map(m => `- ${m.content}`).join('\n')
    : '(none yet)'

  const today = new Date()
  const storeName = storeSettings?.store_name || 'the store'

  // Save the user's last message BEFORE streaming
  const last = messages[messages.length - 1]
  if (last?.role === 'user') {
    const userText = last.parts
      .filter(p => p.type === 'text')
      .map(p => ('text' in p ? p.text : ''))
      .join('')
    if (userText.trim()) {
      await supabase.from('ai_conversations').insert({
        user_id: user.id,
        role: 'user',
        content: userText,
      })
    }
  }

  const systemPrompt = `You are Boss AI, an intelligent scheduling assistant for ${storeName}. You help the manager (${profile.full_name}) by finding shift coverage, answering questions about the schedule, and making schedule changes.

Today is ${format(today, 'EEEE, MMMM d, yyyy')}.

Store hours: ${storeHoursSummary || 'not configured'}

Employees:
${employeeList.map(e => `- ${e.name}${e.role ? ` (${e.role})` : ''} — id: ${e.id}, max ${e.max_hours_per_week}h/week`).join('\n') || '(no employees)'}

Manager's saved notes/preferences:
${memorySection}

Guidelines:
- When the manager asks about coverage, call get_availability and get_time_off to determine who can actually work.
- Never suggest someone on approved time off as a replacement.
- Respect store hours — don't schedule shifts outside the store's open/close window.
- When creating or deleting shifts, always confirm the specifics (employee, date, time) before acting unless the manager has clearly authorized the change.
- If the manager says "remember X" or expresses a durable preference, call save_memory.
- Use the employee UUIDs from the list above when calling tools — do not invent IDs.
- Resolve relative dates (today/tomorrow/Monday) to concrete YYYY-MM-DD values before calling tools.

CRITICAL — never duplicate shifts:
- Before ANY mutation (create_shift, update_shift, delete_shift), you MUST first call get_shifts for the relevant date range to see what already exists.
- If the manager says "change", "revise", "update", "move", "adjust", "shift", or "reschedule": use update_shift on the existing shift_id. Do NOT call create_shift.
- If the manager says "replace the schedule" or "redo the day" or "swap everyone": use replace_day_schedule — it atomically wipes the day and rebuilds it.
- If a shift already exists for that employee on that date, treat it as an update, not a create. Use update_shift with the existing shift_id, or delete it first and then create.
- Only call create_shift when NO shift yet exists for that employee on that date.

Formatting rules:
- Be concise. Prefer 1–3 short sentences or a short bulleted list.
- DO NOT use markdown headings (no #, ##, ###).
- DO NOT use horizontal rules (no ---).
- Use **bold** sparingly for names and key times only.
- Use simple "- " bullets for lists. Don't number unless order matters.
- Never narrate what you're doing ("I'll check the schedule…", "Let me look up…"). Just give the answer.
- Never mention tools, databases, or internal steps to the manager.`

  const result = streamText({
    // Routed through the Vercel AI Gateway. GPT-4.1 gives stronger
    // multi-step tool reasoning than the prior Claude Haiku 4.5, which
    // matters for scheduling flows that chain get_shifts → update_shift.
    model: 'openai/gpt-4.1',
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      get_shifts: tool({
        description: 'Get scheduled shifts for a given date range. Returns who is working, when, and in what role.',
        inputSchema: z.object({
          start_date: z.string().describe('YYYY-MM-DD'),
          end_date: z.string().describe('YYYY-MM-DD (inclusive)'),
          employee_id: z.string().optional().describe('Optional: filter to a specific employee'),
        }),
        execute: async ({ start_date, end_date, employee_id }) => {
          let q = supabase.from('shifts')
            .select('id, employee_id, role_id, date, start_time, end_time, notes, employee:employees(profile:profiles(full_name)), role:roles(name)')
            .gte('date', start_date)
            .lte('date', end_date)
          if (employee_id) q = q.eq('employee_id', employee_id)
          const { data, error } = await q.order('date').order('start_time')
          if (error) return { error: error.message }
          return {
            shifts: (data || []).map(s => ({
              id: s.id,
              employee_id: s.employee_id,
              // @ts-expect-error — supabase typing
              employee_name: s.employee?.profile?.full_name || 'Unknown',
              date: s.date,
              start_time: s.start_time.slice(0, 5),
              end_time: s.end_time.slice(0, 5),
              // @ts-expect-error — supabase typing
              role: s.role?.name || null,
              notes: s.notes,
            })),
          }
        },
      }),

      get_availability: tool({
        description: 'Get weekly recurring availability for one or all employees. Returns when each employee is generally available.',
        inputSchema: z.object({
          employee_id: z.string().optional(),
        }),
        execute: async ({ employee_id }) => {
          let q = supabase.from('availability').select('*')
          if (employee_id) q = q.eq('employee_id', employee_id)
          const { data, error } = await q
          if (error) return { error: error.message }
          return {
            availability: (data || []).map(a => ({
              employee_id: a.employee_id,
              day: DAY_NAMES[a.day_of_week],
              day_of_week: a.day_of_week,
              is_available: a.is_available,
              start_time: a.start_time?.slice(0, 5),
              end_time: a.end_time?.slice(0, 5),
            })),
          }
        },
      }),

      get_availability_exceptions: tool({
        description: 'Get date-specific availability overrides (e.g. unavailable on 2026-04-22) for a date range.',
        inputSchema: z.object({
          start_date: z.string(),
          end_date: z.string(),
        }),
        execute: async ({ start_date, end_date }) => {
          const { data, error } = await supabase
            .from('availability_exceptions')
            .select('*')
            .gte('date', start_date)
            .lte('date', end_date)
          if (error) return { error: error.message }
          return { exceptions: data || [] }
        },
      }),

      get_time_off: tool({
        description: 'Get approved time-off requests overlapping a date range. People on approved time off CANNOT work during that period.',
        inputSchema: z.object({
          start_date: z.string(),
          end_date: z.string(),
          status: z.enum(['pending', 'approved', 'denied', 'any']).default('approved'),
        }),
        execute: async ({ start_date, end_date, status }) => {
          let q = supabase.from('time_off_requests')
            .select('*, employee:employees(profile:profiles(full_name))')
            .lte('start_date', end_date)
            .gte('end_date', start_date)
          if (status !== 'any') q = q.eq('status', status)
          const { data, error } = await q
          if (error) return { error: error.message }
          return {
            requests: (data || []).map(r => ({
              id: r.id,
              employee_id: r.employee_id,
              employee_name: (r as { employee?: { profile?: { full_name?: string } } }).employee?.profile?.full_name || 'Unknown',
              start_date: r.start_date,
              end_date: r.end_date,
              reason: r.reason,
              status: r.status,
            })),
          }
        },
      }),

      get_store_hours: tool({
        description: 'Get the store hours of operation by day of week.',
        inputSchema: z.object({}),
        execute: async () => {
          const { data, error } = await supabase.from('store_hours').select('*').order('day_of_week')
          if (error) return { error: error.message }
          return {
            hours: (data || []).map(h => ({
              day: DAY_NAMES[h.day_of_week],
              day_of_week: h.day_of_week,
              is_open: h.is_open,
              open_time: h.open_time?.slice(0, 5),
              close_time: h.close_time?.slice(0, 5),
            })),
          }
        },
      }),

      create_shift: tool({
        description: 'Create a new shift for an employee. Use ONLY after confirming the specifics with the manager or if they clearly authorized it. Times must fall within store hours.',
        inputSchema: z.object({
          employee_id: z.string().describe('The employee UUID from the employees list'),
          date: z.string().describe('YYYY-MM-DD'),
          start_time: z.string().describe('HH:MM (24h)'),
          end_time: z.string().describe('HH:MM (24h)'),
          notes: z.string().optional(),
        }),
        execute: async ({ employee_id, date, start_time, end_time, notes }) => {
          const emp = employeeList.find(e => e.id === employee_id)
          if (!emp) return { error: `No employee with id ${employee_id}` }

          const dayOfWeek = new Date(date + 'T12:00:00').getDay()

          const weekStart = formatDate(startOfWeek(new Date(date + 'T12:00:00'), { weekStartsOn: 0 }))
          const weekEnd = formatDate(addDays(startOfWeek(new Date(date + 'T12:00:00'), { weekStartsOn: 0 }), 6))

          let { data: sched } = await supabase
            .from('schedules')
            .select('*')
            .eq('week_start', weekStart)
            .maybeSingle()

          if (!sched) {
            const { data: newSched, error: schedErr } = await supabase
              .from('schedules')
              .insert({ week_start: weekStart, week_end: weekEnd, created_by: user.id })
              .select()
              .single()
            if (schedErr) return { error: schedErr.message }
            sched = newSched
          }

          // Pull role_id from employee record (can't read from employeeList since it's trimmed)
          const { data: empRow } = await supabase
            .from('employees')
            .select('role_id')
            .eq('id', employee_id)
            .single()

          const { data: shift, error } = await supabase.from('shifts').insert({
            schedule_id: sched.id,
            employee_id,
            role_id: empRow?.role_id || null,
            date,
            day_of_week: dayOfWeek,
            start_time,
            end_time,
            notes: notes || null,
          }).select().single()

          if (error) return { error: error.message }
          return {
            success: true,
            shift_id: shift.id,
            message: `Scheduled ${emp.name} on ${date} from ${start_time} to ${end_time}`,
          }
        },
      }),

      delete_shift: tool({
        description: 'Delete a shift by its ID. Use get_shifts first to find the shift_id.',
        inputSchema: z.object({
          shift_id: z.string(),
        }),
        execute: async ({ shift_id }) => {
          const { error } = await supabase.from('shifts').delete().eq('id', shift_id)
          if (error) return { error: error.message }
          return { success: true, message: 'Shift removed' }
        },
      }),

      update_shift: tool({
        description: 'Update the time or notes on an existing shift. Use get_shifts first to find the shift_id.',
        inputSchema: z.object({
          shift_id: z.string(),
          start_time: z.string().optional(),
          end_time: z.string().optional(),
          notes: z.string().optional(),
        }),
        execute: async ({ shift_id, start_time, end_time, notes }) => {
          const patch: Record<string, string> = {}
          if (start_time) patch.start_time = start_time
          if (end_time) patch.end_time = end_time
          if (notes !== undefined) patch.notes = notes
          if (Object.keys(patch).length === 0) return { error: 'No fields to update' }
          const { error } = await supabase.from('shifts').update(patch).eq('id', shift_id)
          if (error) return { error: error.message }
          return { success: true, message: 'Shift updated' }
        },
      }),

      save_memory: tool({
        description: 'Save a long-term note or preference from the manager. Use when the manager says things like "remember", "always", "going forward", or expresses a durable preference about people or scheduling.',
        inputSchema: z.object({
          content: z.string().describe('The note or preference to remember, written as a clear standalone statement'),
          kind: z.enum(['preference', 'constraint', 'note']).default('preference'),
        }),
        execute: async ({ content, kind }) => {
          const { error } = await supabase.from('ai_memories').insert({
            user_id: user.id,
            kind,
            content,
          })
          if (error) return { error: error.message }
          return { success: true, message: `Saved: "${content}"` }
        },
      }),

      delete_memory: tool({
        description: 'Delete a saved note when the manager asks to forget something.',
        inputSchema: z.object({
          memory_id: z.string(),
        }),
        execute: async ({ memory_id }) => {
          const { error } = await supabase.from('ai_memories').delete().eq('id', memory_id).eq('user_id', user.id)
          if (error) return { error: error.message }
          return { success: true }
        },
      }),
    },
    onFinish: async ({ text }) => {
      if (text.trim()) {
        await supabase.from('ai_conversations').insert({
          user_id: user.id,
          role: 'assistant',
          content: text,
        })
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
