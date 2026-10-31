'use client'
import * as React from 'react'
import Link from 'next/link'
import { ArrowUpCircle, Boxes, Coins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc'
import { EquipmentStats, KIND_ICON, KIND_LABEL, TierBadge } from '@/components/game/equipment-card'
import { useGameAction, useInventory, useRigs } from '@/hooks/use-game'
import { api, newIdempotencyKey } from '@/lib/api-client'
import type { InventoryEntry, UpgradeResult } from '@/lib/api-types'
import { formatInt } from '@/lib/game/config'
import { UPGRADES } from '@/lib/game/config'

export default function InventoryPage() {
  const { data, error, refetch, isLoading } = useInventory()
  const rigs = useRigs()
  const [pending, setPending] = React.useState<InventoryEntry | null>(null)
  const keyRef = React.useRef(newIdempotencyKey())

  const upgrade = useGameAction<InventoryEntry, UpgradeResult>({
    run: (item) => api<UpgradeResult>(`/inventory/${item.id}/upgrade`, { method: 'POST', body: { idempotencyKey: keyRef.current } }),
    success: (out) => `${out.item.equipment.name} is now level ${out.item.level}.`,
  })
  const rigName = (id: string | null) => (id ? (rigs.data?.find((r) => r.id === id)?.name ?? 'a rig') : null)

  return (
    <div>
      <PageHeader title="Inventory" subtitle={`Everything you own. Upgrade parts up to level ${UPGRADES.maxLevel} for +${UPGRADES.bonusPerLevel * 100}% capacity per level.`} />
      {error ? <ErrorState message={error.message} onRetry={() => void refetch()} /> : null}
      {isLoading ? <Skeleton className="h-40" /> : null}
      {data && data.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-6 w-6" />}
          title="Your inventory is empty"
          action={
            <Button asChild size="sm">
              <Link href="/market">Visit the market</Link>
            </Button>
          }
        />
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((item) => {
          const Icon = KIND_ICON[item.equipment.kind]
          const installed = rigName(item.rigId)
          return (
            <Card key={item.id} data-testid="inventory-item" data-slug={item.equipment.slug}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg border border-ink-500 bg-ink-900 p-2 text-cyan-dive">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="font-display text-base font-semibold text-fog-100">{item.equipment.name}</p>
                    <p className="text-xs text-fog-500">{KIND_LABEL[item.equipment.kind]}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <TierBadge tier={item.equipment.tier} />
                  <Badge tone={item.level > 1 ? 'violet' : 'neutral'}>Level {item.level}</Badge>
                </div>
              </div>
              <div className="mt-2">
                <EquipmentStats equipment={item.equipment} level={item.level} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                {installed ? <Badge tone="green">Installed in {installed}</Badge> : <Badge>In storage</Badge>}
                {item.upgradeCost === null ? (
                  <Badge tone="violet">Max level</Badge>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setPending(item)}>
                    <ArrowUpCircle className="h-4 w-4" aria-hidden />
                    Upgrade
                    <span className="flex items-center gap-1 tabular-nums">
                      <Coins className="h-3 w-3 text-cyan-dive" aria-hidden />
                      {formatInt(item.upgradeCost)}
                    </span>
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null)
        }}
        title={`Upgrade ${pending?.equipment.name ?? ''}?`}
        description={pending ? `Level ${pending.level} to ${pending.level + 1} costs ${formatInt(pending.upgradeCost ?? 0)} credits.` : ''}
        confirmLabel="Upgrade"
        loading={upgrade.isPending}
        onConfirm={() => {
          if (pending)
            upgrade.mutate(pending, {
              onSettled: () => {
                keyRef.current = newIdempotencyKey()
                setPending(null)
              },
            })
        }}
      />
    </div>
  )
}
