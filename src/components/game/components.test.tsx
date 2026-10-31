// @vitest-environment jsdom
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JobCard } from './job-card'
import { PuzzleBoard, initialSolution } from './puzzle-board'
import { RigStatsPanel } from './rig-stats-panel'
import { computeRigStats } from '@/lib/game/rig'
import type { RigPart } from '@/lib/game/types'
import type { JobData } from '@/lib/api-types'
import type { KnapsackPayload, PathPayload, Solution } from '@/lib/challenges/types'

afterEach(() => vi.restoreAllMocks())

const knapsack: KnapsackPayload = {
  type: 'KNAPSACK',
  capacity: 10,
  target: 12,
  items: [
    { id: 0, name: 'Batch A1', weight: 4, value: 8 },
    { id: 1, name: 'Batch B1', weight: 5, value: 9 },
    { id: 2, name: 'Batch C1', weight: 8, value: 20 },
  ],
}

function Harness({ payload }: { payload: KnapsackPayload | PathPayload }) {
  const [solution, setSolution] = React.useState<Solution>(() => initialSolution(payload))
  return (
    <>
      <PuzzleBoard payload={payload} solution={solution} onChange={setSolution} />
      <output data-testid="json">{JSON.stringify(solution)}</output>
    </>
  )
}

describe('PuzzleBoard (knapsack)', () => {
  it('toggles items and shows live weight and value against the limits', async () => {
    const user = userEvent.setup()
    render(<Harness payload={knapsack} />)
    expect(screen.getByTestId('board-score')).toHaveTextContent('Weight 0 / 10 · Value 0 (target 12)')
    await user.click(screen.getByTestId('item-0'))
    await user.click(screen.getByTestId('item-1'))
    expect(screen.getByTestId('board-score')).toHaveTextContent('Weight 9 / 10 · Value 17')
    expect(JSON.parse(screen.getByTestId('json').textContent ?? '{}')).toEqual({ type: 'KNAPSACK', selected: [0, 1] })
    await user.click(screen.getByTestId('item-0'))
    expect(screen.getByTestId('item-0')).toHaveAttribute('aria-pressed', 'false')
  })

  it('warns when the selection is overweight', async () => {
    const user = userEvent.setup()
    render(<Harness payload={knapsack} />)
    await user.click(screen.getByTestId('item-2'))
    await user.click(screen.getByTestId('item-0'))
    expect(screen.getByTestId('board-score')).toHaveClass('text-rose-dive')
  })
})

describe('PuzzleBoard (path)', () => {
  const path: PathPayload = {
    type: 'PATH',
    start: 0,
    end: 2,
    budget: 10,
    nodes: [
      { id: 0, x: 10, y: 50 },
      { id: 1, x: 50, y: 20 },
      { id: 2, x: 90, y: 50 },
    ],
    edges: [
      { a: 0, b: 1, w: 3 },
      { a: 1, b: 2, w: 4 },
    ],
  }

  it('only lets the route grow along real links, and undo from the end', () => {
    render(<Harness payload={path} />)
    fireEvent.click(screen.getByTestId('node-2')) // not adjacent to the start: ignored
    expect(screen.getByTestId('json')).toHaveTextContent('"path":[0]')
    fireEvent.click(screen.getByTestId('node-1'))
    fireEvent.click(screen.getByTestId('node-2'))
    expect(screen.getByTestId('json')).toHaveTextContent('"path":[0,1,2]')
    expect(screen.getByTestId('board-score')).toHaveTextContent('Latency 7 / budget 10')
    fireEvent.click(screen.getByTestId('node-2')) // undo the last hop
    expect(screen.getByTestId('json')).toHaveTextContent('"path":[0,1]')
  })
})

describe('RigStatsPanel', () => {
  const part = (kind: RigPart['kind'], extra: Partial<RigPart> = {}): RigPart => ({
    kind, level: 1, compute: 0, memory: 0, powerDraw: 0, powerCapacity: 0, heat: 0, coolingCapacity: 0, accelSlots: 0, memSlots: 0, ...extra,
  })

  it('lists what is missing on an incomplete rig', () => {
    render(<RigStatsPanel stats={computeRigStats([part('CHASSIS', { memSlots: 1 })])} />)
    expect(screen.getByText('Needs a processor.')).toBeInTheDocument()
    expect(screen.queryByText('Ready to mine')).not.toBeInTheDocument()
  })

  it('flags throttling and reports readiness for a complete rig', () => {
    const stats = computeRigStats([
      part('CHASSIS', { memSlots: 1 }),
      part('PROCESSOR', { compute: 20, powerDraw: 40, heat: 200 }),
      part('MEMORY', { memory: 8 }),
      part('COOLING', { coolingCapacity: 100 }),
      part('PSU', { powerCapacity: 200 }),
    ])
    render(<RigStatsPanel stats={stats} />)
    expect(screen.getByText('Ready to mine')).toBeInTheDocument()
    expect(screen.getByText(/throttled from 20/)).toBeInTheDocument()
    expect(screen.getByTestId('stat-compute')).toHaveTextContent('10')
  })
})

describe('JobCard', () => {
  const base: JobData = {
    id: 'job1', status: 'COMPLETED', rigId: 'r1', rigName: 'Starter Rig', challengeName: 'Packet Routing', challengeType: 'PATH', difficulty: 1,
    startedAt: new Date().toISOString(), endsAt: new Date().toISOString(), durationSec: 20, remainingSec: 0, progress: 1, energyCost: 60, feeCredits: 10,
    effectiveCompute: 10, optimal: true, efficient: false, rewardMq: 1000, xpReward: 75, claimedAt: null,
  }
  const renderCard = (job: JobData) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <JobCard job={job} />
      </QueryClientProvider>,
    )

  it('shows a claim button for a finished job and posts the claim', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { rewardMq: 1000, xp: 75, level: 1, achievements: [], job: base } }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderCard(base)
    expect(screen.getByText('Ready to claim')).toBeInTheDocument()
    expect(screen.getByText('Optimal')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /claim reward/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/jobs/job1/claim')
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST')
  })

  it('offers cancel (with confirmation) only while running, and nothing for a claimed job', async () => {
    const user = userEvent.setup()
    const { unmount } = renderCard({ ...base, status: 'RUNNING', progress: 0.5, remainingSec: 10 })
    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel job/i }))
    expect(await screen.findByText('Cancel this job?')).toBeInTheDocument()
    unmount()
    renderCard({ ...base, status: 'CLAIMED' })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('EfficiencyChart', () => {
  const job = (i: number, status: JobData['status']): JobData => ({
    id: `j${i}`, status, rigId: 'r', rigName: 'R', challengeName: `Job ${i}`, challengeType: 'PATH', difficulty: 1,
    startedAt: new Date().toISOString(), endsAt: new Date().toISOString(), durationSec: 10, remainingSec: 0, progress: 1,
    energyCost: 50, feeCredits: 10, effectiveCompute: 10, optimal: false, efficient: false, rewardMq: 800 + i * 100, xpReward: 50, claimedAt: null,
  })

  it('stays hidden until there are at least two claimed jobs', async () => {
    // jsdom has no ResizeObserver, which the chart container needs.
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    const { EfficiencyChart } = await import('./efficiency-chart')
    const { container, rerender } = render(<EfficiencyChart jobs={[job(1, 'CLAIMED'), job(2, 'RUNNING')]} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<EfficiencyChart jobs={[job(1, 'CLAIMED'), job(2, 'CLAIMED')]} />)
    expect(screen.getByRole('img', { name: /quanta earned per 100 energy/i })).toBeInTheDocument()
  })
})
