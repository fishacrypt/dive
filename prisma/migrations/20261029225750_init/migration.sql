-- CreateEnum
CREATE TYPE "EquipmentKind" AS ENUM ('CHASSIS', 'PROCESSOR', 'ACCELERATOR', 'MEMORY', 'COOLING', 'PSU');

-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('PATH', 'COLORING', 'KNAPSACK', 'SPANNING_TREE');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('OPEN', 'USED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'CLAIMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LedgerResource" AS ENUM ('CREDITS', 'QUANTA', 'ENERGY');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('GRANT', 'PURCHASE', 'UPGRADE', 'ENERGY_RECHARGE', 'JOB_FEE', 'JOB_ENERGY', 'JOB_REFUND', 'REWARD_CLAIM', 'EXCHANGE', 'ACHIEVEMENT');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "quantaMilli" INTEGER NOT NULL DEFAULT 0,
    "energy" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "EquipmentKind" NOT NULL,
    "tier" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "compute" INTEGER NOT NULL DEFAULT 0,
    "memory" INTEGER NOT NULL DEFAULT 0,
    "powerDraw" INTEGER NOT NULL DEFAULT 0,
    "powerCapacity" INTEGER NOT NULL DEFAULT 0,
    "heat" INTEGER NOT NULL DEFAULT 0,
    "coolingCapacity" INTEGER NOT NULL DEFAULT 0,
    "accelSlots" INTEGER NOT NULL DEFAULT 0,
    "memSlots" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rig" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RigComponent" (
    "id" TEXT NOT NULL,
    "rigId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RigComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "size" INTEGER NOT NULL,
    "baseRewardMq" INTEGER NOT NULL,
    "workUnits" INTEGER NOT NULL,
    "minCompute" INTEGER NOT NULL DEFAULT 0,
    "minMemory" INTEGER NOT NULL DEFAULT 0,
    "feeCredits" INTEGER NOT NULL,
    "energyPar" INTEGER NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeInstance" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiningJob" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rigId" TEXT NOT NULL,
    "challengeInstanceId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "energyCost" INTEGER NOT NULL,
    "feeCredits" INTEGER NOT NULL,
    "effectiveCompute" INTEGER NOT NULL,
    "optimal" BOOLEAN NOT NULL,
    "efficient" BOOLEAN NOT NULL,
    "rewardMq" INTEGER NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "settledAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiningJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardClaim" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "quantaMilli" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "resource" "LedgerResource" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rewardCredits" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAchievement" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_handle_key" ON "Player"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentDefinition_slug_key" ON "EquipmentDefinition"("slug");

-- CreateIndex
CREATE INDEX "EquipmentDefinition_kind_idx" ON "EquipmentDefinition"("kind");

-- CreateIndex
CREATE INDEX "InventoryItem_playerId_idx" ON "InventoryItem"("playerId");

-- CreateIndex
CREATE INDEX "Rig_playerId_idx" ON "Rig"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RigComponent_inventoryItemId_key" ON "RigComponent"("inventoryItemId");

-- CreateIndex
CREATE INDEX "RigComponent_rigId_idx" ON "RigComponent"("rigId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeDefinition_slug_key" ON "ChallengeDefinition"("slug");

-- CreateIndex
CREATE INDEX "ChallengeInstance_playerId_status_idx" ON "ChallengeInstance"("playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MiningJob_challengeInstanceId_key" ON "MiningJob"("challengeInstanceId");

-- CreateIndex
CREATE INDEX "MiningJob_playerId_status_idx" ON "MiningJob"("playerId", "status");

-- CreateIndex
CREATE INDEX "MiningJob_rigId_status_idx" ON "MiningJob"("rigId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MiningJob_playerId_idempotencyKey_key" ON "MiningJob"("playerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_jobId_key" ON "RewardClaim"("jobId");

-- CreateIndex
CREATE INDEX "LedgerEntry_playerId_createdAt_idx" ON "LedgerEntry"("playerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_playerId_idempotencyKey_resource_key" ON "LedgerEntry"("playerId", "idempotencyKey", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementDefinition_slug_key" ON "AchievementDefinition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAchievement_playerId_achievementId_key" ON "PlayerAchievement"("playerId", "achievementId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rig" ADD CONSTRAINT "Rig_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RigComponent" ADD CONSTRAINT "RigComponent_rigId_fkey" FOREIGN KEY ("rigId") REFERENCES "Rig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RigComponent" ADD CONSTRAINT "RigComponent_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeInstance" ADD CONSTRAINT "ChallengeInstance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeInstance" ADD CONSTRAINT "ChallengeInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "ChallengeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiningJob" ADD CONSTRAINT "MiningJob_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiningJob" ADD CONSTRAINT "MiningJob_rigId_fkey" FOREIGN KEY ("rigId") REFERENCES "Rig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiningJob" ADD CONSTRAINT "MiningJob_challengeInstanceId_fkey" FOREIGN KEY ("challengeInstanceId") REFERENCES "ChallengeInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MiningJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "AchievementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written integrity constraints (not expressible in the Prisma schema) --

-- Balances can never go negative, whatever the application code does.
ALTER TABLE "Player" ADD CONSTRAINT "Player_credits_nonneg" CHECK ("credits" >= 0);
ALTER TABLE "Player" ADD CONSTRAINT "Player_quanta_nonneg" CHECK ("quantaMilli" >= 0);
ALTER TABLE "Player" ADD CONSTRAINT "Player_energy_nonneg" CHECK ("energy" >= 0);
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_level_range" CHECK ("level" >= 1 AND "level" <= 3);
ALTER TABLE "MiningJob" ADD CONSTRAINT "MiningJob_reward_nonneg" CHECK ("rewardMq" >= 0 AND "energyCost" >= 0 AND "feeCredits" >= 0);

-- A rig can only run one job at a time.
CREATE UNIQUE INDEX "MiningJob_one_running_per_rig" ON "MiningJob" ("rigId") WHERE "status" = 'RUNNING';

-- Idempotency keys are only unique when present (NULLs never collide in Postgres, which is what we want).
