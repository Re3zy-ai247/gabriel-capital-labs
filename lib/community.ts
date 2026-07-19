import { currentAccount } from "./session";
import { prisma } from "./prisma";
import { isPremium } from "./entitlements";
import { deleteAttachmentsFor } from "./attachments";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "./communityShared";

export { CATEGORIES, CATEGORY_KEYS, type Category };

// The Operator Network is for every PAYING CreditVector member (founder decision,
// Phase 1.1) plus the platform owner/ADMIN. Paid status comes from the ONE
// canonical predicate — lib/entitlements.isPremium (plan + isAgency + active
// subscription states) — never re-derived here, so billing truth cannot drift.
// Fail-closed: unpaid, expired, or canceled accounts get nothing. A delinquent
// (past_due) account KEEPS access during Stripe's payment-retry grace window —
// past_due is in ACTIVE_SUBSCRIPTION_STATES (lib/os/host/billingTier.ts) and is
// cleared back to a live status (or canceled) by the invoice webhook handlers.
// A managed client (a consumer worked by an agency) is NOT itself a paying
// member — its own row carries no paid plan — so it does not gain access; the
// agency inheritance in getEntitlement() is deliberately NOT consulted here.
//
// Authorship always uses currentAccount() — the REAL signed-in account — never an
// impersonated client or an opened client workspace, so posts are attributed to
// the member, not to a consumer being managed.

export type CommunityAccount = NonNullable<Awaited<ReturnType<typeof currentAccount>>>;

export function canAccessCommunity(account: {
  role?: string | null;
  isAgency?: boolean | null;
  plan?: string | null;
  subscriptionStatus?: string | null;
} | null): boolean {
  if (!account) return false;
  if (account.role === "ADMIN") return true;
  return isPremium(account);
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
  `CREATE TABLE IF NOT EXISTS "CommunityReport" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "targetType" TEXT NOT NULL,
     "targetId" TEXT NOT NULL,
     "threadId" TEXT NOT NULL,
     "reporterId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
     "reporterName" TEXT NOT NULL,
     "reason" TEXT,
     "status" TEXT NOT NULL DEFAULT 'open',
     "resolvedById" TEXT,
     "resolvedAt" TIMESTAMP(3),
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "CommunityReport_status_createdAt_idx" ON "CommunityReport"("status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "CommunityReport_targetType_targetId_idx" ON "CommunityReport"("targetType", "targetId")`,
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

// Display name for a member in the Operator Network: the agency brand if the
// account has one, falling back to the account name, then a population-neutral
// default — the network is open to ALL paying members (Phase 1.1), so the
// fallback must never imply an agency affiliation. Snapshotted at post time;
// historical agency-era rows keep their (then-accurate) snapshots.
export function communityDisplayName(account: {
  agencyName?: string | null;
  name?: string | null;
}): string {
  return (account.agencyName?.trim() || account.name?.trim() || "Member").slice(0, 80);
}

export function normalizeCategory(value: unknown): string {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  return CATEGORY_KEYS.includes(v) ? v : "general";
}

export const LIMITS = {
  title: 140,
  body: 8000,
  reply: 6000,
  reportReason: 1000,
};

// Collapse whitespace runs of 3+ blank lines and hard-trim to a max length.
export function cleanText(input: unknown, max: number): string {
  const s = typeof input === "string" ? input : "";
  return s.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

export type ReportTargetType = "thread" | "reply";

// Resolve (close) any OPEN reports pointing at the given targets — called whenever
// the underlying content is removed, so the moderation queue never shows a report
// whose content is already gone.
async function resolveOpenReports(targets: { type: ReportTargetType; id: string }[]): Promise<void> {
  if (!targets.length) return;
  await prisma.communityReport.updateMany({
    where: { status: "open", OR: targets.map((t) => ({ targetType: t.type, targetId: t.id })) },
    data: { status: "actioned", resolvedAt: new Date() },
  });
}

// Delete a thread and everything that hangs off it: its replies cascade via the FK,
// but their encrypted attachments (no FK) and any open reports must be swept in
// code. Shared by the author/admin delete route and the admin moderation queue.
export async function deleteThreadAndAttachments(threadId: string): Promise<void> {
  const replyIds = (
    await prisma.communityReply.findMany({ where: { threadId }, select: { id: true } })
  ).map((r) => r.id);
  await prisma.communityThread.delete({ where: { id: threadId } });
  await deleteAttachmentsFor("community_thread", [threadId]);
  await deleteAttachmentsFor("community_reply", replyIds);
  await resolveOpenReports([
    { type: "thread", id: threadId },
    ...replyIds.map((id) => ({ type: "reply" as const, id })),
  ]);
}

// Delete a single reply, sweep its attachment, keep the parent replyCount in sync,
// and close any open reports against it.
export async function deleteReplyAndAttachments(replyId: string, threadId: string): Promise<void> {
  await prisma.communityReply.delete({ where: { id: replyId } });
  await deleteAttachmentsFor("community_reply", [replyId]);
  await prisma.communityThread.update({
    where: { id: threadId },
    data: { replyCount: { decrement: 1 } },
  });
  await resolveOpenReports([{ type: "reply", id: replyId }]);
}
