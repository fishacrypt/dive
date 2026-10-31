import { Cpu, Fan, HardDrive, MemoryStick, Plug, Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { levelMultiplier } from '@/lib/game/rig'
import type { EquipmentKind } from '@/lib/game/types'

export const KIND_LABEL: Record<EquipmentKind, string> = {
  CHASSIS: 'Chassis',
  PROCESSOR: 'Processor',
  ACCELERATOR: 'Accelerator',
  MEMORY: 'Memory',
  COOLING: 'Cooling',
  PSU: 'Power supply',
}

export const KIND_ICON: Record<EquipmentKind, typeof Cpu> = {
  CHASSIS: Server,
  PROCESSOR: Cpu,
  ACCELERATOR: HardDrive,
  MEMORY: MemoryStick,
  COOLING: Fan,
  PSU: Plug,
}

export interface EquipmentLike {
  kind: EquipmentKind
  tier: number
  compute: number
  memory: number
  powerDraw: number
  powerCapacity: number
  heat: number
  coolingCapacity: number
  accelSlots: number
  memSlots: number
}

/** Compact stat chips for a piece of equipment, scaled by its upgrade level. */
export function EquipmentStats({ equipment, level = 1 }: { equipment: EquipmentLike; level?: number }) {
  const m = levelMultiplier(level)
  const stat = (label: string, value: number, scaled: boolean) => (value > 0 ? { label, value: scaled ? Math.floor(value * m) : value } : null)
  const rows = [
    stat('Compute', equipment.compute, true),
    stat('Memory GB', equipment.memory, true),
    stat('Supply W', equipment.powerCapacity, true),
    stat('Cooling', equipment.coolingCapacity, true),
    stat('Draw W', equipment.powerDraw, false),
    stat('Heat', equipment.heat, false),
    stat('Accel slots', equipment.accelSlots, false),
    stat('Memory slots', equipment.memSlots, false),
  ].filter((r): r is { label: string; value: number } => r !== null)
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline gap-1">
          <dt className="text-xs text-fog-500">{r.label}</dt>
          <dd className="font-mono text-xs tabular-nums text-fog-100">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function TierBadge({ tier }: { tier: number }) {
  return <Badge tone={tier >= 3 ? 'violet' : tier === 2 ? 'cyan' : 'neutral'}>Tier {tier}</Badge>
}
