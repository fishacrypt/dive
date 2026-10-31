import { describe, expect, it } from 'vitest'
import { prisma } from '@/server/db'
import { assignComponent, createRig, deleteRig, getRig, listRigs, removeComponent } from '@/server/services/rigs'
import { giveItem, newPlayer } from './helpers'

describe('rig building', () => {
  it('starts with a ready Starter Rig', async () => {
    const id = await newPlayer()
    const [rig] = await listRigs(id)
    expect(rig?.name).toBe('Starter Rig')
    expect(rig?.stats.ready).toBe(true)
  })

  it('builds a rig step by step and reports stats', async () => {
    const id = await newPlayer()
    const rig = await createRig(id, 'Beta')
    expect(rig.stats.ready).toBe(false)
    for (const slug of ['chassis-starter', 'cpu-vector', 'ram-16', 'cool-fan', 'psu-300']) {
      await assignComponent(id, rig.id, await giveItem(id, slug))
    }
    const built = await getRig(id, rig.id)
    expect(built.stats).toMatchObject({ ready: true, compute: 24, memory: 16, powerDraw: 80 + 8 + 10 })
  })

  it('refuses to install an item that is already installed elsewhere', async () => {
    const id = await newPlayer()
    const [starter] = await listRigs(id)
    const other = await createRig(id, 'Other')
    const installed = starter?.components[0]?.itemId as string
    await expect(assignComponent(id, other.id, installed)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('refuses another player\'s item and another player\'s rig', async () => {
    const a = await newPlayer()
    const b = await newPlayer()
    const rigA = await createRig(a, 'A')
    const itemB = await giveItem(b, 'chassis-starter')
    await expect(assignComponent(a, rigA.id, itemB)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const itemA = await giveItem(a, 'chassis-starter')
    await expect(assignComponent(b, rigA.id, itemA)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(getRig(b, rigA.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('enforces slot limits', async () => {
    const id = await newPlayer()
    const rig = await createRig(id, 'Slots')
    await assignComponent(id, rig.id, await giveItem(id, 'chassis-starter'))
    await expect(assignComponent(id, rig.id, await giveItem(id, 'chassis-starter'))).rejects.toMatchObject({ code: 'INCOMPATIBLE' })
    await assignComponent(id, rig.id, await giveItem(id, 'gpu-spark'))
    await expect(assignComponent(id, rig.id, await giveItem(id, 'gpu-spark'))).rejects.toMatchObject({ code: 'INCOMPATIBLE' })
  })

  it('parallel installs cannot exceed a slot limit', async () => {
    const id = await newPlayer()
    const rig = await createRig(id, 'Race')
    await assignComponent(id, rig.id, await giveItem(id, 'chassis-starter'))
    const items = await Promise.all([giveItem(id, 'gpu-spark'), giveItem(id, 'gpu-spark'), giveItem(id, 'gpu-spark')])
    const results = await Promise.allSettled(items.map((item) => assignComponent(id, rig.id, item)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await prisma.rigComponent.count({ where: { rigId: rig.id, item: { equipment: { kind: 'ACCELERATOR' } } } })).toBe(1)
  })

  it('refuses to remove a chassis that still hosts parts, and frees removed parts', async () => {
    const id = await newPlayer()
    const [starter] = await listRigs(id)
    const chassis = starter?.components.find((c) => c.equipment.kind === 'CHASSIS')?.itemId as string
    await expect(removeComponent(id, starter?.id as string, chassis)).rejects.toMatchObject({ code: 'INCOMPATIBLE' })
    const psu = starter?.components.find((c) => c.equipment.kind === 'PSU')?.itemId as string
    const after = await removeComponent(id, starter?.id as string, psu)
    expect(after.stats.ready).toBe(false)
    expect(await prisma.rigComponent.count({ where: { inventoryItemId: psu } })).toBe(0)
  })

  it('enforces the rig limit and allows deleting an unused rig', async () => {
    const id = await newPlayer()
    for (let i = 0; i < 5; i++) await createRig(id, `R${i}`)
    await expect(createRig(id, 'too many')).rejects.toMatchObject({ code: 'CONFLICT' })
    const rigs = await listRigs(id)
    await deleteRig(id, rigs[1]?.id as string)
    expect(await listRigs(id)).toHaveLength(5)
  })
})
