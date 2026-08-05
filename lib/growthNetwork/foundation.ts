// CreditVector Growth Network — dormant, pure foundation vocabulary.
//
// This module is intentionally client-safe and effect-free. It owns no identity,
// qualification, reputation, amount, ledger, tax, provider, or payment truth.
// Activation and every economic policy value remain owner-gated by ADR-0039.

export const GROWTH_NETWORK_FOUNDATION_VERSION = 1 as const;

export const GROWTH_NETWORK_PATHS = Object.freeze([
  "AGENCY_BUILDER",
  "PROFESSIONAL_OPERATOR",
] as const);
export type GrowthNetworkPath = (typeof GROWTH_NETWORK_PATHS)[number];

// Identifiers partition future source/accounting semantics. Their presence does not
// mean a product, order, obligation, provider, or payment path exists.
export const GROWTH_REVENUE_STREAMS = Object.freeze([
  "AGENCY_GROWTH_DISTRIBUTION",
  "MARKETPLACE_SALE",
  "COURSE_SALE",
  "EDUCATION_SERVICE",
  "MENTORSHIP",
  "CONSULTING",
  "KAI_ASSET",
  "AFFILIATE_GROWTH",
  "SPONSORSHIP",
  "PARTNERSHIP",
  "ENTERPRISE_PROGRAM",
] as const);
export type GrowthRevenueStream = (typeof GROWTH_REVENUE_STREAMS)[number];

// These inputs can never qualify merely by occurring. The registry is not a complete
// future policy; it pins the founder/compliance refusal boundary in the dormant seam.
export const NON_QUALIFYING_GROWTH_SIGNALS = Object.freeze([
  "RAW_RECRUITMENT",
  "OPERATOR_COUNT",
  "PARTICIPANT_ADDITION",
  "INVITE_SENT",
  "REFERRAL_CLICK",
  "UNPAID_SIGNUP",
  "SELF_REFERRAL",
  "DUPLICATE_ACCOUNT",
  "PARTICIPANT_PURCHASE",
  "PAID_RETENTION",
  "DOWNSTREAM_ACTIVITY",
  "POPULARITY",
  "REVIEW_SENTIMENT",
  "FOLLOWER_COUNT",
  "LOGIN",
  "PAGE_OPEN",
  "MESSAGE_COUNT",
  "HOURS_ONLINE",
] as const);
export type NonQualifyingGrowthSignal = (typeof NON_QUALIFYING_GROWTH_SIGNALS)[number];

export const AGENCY_GROWTH_DISTRIBUTION_DAY_OF_MONTH = 15 as const;

// Input semantics are explicit: this is the DISTRIBUTION month, never an observation
// month or generic cycle id. The function appends day 15 to the same valid YYYY-MM and
// never uses Date, locale, timezone, ambient time, or next-month inference.
export function scheduledAgencyDistributionDate(
  distributionMonth: unknown,
): string | null {
  if (typeof distributionMonth !== "string") return null;
  if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(distributionMonth)) return null;
  return `${distributionMonth}-15`;
}
