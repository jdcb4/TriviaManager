import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
}

interface MultiSelectProps {
  options: Option[]
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'All',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }

  const displayLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? (options.find(o => o.value === value[0])?.label ?? value[0])
      : `${value.length} selected`

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <span className={value.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
          {displayLabel}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value.length > 0 && (
            <span
              role="button"
              aria-label="Clear"
              onClick={e => { e.stopPropagation(); onChange([]) }}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={cn('text-gray-400 transition-transform duration-150', open && 'rotate-180')}
          />
        </div>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm select-none"
            >
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
