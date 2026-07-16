// GIOS kernel — plan-tier & capability-bundle TYPES (Platform Phase B, B1).
// ─────────────────────────────────────────────────────────────────────────────
// STATUS: DORMANT. Zero production consumers. The live authorization gate remains
// lib/entitlements.ts (binary premium + agencyClientLimit) until the approved
// Phase-B migration gates (B3/B4) flip it route-by-route behind a flag.
//
// OWNERSHIP (Phase-B boundary): this file is MECHANISM TYPES and belongs to GIOS.
// The VALUES that parameterize it (which capability each plan gets, the limits,
// the prices) are product data and live in config/capabilityMatrix.ts
// (CreditVector-owned). The kernel never imports product data — a host injects
// the matrix into the resolver (dependency points product → platform only).
//
// ACTIVATION STEP (documented, not performed here): Phase B2 adds the pure
// resolver `snapshotForTier(tier, matrix, workspace, flags): EntitlementSnapshot`
// in lib/os/host/tierResolver.ts; Phase B3 re-derives lib/entitlements.ts from it
// behind CAPABILITY_PLATFORM (default OFF) with byte-identical golden fixtures;
// Phase B4 flips live reads one route at a time. Owner gate before each.
//
// The architecture is capability-first: capability → grant → bundle(TierGrant)
// → plan(PlanTier). Plan names are never the authorization primitive — the PEP
// consumes only the resolved EntitlementSnapshot.
import type { CapabilityKey, Permission } from "./types";

/** Every plan tier across the platform. Order = upgrade path. */
export type PlanTier =
  | "explorer"
  | "professional"
  | "professional_plus"
  | "agency"
  | "agency_pro"
  | "scale"
  | "enterprise";

/** Quantitative limits a tier grants. null = unlimited / negotiated. */
export type LimitKey =
  | "CLIENT_WORKSPACE_LIMIT"
  | "CONCURRENT_SESSION_LIMIT"
  | "TEAM_MEMBER_LIMIT"
  | "LETTERS_MONTHLY_LIMIT"
  | "API_CALLS_MONTHLY_LIMIT";

/** Everything a single tier grants: the bundle. */
export interface TierGrant {
  capabilities: ReadonlySet<CapabilityKey>;
  permissions: ReadonlySet<Permission>;
  limits: ReadonlyMap<LimitKey, number | null>;
  /** Per-capability rollout flags (a declared capability may still be flag-off). */
  flags: ReadonlyMap<CapabilityKey, boolean>;
}

/** The full product matrix a host injects into the tier resolver. */
export type TierCapabilityMatrix = Readonly<Record<PlanTier, TierGrant>>;
