// Canonical Agency capacity & packaging resolver (ADR-0031 §4). PURE, deterministic,
// side-effect free, ZERO repository imports — so both the live gate
// (lib/entitlements.agencyClientLimit) and the dormant matrix (config/capabilityMatrix)
// consume ONE source of truth and can never drift. Server-authoritative: it accepts
// only values the server already owns (plan/tier, account creation date, an approved
// add-on pack count, an approved Enterprise override). It NEVER accepts a client-supplied
// capacity. Fail-closed on unknown/malformed input.
//
// Packaging eras (a newer era NEVER shrinks a sold cap — ADR-0031 §2.4 grandfather):
//   • v1 legacy  (created < 2026-07-17): Agency "up to 20", Agency Pro "unlimited"  ← real sold entitlements
//   • v2         (2026-07-17 .. 2026-07-18): Agency 15 · Agency Pro 40 · Scale 100    ← grandfathered if any exist
//   • v3         (created ≥ 2026-07-19):     Agency 15 · Agency Pro 30 · Scale 50      ← founder-approved current
// Agency Pro / Scale were "coming soon" (never purchasable), so real accounts on 40/100
// should be zero (Founder gate F-A) — the grandfather mechanism is nonetheless honored.

export type AgencyTier = "agency" | "agency_pro" | "scale" | "enterprise";
export type PackagingVersion = "v1_legacy" | "v2" | "v3";

// Effective dates (UTC). A new packaging version is added here, never by rewriting callers.
export const PACKAGING_V2_EFFECTIVE = Date.UTC(2026, 6, 17); // 2026-07-17
export const PACKAGING_V3_EFFECTIVE = Date.UTC(2026, 6, 19); // 2026-07-19 — ADR-0031 founder packaging

export const ADDON_WORKSPACES_PER_PACK = 10; // ADR-0031: +10 Active Client Workspaces per $100 pack, stackable

// Base workspace caps by era (null = unlimited/negotiated). Scale is 50 in v1_legacy
// because Scale did not exist before v2 — there is no real legacy Scale cap to preserve.
const BASE_V3 = { agency: 15, agency_pro: 30, scale: 50 } as const;
const BASE_V2 = { agency: 15, agency_pro: 40, scale: 100 } as const;
const BASE_V1 = { agency: 20, agency_pro: null, scale: 50 } as const;

/** Canonical v3 base — the value the CURRENT packaging grants a NEW account. The
 *  capability matrix imports this so the dormant declaration cannot drift from the live gate. */
export const WORKSPACE_BASE_V3: { readonly agency: number; readonly agency_pro: number; readonly scale: number } = BASE_V3;

/** Founder-approved staff seats per tier. DECLARATION-ONLY: enforcement depends on the
 *  dormant Team Foundation (multi-seat) and is NOT implemented here. This is NOT the same
 *  axis as CONCURRENT_SESSION_LIMIT (a per-user device cap). Enterprise = custom (null). */
export const STAFF_USER_LIMIT: { readonly agency: number; readonly agency_pro: number; readonly scale: number } = {
  agency: 1,
  agency_pro: 3,
  scale: 5,
};

export interface AgencyCapacityInput {
  plan?: string | null; // subscription plan id (server)
  isAgency?: boolean | null; // account is an agency (server)
  createdAt?: Date | string | number | null; // account creation (server)
  addonPackCount?: number | null; // approved add-on packs (server; default 0 — no storage yet)
  enterpriseWorkspaceOverride?: number | null; // server-approved Enterprise workspace cap
  enterpriseStaffOverride?: number | null; // server-approved Enterprise staff cap
}

export interface AgencyCapacity {
  workspaceLimit: number | null; // null = unlimited/negotiated
  staffUserLimit: number | null; // null = custom (Enterprise); declaration-only
  baseWorkspaceLimit: number | null;
  addonWorkspaceLimit: number;
  addonPackCount: number;
  packagingVersion: PackagingVersion;
  grandfathered: boolean; // true when the base differs from the current v3 base for this tier
  source: "resolver";
}

