// Client-safe CreditVector Brief constants (no server-only imports) — shared by the
// API routes and the React components so the category set + disclaimer never drift.
// Mirrors lib/communityShared.ts.

export interface BriefCategory {
  key: string;
  label: string;
}

// Fixed category set (stored as a plain String on the article — no DB enum, so
// adding a category never needs a migration).
export const BRIEF_CATEGORIES: BriefCategory[] = [
  { key: "fcra", label: "FCRA" },
  { key: "cfpb", label: "CFPB" },
  { key: "ftc", label: "FTC" },
  { key: "bureau-lawsuits", label: "Credit Bureau Lawsuits" },
  { key: "bank-lawsuits", label: "Bank Lawsuits" },
  { key: "debt-collection", label: "Debt Collection" },
  { key: "reporting-errors", label: "Credit Reporting Errors" },
  { key: "identity-theft", label: "Identity Theft" },
  { key: "consumer-rights", label: "Consumer Rights" },
  { key: "repair-compliance", label: "Credit Repair Compliance" },
  { key: "state-cso", label: "State Credit-Services Laws" },
  { key: "agency-alerts", label: "Agency Compliance Alerts" },
];

export const BRIEF_CATEGORY_KEYS = BRIEF_CATEGORIES.map((c) => c.key);

export function briefCategoryLabel(key: string): string {
  return BRIEF_CATEGORIES.find((c) => c.key === key)?.label ?? "News";
}

export function normalizeBriefCategory(value: unknown): string {
  const v = typeof value === "string" ? value.toLowerCase().trim() : "";
  return BRIEF_CATEGORY_KEYS.includes(v) ? v : "consumer-rights";
}

// Required, verbatim, on every Brief surface (feed cards + article detail pages).
export const BRIEF_DISCLAIMER =
  "This is an educational news summary and does not constitute legal advice.";

export const BRIEF_LIMITS = {
  title: 200,
  summary: 12000,
  caption: 400,
  source: 600,
  tag: 40,
  tags: 8,
};

// Stateless cover-image URL for an article (title + category label drive the art).
// Served by app/api/brief/cover; used as the visible cover AND the Open Graph image.
export function briefCoverUrl(title: string, categoryLabel: string): string {
  const p = new URLSearchParams({ title: title.slice(0, 160), category: categoryLabel.slice(0, 40) });
  return `/api/brief/cover?${p.toString()}`;
}

// ---- Optional YouTube video embed (official player only) ------------------
// Legal posture: we embed via YouTube's own player; we never download or
// re-host video. Parsing is host-allowlisted so a stored videoUrl can only ever
// produce an iframe pointed at YouTube — never an arbitrary origin.

const YT_ID = /^[A-Za-z0-9_-]{11}$/; // YouTube video ids are 11 url-safe chars.

// Extract the 11-char video id from the common YouTube URL shapes, or null if the
// input isn't a YouTube link. Used to validate admin input AND to build the embed.
export function youtubeVideoId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "").toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") {
    id = u.pathname.split("/").filter(Boolean)[0] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") {
      id = u.searchParams.get("v");
    } else {
      const parts = u.pathname.split("/").filter(Boolean); // ['embed', ID] | ['shorts', ID] | ['v', ID]
      if (parts.length === 2 && (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "v")) id = parts[1];
    }
  }
  return id && YT_ID.test(id) ? id : null;
}

// Canonical watch URL to store (human-friendly), or null when not a YouTube link.
export function normalizeYouTubeUrl(input: unknown): string | null {
  const id = youtubeVideoId(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

// Privacy-enhanced no-cookie player; rel=0 keeps related videos to the same channel.
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}

// ---- Engagement (likes + bookmarks) ---------------------------------------
export const BRIEF_REACTION_KINDS = ["like", "bookmark"] as const;
export type BriefReactionKind = (typeof BRIEF_REACTION_KINDS)[number];

export function isBriefReactionKind(v: unknown): v is BriefReactionKind {
  return typeof v === "string" && (BRIEF_REACTION_KINDS as readonly string[]).includes(v);
}

// ---- Comments (Phase 2b) --------------------------------------------------
export const BRIEF_COMMENT_LIMITS = { body: 1500, min: 2, reportReason: 300 };

// Verbatim near the comment composer + above the list. Frames comments as reader
// opinions (not CreditVector advice) and that they post without prior review —
// the UGC half of the post-moderation compliance posture.
export const BRIEF_COMMENT_DISCLAIMER =
  "Comments are posted by CreditVector readers and reflect their own opinions — not legal or financial advice from CreditVector, and not reviewed or verified before they appear. Individual experiences vary and aren't typical or guaranteed. Keep it respectful and on-topic, and report anything that breaks the rules.";

// The comment shape sent to the client, shared so server + client agree.
export interface BriefCommentData {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  canDelete: boolean;
}

// The card shape sent to the client (feed + API), shared so server + client agree.
export interface BriefCardData {
  slug: string;
  title: string;
  category: string;
  categoryLabel: string;
  tags: string[];
  sourceName: string;
  sourceUrl: string;
  excerpt: string;
  featured: boolean;
  views: number;
  likeCount: number;
  publishedAt: string | null;
}
