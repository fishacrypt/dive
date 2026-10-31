import { randomInt } from 'node:crypto'
import type { ChallengeDefinition, ChallengeInstance } from '@prisma/client'
import { prisma } from '../db'
import { DomainError, notFound } from '../errors'
import { generateChallenge } from '@/lib/challenges/generate'
import { evaluateSolution } from '@/lib/challenges/evaluate'
import { payloadSchema, type ChallengePayload, type Solution } from '@/lib/challenges/types'

export const MAX_OPEN_CHALLENGES = 10

export function serializeDefinition(d: ChallengeDefinition, playerLevel: number) {
  return {
    id: d.id,
    slug: d.slug,
    type: d.type,
    name: d.name,
    description: d.description,
    difficulty: d.difficulty,
    requiredLevel: d.requiredLevel,
    locked: playerLevel < d.requiredLevel,
    size: d.size,
    baseRewardMq: d.baseRewardMq,
    workUnits: d.workUnits,
    minCompute: d.minCompute,
    minMemory: d.minMemory,
    feeCredits: d.feeCredits,
    energyPar: d.energyPar,
    xpReward: d.xpReward,
  }
}

/** Parse the stored payload. Throws if the stored JSON is somehow malformed. */
export function readPayload(instance: Pick<ChallengeInstance, 'payload'>): ChallengePayload {
  return payloadSchema.parse(instance.payload)
}

export function serializeInstance(instance: ChallengeInstance, definition: ChallengeDefinition, playerLevel: number) {
  return {
    id: instance.id,
    status: instance.status,
    createdAt: instance.createdAt.toISOString(),
    definition: serializeDefinition(definition, playerLevel),
    payload: readPayload(instance),
  }
}

export async function listChallenges(playerId: string) {
  const [player, definitions, instances] = await Promise.all([
    prisma.player.findUniqueOrThrow({ where: { id: playerId }, select: { level: true } }),
    prisma.challengeDefinition.findMany({ orderBy: [{ difficulty: 'asc' }, { requiredLevel: 'asc' }, { slug: 'asc' }] }),
    prisma.challengeInstance.findMany({
      where: { playerId, status: 'OPEN' },
      include: { definition: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  return {
    playerLevel: player.level,
    maxOpen: MAX_OPEN_CHALLENGES,
    definitions: definitions.map((d) => serializeDefinition(d, player.level)),
    open: instances.map((i) => serializeInstance(i, i.definition, player.level)),
  }
}

/**
 * Generate a fresh puzzle for the player. The seed is chosen on the server
 * (optionally fixed by tests) and the whole puzzle is derived from it.
 */
export async function generateInstance(playerId: string, definitionId: string, seed?: number) {
  const [player, definition, openCount] = await Promise.all([
    prisma.player.findUniqueOrThrow({ where: { id: playerId }, select: { level: true } }),
    prisma.challengeDefinition.findUnique({ where: { id: definitionId } }),
    prisma.challengeInstance.count({ where: { playerId, status: 'OPEN' } }),
  ])
  if (!definition) throw notFound('Challenge')
  if (player.level < definition.requiredLevel) {
    throw new DomainError('LEVEL_LOCKED', `Requires level ${definition.requiredLevel}.`)
  }
  if (openCount >= MAX_OPEN_CHALLENGES) {
    throw new DomainError('CONFLICT', `You already have ${MAX_OPEN_CHALLENGES} open challenges. Start jobs to use them up.`)
  }
  const useSeed = seed ?? randomInt(1, 2_000_000_000)
  const payload = generateChallenge(definition.type, useSeed, definition.size)
  const instance = await prisma.challengeInstance.create({
    data: { playerId, definitionId: definition.id, seed: useSeed, payload },
  })
  return serializeInstance(instance, definition, player.level)
}

/** Dry-run a solution. Nothing is charged or stored. */
export async function checkSolution(playerId: string, instanceId: string, solution: Solution) {
  const instance = await prisma.challengeInstance.findFirst({ where: { id: instanceId, playerId } })
  if (!instance) throw notFound('Challenge')
  const result = evaluateSolution(readPayload(instance), solution)
  // Whether a solution is optimal stays hidden until the job starts: no free hints.
  return { valid: result.valid, summary: result.summary, reason: result.reason }
}
