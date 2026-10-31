/**
 * Central game configuration. Every price rule, energy cost, reward formula,
 * difficulty setting and progression threshold lives here (or in catalog.ts)
 * so balancing the game never means hunting through the code base.
 *
 * ALL RESOURCES ARE SIMULATED. Quanta (Q) is not withdrawable and is not a
 * real QMS reward.
 */

export const SIMULATION_NOTICE =
  'Simulated resources. Quanta (Q) has no real-world value, cannot be withdrawn, and is not a real QMS reward.'

/** 1 Quanta = 1000 milli-Quanta. Quanta is stored as integer milli-Quanta. */
export const MQ_PER_Q = 1000

/** Starting balances for a new demo player. */
export const STARTING_RESOURCES = {
  credits: 1500,
  quantaMilli: 0,
  energy: 400,
} as const

export const ENERGY = {
  /** Maximum energy a player can store. */
  cap: 1000,
  /** Recharge pack: buy `perPack` energy for `creditsPerPack` credits. */
  perPack: 100,
  creditsPerPack: 20,
  /** energyCost = ceil(powerDrawWatts * durationSec / divisor) */
  divisor: 20,
} as const

/** One-way Refinery exchange: converts simulated Quanta into credits. */
export const REFINERY = {
  creditsPerQuanta: 150,
} as const

export const JOBS = {
  minDurationSec: 5,
  maxDurationSec: 900,
  /** Cancelling refunds the unspent share of the energy; the fee is not refunded. */
  refundEnergyOnCancel: true,
} as const

export const REWARDS = {
  /** Basis points. 10000 = 100% of the challenge base reward. */
  baseBp: 10000,
  /** Bonus for submitting a provably optimal solution. */
  optimalBonusBp: 2500,
  /** Bonus for finishing a job at or below the challenge energy par. */
  efficiencyBonusBp: 1500,
} as const

export const RIG_RULES = {
  maxCooling: 2,
  maxRigsPerPlayer: 6,
  /** Overheating throttles compute but never below this fraction. */
  minThrottle: 0.4,
} as const

export const UPGRADES = {
  maxLevel: 3,
  /** Each level adds this fraction to the item's positive capacity stats. */
  bonusPerLevel: 0.15,
  /** Cost to go from level L to L+1 = ceil(price * costFactor * L) */
  costFactor: 0.4,
} as const

export const PROGRESSION = {
  maxLevel: 20,
  /** xp required to *reach* level L = xpPerLevelSquared * (L - 1)^2 */
  xpPerLevelSquared: 100,
} as const

/** Energy-per-compute ratio considered "par" when setting challenge energy par. */
export const ENERGY_PAR_WATTS_PER_COMPUTE = 5

export const DEMO = {
  defaultHandle: 'demo',
  displayName: 'Demo Miner',
} as const

export function quantaMilliToQ(mq: number): number {
  return mq / MQ_PER_Q
}

export function formatQuanta(mq: number): string {
  return (mq / MQ_PER_Q).toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

export function formatInt(n: number): string {
  return n.toLocaleString('en-US')
}
