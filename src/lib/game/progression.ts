import { PROGRESSION, REWARDS } from './config'

/** Total xp needed to reach `level`. */
export function xpForLevel(level: number): number {
  return PROGRESSION.xpPerLevelSquared * (level - 1) * (level - 1)
}

export function levelFromXp(xp: number): number {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / PROGRESSION.xpPerLevelSquared)) + 1
  return Math.min(PROGRESSION.maxLevel, level)
}

export interface LevelProgress {
  level: number
  xp: number
  currentLevelXp: number
  nextLevelXp: number | null
  /** 0..1 progress through the current level. */
  fraction: number
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp)
  const currentLevelXp = xpForLevel(level)
  if (level >= PROGRESSION.maxLevel) return { level, xp, currentLevelXp, nextLevelXp: null, fraction: 1 }
  const nextLevelXp = xpForLevel(level + 1)
  return { level, xp, currentLevelXp, nextLevelXp, fraction: (xp - currentLevelXp) / (nextLevelXp - currentLevelXp) }
}

export interface RewardInput {
  baseRewardMq: number
  xpReward: number
  optimal: boolean
  efficient: boolean
}

export interface RewardResult {
  rewardMq: number
  xp: number
  bonusBp: number
}

/**
 * Deterministic reward formula. The same inputs always give the same output;
 * nothing random or client-supplied is involved.
 */
export function computeReward(input: RewardInput): RewardResult {
  const bonusBp = (input.optimal ? REWARDS.optimalBonusBp : 0) + (input.efficient ? REWARDS.efficiencyBonusBp : 0)
  const rewardMq = Math.floor((input.baseRewardMq * (REWARDS.baseBp + bonusBp)) / 10000)
  const xp = Math.floor((input.xpReward * (REWARDS.baseBp + bonusBp)) / 10000)
  return { rewardMq, xp, bonusBp }
}
