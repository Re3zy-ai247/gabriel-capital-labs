// Client-safe support constants/helpers (no server-only imports), shared by the
// API routes and the React page so the category set never drifts.

export const SUPPORT_CATEGORIES = [
  { key: "general", label: "General" },
  { key: "billing", label: "Billing & Payments" },
  { key: "technical", label: "Technical / Bug" },
  { key: "account", label: "Account & Login" },
] as const;

export const SUPPORT_CATEGORY_KEYS: string[] = SUPPORT_CATEGORIES.map((c) => c.key);

export function supportCategoryLabel(key: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.key === key)?.label ?? "General";
}

export function normalizeSupportCategory(value: unknown): string {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  return SUPPORT_CATEGORY_KEYS.includes(v) ? v : "general";
}

export const SUPPORT_LIMITS = { subject: 160, body: 6000 };

export function cleanSupportText(input: unknown, max: number): string {
  const s = typeof input === "string" ? input : "";
  return s.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}
