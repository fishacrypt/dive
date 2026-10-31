'use client'
import * as React from 'react'
import { ArrowRight, BatteryCharging, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { api, newIdempotencyKey } from '@/lib/api-client'
import type { DashboardData } from '@/lib/api-types'
import { MQ_PER_Q } from '@/lib/game/config'
import { useGameAction } from '@/hooks/use-game'

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center rounded-lg border border-ink-500 bg-ink-900" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} className="h-10 w-10 text-lg text-fog-300 hover:text-fog-100 disabled:opacity-40" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        -
      </button>
      <span className="w-10 text-center text-sm tabular-nums text-fog-100" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={`Increase ${label}`} className="h-10 w-10 text-lg text-fog-300 hover:text-fog-100 disabled:opacity-40" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  )
}

interface Props {
  data: DashboardData
}

/** Energy recharge and the one-way Quanta Refinery. */
export function Operations({ data }: Props) {
  const [packs, setPacks] = React.useState(1)
  const [quanta, setQuanta] = React.useState(1)
  const [confirm, setConfirm] = React.useState<'recharge' | 'refine' | null>(null)
  const keyRef = React.useRef<string>(newIdempotencyKey())

  const recharge = useGameAction({
    run: (n: number) => api('/energy/recharge', { method: 'POST', body: { packs: n, idempotencyKey: keyRef.current } }),
    success: (_o, n) => `Recharged ${n * data.rules.energyPerPack} energy.`,
  })
  const refine = useGameAction({
    run: (q: number) => api('/refinery/exchange', { method: 'POST', body: { quanta: q, idempotencyKey: keyRef.current } }),
    success: (_o, q) => `Refined ${q} Q into ${q * data.rules.creditsPerQuanta} credits.`,
  })

  const rechargeCost = packs * data.rules.creditsPerPack
  const energyRoom = data.balances.energyCap - data.balances.energy
  const wholeQuanta = Math.floor(data.balances.quantaMilli / MQ_PER_Q)
  const q = Math.min(quanta, Math.max(1, wholeQuanta))
  const done = () => {
    keyRef.current = newIdempotencyKey()
    setConfirm(null)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BatteryCharging className="h-4 w-4 text-mint-dive" aria-hidden /> Recharge energy
          </CardTitle>
        </CardHeader>
        <p className="text-sm text-fog-300">
          {data.rules.energyPerPack} energy per pack for {data.rules.creditsPerPack} credits. Jobs burn energy based on your rig&apos;s power draw.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Stepper value={packs} min={1} max={10} onChange={setPacks} label="energy packs" />
          <Button
            onClick={() => setConfirm('recharge')}
            disabled={packs * data.rules.energyPerPack > energyRoom || rechargeCost > data.balances.credits}
          >
            Recharge for {rechargeCost}
          </Button>
        </div>
        {packs * data.rules.energyPerPack > energyRoom ? <p className="mt-2 text-xs text-amber-dive">Energy cap reached. Spend some first.</p> : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-violet-dive" aria-hidden /> Refinery
          </CardTitle>
        </CardHeader>
        <p className="text-sm text-fog-300">
          Convert whole Quanta into credits at {data.rules.creditsPerQuanta} credits per Q. One-way and simulated: Quanta can never leave the game.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Stepper value={q} min={1} max={Math.max(1, wholeQuanta)} onChange={setQuanta} label="Quanta" />
          <Button variant="secondary" onClick={() => setConfirm('refine')} disabled={q > wholeQuanta}>
            Refine <ArrowRight className="h-4 w-4" aria-hidden /> {q * data.rules.creditsPerQuanta}
          </Button>
        </div>
        {wholeQuanta < 1 ? <p className="mt-2 text-xs text-fog-500">Claim at least 1 Q from a job to use the Refinery.</p> : null}
      </Card>

      <ConfirmDialog
        open={confirm === 'recharge'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Recharge energy?"
        description={`Spend ${rechargeCost} credits for ${packs * data.rules.energyPerPack} energy.`}
        confirmLabel="Recharge"
        loading={recharge.isPending}
        onConfirm={() => recharge.mutate(packs, { onSettled: done })}
      />
      <ConfirmDialog
        open={confirm === 'refine'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Refine Quanta?"
        description={`Convert ${q} Q (simulated) into ${q * data.rules.creditsPerQuanta} credits. This cannot be undone.`}
        confirmLabel="Refine"
        loading={refine.isPending}
        onConfirm={() => refine.mutate(q, { onSettled: done })}
      />
    </div>
  )
}
