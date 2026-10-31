import { Prisma, type LedgerResource, type LedgerType } from '@prisma/client'
import { prisma } from '../db'
import { DomainError } from '../errors'

export type Tx = Prisma.TransactionClient

export interface LedgerMeta {
  type: LedgerType
  refType: string
  refId: string
  memo: string
  /** Namespaced idempotency key. A repeated key violates a unique index. */
  idempotencyKey?: string
}

export interface AdjustOptions {
  /** Reject an increase that would push the balance above this value. */
  maxBalance?: number
}

const FIELD = {
  CREDITS: 'credits',
  QUANTA: 'quantaMilli',
  ENERGY: 'energy',
} as const satisfies Record<LedgerResource, 'credits' | 'quantaMilli' | 'energy'>

const LABEL: Record<LedgerResource, string> = { CREDITS: 'credits', QUANTA: 'Quanta', ENERGY: 'energy' }

/**
 * The ONLY way balances change. Applies the change atomically with a
 * conditional UPDATE (so concurrent requests cannot overspend: the database
 * re-checks the balance under a row lock) and writes the matching ledger entry
 * in the same transaction. Returns the new balance.
 */
export async function adjust(
  tx: Tx,
  playerId: string,
  resource: LedgerResource,
  delta: number,
  meta: LedgerMeta,
  options: AdjustOptions = {},
): Promise<number> {
  if (!Number.isInteger(delta)) throw new DomainError('VALIDATION', 'Amounts must be whole numbers.')
  const field = FIELD[resource]

  if (delta !== 0) {
    const where: Prisma.PlayerWhereInput = { id: playerId }
    if (delta < 0) where[field] = { gte: -delta }
    else if (options.maxBalance !== undefined) where[field] = { lte: options.maxBalance - delta }
    const data: Prisma.PlayerUpdateManyMutationInput =
      delta < 0 ? { [field]: { decrement: -delta } } : { [field]: { increment: delta } }
    const result = await tx.player.updateMany({ where, data })
    if (result.count === 0) {
      if (delta < 0) {
        throw new DomainError('INSUFFICIENT_FUNDS', `Not enough ${LABEL[resource]}.`, { resource, required: -delta })
      }
      throw new DomainError('CONFLICT', `That would exceed the ${LABEL[resource]} limit.`)
    }
  }

  const player = await tx.player.findUnique({ where: { id: playerId }, select: { credits: true, quantaMilli: true, energy: true } })
  if (!player) throw new DomainError('NOT_FOUND', 'Player not found.')
  const balanceAfter = player[field]

  if (delta !== 0) {
    await tx.ledgerEntry.create({
      data: {
        playerId,
        type: meta.type,
        resource,
        amount: delta,
        balanceAfter,
        refType: meta.refType,
        refId: meta.refId,
        memo: meta.memo,
        idempotencyKey: meta.idempotencyKey,
      },
    })
  }
  return balanceAfter
}

/** Look up a previous operation by its namespaced idempotency key. */
export async function findByIdempotencyKey(tx: Tx, playerId: string, key: string) {
  return tx.ledgerEntry.findFirst({ where: { playerId, idempotencyKey: key }, orderBy: { createdAt: 'asc' } })
}

export const namespaced = (operation: string, key: string | undefined): string | undefined =>
  key ? `${operation}:${key}` : undefined

export interface Reconciliation {
  resource: LedgerResource
  balance: number
  ledgerSum: number
  reconciled: boolean
}

/** Compare each balance to the sum of its ledger entries. They must always match. */
export async function reconcile(playerId: string): Promise<Reconciliation[]> {
  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player) throw new DomainError('NOT_FOUND', 'Player not found.')
  const sums = await prisma.ledgerEntry.groupBy({ by: ['resource'], where: { playerId }, _sum: { amount: true } })
  const sumFor = (r: LedgerResource): number => sums.find((s) => s.resource === r)?._sum.amount ?? 0
  const rows: Array<[LedgerResource, number]> = [
    ['CREDITS', player.credits],
    ['QUANTA', player.quantaMilli],
    ['ENERGY', player.energy],
  ]
  return rows.map(([resource, balance]) => ({ resource, balance, ledgerSum: sumFor(resource), reconciled: balance === sumFor(resource) }))
}

export async function listLedger(playerId: string, limit = 100, cursor?: string) {
  const take = Math.min(Math.max(limit, 1), 200)
  const rows = await prisma.ledgerEntry.findMany({
    where: { playerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  const page = rows.slice(0, take)
  return {
    entries: page.map((e) => ({
      id: e.id,
      createdAt: e.createdAt.toISOString(),
      type: e.type,
      resource: e.resource,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      refType: e.refType,
      refId: e.refId,
      memo: e.memo,
    })),
    nextCursor: rows.length > take ? (page[page.length - 1]?.id ?? null) : null,
    reconciliation: await reconcile(playerId),
  }
}
