'use client'
import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-sm font-medium text-[#e8e8f0]">{label}</label>}
        <input
          ref={ref}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all',
            'bg-[#1a1a24] border-[#2a2a3a] text-[#e8e8f0] placeholder-[#888899]',
            'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30',
            error && 'border-red-500/50',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    )
  }
)
Input.displayName = 'Input'
export { Input }
