'use client'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, errorMessage } from '@/lib/api-client'
import type {
  ChallengesData,
  DashboardData,
  InventoryData,
  JobData,
  LedgerData,
  MarketplaceData,
  ProgressionData,
  RigData,
} from '@/lib/api-types'

export const keys = {
  dashboard: ['dashboard'] as const,
  market: ['market'] as const,
  inventory: ['inventory'] as const,
  rigs: ['rigs'] as const,
  challenges: ['challenges'] as const,
  jobs: ['jobs'] as const,
  ledger: ['ledger'] as const,
  progression: ['progression'] as const,
}

/** Every state-changing action can touch balances, so refresh all game data afterwards. */
const ALL_KEYS: QueryKey[] = Object.values(keys)

export const useDashboard = () =>
  useQuery({
    queryKey: keys.dashboard,
    queryFn: () => api<DashboardData>('/dashboard'),
    refetchInterval: (q) => (q.state.data?.activeJobs.some((j) => j.status === 'RUNNING') ? 2000 : 10000),
  })
export const useMarket = () => useQuery({ queryKey: keys.market, queryFn: () => api<MarketplaceData>('/marketplace') })
export const useInventory = () => useQuery({ queryKey: keys.inventory, queryFn: () => api<InventoryData>('/inventory') })
export const useRigs = () => useQuery({ queryKey: keys.rigs, queryFn: () => api<RigData[]>('/rigs') })
export const useChallenges = () => useQuery({ queryKey: keys.challenges, queryFn: () => api<ChallengesData>('/challenges') })
export const useProgression = () => useQuery({ queryKey: keys.progression, queryFn: () => api<ProgressionData>('/progression') })
export const useLedger = (limit: number) =>
  useQuery({ queryKey: [...keys.ledger, limit], queryFn: () => api<LedgerData>(`/ledger?limit=${limit}`) })
export const useJobs = () =>
  useQuery({
    queryKey: keys.jobs,
    queryFn: () => api<JobData[]>('/jobs'),
    // Polling-based status: keep refreshing while anything is running.
    refetchInterval: (q) => (q.state.data?.some((j) => j.status === 'RUNNING') ? 1500 : 8000),
  })

interface ActionOptions<TIn, TOut> {
  run: (input: TIn) => Promise<TOut>
  success?: (out: TOut, input: TIn) => string | null
}

/** A mutation that toasts the outcome and refreshes all game data. */
export function useGameAction<TIn, TOut>({ run, success }: ActionOptions<TIn, TOut>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: async (out, input) => {
      const message = success?.(out, input)
      if (message) toast.success(message)
      await Promise.all(ALL_KEYS.map((queryKey) => client.invalidateQueries({ queryKey })))
    },
    onError: (error) => {
      toast.error(errorMessage(error))
      void Promise.all(ALL_KEYS.map((queryKey) => client.invalidateQueries({ queryKey })))
    },
  })
}
