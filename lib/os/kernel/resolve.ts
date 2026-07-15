// Capability Resolution (Sprint 1) — "what CAN Kai do?" Pure, over the preloaded
// EntitlementSnapshot (no DB, no lookups mid-flow — R3). The single source of truth every
// surface reads (pricing, UI, modules) so page ↔ entitlements ↔ modules can't disagree.
// The PEP (pep.ts) answers the separate question "may Kai do it *now*, in this context?".
import type { Registry } from "./registry";
import type { CapabilityKey, CapabilityState, EntitlementSnapshot } from "./types";

export function resolve(key: CapabilityKey, registry: Registry, ent: EntitlementSnapshot): CapabilityState {
  if (!registry.isRegistered(key)) return "unavailable";        // no provider
  const flagOn = ent.flags.get(key) ?? false;
  if (!flagOn) return "coming_soon";                            // registered, advertised, not switched on
  if (!ent.grantedCapabilities.has(key)) return "not_entitled"; // plan doesn't grant it
  return "available";                                           // may still be blocked by the PEP at call time
}
