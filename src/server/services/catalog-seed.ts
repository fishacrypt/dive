import type { PrismaClient } from '@prisma/client'
import { ACHIEVEMENT_SEEDS, CHALLENGE_SEEDS, EQUIPMENT_SEEDS, energyParFor } from '@/lib/game/catalog'
import { ENERGY } from '@/lib/game/config'

/** Upsert equipment, challenge templates and achievements. Safe to run repeatedly. */
export async function seedCatalog(db: PrismaClient): Promise<void> {
  for (const e of EQUIPMENT_SEEDS) {
    const data = {
      name: e.name,
      kind: e.kind,
      tier: e.tier,
      description: e.description,
      price: e.price,
      requiredLevel: e.requiredLevel,
      compute: e.compute ?? 0,
      memory: e.memory ?? 0,
      powerDraw: e.powerDraw ?? 0,
      powerCapacity: e.powerCapacity ?? 0,
      heat: e.heat ?? 0,
      coolingCapacity: e.coolingCapacity ?? 0,
      accelSlots: e.accelSlots ?? 0,
      memSlots: e.memSlots ?? 0,
    }
    await db.equipmentDefinition.upsert({ where: { slug: e.slug }, create: { slug: e.slug, ...data }, update: data })
  }

  for (const c of CHALLENGE_SEEDS) {
    const { slug, ...rest } = c
    const data = { ...rest, energyPar: energyParFor(c.workUnits, ENERGY.divisor) }
    await db.challengeDefinition.upsert({ where: { slug }, create: { slug, ...data }, update: data })
  }

  for (const a of ACHIEVEMENT_SEEDS) {
    const { slug, ...data } = a
    await db.achievementDefinition.upsert({ where: { slug }, create: { slug, ...data }, update: data })
  }
}
