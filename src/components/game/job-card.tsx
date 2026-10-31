'use client'
import * as React from 'react'
import { CheckCircle2, Gem, Timer, XCircle, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api-client'
import type { ClaimResult, JobData } from '@/lib/api-types'
import { formatQuanta } from '@/lib/game/config'
import { formatDuration, formatTime } from '@/lib/utils'
import { useGameAction } from '@/hooks/use-game'

const STATUS_TONE = { RUNNING: 'cyan', COMPLETED: 'green', CLAIMED: 'neutral', CANCELLED: 'red' } as const
const STATUS_LABEL = { RUNNING: 'Running', COMPLETED: 'Ready to claim', CLAIMED: 'Claimed', CANCELLED: 'Cancelled' } as const

export function JobCard({ job }: { job: JobData }) {
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const claim = useGameAction<string, ClaimResult>({
    run: (id) => api<ClaimResult>(`/jobs/${id}/claim`, { method: 'POST' }),
    success: (out) =>
      `Claimed ${formatQuanta(out.rewardMq)} Q (simulated) and ${out.xp} XP.${out.achievements.length ? ` Achievement unlocked: ${out.achievements.join(', ')}.` : ''}`,
  })
  const cancel = useGameAction<string, JobData>({
    run: (id) => api<JobData>(`/jobs/${id}/cancel`, { method: 'POST' }),
    success: () => 'Job cancelled. Unspent energy was refunded.',
  })

  return (
    <Card data-testid="job-card" data-status={job.status}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-semibold text-fog-100">{job.challengeName}</p>
          <p className="text-xs text-fog-500">
            on {job.rigName} · started {formatTime(job.startedAt)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {job.optimal ? <Badge tone="violet">Optimal</Badge> : null}
          {job.efficient ? <Badge tone="green">Efficient</Badge> : null}
          <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
        </div>
      </div>

      {job.status === 'RUNNING' || job.status === 'COMPLETED' ? (
        <div className="mt-3">
          <Progress value={job.progress} tone={job.status === 'COMPLETED' ? 'green' : 'cyan'} label="Job progress" />
          <div className="mt-1 flex justify-between text-xs tabular-nums text-fog-500">
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" aria-hidden />
              {job.status === 'RUNNING' ? `${formatDuration(job.remainingSec)} left` : 'Finished'}
            </span>
            <span>{Math.round(job.progress * 100)}%</span>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fog-300">
        <span className="flex items-center gap-1">
          <Gem className="h-3.5 w-3.5 text-violet-dive" aria-hidden />
          {formatQuanta(job.rewardMq)} Q reward
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3.5 w-3.5 text-mint-dive" aria-hidden />
          {job.energyCost} energy used
        </span>
        <span>{job.feeCredits} credit fee</span>
        <span>{job.xpReward} XP</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {job.status === 'COMPLETED' ? (
          <Button variant="success" size="sm" loading={claim.isPending} onClick={() => claim.mutate(job.id)}>
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Claim reward
          </Button>
        ) : null}
        {job.status === 'RUNNING' ? (
          <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
            <XCircle className="h-4 w-4" aria-hidden />
            Cancel job
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this job?"
        description="Unspent energy is refunded in proportion to the time left. The entry fee is not refunded, and the challenge goes back to your board."
        confirmLabel="Cancel job"
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(job.id, { onSettled: () => setConfirmCancel(false) })}
      />
    </Card>
  )
}
