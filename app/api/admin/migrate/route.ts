import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
];

async function run() {
  const applied: string[] = [];
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    applied.push(sql.replace(/\s+/g, " ").slice(0, 80));
  }
  return applied;
}

export async function POST() {
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

export async function GET() {
  return POST();
}
