'use client'
import * as React from 'react'
import { Plus, Trash2, Unplug } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc'
import { EquipmentStats, KIND_ICON, KIND_LABEL } from '@/components/game/equipment-card'
import { RigStatsPanel } from '@/components/game/rig-stats-panel'
import { useGameAction, useInventory, useRigs } from '@/hooks/use-game'
import { api } from '@/lib/api-client'
import type { RigData } from '@/lib/api-types'
import { RIG_RULES } from '@/lib/game/config'
import { cn } from '@/lib/utils'

export default function RigsPage() {
  const rigs = useRigs()
  const inventory = useInventory()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [newName, setNewName] = React.useState('')
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const selected: RigData | undefined = rigs.data?.find((r) => r.id === selectedId) ?? rigs.data?.[0]

  const create = useGameAction<string, RigData>({
    run: (name) => api<RigData>('/rigs', { method: 'POST', body: { name } }),
    success: (r) => `Created ${r.name}.`,
  })
  const assign = useGameAction<{ rigId: string; itemId: string }, RigData>({
    run: ({ rigId, itemId }) => api<RigData>(`/rigs/${rigId}/components`, { method: 'POST', body: { inventoryItemId: itemId } }),
    success: () => 'Component installed.',
  })
  const remove = useGameAction<{ rigId: string; itemId: string }, RigData>({
    run: ({ rigId, itemId }) => api<RigData>(`/rigs/${rigId}/components/${itemId}`, { method: 'DELETE' }),
    success: () => 'Component removed.',
  })
  const destroy = useGameAction<string, unknown>({
    run: (id) => api(`/rigs/${id}`, { method: 'DELETE' }),
    success: () => 'Rig deleted. Its parts are back in storage.',
  })

  const available = (inventory.data ?? []).filter((i) => i.rigId === null)

  return (
    <div>
      <PageHeader title="Rigs" subtitle="Assemble parts into rigs. Power draw must stay under your supply, and heat above your cooling throttles compute." />
      {rigs.error ? <ErrorState message={rigs.error.message} onRetry={() => void rigs.refetch()} /> : null}
      {rigs.isLoading ? <Skeleton className="h-64" /> : null}

      {rigs.data ? (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {rigs.data.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                aria-pressed={selected?.id === r.id}
                data-testid="rig-tab"
                className={cn(
                  'flex min-h-[56px] w-full items-center justify-between rounded-xl border px-3 text-left transition-colors',
                  selected?.id === r.id ? 'border-cyan-dive/60 bg-ink-700 shadow-glow' : 'border-ink-600 bg-ink-800 hover:bg-ink-700',
                )}
              >
                <span>
                  <span className="block font-display text-sm font-semibold text-fog-100">{r.name}</span>
                  <span className="text-xs tabular-nums text-fog-500">{r.stats.effectiveCompute} compute</span>
                </span>
                <Badge tone={r.busy ? 'cyan' : r.stats.ready ? 'green' : 'amber'}>{r.busy ? 'Mining' : r.stats.ready ? 'Ready' : 'Incomplete'}</Badge>
              </button>
            ))}
            {rigs.data.length < RIG_RULES.maxRigsPerPlayer ? (
              <form
                className="flex gap-2 pt-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const name = newName.trim()
                  if (name) create.mutate(name, { onSuccess: (r) => { setNewName(''); setSelectedId(r.id) } })
                }}
              >
                <label htmlFor="rig-name" className="sr-only">
                  New rig name
                </label>
                <input
                  id="rig-name"
                  value={newName}
                  maxLength={32}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New rig name"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-ink-500 bg-ink-900 px-3 text-sm text-fog-100 placeholder:text-fog-500"
                />
                <Button type="submit" loading={create.isPending} disabled={!newName.trim()} aria-label="Create rig">
                  <Plus className="h-4 w-4" aria-hidden /> Create
                </Button>
              </form>
            ) : (
              <p className="text-xs text-fog-500">Rig limit reached ({RIG_RULES.maxRigsPerPlayer}).</p>
            )}
          </div>

          {selected ? (
            <div className="space-y-4" data-testid="rig-editor" data-rig-id={selected.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{selected.name}</CardTitle>
                  <Button variant="danger" size="sm" disabled={selected.busy} onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4" aria-hidden /> Delete
                  </Button>
                </CardHeader>
                {selected.busy ? <p className="mb-3 text-xs text-amber-dive">This rig is mining. Parts are locked until the job ends.</p> : null}
                <RigStatsPanel stats={selected.stats} />
              </Card>

              <Card>
                <CardTitle className="mb-3">Installed parts</CardTitle>
                {selected.components.length === 0 ? (
                  <EmptyState title="Empty rig" hint="Install a chassis first, then a processor, memory, cooling and a power supply." />
                ) : (
                  <ul className="divide-y divide-ink-600">
                    {selected.components.map((c) => {
                      const Icon = KIND_ICON[c.equipment.kind]
                      return (
                        <li key={c.itemId} className="flex items-center justify-between gap-3 py-2" data-testid="installed-part">
                          <div className="flex min-w-0 items-center gap-3">
                            <Icon className="h-4 w-4 shrink-0 text-cyan-dive" aria-hidden />
                            <div className="min-w-0">
                              <p className="truncate text-sm text-fog-100">
                                {c.equipment.name} <span className="text-xs text-fog-500">Lv {c.level}</span>
                              </p>
                              <EquipmentStats equipment={c.equipment} level={c.level} />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={selected.busy || remove.isPending}
                            onClick={() => remove.mutate({ rigId: selected.id, itemId: c.itemId })}
                            aria-label={`Remove ${c.equipment.name}`}
                          >
                            <Unplug className="h-4 w-4" aria-hidden /> Remove
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>

              <Card>
                <CardTitle className="mb-3">Available in storage</CardTitle>
                {available.length === 0 ? (
                  <p className="text-sm text-fog-500">Nothing in storage. Buy parts at the Market.</p>
                ) : (
                  <ul className="divide-y divide-ink-600">
                    {available.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 py-2" data-testid="storage-part" data-slug={i.equipment.slug}>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-fog-100">
                            {i.equipment.name} <span className="text-xs text-fog-500">{KIND_LABEL[i.equipment.kind]} · Lv {i.level}</span>
                          </p>
                          <EquipmentStats equipment={i.equipment} level={i.level} />
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={selected.busy || assign.isPending}
                          onClick={() => assign.mutate({ rigId: selected.id, itemId: i.id })}
                        >
                          Install
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this rig?"
        description="Its parts return to storage. Rigs that have run jobs cannot be deleted."
        confirmLabel="Delete rig"
        tone="danger"
        loading={destroy.isPending}
        onConfirm={() => {
          if (selected) destroy.mutate(selected.id, { onSettled: () => { setConfirmDelete(false); setSelectedId(null) } })
        }}
      />
    </div>
  )
}
