import { currentAccount } from "./session";
import { prisma } from "./prisma";
import { deleteAttachmentsFor } from "./attachments";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "./communityShared";
import { applyCompliance } from "./compliance";

export { CATEGORIES, CATEGORY_KEYS, type Category };

// ── RC1-S6a · THE OPERATOR NETWORK IS OFF (Founder D-8 / P1-36) ──────────────
//
// This module used to gate the network on the canonical paid predicate in
// lib/entitlements — a membership check that answered "no" with a 403 saying
// members only. That is a
// paywall wearing a 403, and under the free-consumer law no such refusal may
// exist. The billing predicate is not consulted here any more, at all.
//
// The Founder's decision is that community is OFF, not that it is priced. So the
// gate is now a plain feature switch:
//   · COMMUNITY_ENABLED absent or anything but "true"  → the feature is off, for
//     everyone, and every surface says so in those words. Fail-closed by default.
//   · COMMUNITY_ENABLED="true"                         → every SIGNED-IN account
//     may use it. There is no tier, no plan, no payer.
//
// NOTHING IS DELETED. Threads, replies, reports and attachments stay exactly
// where they are, and the routes stay mounted, so turning the switch back on
// restores the network intact.
//
// AUTHOR DATA-CONTROL IS NOT PART OF THE SWITCH. A member who posted something
// must be able to withdraw it whether or not the feature is available — see
// requireCommunityAuthor() below. "The feature is off" must never become "you
// cannot take your own words down."
//
// Authorship always uses currentAccount() — the REAL signed-in account — never an
// impersonated client or an opened client workspace, so posts are attributed to
// the member, not to a consumer being managed.

export type CommunityAccount = NonNullable<Awaited<ReturnType<typeof currentAccount>>>;

/** Absent = off. Only the exact string "true" turns the network on. */
export function communityEnabled(): boolean {
  return process.env.COMMUNITY_ENABLED === "true";
}

// The ONE refusal string for a switched-off network. Truthful and non-commercial:
// it states availability and nothing about membership, payment or tiers.
export const COMMUNITY_UNAVAILABLE = "Community is not available right now.";

export function canAccessCommunity(account: {
  role?: string | null;
} | null): boolean {
  if (!account) return false;
  // STAFF MODERATION, not a tier. An ADMIN keeps access while the network is
  // switched off so already-published content stays moderatable — a report filed
  // the day before the switch must not become impossible to action, and content
  // that has to come down must still be reachable. This is a role, never a plan:
  // no amount of paying makes an account an ADMIN, and no ADMIN is a consumer.
  if (account.role === "ADMIN") return true;
  return communityEnabled();
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
// correct gate for every READ or NEW-CONTENT /api/community/* route; also
// self-heals the Hub schema on first access so the feature works without a
// manual migrate. Fail-closed while the network is switched off.
export async function requireCommunityAccount(): Promise<CommunityAccount | null> {
  const account = await currentAccount();
  if (!account || !canAccessCommunity(account)) return null;
  await ensureCommunityTables();
  return account;
}

/**
 * THE AUTHOR CARVE-OUT. Returns the signed-in account WITHOUT asking whether the
 * network is switched on, for the one class of action that must never be gated
 * by availability: removing content you yourself posted (and admin moderation of
 * content someone reported before the switch flipped).
 *
 * The caller still has to prove authorship — this grants no read, no write and
 * no new content, only an identity to compare against `authorId`. Order matters
 * in the routes: resolve the author, check ownership, THEN (and only for a
 * non-author) refuse. Checking availability first is what would trap a member's
 * own words behind a feature switch.
 */
export async function requireCommunityAuthor(): Promise<CommunityAccount | null> {
  const account = await currentAccount();
  if (!account) return null;
  await ensureCommunityTables();
  return account;
}

// Display name for a member in the Operator Network: the agency brand if the
// account has one, falling back to the account name, then a population-neutral
// default — the network carries no tiers, so the fallback must never imply an
// agency affiliation. Snapshotted at post time; historical agency-era rows keep
// their (then-accurate) snapshots.
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

// CROA screen for member-authored network text. Members post their OWN words, so a
// prohibited claim is REJECTED, never silently reworded — the platform must not
// host the claim and must not put words in a member's mouth. Mirrors the Brief's
// screenCommentBody (lib/brief.ts) so both member-authored surfaces hold one bar.
// (The letter engine keeps substitute-and-show: there the user reviews and approves
// the final text before it goes anywhere, so rewriting is visible, not silent.)
// Pure — no DB — so it stays unit-testable.
export const COMMUNITY_CLAIM_ERROR =
  "Posts can't promise guaranteed deletions or score increases, cite §609/Metro-2 deletion myths, " +
  "or state legal conclusions. Please rephrase as your own experience or question.";

export function screenCommunityText(...parts: string[]): { ok: true } | { ok: false; error: string } {
  const joined = parts.filter(Boolean).join("\n\n");
  if (!joined) return { ok: true };
  const { flags } = applyCompliance(joined);
  if (flags.length > 0) return { ok: false, error: COMMUNITY_CLAIM_ERROR };
  return { ok: true };
}

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
