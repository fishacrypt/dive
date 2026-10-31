'use client'
import * as React from 'react'
import { Coins, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc'
import { EquipmentStats, KIND_ICON, KIND_LABEL, TierBadge } from '@/components/game/equipment-card'
import { useGameAction, useMarket } from '@/hooks/use-game'
import { api, newIdempotencyKey } from '@/lib/api-client'
import type { MarketItem, PurchaseResult } from '@/lib/api-types'
import { formatInt } from '@/lib/game/config'
import { EQUIPMENT_KINDS, type EquipmentKind } from '@/lib/game/types'
import { cn } from '@/lib/utils'

export default function MarketPage() {
  const { data, error, refetch, isLoading } = useMarket()
  const [filter, setFilter] = React.useState<EquipmentKind | 'ALL'>('ALL')
  const [pending, setPending] = React.useState<MarketItem | null>(null)
  const keyRef = React.useRef(newIdempotencyKey())

  const buy = useGameAction<MarketItem, PurchaseResult>({
    run: (item) => api<PurchaseResult>('/marketplace/purchase', { method: 'POST', body: { equipmentId: item.id, idempotencyKey: keyRef.current } }),
    success: (out, item) => `Bought ${item.name}.${out.replayed ? '' : ' It is in your inventory.'}`,
  })

  const items = (data?.items ?? []).filter((i) => filter === 'ALL' || i.kind === filter)

  return (
    <div>
      <PageHeader title="Market" subtitle="Equipment prices are set by the server. Higher tiers unlock as you level up." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Equipment category">
        {(['ALL', ...EQUIPMENT_KINDS] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className={cn(
              'min-h-[36px] rounded-lg border px-3 text-sm transition-colors',
              filter === k ? 'border-cyan-dive/60 bg-cyan-dive/10 text-cyan-dive' : 'border-ink-500 text-fog-300 hover:bg-ink-700',
            )}
          >
            {k === 'ALL' ? 'All' : KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {error ? <ErrorState message={error.message} onRetry={() => void refetch()} /> : null}
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : null}
      {data && items.length === 0 ? <EmptyState title="Nothing here" hint="Try another category." /> : null}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind]
          return (
            <Card key={item.id} className={cn(item.locked && 'opacity-70')} data-testid="market-item" data-slug={item.slug}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg border border-ink-500 bg-ink-900 p-2 text-cyan-dive">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="font-display text-base font-semibold text-fog-100">{item.name}</p>
                    <p className="text-xs text-fog-500">{KIND_LABEL[item.kind]}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <TierBadge tier={item.tier} />
                  {item.owned > 0 ? <Badge tone="green">Owned x{item.owned}</Badge> : null}
                </div>
              </div>
              <p className="mt-2 text-sm text-fog-300">{item.description}</p>
              <div className="mt-2">
                <EquipmentStats equipment={item} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-display text-lg font-semibold tabular-nums text-fog-100">
                  <Coins className="h-4 w-4 text-cyan-dive" aria-hidden />
                  {formatInt(item.price)}
                </span>
                {item.locked ? (
                  <Badge tone="amber">
                    <Lock className="h-3 w-3" aria-hidden /> Level {item.requiredLevel}
                  </Badge>
                ) : (
                  <Button size="sm" disabled={!item.affordable} onClick={() => setPending(item)}>
                    {item.affordable ? 'Buy' : 'Not enough credits'}
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
        title={`Buy ${pending?.name ?? ''}?`}
        description={pending ? `This costs ${formatInt(pending.price)} credits (simulated). You have ${formatInt(data?.credits ?? 0)}.` : ''}
        confirmLabel="Confirm purchase"
        loading={buy.isPending}
        onConfirm={() => {
          if (pending)
            buy.mutate(pending, {
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
