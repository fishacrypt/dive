'use client'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { JobData } from '@/lib/api-types'
import { MQ_PER_Q } from '@/lib/game/config'

/** Quanta earned per 100 energy for each claimed job, oldest to newest. Rewards efficient play. */
export function EfficiencyChart({ jobs }: { jobs: JobData[] }) {
  const rows = jobs
    .filter((j) => j.status === 'CLAIMED' && j.energyCost > 0)
    .slice()
    .reverse()
    .slice(-12)
    .map((j, i) => ({
      name: `#${i + 1}`,
      job: j.challengeName,
      value: Number((((j.rewardMq / MQ_PER_Q) * 100) / j.energyCost).toFixed(2)),
    }))
  if (rows.length < 2) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Energy efficiency</CardTitle>
        <span className="text-xs text-fog-500">Q earned per 100 energy, last {rows.length} claimed jobs</span>
      </CardHeader>
      <div className="h-48 w-full" role="img" aria-label="Bar chart of Quanta earned per 100 energy for recent jobs">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#272d38" vertical={false} />
            <XAxis dataKey="name" stroke="#6f7a8d" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis stroke="#6f7a8d" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(34,211,238,0.06)' }}
              contentStyle={{ background: '#101318', border: '1px solid #363e4c', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`${v} Q`, 'per 100 energy']}
              labelFormatter={(_l, p) => (p[0]?.payload as { job: string } | undefined)?.job ?? ''}
            />
            <Bar dataKey="value" fill="#4ade80" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
