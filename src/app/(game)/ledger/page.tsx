'use client'
import * as React from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc'
import { useLedger } from '@/hooks/use-game'
import { formatInt, formatQuanta } from '@/lib/game/config'
import { formatTime } from '@/lib/utils'

const RES_LABEL = { CREDITS: 'Credits', QUANTA: 'Quanta (Q)', ENERGY: 'Energy' } as const

function amountText(resource: 'CREDITS' | 'QUANTA' | 'ENERGY', n: number): string {
  return resource === 'QUANTA' ? formatQuanta(n) : formatInt(n)
}

export default function LedgerPage() {
  const [limit, setLimit] = React.useState(50)
  const { data, error, refetch, isLoading } = useLedger(limit)

  return (
    <div className="space-y-4">
      <PageHeader title="Ledger" subtitle="Every change to your balances, newest first. Each balance must equal the sum of its entries." />
      {error ? <ErrorState message={error.message} onRetry={() => void refetch()} /> : null}
      {isLoading ? <Skeleton className="h-48" /> : null}
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.reconciliation.map((r) => (
              <Card key={r.resource} data-testid={`recon-${r.resource.toLowerCase()}`}>
                <div className="flex items-center justify-between">
                  <CardTitle>{RES_LABEL[r.resource]}</CardTitle>
                  {r.reconciled ? (
                    <Badge tone="green">
                      <ShieldCheck className="h-3 w-3" aria-hidden /> Reconciled
                    </Badge>
                  ) : (
                    <Badge tone="red">
                      <ShieldAlert className="h-3 w-3" aria-hidden /> Mismatch
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-fog-500">
                  Balance <span className="tabular-nums text-fog-100">{amountText(r.resource, r.balance)}</span> · Ledger sum{' '}
                  <span className="tabular-nums text-fog-100">{amountText(r.resource, r.ledgerSum)}</span>
                </p>
              </Card>
            ))}
          </div>

          {data.entries.length === 0 ? (
            <EmptyState title="No entries yet" />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-600 text-xs uppercase tracking-wider text-fog-500">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e.id} className="border-b border-ink-700 last:border-0" data-testid="ledger-row" data-type={e.type}>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-fog-500">{formatTime(e.createdAt)}</td>
                      <td className="px-4 py-2">
                        <Badge tone={e.resource === 'QUANTA' ? 'violet' : e.resource === 'ENERGY' ? 'green' : 'cyan'}>{e.type.replace('_', ' ').toLowerCase()}</Badge>
                      </td>
                      <td className="px-4 py-2 text-fog-300">{e.memo}</td>
                      <td className={`whitespace-nowrap px-4 py-2 text-right tabular-nums ${e.amount < 0 ? 'text-rose-dive' : 'text-mint-dive'}`}>
                        {e.amount > 0 ? '+' : ''}
                        {amountText(e.resource, e.amount)} <span className="text-xs text-fog-500">{e.resource === 'QUANTA' ? 'Q' : e.resource === 'ENERGY' ? 'en' : 'cr'}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-fog-100">{amountText(e.resource, e.balanceAfter)}</td>
                      <td className="px-4 py-2 font-mono text-xs text-fog-500" title={`${e.refType}:${e.refId}`}>
                        {e.refId.slice(0, 8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {data.nextCursor ? (
            <div className="text-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + 50)}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
