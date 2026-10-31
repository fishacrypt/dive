/**
 * Seed catalog: equipment, challenge templates and achievements.
 * The database is the runtime source of truth; this file feeds the seed script.
 */
import { ENERGY_PAR_WATTS_PER_COMPUTE } from './config'
import type { ChallengeType, EquipmentKind } from './types'

export interface EquipmentSeed {
  slug: string
  name: string
  kind: EquipmentKind
  tier: number
  description: string
  price: number
  requiredLevel: number
  compute?: number
  memory?: number
  powerDraw?: number
  powerCapacity?: number
  heat?: number
  coolingCapacity?: number
  accelSlots?: number
  memSlots?: number
}

export const EQUIPMENT_SEEDS: EquipmentSeed[] = [
  // Chassis: define how many accelerator / memory slots a rig has.
  { slug: 'chassis-starter', name: 'Starter Frame', kind: 'CHASSIS', tier: 1, description: '1 accelerator slot, 2 memory slots.', price: 150, requiredLevel: 1, accelSlots: 1, memSlots: 2 },
  { slug: 'chassis-rack', name: 'Rackmount 4U', kind: 'CHASSIS', tier: 2, description: '2 accelerator slots, 4 memory slots.', price: 600, requiredLevel: 3, accelSlots: 2, memSlots: 4 },
  { slug: 'chassis-tower', name: 'Quantum Tower', kind: 'CHASSIS', tier: 3, description: '4 accelerator slots, 4 memory slots.', price: 1800, requiredLevel: 6, accelSlots: 4, memSlots: 4 },
  // Processors
  { slug: 'cpu-pulse', name: 'Pulse CPU-1', kind: 'PROCESSOR', tier: 1, description: 'Entry processor. Cheap and cool.', price: 120, requiredLevel: 1, compute: 10, powerDraw: 45, heat: 30 },
  { slug: 'cpu-vector', name: 'Vector CPU-2', kind: 'PROCESSOR', tier: 2, description: 'Balanced mid-range processor.', price: 450, requiredLevel: 3, compute: 24, powerDraw: 80, heat: 55 },
  { slug: 'cpu-helix', name: 'Helix CPU-3', kind: 'PROCESSOR', tier: 3, description: 'High-throughput processor.', price: 1400, requiredLevel: 6, compute: 50, powerDraw: 120, heat: 80 },
  // Accelerators
  { slug: 'gpu-spark', name: 'Spark GPU', kind: 'ACCELERATOR', tier: 1, description: 'First parallel accelerator.', price: 350, requiredLevel: 2, compute: 30, powerDraw: 120, heat: 90 },
  { slug: 'gpu-torque', name: 'Torque GPU', kind: 'ACCELERATOR', tier: 2, description: 'Serious parallel compute.', price: 1100, requiredLevel: 4, compute: 70, powerDraw: 190, heat: 140 },
  { slug: 'gpu-nova', name: 'Nova GPU', kind: 'ACCELERATOR', tier: 3, description: 'Flagship accelerator. Runs hot.', price: 3200, requiredLevel: 7, compute: 150, powerDraw: 280, heat: 200 },
  // Memory
  { slug: 'ram-8', name: '8 GB Memory', kind: 'MEMORY', tier: 1, description: 'Basic working memory.', price: 40, requiredLevel: 1, memory: 8, powerDraw: 5, heat: 3 },
  { slug: 'ram-16', name: '16 GB Memory', kind: 'MEMORY', tier: 2, description: 'Roomy working memory.', price: 90, requiredLevel: 2, memory: 16, powerDraw: 8, heat: 5 },
  { slug: 'ram-32', name: '32 GB Memory', kind: 'MEMORY', tier: 3, description: 'Large working memory.', price: 200, requiredLevel: 4, memory: 32, powerDraw: 12, heat: 8 },
  // Cooling
  { slug: 'cool-fan', name: 'Fan Kit', kind: 'COOLING', tier: 1, description: 'Air cooling.', price: 60, requiredLevel: 1, coolingCapacity: 120, powerDraw: 10 },
  { slug: 'cool-liquid', name: 'Liquid Loop', kind: 'COOLING', tier: 2, description: 'Liquid cooling.', price: 280, requiredLevel: 3, coolingCapacity: 260, powerDraw: 25 },
  { slug: 'cool-cryo', name: 'Cryo Block', kind: 'COOLING', tier: 3, description: 'Extreme cooling.', price: 900, requiredLevel: 6, coolingCapacity: 520, powerDraw: 40 },
  // Power supplies
  { slug: 'psu-300', name: '300 W Bronze PSU', kind: 'PSU', tier: 1, description: 'Starter power supply.', price: 80, requiredLevel: 1, powerCapacity: 300 },
  { slug: 'psu-600', name: '600 W Silver PSU', kind: 'PSU', tier: 2, description: 'Mid-range power supply.', price: 260, requiredLevel: 2, powerCapacity: 600 },
  { slug: 'psu-1000', name: '1000 W Gold PSU', kind: 'PSU', tier: 3, description: 'Heavy-duty power supply.', price: 800, requiredLevel: 5, powerCapacity: 1000 },
]

/** Equipment the demo player starts with, already assembled into "Starter Rig". */
export const STARTER_LOADOUT = ['chassis-starter', 'cpu-pulse', 'ram-8', 'cool-fan', 'psu-300'] as const

export interface ChallengeSeed {
  slug: string
  type: ChallengeType
  name: string
  description: string
  difficulty: number
  requiredLevel: number
  size: number
  baseRewardMq: number
  workUnits: number
  minCompute: number
  minMemory: number
  feeCredits: number
  xpReward: number
}

