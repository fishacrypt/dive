import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-ink-700', className)} aria-hidden />
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink-500 px-4 py-10 text-center">
      {icon ? <div className="text-fog-500">{icon}</div> : null}
      <p className="font-display text-base font-medium text-fog-100">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-fog-500">{hint}</p> : null}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-rose-dive/30 bg-rose-dive/5 px-4 py-8 text-center">
      <AlertTriangle className="h-6 w-6 text-rose-dive" aria-hidden />
      <p className="text-sm text-fog-100">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className={cn('font-display text-lg font-semibold tabular-nums text-fog-100', tone)}>{value}</p>
      {hint ? <p className="text-xs text-fog-500">{hint}</p> : null}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-fog-100 sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-fog-300">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  )
}
