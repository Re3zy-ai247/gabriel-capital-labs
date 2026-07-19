// Client-safe community constants (no server-only imports), shared by the API
// routes and the React components so the category set never drifts.

export interface Category {
  key: string;
  label: string;
  blurb: string;
}

// Fixed category set (stored as a plain String on the thread — no DB enum, so
// adding a category never needs a migration). "questions" is where Kai shines.
export const CATEGORIES: Category[] = [
  { key: "general", label: "General", blurb: "Introductions, announcements, and anything else." },
  { key: "wins", label: "Wins", blurb: "Results and success stories — what actually happened." },
  { key: "strategy", label: "Strategy", blurb: "Dispute tactics, round sequencing, and escalation." },
  { key: "tools", label: "Tools & Workflow", blurb: "Using CreditVector efficiently — setups and workflows." },
  { key: "questions", label: "Questions for Kai", blurb: "Ask Kai anything about the system." },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? "General";
}