export const CHALLENGE_SEEDS: ChallengeSeed[] = [
  { slug: 'route-basic', type: 'PATH', name: 'Packet Routing', description: 'Route a data packet across the network within the latency budget. The cheapest route earns a bonus.', difficulty: 1, requiredLevel: 1, size: 7, baseRewardMq: 800, workUnits: 200, minCompute: 0, minMemory: 8, feeCredits: 10, xpReward: 60 },
  { slug: 'color-basic', type: 'COLORING', name: 'Channel Assignment', description: 'Assign frequency channels so no two neighbouring relays interfere. Using the fewest channels earns a bonus.', difficulty: 1, requiredLevel: 1, size: 8, baseRewardMq: 900, workUnits: 220, minCompute: 0, minMemory: 8, feeCredits: 12, xpReward: 65 },
  { slug: 'pack-basic', type: 'KNAPSACK', name: 'Batch Scheduling', description: 'Choose work batches that fit the rig capacity and reach the value target. The best mix earns a bonus.', difficulty: 1, requiredLevel: 1, size: 8, baseRewardMq: 850, workUnits: 210, minCompute: 0, minMemory: 8, feeCredits: 10, xpReward: 60 },
  { slug: 'span-basic', type: 'SPANNING_TREE', name: 'Grid Cabling', description: 'Connect every node with cable under budget. The cheapest tree earns a bonus.', difficulty: 2, requiredLevel: 2, size: 8, baseRewardMq: 2400, workUnits: 600, minCompute: 30, minMemory: 8, feeCredits: 30, xpReward: 120 },
  { slug: 'route-hard', type: 'PATH', name: 'Backbone Routing', description: 'A larger network with tighter latency budgets.', difficulty: 2, requiredLevel: 3, size: 12, baseRewardMq: 2700, workUnits: 650, minCompute: 30, minMemory: 8, feeCredits: 35, xpReward: 130 },
  { slug: 'color-hard', type: 'COLORING', name: 'Dense Channel Plan', description: 'A dense relay mesh that needs careful channel planning.', difficulty: 3, requiredLevel: 4, size: 12, baseRewardMq: 7000, workUnits: 1800, minCompute: 60, minMemory: 16, feeCredits: 80, xpReward: 260 },
  { slug: 'pack-hard', type: 'KNAPSACK', name: 'Cluster Scheduling', description: 'Many batches, one tight capacity. Dynamic programming territory.', difficulty: 3, requiredLevel: 5, size: 14, baseRewardMq: 7400, workUnits: 1900, minCompute: 60, minMemory: 16, feeCredits: 85, xpReward: 280 },
  { slug: 'span-hard', type: 'SPANNING_TREE', name: 'Metro Fibre Plan', description: 'A large fibre network where every kilometre counts.', difficulty: 4, requiredLevel: 7, size: 14, baseRewardMq: 18000, workUnits: 4500, minCompute: 120, minMemory: 32, feeCredits: 200, xpReward: 520 },
]

/** Energy par for a challenge: the energy a "reasonably efficient" rig would spend. */
export function energyParFor(workUnits: number, divisor: number): number {
  return Math.ceil((workUnits * ENERGY_PAR_WATTS_PER_COMPUTE) / divisor)
}

export interface AchievementSeed {
  slug: AchievementSlug
  name: string
  description: string
  rewardCredits: number
  sortOrder: number
}

export type AchievementSlug =
  | 'first-purchase'
  | 'first-rig'
  | 'first-job'
  | 'first-claim'
  | 'perfect-solve'
  | 'efficient-miner'
  | 'upgrader'
  | 'level-3'
  | 'level-5'
  | 'quanta-5'
  | 'veteran'

export const ACHIEVEMENT_SEEDS: AchievementSeed[] = [
  { slug: 'first-purchase', name: 'Window Shopper', description: 'Buy your first piece of equipment.', rewardCredits: 25, sortOrder: 1 },
  { slug: 'first-rig', name: 'Rig Builder', description: 'Assemble and name a new rig.', rewardCredits: 25, sortOrder: 2 },
  { slug: 'first-job', name: 'Boot Sequence', description: 'Start your first mining job.', rewardCredits: 25, sortOrder: 3 },
  { slug: 'first-claim', name: 'First Quanta', description: 'Claim your first simulated reward.', rewardCredits: 50, sortOrder: 4 },
  { slug: 'perfect-solve', name: 'Optimal Mind', description: 'Submit a provably optimal solution.', rewardCredits: 75, sortOrder: 5 },
  { slug: 'efficient-miner', name: 'Efficient Miner', description: 'Finish a job at or below the energy par.', rewardCredits: 75, sortOrder: 6 },
  { slug: 'upgrader', name: 'Overclocker', description: 'Upgrade a piece of equipment.', rewardCredits: 40, sortOrder: 7 },
  { slug: 'level-3', name: 'Apprentice', description: 'Reach level 3.', rewardCredits: 100, sortOrder: 8 },
  { slug: 'level-5', name: 'Operator', description: 'Reach level 5.', rewardCredits: 200, sortOrder: 9 },
  { slug: 'quanta-5', name: 'Five Quanta', description: 'Claim 5 Q in total.', rewardCredits: 100, sortOrder: 10 },
  { slug: 'veteran', name: 'Veteran Miner', description: 'Claim 10 completed jobs.', rewardCredits: 250, sortOrder: 11 },
]
