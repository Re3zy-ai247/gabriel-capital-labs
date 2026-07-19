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
