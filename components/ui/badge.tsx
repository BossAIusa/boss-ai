import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  color?: string
  className?: string
  variant?: 'solid' | 'soft'
}

export function Badge({ children, color, className, variant = 'soft' }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', className)}
      style={color ? {
        backgroundColor: variant === 'soft' ? `${color}22` : color,
        color: variant === 'soft' ? color : '#fff',
        border: `1px solid ${color}33`,
      } : {}}
    >
      {children}
    </span>
  )
}
