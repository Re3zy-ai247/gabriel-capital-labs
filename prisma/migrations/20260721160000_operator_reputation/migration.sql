-- Operator Reputation — durable Vector XP ledger (Sprint 10). Additive-only: 2 new
-- tables + indexes + FKs onto OperatorIdentity. 0 DROP; no existing table altered.
-- Owner-gated: applied via `prisma migrate deploy` after the operator_identity
-- migration, never at build time; dormant behind OPERATOR_REPUTATION_ENABLED.

-- CreateTable
CREATE TABLE "XpAward" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "awardKind" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "reversesId" TEXT,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationMilestone" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "milestoneKey" TEXT NOT NULL,
    "xpAtAchieve" INTEGER NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "XpAward_subjectId_operatorId_awardKind_key" ON "XpAward"("subjectId", "operatorId", "awardKind");

-- CreateIndex
CREATE INDEX "XpAward_operatorId_createdAt_id_idx" ON "XpAward"("operatorId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReputationMilestone_operatorId_milestoneKey_key" ON "ReputationMilestone"("operatorId", "milestoneKey");

-- CreateIndex
CREATE INDEX "ReputationMilestone_operatorId_idx" ON "ReputationMilestone"("operatorId");

-- AddForeignKey
ALTER TABLE "XpAward" ADD CONSTRAINT "XpAward_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "OperatorIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationMilestone" ADD CONSTRAINT "ReputationMilestone_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "OperatorIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
