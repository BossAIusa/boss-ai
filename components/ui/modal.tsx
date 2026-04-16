'use client'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { ReactNode, useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, className, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative z-10 rounded-xl border border-[#2a2a3a] bg-[#111118] shadow-2xl',
        {
          'w-full max-w-sm': size === 'sm',
          'w-full max-w-md': size === 'md',
          'w-full max-w-lg': size === 'lg',
          'w-full max-w-2xl': size === 'xl',
        },
        className
      )}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a]">
            <h2 className="text-base font-semibold text-[#e8e8f0]">{title}</h2>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-[#1a1a24] text-[#888899] hover:text-[#e8e8f0] transition-colors">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
