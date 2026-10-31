'use client'
import * as React from 'react'
import { Lock, Plus, Puzzle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc'
import { ChallengeSolver } from '@/components/game/challenge-solver'
import { useChallenges, useDashboard, useGameAction } from '@/hooks/use-game'
import { api } from '@/lib/api-client'
import type { ChallengeDefinitionData, ChallengeInstanceData } from '@/lib/api-types'
import { formatQuanta } from '@/lib/game/config'
import { cn } from '@/lib/utils'

const TYPE_LABEL = { PATH: 'Routing', COLORING: 'Constraint', KNAPSACK: 'Allocation', SPANNING_TREE: 'Network design' } as const

export default function ChallengesPage() {
  const { data, error, refetch, isLoading } = useChallenges()
  const dash = useDashboard()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const generate = useGameAction<ChallengeDefinitionData, ChallengeInstanceData>({
    run: (def) => api<ChallengeInstanceData>('/challenges', { method: 'POST', body: { definitionId: def.id } }),
    success: (inst) => `New challenge: ${inst.definition.name}.`,
  })

  const selected = data?.open.find((i) => i.id === selectedId) ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Challenge board"
        subtitle="Each challenge is a real computational problem generated on the server. Solve it, then run it on a rig to earn Quanta."
      />
      {error ? <ErrorState message={error.message} onRetry={() => void refetch()} /> : null}
      {isLoading ? <Skeleton className="h-40" /> : null}

      {data ? (
        <>
          <section aria-labelledby="tpl-h">
            <h2 id="tpl-h" className="mb-3 font-display text-lg font-semibold text-fog-100">
              Generate a challenge
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.definitions.map((d) => (
                <Card key={d.id} className={cn(d.locked && 'opacity-60')} data-testid="challenge-def" data-slug={d.slug}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-sm font-semibold text-fog-100">{d.name}</p>
                    <Badge tone={d.difficulty >= 3 ? 'violet' : d.difficulty === 2 ? 'cyan' : 'neutral'}>D{d.difficulty}</Badge>
                  </div>
                  <p className="text-xs text-fog-500">{TYPE_LABEL[d.type]}</p>
                  <dl className="mt-2 space-y-0.5 text-xs text-fog-300">
                    <div className="flex justify-between">
                      <dt>Reward</dt>
                      <dd className="tabular-nums text-violet-dive">{formatQuanta(d.baseRewardMq)}+ Q</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Needs</dt>
                      <dd className="tabular-nums">
                        {d.minCompute} compute, {d.minMemory} GB
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Entry fee</dt>
                      <dd className="tabular-nums">{d.feeCredits} cr</dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    {d.locked ? (
                      <Badge tone="amber">
                        <Lock className="h-3 w-3" aria-hidden /> Level {d.requiredLevel}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        disabled={data.open.length >= data.maxOpen}
                        loading={generate.isPending && generate.variables?.id === d.id}
                        onClick={() => generate.mutate(d, { onSuccess: (inst) => setSelectedId(inst.id) })}
                      >
                        <Plus className="h-4 w-4" aria-hidden /> Generate
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section aria-labelledby="open-h">
            <h2 id="open-h" className="mb-3 font-display text-lg font-semibold text-fog-100">
              Your open challenges ({data.open.length}/{data.maxOpen})
            </h2>
            {data.open.length === 0 ? (
              <EmptyState icon={<Puzzle className="h-6 w-6" />} title="No open challenges" hint="Generate one above to get started." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.open.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => setSelectedId(i.id)}
                    aria-pressed={selected?.id === i.id}
                    data-testid="open-challenge"
                    data-slug={i.definition.slug}
                    className={cn(
                      'min-h-[44px] rounded-lg border px-3 text-left text-sm',
                      selected?.id === i.id ? 'border-cyan-dive/70 bg-ink-700 text-cyan-dive' : 'border-ink-500 bg-ink-800 text-fog-300 hover:bg-ink-700',
                    )}
                  >
                    {i.definition.name}
                    <span className="ml-2 font-mono text-xs text-fog-500">{i.id.slice(-5)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selected ? <ChallengeSolver key={selected.id} instance={selected} balances={dash.data?.balances} /> : null}
        </>
      ) : null}
    </div>
  )
}
