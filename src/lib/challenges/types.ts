import { z } from 'zod'

export const nodeSchema = z.object({ id: z.number().int(), x: z.number(), y: z.number() })
export const edgeSchema = z.object({ a: z.number().int(), b: z.number().int(), w: z.number().int() })

export const pathPayloadSchema = z.object({
  type: z.literal('PATH'),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  start: z.number().int(),
  end: z.number().int(),
  budget: z.number().int(),
})

export const coloringPayloadSchema = z.object({
  type: z.literal('COLORING'),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  /** Number of colours available to the player. */
  colors: z.number().int(),
})

export const knapsackPayloadSchema = z.object({
  type: z.literal('KNAPSACK'),
  items: z.array(z.object({ id: z.number().int(), name: z.string(), weight: z.number().int(), value: z.number().int() })),
  capacity: z.number().int(),
  /** Minimum total value to be accepted. */
  target: z.number().int(),
})

export const treePayloadSchema = z.object({
  type: z.literal('SPANNING_TREE'),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  budget: z.number().int(),
})

export const payloadSchema = z.discriminatedUnion('type', [
  pathPayloadSchema,
  coloringPayloadSchema,
  knapsackPayloadSchema,
  treePayloadSchema,
])

export type GraphNode = z.infer<typeof nodeSchema>
export type GraphEdge = z.infer<typeof edgeSchema>
export type PathPayload = z.infer<typeof pathPayloadSchema>
export type ColoringPayload = z.infer<typeof coloringPayloadSchema>
export type KnapsackPayload = z.infer<typeof knapsackPayloadSchema>
export type TreePayload = z.infer<typeof treePayloadSchema>
export type ChallengePayload = z.infer<typeof payloadSchema>

export const solutionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PATH'), path: z.array(z.number().int()).max(200) }),
  z.object({ type: z.literal('COLORING'), colors: z.array(z.number().int()).max(200) }),
  z.object({ type: z.literal('KNAPSACK'), selected: z.array(z.number().int()).max(200) }),
  z.object({ type: z.literal('SPANNING_TREE'), edges: z.array(z.number().int()).max(400) }),
])
export type Solution = z.infer<typeof solutionSchema>

export interface EvaluationResult {
  /** Solution satisfies every constraint. */
  valid: boolean
  /** Solution is provably the best possible. Only meaningful when valid. */
  optimal: boolean
  /** Human-readable score line (cost, value, colours used...). */
  summary: string
  /** Why it was rejected (when !valid). */
  reason?: string
}
