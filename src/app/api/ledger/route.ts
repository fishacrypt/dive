import { route } from '@/server/http'
import { listLedger } from '@/server/services/ledger'
import { ledgerQuerySchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const GET = route(({ playerId, request }) => {
  const url = new URL(request.url)
  const q = ledgerQuerySchema.parse({
    limit: url.searchParams.get('limit') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
  })
  return listLedger(playerId, q.limit, q.cursor)
})
