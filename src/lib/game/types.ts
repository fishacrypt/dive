/** Plain string unions mirroring the Prisma enums, safe to import in client code. */

export const EQUIPMENT_KINDS = ['CHASSIS', 'PROCESSOR', 'ACCELERATOR', 'MEMORY', 'COOLING', 'PSU'] as const
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number]

export const CHALLENGE_TYPES = ['PATH', 'COLORING', 'KNAPSACK', 'SPANNING_TREE'] as const
export type ChallengeType = (typeof CHALLENGE_TYPES)[number]

export type JobStatus = 'RUNNING' | 'COMPLETED' | 'CLAIMED' | 'CANCELLED'
export type LedgerResource = 'CREDITS' | 'QUANTA' | 'ENERGY'

/** The stats of a piece of equipment, as stored on EquipmentDefinition. */
export interface EquipmentStats {
  kind: EquipmentKind
  compute: number
  memory: number
  powerDraw: number
  powerCapacity: number
  heat: number
  coolingCapacity: number
  accelSlots: number
  memSlots: number
}

/** A concrete owned component: definition stats plus its upgrade level. */
export interface RigPart extends EquipmentStats {
  level: number
}
