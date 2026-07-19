// Client-safe community constants (no server-only imports), shared by the API
// routes and the React components so the category set never drifts.

export interface Category {
  key: string;
  label: string;
  blurb: string;
}

// Fixed category set (stored as a plain String on the thread — no DB enum, so
// adding a category never needs a migration). KEYS ARE FROZEN storage values;
// labels are the customer-facing WORKSPACE names (Operator Network Phase 1.2 —
// rooms inside headquarters, never chat channels). Bylines stay factual and
// process-language (CROA: records and process, never promised outcomes).
export const CATEGORIES: Category[] = [
  { key: "general", label: "Operations Floor", blurb: "Introductions, announcements, and the day-to-day of running your credit work." },
  { key: "wins", label: "Success Intelligence", blurb: "Member-reported results and what actually happened — records, never promises." },
  { key: "strategy", label: "Strategy Council", blurb: "Dispute tactics, round sequencing, and escalation — argued with receipts." },
  { key: "tools", label: "Operations Lab", blurb: "Workflows, setups, and getting the most out of CreditVector." },
  { key: "questions", label: "Kai Intelligence", blurb: "Ask Kai anything about the system — answered with statutes and process." },
];

// The default workspace (no filter) — the whole network's attention queue.
export const BRIEFING_ROOM = { key: "", label: "Executive Briefing", blurb: "Everything that requires attention across the network." } as const;

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? "General";
}
