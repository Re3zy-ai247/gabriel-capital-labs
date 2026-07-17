// CreditVector device/session persistence (Platform Phase B, Sprint 4) —
// PRODUCT-SIDE store for the GIOS session mechanism (prisma + self-heal DDL,
// ADR-0001). DORMANT: every entry point throws before touching the DB unless
// SESSION_FOUNDATION=true (fail-closed). Privacy: nickname (clamped) + coarse
// platform class only — no fingerprints, no IPs, no secrets.
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import {
  sessionFoundationEnabled, DEVICE_PLATFORMS,
  type DevicePlatform, type DeviceRecord, type SessionRecord, type RiskSink,
} from "@/lib/os/platform/sessions";

let ready = false;
async function ensureTables(): Promise<void> {
  if (!sessionFoundationEnabled()) throw new Error("SESSION_FOUNDATION is disabled");
  if (ready) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserDevice" (
    "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "nickname" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL, "trusted" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "lastSeenAt" TIMESTAMP NOT NULL DEFAULT NOW())`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserDevice_userId_idx" ON "UserDevice"("userId")`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserSession" (
    "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "lastSeenAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "revokedAt" TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserSession_userId_idx" ON "UserSession"("userId")`);
  ready = true;
}

export async function registerDevice(userId: string, platform: DevicePlatform, nickname = ""): Promise<DeviceRecord> {
  await ensureTables();
  // Same input hardening as setDeviceNickname; unknown platform fail-closes to "browser".
  const safePlatform: DevicePlatform = DEVICE_PLATFORMS.has(platform) ? platform : "browser";
  const safeNickname = nickname.slice(0, 60);
  const d: DeviceRecord = { id: randomUUID(), userId, nickname: safeNickname, platform: safePlatform, trusted: false, createdAt: new Date(), lastSeenAt: new Date() };
  await prisma.$executeRawUnsafe(
    `INSERT INTO "UserDevice" ("id","userId","nickname","platform","trusted","createdAt","lastSeenAt") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    d.id, d.userId, d.nickname, d.platform, d.trusted, d.createdAt, d.lastSeenAt
  );
  return d;
}

export async function listSessions(userId: string): Promise<SessionRecord[]> {
  await ensureTables();
  return prisma.$queryRawUnsafe(
    `SELECT "id","userId","deviceId","createdAt","lastSeenAt","revokedAt" FROM "UserSession" WHERE "userId" = $1 ORDER BY "lastSeenAt" DESC, "id"`,
    userId
  );
}

/** Remote logout: revocation is a tombstone — sessions are never deleted (audit trail). */
export async function revokeSession(userId: string, sessionId: string, risk?: RiskSink): Promise<void> {
  await ensureTables();
  await prisma.$executeRawUnsafe(
    `UPDATE "UserSession" SET "revokedAt" = NOW() WHERE "id" = $1 AND "userId" = $2 AND "revokedAt" IS NULL`,
    sessionId, userId
  );
  risk?.({ kind: "remote_logout", userId, at: new Date() });
}

export async function setDeviceNickname(userId: string, deviceId: string, nickname: string): Promise<void> {
  await ensureTables();
  await prisma.$executeRawUnsafe(
    `UPDATE "UserDevice" SET "nickname" = $1 WHERE "id" = $2 AND "userId" = $3`,
    nickname.slice(0, 60), deviceId, userId
  );
}

/** Expired/stale sessions never consume capacity: activity refresh is the caller's duty. */
export async function touchSession(userId: string, sessionId: string): Promise<void> {
  await ensureTables();
  await prisma.$executeRawUnsafe(
    `UPDATE "UserSession" SET "lastSeenAt" = NOW() WHERE "id" = $1 AND "userId" = $2 AND "revokedAt" IS NULL`,
    sessionId, userId
  );
}
