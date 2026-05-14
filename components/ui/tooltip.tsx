'use client'
import { ReactNode, useState } from 'react'

interface TooltipProps {
  label: string
  children: ReactNode
}

export function Tooltip({ label, children }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={e => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={e => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <span
          role="tooltip"
          className="pointer-events-none fixed bg-[#1a1a24] text-[#e8e8f0] text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[#2a2a3a] whitespace-nowrap z-[9999]"
          style={{
            left: pos.x + 12,
            top: pos.y + 16,
            animation: 'tooltip-fade 120ms ease-out',
          }}
        >
          {label}
        </span>
      )}
    </span>
  )
}
