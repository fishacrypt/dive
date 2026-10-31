import { prisma } from '../db'
import { DomainError } from '../errors'
import { adjust, findByIdempotencyKey, namespaced } from './ledger'
import { ENERGY, MQ_PER_Q, REFINERY } from '@/lib/game/config'

/** Buy energy packs with credits. Energy is capped so it cannot be stockpiled forever. */
export async function rechargeEnergy(playerId: string, packs: number, idempotencyKey?: string) {
  const key = namespaced('recharge', idempotencyKey)
  const energyGain = packs * ENERGY.perPack
  const cost = packs * ENERGY.creditsPerPack
  return prisma.$transaction(async (tx) => {
    if (key) {
      const prior = await findByIdempotencyKey(tx, playerId, key)
      if (prior) {
        const p = await tx.player.findUniqueOrThrow({ where: { id: playerId } })
        return { energy: p.energy, credits: p.credits, replayed: true }
      }
    }
    // Lock order: charge credits first, then add energy, always in the same order.
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { energy: true } })
    if (player.energy + energyGain > ENERGY.cap) {
      throw new DomainError('CONFLICT', `Energy is capped at ${ENERGY.cap}. You can add at most ${Math.max(0, ENERGY.cap - player.energy)} more.`)
    }
    const credits = await adjust(tx, playerId, 'CREDITS', -cost, {
      type: 'ENERGY_RECHARGE',
      refType: 'recharge',
      refId: `${packs}`,
      memo: `Energy recharge x${packs} (${cost} credits)`,
      idempotencyKey: key ? `${key}:credits` : undefined,
    })
    const energy = await adjust(tx, playerId, 'ENERGY', energyGain, {
      type: 'ENERGY_RECHARGE',
      refType: 'recharge',
      refId: `${packs}`,
      memo: `Energy recharge +${energyGain}`,
      idempotencyKey: key ? `${key}:energy` : undefined,
    }, { maxBalance: ENERGY.cap })
    return { energy, credits, replayed: false }
  })
}

/** One-way Refinery: turn whole simulated Quanta into credits. Quanta can never leave the game. */
export async function exchangeQuanta(playerId: string, quanta: number, idempotencyKey?: string) {
  const key = namespaced('exchange', idempotencyKey)
  const credits = quanta * REFINERY.creditsPerQuanta
  return prisma.$transaction(async (tx) => {
    if (key) {
      const prior = await findByIdempotencyKey(tx, playerId, key)
      if (prior) {
        const p = await tx.player.findUniqueOrThrow({ where: { id: playerId } })
        return { credits: p.credits, quantaMilli: p.quantaMilli, replayed: true }
      }
    }
    const quantaMilli = await adjust(tx, playerId, 'QUANTA', -quanta * MQ_PER_Q, {
      type: 'EXCHANGE',
      refType: 'refinery',
      refId: `${quanta}`,
      memo: `Refinery: ${quanta} Q converted (simulated)`,
      idempotencyKey: key ? `${key}:quanta` : undefined,
    })
    const newCredits = await adjust(tx, playerId, 'CREDITS', credits, {
      type: 'EXCHANGE',
      refType: 'refinery',
      refId: `${quanta}`,
      memo: `Refinery: +${credits} credits`,
      idempotencyKey: key ? `${key}:credits` : undefined,
    })
    return { credits: newCredits, quantaMilli, replayed: false }
  })
}
