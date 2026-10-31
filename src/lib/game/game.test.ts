import { describe, expect, it } from 'vitest'
import { ENERGY, JOBS, REWARDS, UPGRADES } from './config'
import { computeReward, levelFromXp, levelProgress, xpForLevel } from './progression'
import { checkAssignment, checkRemoval, checkRigMeetsChallenge, computeRigStats, levelMultiplier, planJob, upgradeCost } from './rig'
import type { RigPart } from './types'

const part = (kind: RigPart['kind'], extra: Partial<RigPart> = {}): RigPart => ({
  kind,
  level: 1,
  compute: 0,
  memory: 0,
  powerDraw: 0,
  powerCapacity: 0,
  heat: 0,
  coolingCapacity: 0,
  accelSlots: 0,
  memSlots: 0,
  ...extra,
})

const chassis = part('CHASSIS', { accelSlots: 1, memSlots: 2 })
const cpu = part('PROCESSOR', { compute: 10, powerDraw: 45, heat: 30 })
const ram = part('MEMORY', { memory: 8, powerDraw: 5, heat: 3 })
const fan = part('COOLING', { coolingCapacity: 120, powerDraw: 10 })
const psu = part('PSU', { powerCapacity: 300 })
const gpu = part('ACCELERATOR', { compute: 30, powerDraw: 120, heat: 90 })
const starter = [chassis, cpu, ram, fan, psu]

describe('rig calculations', () => {
  it('computes the starter rig stats', () => {
    const s = computeRigStats(starter)
    expect(s).toMatchObject({ compute: 10, effectiveCompute: 10, memory: 8, powerDraw: 60, powerCapacity: 300, heat: 33, coolingCapacity: 120, throttle: 1, ready: true })
    expect(s.efficiency).toBeCloseTo(10 / 60)
  })

  it('reports every missing essential part', () => {
    const s = computeRigStats([])
    expect(s.ready).toBe(false)
    expect(s.errors).toEqual(expect.arrayContaining(['Needs a chassis.', 'Needs a processor.', 'Needs a power supply.']))
  })

  it('rejects a rig whose power draw exceeds its supply', () => {
    const weak = computeRigStats([chassis, cpu, gpu, ram, fan, part('PSU', { powerCapacity: 150 })])
    expect(weak.ready).toBe(false)
    expect(weak.errors.join(' ')).toMatch(/Power draw 180 W exceeds supply 150 W/)
  })

  it('throttles compute when heat exceeds cooling, never below the floor', () => {
    const hot = computeRigStats([chassis, cpu, gpu, ram, fan, psu])
    expect(hot.heat).toBe(123)
    expect(hot.throttle).toBeCloseTo(120 / 123)
    expect(hot.effectiveCompute).toBe(Math.floor(40 * (120 / 123)))
    const furnace = computeRigStats([chassis, cpu, part('ACCELERATOR', { compute: 100, heat: 5000 }), ram, fan, psu])
    expect(furnace.throttle).toBe(0.4)
  })

  it('upgrade levels scale capacity but not draw or heat', () => {
    expect(levelMultiplier(1)).toBe(1)
    expect(levelMultiplier(3)).toBeCloseTo(1 + 2 * UPGRADES.bonusPerLevel)
    const s = computeRigStats([chassis, { ...cpu, level: 3 }, ram, fan, psu])
    expect(s.compute).toBe(Math.floor(10 * levelMultiplier(3)))
    expect(s.powerDraw).toBe(60)
  })

  it('upgrade costs rise per level and stop at the cap', () => {
    expect(upgradeCost(100, 1)).toBe(40)
    expect(upgradeCost(100, 2)).toBe(80)
    expect(upgradeCost(100, UPGRADES.maxLevel)).toBeNull()
  })
})

describe('component compatibility', () => {
  it('limits chassis, processor and PSU to one each, cooling to two', () => {
    expect(checkAssignment(starter, chassis)).toMatch(/maximum/)
    expect(checkAssignment(starter, cpu)).toMatch(/maximum/)
    expect(checkAssignment(starter, psu)).toMatch(/maximum/)
    expect(checkAssignment(starter, fan)).toBeNull()
    expect(checkAssignment([...starter, fan], fan)).toMatch(/maximum/)
  })

  it('needs a chassis with free slots for accelerators and memory', () => {
    expect(checkAssignment([cpu], gpu)).toMatch(/chassis/)
    expect(checkAssignment(starter, gpu)).toBeNull()
    expect(checkAssignment([...starter, gpu], gpu)).toMatch(/accelerator slot/)
    expect(checkAssignment([...starter, ram], ram)).toMatch(/memory slot/)
  })

  it('blocks removing a chassis that still hosts parts', () => {
    expect(checkRemoval(starter, chassis)).toMatch(/Remove accelerators and memory/)
    expect(checkRemoval([chassis, cpu], chassis)).toBeNull()
  })
})

describe('job planning', () => {
  it('derives duration and energy from compute and power draw', () => {
    const plan = planJob({ effectiveCompute: 10, powerDraw: 60 }, 200)
    expect(plan.durationSec).toBe(20)
    expect(plan.energyCost).toBe(Math.ceil((60 * 20) / ENERGY.divisor))
  })

  it('clamps duration to the configured bounds', () => {
    expect(planJob({ effectiveCompute: 10_000, powerDraw: 100 }, 200).durationSec).toBe(JOBS.minDurationSec)
    expect(planJob({ effectiveCompute: 1, powerDraw: 100 }, 1_000_000).durationSec).toBe(JOBS.maxDurationSec)
  })

  it('checks challenge requirements', () => {
    const stats = computeRigStats(starter)
    expect(checkRigMeetsChallenge(stats, { minCompute: 0, minMemory: 8 })).toBeNull()
    expect(checkRigMeetsChallenge(stats, { minCompute: 30, minMemory: 8 })).toMatch(/compute/)
    expect(checkRigMeetsChallenge(stats, { minCompute: 0, minMemory: 16 })).toMatch(/memory/)
    expect(checkRigMeetsChallenge(computeRigStats([]), { minCompute: 0, minMemory: 0 })).toMatch(/not ready/)
  })
})

describe('rewards and progression are deterministic', () => {
  const base = { baseRewardMq: 1000, xpReward: 100 }
  it('applies optimal and efficiency bonuses in basis points', () => {
    expect(computeReward({ ...base, optimal: false, efficient: false })).toMatchObject({ rewardMq: 1000, xp: 100 })
    expect(computeReward({ ...base, optimal: true, efficient: false }).rewardMq).toBe(1000 + (1000 * REWARDS.optimalBonusBp) / 10000)
    expect(computeReward({ ...base, optimal: true, efficient: true }).bonusBp).toBe(REWARDS.optimalBonusBp + REWARDS.efficiencyBonusBp)
  })

  it('is a pure function of its inputs', () => {
    const input = { ...base, optimal: true, efficient: true }
    expect(computeReward(input)).toEqual(computeReward({ ...input }))
  })

  it('maps xp to levels and back', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(99)).toBe(1)
    expect(levelFromXp(100)).toBe(2)
    expect(levelFromXp(xpForLevel(5))).toBe(5)
    expect(levelFromXp(1e9)).toBe(20)
    expect(levelProgress(150).fraction).toBeCloseTo(0.1667, 3)
  })
})
