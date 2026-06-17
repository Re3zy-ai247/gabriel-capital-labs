import { currentAccount } from "./session";
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

// Returns the signed-in account IFF it may use the community, else null. The
// correct gate for every /api/community/* route.
export async function requireCommunityAccount(): Promise<CommunityAccount | null> {
  const account = await currentAccount();
  if (!account || !canAccessCommunity(account)) return null;
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
