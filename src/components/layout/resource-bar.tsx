'use client'
import { Coins, Gem, Zap } from 'lucide-react'
import { useDashboard } from '@/hooks/use-game'
import { formatInt, formatQuanta } from '@/lib/game/config'
import { Skeleton } from '@/components/ui/misc'

function Chip({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5" title={`${label} (simulated)`}>
      <span className={tone}>{icon}</span>
      <div className="leading-tight">
        <p className="label-caps !text-[0.6rem]">{label}</p>
        <p className="font-display text-sm font-semibold tabular-nums text-fog-100" data-testid={`balance-${label.toLowerCase()}`}>
          {value}
        </p>
      </div>
    </div>
  )
}

export function ResourceBar() {
  const { data } = useDashboard()
  if (!data) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-28" />
      </div>
    )
  }
  const b = data.balances
  return (
    <div className="flex flex-wrap gap-2">
      <Chip icon={<Coins className="h-4 w-4" />} label="Credits" value={formatInt(b.credits)} tone="text-cyan-dive" />
      <Chip icon={<Gem className="h-4 w-4" />} label="Quanta" value={`${formatQuanta(b.quantaMilli)} Q`} tone="text-violet-dive" />
      <Chip icon={<Zap className="h-4 w-4" />} label="Energy" value={`${formatInt(b.energy)} / ${formatInt(b.energyCap)}`} tone="text-mint-dive" />
    </div>
  )
}
