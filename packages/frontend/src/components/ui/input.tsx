import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
)
Select.displayName = 'Select'

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
        'disabled:opacity-50 disabled:cursor-not-allowed resize-none',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
