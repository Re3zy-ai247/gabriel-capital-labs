// CreditVector team persistence (Platform Phase B, Sprint 3) — PRODUCT-SIDE
// store for the GIOS team mechanism. Holds the prisma dependency + raw self-heal
// DDL (ADR-0001) that must NOT live in the GIOS zone (hexagonal ports law).
// DORMANT: every entry point throws before touching the DB unless
// TEAM_FOUNDATION=true (fail-closed).
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { teamFoundationEnabled, type Invitation, type TeamRole } from "@/lib/os/platform/teams";

let ready = false;
async function ensureTables(): Promise<void> {
  if (!teamFoundationEnabled()) throw new Error("TEAM_FOUNDATION is disabled");
  if (ready) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id" TEXT PRIMARY KEY, "orgId" TEXT NOT NULL, "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE ("orgId", "userId"))`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TeamMember_orgId_idx" ON "TeamMember"("orgId")`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "TeamInvitation" (
    "id" TEXT PRIMARY KEY, "orgId" TEXT NOT NULL, "email" TEXT NOT NULL,
    "role" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "expiresAt" TIMESTAMP NOT NULL)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ClientAssignment" (
    "orgId" TEXT NOT NULL, "clientUserId" TEXT NOT NULL, "operatorUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP NOT NULL DEFAULT NOW(), PRIMARY KEY ("orgId", "clientUserId"))`);
  ready = true;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvitation(orgId: string, email: string, role: TeamRole): Promise<Invitation> {
  await ensureTables();
  const inv: Invitation = {
    id: randomUUID(), orgId, email: email.trim().toLowerCase(), role,
    status: "pending", createdAt: new Date(), expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TeamInvitation" ("id","orgId","email","role","status","createdAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    inv.id, inv.orgId, inv.email, inv.role, inv.status, inv.createdAt, inv.expiresAt
  );
  return inv;
}

export async function listMembers(orgId: string): Promise<Array<{ id: string; userId: string; role: TeamRole; createdAt: Date }>> {
  await ensureTables();
  return prisma.$queryRawUnsafe(`SELECT "id","userId","role","createdAt" FROM "TeamMember" WHERE "orgId" = $1 ORDER BY "createdAt", "id"`, orgId);
}

export async function assignClient(orgId: string, clientUserId: string, operatorUserId: string): Promise<void> {
  await ensureTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ClientAssignment" ("orgId","clientUserId","operatorUserId") VALUES ($1,$2,$3)
     ON CONFLICT ("orgId","clientUserId") DO UPDATE SET "operatorUserId" = $3, "assignedAt" = NOW()`,
    orgId, clientUserId, operatorUserId
  );
}
