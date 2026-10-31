'use client'
import Link from 'next/link'
import { ArrowRight, Boxes, Cpu, Gem, Puzzle, ShieldCheck, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, Skeleton, Stat } from '@/components/ui/misc'
import { Progress } from '@/components/ui/progress'
import { JobCard } from '@/components/game/job-card'
import { Operations } from '@/components/game/operations'
import { useDashboard } from '@/hooks/use-game'
import { formatInt, formatQuanta } from '@/lib/game/config'
import { formatTime } from '@/lib/utils'

const LOOP = [
  { n: '1', title: 'Buy', text: 'Get parts at the Market.', href: '/market', icon: Boxes },
  { n: '2', title: 'Build', text: 'Assemble a rig.', href: '/rigs', icon: Cpu },
  { n: '3', title: 'Solve', text: 'Crack a challenge, start a job.', href: '/challenges', icon: Puzzle },
  { n: '4', title: 'Earn', text: 'Claim simulated Quanta.', href: '/jobs', icon: Gem },
] as const

export default function DashboardPage() {
  const { data, error, refetch, isLoading } = useDashboard()

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(420px circle at 100% 0%, rgba(167,139,250,0.12), transparent 70%), radial-gradient(360px circle at 0% 100%, rgba(34,211,238,0.10), transparent 70%)' }}
          aria-hidden
        />
        <p className="label-caps">Useful-work mining simulator</p>
        <h1 className="mt-2 font-display text-6xl font-bold tracking-[0.12em] text-fog-100 sm:text-7xl">DIVE</h1>
        <p className="mt-3 font-display text-lg text-cyan-dive sm:text-xl">Build Your Rig. Solve Useful Work. Earn Quanta.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-4">
          {LOOP.map(({ n, title, text, href, icon: Icon }) => (
            <Link key={href} href={href} className="group rounded-xl border border-ink-600 bg-ink-800/80 p-3 transition-colors hover:border-cyan-dive/50">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-fog-500">{n}</span>
                <Icon className="h-4 w-4 text-fog-500 group-hover:text-cyan-dive" aria-hidden />
              </div>
              <p className="mt-1 font-display text-base font-semibold text-fog-100">{title}</p>
              <p className="text-xs text-fog-300">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      {error ? <ErrorState message={error.message} onRetry={() => void refetch()} /> : null}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Operator level</CardTitle>
                <Badge tone="cyan" data-testid="level-badge">
                  Level {data.progress.level}
                </Badge>
              </CardHeader>
              <Progress value={data.progress.fraction} tone="violet" label="Level progress" />
              <p className="mt-2 text-xs tabular-nums text-fog-300">
                {formatInt(data.progress.xp)} XP{data.progress.nextLevelXp ? ` / ${formatInt(data.progress.nextLevelXp)} for level ${data.progress.level + 1}` : ' (max level)'}
              </p>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Farm totals</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Quanta earned" value={`${formatQuanta(data.totals.quantaEarnedMilli)} Q`} />
                <Stat label="Jobs claimed" value={data.totals.jobsClaimed} />
                <Stat label="Open challenges" value={data.totals.openChallenges} />
                <Stat label="Achievements" value={`${data.totals.achievementsUnlocked}/${data.totals.achievementsTotal}`} />
              </div>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Rigs</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/rigs">Manage</Link>
                </Button>
              </CardHeader>
              <ul className="space-y-2">
                {data.rigs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-fog-100">{r.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-fog-500">{r.effectiveCompute} compute</span>
                      <Badge tone={r.busy ? 'cyan' : r.ready ? 'green' : 'amber'}>{r.busy ? 'Mining' : r.ready ? 'Idle' : 'Incomplete'}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <section aria-labelledby="active-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="active-heading" className="font-display text-xl font-semibold text-fog-100">
                Active jobs
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/jobs">
                  All jobs <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
            {data.activeJobs.length === 0 ? (
              <EmptyState
                icon={<Puzzle className="h-6 w-6" />}
                title="No jobs running"
                hint="Pick a challenge, solve it, and send it to one of your rigs."
                action={
                  <Button asChild size="sm">
                    <Link href="/challenges">Open the challenge board</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.activeJobs.map((j) => (
                  <JobCard key={j.id} job={j} />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="ops-heading">
            <h2 id="ops-heading" className="mb-3 font-display text-xl font-semibold text-fog-100">
              Operations
            </h2>
            <Operations data={data} />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Recent ledger</CardTitle>
              <div className="flex items-center gap-2">
                {data.reconciled ? (
                  <Badge tone="green">
                    <ShieldCheck className="h-3 w-3" aria-hidden /> Balances reconciled
                  </Badge>
                ) : (
                  <Badge tone="red">
                    <ShieldAlert className="h-3 w-3" aria-hidden /> Mismatch
                  </Badge>
                )}
                <Button asChild variant="ghost" size="sm">
                  <Link href="/ledger">Full ledger</Link>
                </Button>
              </div>
            </CardHeader>
            <ul className="divide-y divide-ink-600">
              {data.recentLedger.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-fog-300">{e.memo}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-fog-500 sm:inline">{formatTime(e.createdAt)}</span>
                    <span className={`tabular-nums ${e.amount < 0 ? 'text-rose-dive' : 'text-mint-dive'}`}>
                      {e.amount > 0 ? '+' : ''}
                      {e.resource === 'QUANTA' ? `${formatQuanta(e.amount)} Q` : `${formatInt(e.amount)} ${e.resource === 'ENERGY' ? 'energy' : 'cr'}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  )
}
