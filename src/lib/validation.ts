import { z } from 'zod'
import { solutionSchema } from './challenges/types'

const id = z.string().min(1).max(64)
const idempotencyKey = z.string().min(8).max(100).optional()

export const purchaseSchema = z.object({ equipmentId: id, idempotencyKey })
export const upgradeSchema = z.object({ idempotencyKey })
export const rigNameSchema = z.object({ name: z.string().trim().min(1, 'Name is required.').max(32, 'Name is too long.') })
export const assignSchema = z.object({ inventoryItemId: id })
export const generateChallengeSchema = z.object({ definitionId: id })
export const checkSolutionSchema = z.object({ solution: solutionSchema })
export const startJobSchema = z.object({
  rigId: id,
  challengeInstanceId: id,
  solution: solutionSchema,
  idempotencyKey,
})
export const rechargeSchema = z.object({ packs: z.number().int().min(1).max(10), idempotencyKey })
export const exchangeSchema = z.object({ quanta: z.number().int().min(1).max(1000), idempotencyKey })
export const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(64).optional(),
})
