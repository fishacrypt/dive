'use client'
import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
}

/** Labelled input with inline validation message, and a show/hide toggle for passwords. */
export function Field({ label, name, value, onChange, error, hint, type = 'text', className, ...rest }: FieldProps) {
  const [shown, setShown] = React.useState(false)
  const id = React.useId()
  const isPassword = type === 'password'
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-fog-100">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={isPassword && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full rounded-lg border bg-ink-900 px-3 text-sm text-fog-100 placeholder:text-fog-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-dive/70',
            error ? 'border-rose-dive/70' : 'border-ink-500',
            isPassword && 'pr-11',
            className,
          )}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-fog-500 hover:text-fog-100"
          >
            {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-rose-dive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-fog-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function FormMessage({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        tone === 'error' ? 'border-rose-dive/40 bg-rose-dive/10 text-rose-dive' : 'border-mint-dive/40 bg-mint-dive/10 text-mint-dive',
      )}
    >
      {children}
    </p>
  )
}
