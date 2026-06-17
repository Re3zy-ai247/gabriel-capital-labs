import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The migration is additive/idempotent, but applying schema is privileged. Allow
// it only for a signed-in ADMIN (browser) OR a caller presenting the SETUP_SECRET
// (curl: ?secret= or x-setup-secret header) so it can still be run headlessly.
async function authorize(req: Request): Promise<boolean> {
  if (await requireAdmin()) return true;
  const setup = process.env.SETUP_SECRET;
  if (!setup) return false;
  const url = new URL(req.url);
  const provided = req.headers.get("x-setup-secret") || url.searchParams.get("secret") || "";
  return provided === setup;
}

// Applies the additive billing columns to the User table if they are missing.
// This is a safety net for environments where `prisma db push` did not run
// during the build. Every statement is idempotent (IF NOT EXISTS) and additive
// only — it never drops or alters existing data, so it is safe to run anytime.
const STATEMENTS = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId")`,
  `CREATE TABLE IF NOT EXISTS "ScoreEntry" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     "bureau" "Bureau" NOT NULL,
     "score" INTEGER NOT NULL,
     "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "ScoreEntry_userId_idx" ON "ScoreEntry"("userId")`,
  // Round 2 / bureau-response flow.
  `ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "responseText" TEXT`,
  `ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "responseOutcome" TEXT`,
  `ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "responseAnalysis" TEXT`,
  `ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "responseAt" TIMESTAMP(3)`,
  `ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "parentLetterId" TEXT`,
  // Admin controls: account disabling + the admin audit log.
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "letterCredits" INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "actorId" TEXT NOT NULL,
     "actorEmail" TEXT NOT NULL,
     "action" TEXT NOT NULL,
     "targetType" TEXT,
     "targetId" TEXT,
     "summary" TEXT NOT NULL,
     "metadata" JSONB,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt")`,
  // Broadcast announcements.
  `CREATE TABLE IF NOT EXISTS "Announcement" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "title" TEXT NOT NULL,
     "body" TEXT NOT NULL,
     "tone" TEXT NOT NULL DEFAULT 'info',
     "active" BOOLEAN NOT NULL DEFAULT true,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "Announcement_active_idx" ON "Announcement"("active")`,
  // Agency Community Hub — threads + replies (Kai replies have isKai=true).
  `CREATE TABLE IF NOT EXISTS "CommunityThread" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "authorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
     "authorName" TEXT NOT NULL,
     "category" TEXT NOT NULL DEFAULT 'general',
     "title" TEXT NOT NULL,
     "body" TEXT NOT NULL,
     "pinned" BOOLEAN NOT NULL DEFAULT false,
     "locked" BOOLEAN NOT NULL DEFAULT false,
     "replyCount" INTEGER NOT NULL DEFAULT 0,
     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "CommunityThread_pinned_lastActivityAt_idx" ON "CommunityThread"("pinned", "lastActivityAt")`,
  `CREATE INDEX IF NOT EXISTS "CommunityThread_category_idx" ON "CommunityThread"("category")`,
  `CREATE TABLE IF NOT EXISTS "CommunityReply" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "threadId" TEXT NOT NULL REFERENCES "CommunityThread"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     "authorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
     "authorName" TEXT NOT NULL,
     "body" TEXT NOT NULL,
     "isKai" BOOLEAN NOT NULL DEFAULT false,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "CommunityReply_threadId_createdAt_idx" ON "CommunityReply"("threadId", "createdAt")`,
];

async function run() {
  const applied: string[] = [];
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    applied.push(sql.replace(/\s+/g, " ").slice(0, 80));
  }
  return applied;
}

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  try {
    const applied = await run();
    return NextResponse.json({ ok: true, applied });
  } catch (e) {
    console.error("migrate error", e);
    return NextResponse.json(
      { error: "Migration failed.", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
