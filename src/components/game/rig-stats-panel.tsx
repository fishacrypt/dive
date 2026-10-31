import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import type { RigStats } from '@/lib/game/rig'

function Gauge({ label, value, max, unit, tone }: { label: string; value: number; max: number; unit: string; tone: 'cyan' | 'amber' | 'red' | 'green' }) {
  const over = max > 0 && value > max
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-fog-300">{label}</span>
        <span className={over ? 'tabular-nums text-rose-dive' : 'tabular-nums text-fog-100'}>
          {value} / {max} {unit}
        </span>
      </div>
      <Progress value={max > 0 ? Math.min(1, value / max) : value > 0 ? 1 : 0} tone={over ? 'red' : tone} label={label} />
    </div>
  )
}

export function RigStatsPanel({ stats }: { stats: RigStats }) {
  return (
    <div className="space-y-3" data-testid="rig-stats">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="label-caps">Compute</p>
          <p className="font-display text-xl font-semibold tabular-nums text-cyan-dive" data-testid="stat-compute">
            {stats.effectiveCompute}
          </p>
          {stats.throttle < 1 ? <p className="text-[0.65rem] text-amber-dive">throttled from {stats.compute}</p> : null}
        </div>
        <div>
          <p className="label-caps">Memory</p>
          <p className="font-display text-xl font-semibold tabular-nums text-fog-100">{stats.memory} GB</p>
        </div>
        <div>
          <p className="label-caps">Efficiency</p>
          <p className="font-display text-xl font-semibold tabular-nums text-mint-dive">{stats.efficiency.toFixed(2)}</p>
          <p className="text-[0.65rem] text-fog-500">compute / watt</p>
        </div>
      </div>
      <Gauge label="Power draw" value={stats.powerDraw} max={stats.powerCapacity} unit="W" tone="cyan" />
      <Gauge label="Heat" value={stats.heat} max={stats.coolingCapacity} unit="TU" tone="green" />
      <p className="text-xs text-fog-500">
        Slots: {stats.accelUsed}/{stats.accelSlots} accelerators, {stats.memUsed}/{stats.memSlots} memory
      </p>
      {stats.ready ? (
        <p className="flex items-center gap-1.5 text-xs text-mint-dive">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Ready to mine
        </p>
      ) : (
        <ul className="space-y-1" role="list">
          {stats.errors.map((e) => (
            <li key={e} className="flex items-start gap-1.5 text-xs text-amber-dive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
