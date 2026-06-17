import { currentAccount } from "./session";
import { prisma } from "./prisma";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "./communityShared";

export { CATEGORIES, CATEGORY_KEYS, type Category };

// The Agency Community Hub is members-only: open to AGENCY subscribers (the
// $399/mo Agency and Agency Pro tiers set isAgency via the Stripe webhook) and to
// the platform owner/ADMIN. Regular Premium customers do not have access.
//
// Authorship always uses currentAccount() — the REAL signed-in agency — never an
// impersonated client or an opened client workspace, so posts are attributed to
// the agency, not to a consumer being managed.

export type CommunityAccount = NonNullable<Awaited<ReturnType<typeof currentAccount>>>;

export function canAccessCommunity(account: {
  role?: string | null;
  isAgency?: boolean | null;
  plan?: string | null;
} | null): boolean {
  if (!account) return false;
  if (account.role === "ADMIN") return true;
  if (account.isAgency) return true;
  return account.plan === "agency" || account.plan === "agency_pro";
}

// Community tables are created lazily at runtime — CREATE TABLE IF NOT EXISTS via
// raw SQL works through the Prisma Accelerate proxy even though build-time
// `prisma db push` does not. This self-heals the Hub on first access, so no
// manual migrate step is ever required. Statements mirror app/api/admin/migrate.
const COMMUNITY_DDL = [
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

let communityTablesReady = false;
export async function ensureCommunityTables(): Promise<void> {
  if (communityTablesReady) return;
  for (const sql of COMMUNITY_DDL) {
    await prisma.$executeRawUnsafe(sql);
  }
  communityTablesReady = true;
}

// Returns the signed-in account IFF it may use the community, else null. The
// correct gate for every /api/community/* route; also self-heals the Hub schema
// on first access so the feature works without a manual migrate.
export async function requireCommunityAccount(): Promise<CommunityAccount | null> {
  const account = await currentAccount();
  if (!account || !canAccessCommunity(account)) return null;
  await ensureCommunityTables();
  return account;
}

// Display name for an agency in the hub: its brand, falling back to the account
// name, then a neutral default. Snapshotted onto each thread/reply at post time.
export function communityDisplayName(account: {
  agencyName?: string | null;
  name?: string | null;
}): string {
  return (account.agencyName?.trim() || account.name?.trim() || "Agency Member").slice(0, 80);
}

export function normalizeCategory(value: unknown): string {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  return CATEGORY_KEYS.includes(v) ? v : "general";
}

export const LIMITS = {
  title: 140,
  body: 8000,
  reply: 6000,
};

// Collapse whitespace runs of 3+ blank lines and hard-trim to a max length.
export function cleanText(input: unknown, max: number): string {
  const s = typeof input === "string" ? input : "";
  return s.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}
