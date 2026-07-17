// GIOS kernel — quota resolution (Platform Phase B, B2). Pure mechanism.
// A limit is data on a TierGrant; this is the single evaluator every app uses.
// null limit = unlimited. Fail-closed: an ABSENT limit key counts as 0 (grant
// nothing that was never declared), never as unlimited.
import type { LimitKey, TierGrant } from "./tiers";

export interface QuotaDecision {
  allowed: boolean;
  limit: number | null; // null = unlimited
  used: number;
  remaining: number | null; // null = unlimited
}

export function withinLimit(grant: TierGrant, key: LimitKey, used: number): QuotaDecision {
  const limit = grant.limits.has(key) ? (grant.limits.get(key) as number | null) : 0;
  if (limit === null) return { allowed: true, limit: null, used, remaining: null };
  const remaining = Math.max(0, limit - used);
  return { allowed: used < limit, limit, used, remaining };
}
