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
  publishedAt: string | null;
}
