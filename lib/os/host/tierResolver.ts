// GIOS host — Tier Resolver (Platform Phase B, B2). MECHANISM, app-agnostic.
// Pure function of (tier, matrix): no clock, no randomness, no I/O — preserves
// byte-identical replay. The matrix is INJECTED by the consuming application
// (ownership boundary: GIOS never imports product data; dependency points
// product → platform only). The PEP consumes the resolved EntitlementSnapshot;
// plan names are never the authorization primitive.
//
// Fail-closed: an unknown/absent tier resolves to the matrix's weakest bundle
// ("explorer" by convention), never to a permissive default.
import type { EntitlementSnapshot } from "@/lib/os/kernel";
import type { LimitKey, PlanTier, TierCapabilityMatrix, TierGrant } from "@/lib/os/kernel/tiers";
import { withinLimit } from "@/lib/os/kernel/quota";

export const FALLBACK_TIER: PlanTier = "explorer";

export function grantForTier(tier: PlanTier | null | undefined, matrix: TierCapabilityMatrix): TierGrant {
  return matrix[tier ?? FALLBACK_TIER] ?? matrix[FALLBACK_TIER];
}

/** Resolve a tier to the kernel's EntitlementSnapshot (built once per request, R3). */
export function snapshotForTier(tier: PlanTier | null | undefined, matrix: TierCapabilityMatrix): EntitlementSnapshot {
  const g = grantForTier(tier, matrix);
  return {
    grantedCapabilities: g.capabilities,
    flags: g.flags,
    grantedPermissions: g.permissions,
  };
}

/** Read a quantitative limit for a tier — delegates to the kernel's single
 *  quota law (withinLimit): absent key = 0 (fail-closed), null = unlimited. */
export function limitForTier(tier: PlanTier | null | undefined, matrix: TierCapabilityMatrix, key: LimitKey): number | null {
  return withinLimit(grantForTier(tier, matrix), key, 0).limit;
}
