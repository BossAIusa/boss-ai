'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastKind = 'success' | 'warning' | 'error'

export interface ToastState {
  kind: ToastKind
  message: string
}

export function Toast({ toast }: { toast: ToastState | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    const enter = requestAnimationFrame(() => setVisible(true))
    const hide = setTimeout(() => setVisible(false), 3600)
    return () => {
      cancelAnimationFrame(enter)
      clearTimeout(hide)
    }
  }, [toast])

  const current = toast

  if (!current) return null

  const colorClass =
    current.kind === 'success'
      ? 'border-green-500/40 text-green-300'
      : current.kind === 'error'
        ? 'border-red-500/40 text-red-300'
        : 'border-amber-500/40 text-amber-300'

  const Icon =
    current.kind === 'success' ? CheckCircle : current.kind === 'error' ? XCircle : AlertCircle

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl border bg-[#111118] shadow-xl transition-all duration-300',
        colorClass
      )}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
      }}
    >
      <Icon size={16} />
      <span className="text-sm">{current.message}</span>
    </div>
  )
}
