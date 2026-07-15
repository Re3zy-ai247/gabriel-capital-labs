// Kernel host — Capability Resolution / the plan→capability map (Sprint 2, migration #2).
// The Capability Engine (ADR-0022) realized: it maps the existing entitlement model to the
// kernel's preloaded EntitlementSnapshot (built ONCE per request — R3). This is the single
// source the kernel reads to answer "what CAN this actor do?". It grows one capability at a
// time as subsystems migrate; today it declares the first migrated capability.
import type { CapabilityKey, EntitlementSnapshot, Permission } from "@/lib/os/kernel";

const DRAFT = "credit.letter.draft" as CapabilityKey;

// `premium` mirrors lib/entitlements.isPremium. Increment 1: letter drafting is available to
// every authenticated user (matching today's behavior — the monthly free-letter LIMIT is a
// downstream policy at the save step, and will migrate to a PEP policy provider later).
export function entitlementSnapshot(_opts: { premium: boolean }): EntitlementSnapshot {
  return {
    grantedCapabilities: new Set<CapabilityKey>([DRAFT]),
    flags: new Map<CapabilityKey, boolean>([[DRAFT, true]]),
    grantedPermissions: new Set<Permission>(["letters:generate"]),
  };
}
