'use client'
import { Check, Lock, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, PageHeader, Skeleton } from '@/components/ui/misc'
import { Progress } from '@/components/ui/progress'
import { useProgression } from '@/hooks/use-game'
import { formatInt } from '@/lib/game/config'
import { cn } from '@/lib/utils'

export default function ProgressPage() {
  const { data, error, refetch, isLoading } = useProgression()
  return (
    <div className="space-y-6">
      <PageHeader title="Progress" subtitle="Earn XP by finishing jobs. Efficient and optimal play earns bonus rewards." />
      {error ? <ErrorState message={error.message} onRetry={() => void refetch()} /> : null}
      {isLoading ? <Skeleton className="h-40" /> : null}
      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Operator level {data.progress.level}</CardTitle>
              <Badge tone="violet" data-testid="xp-badge">
                {formatInt(data.progress.xp)} XP
              </Badge>
            </CardHeader>
            <Progress value={data.progress.fraction} tone="violet" label="Level progress" />
            <p className="mt-2 text-xs text-fog-300">
              {data.progress.nextLevelXp ? `${formatInt(data.progress.nextLevelXp - data.progress.xp)} XP to level ${data.progress.level + 1}` : 'Maximum level reached'}
            </p>
          </Card>

          <section aria-labelledby="ach-h">
            <h2 id="ach-h" className="mb-3 font-display text-xl font-semibold text-fog-100">
              Achievements
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.achievements.map((a) => (
                <Card key={a.slug} className={cn(!a.unlockedAt && 'opacity-60')} data-testid="achievement" data-unlocked={a.unlockedAt ? 'true' : 'false'}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Trophy className={cn('h-4 w-4', a.unlockedAt ? 'text-amber-dive' : 'text-fog-500')} aria-hidden />
                      <p className="font-display text-sm font-semibold text-fog-100">{a.name}</p>
                    </div>
                    {a.unlockedAt ? (
                      <Badge tone="green">
                        <Check className="h-3 w-3" aria-hidden /> Unlocked
                      </Badge>
                    ) : (
                      <Badge>Locked</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-fog-300">{a.description}</p>
                  <p className="mt-2 text-xs text-fog-500">Reward: {a.rewardCredits} credits</p>
                </Card>
              ))}
            </div>
          </section>

          <section aria-labelledby="unlock-h">
            <h2 id="unlock-h" className="mb-3 font-display text-xl font-semibold text-fog-100">
              Level unlocks
            </h2>
            <Card>
              <ul className="divide-y divide-ink-600">
                {data.unlocks.map((u) => (
                  <li key={`${u.kind}-${u.name}`} className="flex items-center justify-between py-2 text-sm">
                    <span className="flex items-center gap-2 text-fog-100">
                      {u.unlocked ? <Check className="h-4 w-4 text-mint-dive" aria-hidden /> : <Lock className="h-4 w-4 text-fog-500" aria-hidden />}
                      {u.name}
                      <Badge tone={u.kind === 'equipment' ? 'cyan' : 'violet'}>{u.kind}</Badge>
                    </span>
                    <span className="text-xs text-fog-500">Level {u.requiredLevel}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  )
}
