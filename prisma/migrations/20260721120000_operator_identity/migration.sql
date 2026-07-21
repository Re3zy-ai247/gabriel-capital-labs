-- Operator Identity foundation (Sprint 9). Additive-only: 5 new enum types, 3 new
-- tables, their indexes, and foreign keys onto existing tables. 0 DROP, no column
-- removed/renamed/narrowed on any existing table. Owner-gated: applied via
-- `prisma migrate deploy`, never at build time; dormant behind OPERATOR_IDENTITY_ENABLED.

-- CreateEnum
CREATE TYPE "OperatorState" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('AGENCY', 'ENTERPRISE', 'EDUCATOR', 'VENDOR', 'INTERNAL');

-- CreateEnum
CREATE TYPE "OrganizationState" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipState" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateTable
CREATE TABLE "OperatorIdentity" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "handle" TEXT,
    "state" "OperatorState" NOT NULL DEFAULT 'PENDING',
    "stateReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "ownerAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "OrganizationKind" NOT NULL DEFAULT 'AGENCY',
    "state" "OrganizationState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "state" "MembershipState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperatorIdentity_accountId_key" ON "OperatorIdentity"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorIdentity_handle_key" ON "OperatorIdentity"("handle");

-- CreateIndex
CREATE INDEX "OperatorIdentity_state_idx" ON "OperatorIdentity"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_ownerAccountId_idx" ON "Organization"("ownerAccountId");

-- CreateIndex
CREATE INDEX "Organization_state_idx" ON "Organization"("state");

-- CreateIndex
CREATE INDEX "OrganizationMembership_operatorId_idx" ON "OrganizationMembership"("operatorId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_state_idx" ON "OrganizationMembership"("organizationId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_operatorId_key" ON "OrganizationMembership"("organizationId", "operatorId");

-- AddForeignKey
ALTER TABLE "OperatorIdentity" ADD CONSTRAINT "OperatorIdentity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "OperatorIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
