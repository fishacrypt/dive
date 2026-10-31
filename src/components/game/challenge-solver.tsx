'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Gem, Play, RotateCcw, Timer, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { PuzzleBoard, initialSolution } from './puzzle-board'
import { useGameAction, useRigs } from '@/hooks/use-game'
import { api, errorMessage, newIdempotencyKey } from '@/lib/api-client'
import type { ChallengeInstanceData, DashboardData, JobData } from '@/lib/api-types'
import { formatInt, formatQuanta } from '@/lib/game/config'
import { checkRigMeetsChallenge, planJob } from '@/lib/game/rig'
import type { Solution } from '@/lib/challenges/types'
import { cn, formatDuration } from '@/lib/utils'

interface CheckResult {
  valid: boolean
  summary: string
  reason?: string
}

export function ChallengeSolver({ instance, balances }: { instance: ChallengeInstanceData; balances: DashboardData['balances'] | undefined }) {
  const router = useRouter()
  const rigs = useRigs()
  const [solution, setSolution] = React.useState<Solution>(() => initialSolution(instance.payload))
  const [rigId, setRigId] = React.useState<string | null>(null)
  const [verdict, setVerdict] = React.useState<CheckResult | null>(null)
  const [checking, setChecking] = React.useState(false)
  const [confirm, setConfirm] = React.useState(false)
  const keyRef = React.useRef(newIdempotencyKey())
  const def = instance.definition

  const update = (s: Solution) => {
    setSolution(s)
    setVerdict(null)
  }

  const candidates = rigs.data ?? []
  const selectedRig = candidates.find((r) => r.id === rigId) ?? candidates.find((r) => r.stats.ready && !r.busy) ?? candidates[0]
  const problem = selectedRig ? (selectedRig.busy ? 'This rig is already mining.' : checkRigMeetsChallenge(selectedRig.stats, def)) : 'You need a rig.'
  const plan = selectedRig?.stats.ready ? planJob(selectedRig.stats, def.workUnits) : null
  const efficient = plan ? plan.energyCost <= def.energyPar : false
  const canAfford = plan ? balances !== undefined && balances.credits >= def.feeCredits && balances.energy >= plan.energyCost : false

  const check = async () => {
    setChecking(true)
    try {
      setVerdict(await api<CheckResult>(`/challenges/${instance.id}/check`, { method: 'POST', body: { solution } }))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  const start = useGameAction<void, JobData>({
    run: () =>
      api<JobData>('/jobs', {
        method: 'POST',
        body: { rigId: selectedRig?.id, challengeInstanceId: instance.id, solution, idempotencyKey: keyRef.current },
      }),
    success: () => 'Job started. Your rig is working.',
  })

  const launch = async () => {
    try {
      // The board unmounts once the challenge is used, so navigate from here rather than from mutate callbacks.
      await start.mutateAsync()
      router.push('/jobs')
    } catch {
      // The error toast is shown by the action hook. Use a fresh key for the next attempt.
      keyRef.current = newIdempotencyKey()
    } finally {
      setConfirm(false)
    }
  }

  return (
    <Card data-testid="solver" className="space-y-4">
      <CardHeader className="!mb-0">
        <div>
          <CardTitle className="text-lg">{def.name}</CardTitle>
          <p className="mt-1 max-w-xl text-sm text-fog-300">{def.description}</p>
        </div>
        <Badge tone="violet">{def.type.replace('_', ' ').toLowerCase()}</Badge>
      </CardHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <PuzzleBoard payload={instance.payload} solution={solution} onChange={update} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => update(initialSolution(instance.payload))}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Reset
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void check()} loading={checking}>
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Check solution
            </Button>
          </div>
          {verdict ? (
            <p
              role="status"
              data-testid="verdict"
              data-valid={verdict.valid ? 'true' : 'false'}
              className={cn('mt-2 rounded-lg border px-3 py-2 text-sm', verdict.valid ? 'border-mint-dive/40 bg-mint-dive/10 text-mint-dive' : 'border-rose-dive/40 bg-rose-dive/10 text-rose-dive')}
            >
              {verdict.valid ? `Valid. ${verdict.summary}` : (verdict.reason ?? 'Not valid yet.')}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div>
            <p className="label-caps mb-2">Choose a rig</p>
            <div className="space-y-2" role="radiogroup" aria-label="Rig">
              {candidates.map((r) => {
                const why = r.busy ? 'Mining' : checkRigMeetsChallenge(r.stats, def)
                const active = selectedRig?.id === r.id
                return (
                  <button
                    key={r.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRigId(r.id)}
                    data-testid="rig-option"
                    className={cn('w-full rounded-lg border p-2 text-left text-sm', active ? 'border-cyan-dive/70 bg-ink-700' : 'border-ink-500 bg-ink-900 hover:bg-ink-700')}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-medium text-fog-100">{r.name}</span>
                      <span className="text-xs tabular-nums text-fog-500">{r.stats.effectiveCompute} compute</span>
                    </span>
                    {why ? <span className="mt-0.5 block text-xs text-amber-dive">{why}</span> : <span className="mt-0.5 block text-xs text-mint-dive">Compatible</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg border border-ink-600 bg-ink-900 p-3 text-sm">
            <p className="label-caps mb-2">Job preview</p>
            {plan ? (
              <ul className="space-y-1 text-fog-300">
                <li className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-cyan-dive" aria-hidden /> {formatDuration(plan.durationSec)}
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-mint-dive" aria-hidden /> {plan.energyCost} energy{' '}
                  <span className={efficient ? 'text-mint-dive' : 'text-fog-500'}>(par {def.energyPar}{efficient ? ', efficiency bonus' : ''})</span>
                </li>
                <li>Entry fee {def.feeCredits} credits</li>
                <li className="flex items-center gap-2">
                  <Gem className="h-4 w-4 text-violet-dive" aria-hidden /> {formatQuanta(def.baseRewardMq)}+ Q, {def.xpReward}+ XP
                </li>
              </ul>
            ) : (
              <p className="text-fog-500">Pick a ready rig to preview time and energy.</p>
            )}
            {plan && !canAfford && balances ? (
              <p className="mt-2 text-xs text-amber-dive">
                Not enough resources (you have {formatInt(balances.credits)} credits, {formatInt(balances.energy)} energy).
              </p>
            ) : null}
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!selectedRig || problem !== null || !canAfford}
            loading={start.isPending}
            onClick={() => setConfirm(true)}
          >
            <Play className="h-4 w-4" aria-hidden /> Start job
          </Button>
          {problem ? <p className="text-xs text-amber-dive">{problem}</p> : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Start this job?"
        description={
          plan
            ? `Your solution is checked by the server. If valid, this spends ${def.feeCredits} credits and ${plan.energyCost} energy and runs for ${formatDuration(plan.durationSec)}. Invalid solutions are rejected and cost nothing.`
            : ''
        }
        confirmLabel="Start job"
        loading={start.isPending}
        onConfirm={() => void launch()}
      />
    </Card>
  )
}
