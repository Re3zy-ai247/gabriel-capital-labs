// Shared presentational formatting for the Operator Network shell. Pure, no I/O —
// usable from both server components (feed, Now panel) and client islands.

// The presentational thread shape shared by the shell's server components.
// Mirrors the existing /api/community/threads GET payload — no new fields, no
// new semantics; kaiAnswered derives from CommunityReply.isKai as it does there.
export interface OperatorThread {
  id: string;
  title: string;
  category: string;
  authorName: string;
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  kaiAnswered: boolean;
  lastActivityAt: string;
  excerpt: string;
}

// ── Attention-queue ordering (Phase 1.1, founder-approved comparator) ─────────
// The feed is an attention queue, not a chronological social feed. Deterministic,
// derived ONLY from existing authoritative fields — no randomness, no clock reads,
// no client-side reordering:
//   1. pinned (authoritative CommunityThread.pinned)      — explicit priority
//   2. open loop: zero responses AND not locked           — the network's job is
//      closing loops; locked threads can't be answered, so they never queue
//   3. lastActivityAt desc                                — most recent work
//   4. id asc (immutable cuid)                            — stable tie-breaker
export function isOpenLoop(t: Pick<OperatorThread, "replyCount" | "locked">): boolean {
  return t.replyCount === 0 && !t.locked;
}

export function compareThreads(a: OperatorThread, b: OperatorThread): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const aOpen = isOpenLoop(a);
  const bOpen = isOpenLoop(b);
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  const at = new Date(a.lastActivityAt).getTime();
  const bt = new Date(b.lastActivityAt).getTime();
  if (at !== bt) return bt - at;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function timeAgo(iso: string | Date): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
