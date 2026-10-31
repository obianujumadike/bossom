'use client'

import { useRef, useState, useEffect, useId } from 'react'
import { FaChevronDown, FaCheck } from 'react-icons/fa'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function Select({ options, value, onChange, placeholder, disabled, className, id }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const uid = useId()
  const buttonId = id ?? uid

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`
          w-full flex items-center justify-between gap-2
          px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl
          text-sm text-left transition-all duration-200 outline-none
          focus:ring-2 focus:ring-bossom-500 focus:border-transparent focus:bg-white
          ${disabled ? 'opacity-70 cursor-not-allowed' : 'hover:border-bossom-400 cursor-pointer'}
          ${open ? 'ring-2 ring-bossom-500 border-transparent bg-white' : ''}
        `}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : (placeholder ?? 'Select...')}
        </span>
        <FaChevronDown
          className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-60 overflow-auto"
        >
          {options.map(option => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => { onChange(option.value); setOpen(false) }}
              className={`
                flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition-colors
                ${option.value === value
                  ? 'bg-bossom-50 text-bossom-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'}
              `}
            >
              {option.label}
              {option.value === value && <FaCheck className="w-3 h-3 text-bossom-500 flex-shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
