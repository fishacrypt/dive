'use client'
import Link from 'next/link'
import { Hammer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc'
import { EfficiencyChart } from '@/components/game/efficiency-chart'
import { JobCard } from '@/components/game/job-card'
import { useJobs } from '@/hooks/use-game'

export default function JobsPage() {
  const { data, error, refetch, isLoading } = useJobs()
  const running = data?.filter((j) => j.status === 'RUNNING' || j.status === 'COMPLETED') ?? []
  const history = data?.filter((j) => j.status === 'CLAIMED' || j.status === 'CANCELLED') ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" subtitle="Jobs keep running on the server, so you can refresh or leave and come back. Status updates every couple of seconds." />
      {error ? <ErrorState message={error.message} onRetry={() => void refetch()} /> : null}
      {isLoading ? <Skeleton className="h-32" /> : null}
      {data && data.length === 0 ? (
        <EmptyState
          icon={<Hammer className="h-6 w-6" />}
          title="No jobs yet"
          hint="Solve a challenge and start a job to begin earning simulated Quanta."
          action={
            <Button asChild size="sm">
              <Link href="/challenges">Go to challenges</Link>
            </Button>
          }
        />
      ) : null}
      {data ? <EfficiencyChart jobs={data} /> : null}
      {running.length > 0 ? (
        <section aria-labelledby="running-h">
          <h2 id="running-h" className="mb-3 font-display text-lg font-semibold text-fog-100">
            In progress and ready to claim
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {running.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      ) : null}
      {history.length > 0 ? (
        <section aria-labelledby="history-h">
          <h2 id="history-h" className="mb-3 font-display text-lg font-semibold text-fog-100">
            History
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {history.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
