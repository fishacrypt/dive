/**
 * Response types shared by the UI. They are derived from the server services
 * with type-only imports, so the client never bundles server code.
 */
import type { getDashboard } from '@/server/services/dashboard'
import type { listMarketplace, listInventory, upgradeItem, purchaseEquipment } from '@/server/services/marketplace'
import type { listRigs } from '@/server/services/rigs'
import type { listChallenges, generateInstance } from '@/server/services/challenges'
import type { listJobs, claimJob } from '@/server/services/jobs'
import type { listLedger } from '@/server/services/ledger'
import type { getProgression } from '@/server/services/progression'

type Resolved<T extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<T>>

export type DashboardData = Resolved<typeof getDashboard>
export type MarketplaceData = Resolved<typeof listMarketplace>
export type MarketItem = MarketplaceData['items'][number]
export type InventoryData = Resolved<typeof listInventory>
export type InventoryEntry = InventoryData[number]
export type RigData = Resolved<typeof listRigs>[number]
export type ChallengesData = Resolved<typeof listChallenges>
export type ChallengeDefinitionData = ChallengesData['definitions'][number]
export type ChallengeInstanceData = Resolved<typeof generateInstance>
export type JobData = Resolved<typeof listJobs>[number]
export type LedgerData = Resolved<typeof listLedger>
export type LedgerRow = LedgerData['entries'][number]
export type ProgressionData = Resolved<typeof getProgression>
export type PurchaseResult = Resolved<typeof purchaseEquipment>
export type UpgradeResult = Resolved<typeof upgradeItem>
export type ClaimResult = Resolved<typeof claimJob>
