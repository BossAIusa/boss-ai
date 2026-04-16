'use client'
import { cn } from '@/lib/utils'
import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-sm font-medium text-[#e8e8f0]">{label}</label>}
        <select
          ref={ref}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all cursor-pointer',
            'bg-[#1a1a24] border-[#2a2a3a] text-[#e8e8f0]',
            'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30',
            error && 'border-red-500/50',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    )
  }
)
Select.displayName = 'Select'
export { Select }