// Tier precedence mirrors the live gate exactly: enterprise/scale/agency_pro resolve by
// PLAN; a plain agency resolves by the isAgency FLAG (never by plan==="agency" alone, so a
// bare {plan:"agency", isAgency:false} shape stays non-agency → 0). Unknown ⇒ null (fail closed).
function normTier(input: AgencyCapacityInput): AgencyTier | null {
  if (input.plan === "enterprise") return "enterprise";
  if (input.plan === "scale") return "scale";
  if (input.plan === "agency_pro") return "agency_pro";
  if (input.isAgency === true) return "agency";
  return null;
}

function packagingVersionFor(createdMs: number): PackagingVersion {
  if (createdMs >= PACKAGING_V3_EFFECTIVE) return "v3";
  if (createdMs >= PACKAGING_V2_EFFECTIVE) return "v2";
  return "v1_legacy";
}

// Add-on packs are capacity-only and server-validated. Malformed/negative ⇒ 0 (fail closed):
// a bad count must never grant capacity. ADR-0031 authorizes normalize-to-zero for the count.
function normalizePacks(n: number | null | undefined): number {
  // Strict fail-closed: only a non-negative INTEGER grants capacity. Negative, fractional,
  // NaN, Infinity, or non-number ⇒ 0. A malformed count must never grant a workspace.
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0) return 0;
  return n;
}

/**
 * Resolve an agency account's capacity. Pure and deterministic: identical input ⇒
 * identical output, no I/O. `null` workspaceLimit means unlimited/negotiated (add-on is
 * meaningless on unlimited and is not applied). Missing createdAt is treated as the current
 * (v3) packaging — fail-closed to the smallest current base, never an accidental grandfather.
 */
export function resolveAgencyCapacity(input: AgencyCapacityInput): AgencyCapacity {
  const tier = normTier(input);
  const addonPackCount = normalizePacks(input.addonPackCount);
  const addonWorkspaceLimit = addonPackCount * ADDON_WORKSPACES_PER_PACK;

  const createdRaw = input.createdAt != null ? new Date(input.createdAt).getTime() : PACKAGING_V3_EFFECTIVE;
  const createdMs = Number.isFinite(createdRaw) ? createdRaw : PACKAGING_V3_EFFECTIVE;
  const packagingVersion = packagingVersionFor(createdMs);

  // Unknown / non-agency ⇒ fail closed: zero capacity, zero staff.
  if (tier == null) {
    return {
      workspaceLimit: 0, staffUserLimit: 0, baseWorkspaceLimit: 0, addonWorkspaceLimit: 0,
      addonPackCount, packagingVersion, grandfathered: false, source: "resolver",
    };
  }

  // Enterprise: explicit server override, else fail-closed to negotiated (null = unlimited-by-contract).
  if (tier === "enterprise") {
    const ws = input.enterpriseWorkspaceOverride;
    const base = typeof ws === "number" && Number.isFinite(ws) && ws >= 0 ? Math.floor(ws) : null;
    const staff = input.enterpriseStaffOverride;
    const staffUserLimit = typeof staff === "number" && Number.isFinite(staff) && staff >= 0 ? Math.floor(staff) : null;
    return {
      workspaceLimit: base === null ? null : base + addonWorkspaceLimit,
      staffUserLimit,
      baseWorkspaceLimit: base,
      addonWorkspaceLimit: base === null ? 0 : addonWorkspaceLimit,
      addonPackCount, packagingVersion, grandfathered: false, source: "resolver",
    };
  }

  const table = packagingVersion === "v3" ? BASE_V3 : packagingVersion === "v2" ? BASE_V2 : BASE_V1;
  const base = table[tier] as number | null; // legacy agency_pro = null (unlimited, grandfathered)
  const staffUserLimit = STAFF_USER_LIMIT[tier];
  const grandfathered = base !== (BASE_V3[tier] as number | null);

  // Unlimited base (legacy Agency Pro): add-on is meaningless on unlimited.
  if (base === null) {
    return {
      workspaceLimit: null, staffUserLimit, baseWorkspaceLimit: null, addonWorkspaceLimit: 0,
      addonPackCount, packagingVersion, grandfathered, source: "resolver",
    };
  }
  return {
    workspaceLimit: base + addonWorkspaceLimit,
    staffUserLimit,
    baseWorkspaceLimit: base,
    addonWorkspaceLimit,
    addonPackCount,
    packagingVersion,
    grandfathered,
    source: "resolver",
  };
}
