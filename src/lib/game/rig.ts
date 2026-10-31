import { ENERGY, JOBS, RIG_RULES, UPGRADES } from './config'
import type { EquipmentKind, RigPart } from './types'

export interface RigStats {
  chassisCount: number
  compute: number
  /** Compute after thermal throttling. */
  effectiveCompute: number
  memory: number
  powerDraw: number
  powerCapacity: number
  heat: number
  coolingCapacity: number
  /** 1 = no throttling. */
  throttle: number
  /** Effective compute per watt. */
  efficiency: number
  accelSlots: number
  memSlots: number
  accelUsed: number
  memUsed: number
  /** Reasons the rig cannot run jobs. Empty when ready. */
  errors: string[]
  ready: boolean
}

/** Capacity multiplier for an upgrade level (level 1 = x1.0). */
export function levelMultiplier(level: number): number {
  return 1 + UPGRADES.bonusPerLevel * (Math.max(1, level) - 1)
}

/** Cost to upgrade an item from `level` to `level + 1`; null when maxed. */
export function upgradeCost(price: number, level: number): number | null {
  if (level >= UPGRADES.maxLevel) return null
  return Math.ceil(price * UPGRADES.costFactor * level)
}

const SLOT_LIMITS: Partial<Record<EquipmentKind, number>> = {
  CHASSIS: 1,
  PROCESSOR: 1,
  PSU: 1,
  COOLING: RIG_RULES.maxCooling,
}

function count(parts: RigPart[], kind: EquipmentKind): number {
  return parts.filter((p) => p.kind === kind).length
}

/**
 * Can `candidate` join a rig that already holds `existing`?
 * Returns an error message, or null when the assignment is allowed.
 */
export function checkAssignment(existing: RigPart[], candidate: RigPart): string | null {
  const limit = SLOT_LIMITS[candidate.kind]
  if (limit !== undefined && count(existing, candidate.kind) >= limit) {
    return `This rig already has the maximum number of ${candidate.kind.toLowerCase()} parts (${limit}).`
  }
  if (candidate.kind === 'ACCELERATOR' || candidate.kind === 'MEMORY') {
    const chassis = existing.find((p) => p.kind === 'CHASSIS')
    if (!chassis) return 'Install a chassis before adding accelerators or memory.'
    if (candidate.kind === 'ACCELERATOR' && count(existing, 'ACCELERATOR') >= chassis.accelSlots) {
      return `The chassis only has ${chassis.accelSlots} accelerator slot(s).`
    }
    if (candidate.kind === 'MEMORY' && count(existing, 'MEMORY') >= chassis.memSlots) {
      return `The chassis only has ${chassis.memSlots} memory slot(s).`
    }
  }
  return null
}

/** Can `removing` leave the rig without breaking slot dependencies? */
export function checkRemoval(existing: RigPart[], removing: RigPart): string | null {
  if (removing.kind === 'CHASSIS' && existing.some((p) => p.kind === 'ACCELERATOR' || p.kind === 'MEMORY')) {
    return 'Remove accelerators and memory before removing the chassis.'
  }
  return null
}

/** Compute every derived statistic for a rig. Pure and deterministic. */
export function computeRigStats(parts: RigPart[]): RigStats {
  const sum = (pick: (p: RigPart) => number, positive: boolean): number =>
    parts.reduce((total, p) => total + Math.floor(pick(p) * (positive ? levelMultiplier(p.level) : 1)), 0)

  const compute = sum((p) => p.compute, true)
  const memory = sum((p) => p.memory, true)
  const powerCapacity = sum((p) => p.powerCapacity, true)
  const coolingCapacity = sum((p) => p.coolingCapacity, true)
  const powerDraw = sum((p) => p.powerDraw, false)
  const heat = sum((p) => p.heat, false)
  const chassis = parts.find((p) => p.kind === 'CHASSIS')
  const accelSlots = chassis?.accelSlots ?? 0
  const memSlots = chassis?.memSlots ?? 0
  const accelUsed = count(parts, 'ACCELERATOR')
  const memUsed = count(parts, 'MEMORY')

  const throttle = heat > coolingCapacity && heat > 0 ? Math.max(RIG_RULES.minThrottle, coolingCapacity / heat) : 1
  const effectiveCompute = Math.floor(compute * throttle)

  const errors: string[] = []
  if (!chassis) errors.push('Needs a chassis.')
  if (count(parts, 'PROCESSOR') === 0) errors.push('Needs a processor.')
  if (memUsed === 0) errors.push('Needs at least one memory module.')
  if (count(parts, 'PSU') === 0) errors.push('Needs a power supply.')
  if (accelUsed > accelSlots) errors.push('More accelerators than chassis slots.')
  if (memUsed > memSlots) errors.push('More memory modules than chassis slots.')
  if (powerDraw > powerCapacity) errors.push(`Power draw ${powerDraw} W exceeds supply ${powerCapacity} W.`)

  return {
    chassisCount: count(parts, 'CHASSIS'),
    compute,
    effectiveCompute,
    memory,
    powerDraw,
    powerCapacity,
    heat,
    coolingCapacity,
    throttle,
    efficiency: powerDraw > 0 ? effectiveCompute / powerDraw : 0,
    accelSlots,
    memSlots,
    accelUsed,
    memUsed,
    errors,
    ready: errors.length === 0,
  }
}

export interface JobPlan {
  durationSec: number
  energyCost: number
}

/** Duration and energy for running `workUnits` of work on a rig. */
export function planJob(stats: Pick<RigStats, 'effectiveCompute' | 'powerDraw'>, workUnits: number): JobPlan {
  const compute = Math.max(1, stats.effectiveCompute)
  const raw = Math.ceil(workUnits / compute)
  const durationSec = Math.min(JOBS.maxDurationSec, Math.max(JOBS.minDurationSec, raw))
  const energyCost = Math.ceil((stats.powerDraw * durationSec) / ENERGY.divisor)
  return { durationSec, energyCost }
}

/** Why a rig cannot take a challenge, or null when it can. */
export function checkRigMeetsChallenge(
  stats: Pick<RigStats, 'ready' | 'errors' | 'effectiveCompute' | 'memory'>,
  challenge: { minCompute: number; minMemory: number },
): string | null {
  if (!stats.ready) return `Rig is not ready: ${stats.errors.join(' ')}`
  if (stats.effectiveCompute < challenge.minCompute) {
    return `Needs ${challenge.minCompute} compute (this rig delivers ${stats.effectiveCompute}).`
  }
  if (stats.memory < challenge.minMemory) return `Needs ${challenge.minMemory} GB memory (this rig has ${stats.memory}).`
  return null
}
