// Policy Enforcement Point (Sprint 1) — the gate EVERY capability call traps through
// (the syscall boundary). "May this actor do this *now*, in this context?" Default DENY.
// Pure over the preloaded context. The kernel owns the gate; the RULES are pluggable PDPs
// (compliance/policy) — so regulations change without touching the kernel (mechanism vs
// policy). Permissible-purpose is enforced here (R5).
import type { Registry } from "./registry";
import { resolve } from "./resolve";
import type { Actor, CapabilityKey, EntitlementSnapshot, PolicyDecision, PurposeToken } from "./types";

export function authorize(
  actor: Actor,
  key: CapabilityKey,
  purpose: PurposeToken,
  registry: Registry,
  ent: EntitlementSnapshot,
): PolicyDecision {
  // 1. Availability + entitlement (capability resolution).
  const state = resolve(key, registry, ent);
  if (state !== "available") return { allow: false, reason: `capability ${state}` };

  const spec = registry.spec(key);
  if (!spec) return { allow: false, reason: "capability unavailable" }; // defensive; resolve guarantees this

  // 2. Least-privilege: the actor must hold every required permission (default deny).
  for (const p of spec.requiredPermissions) {
    if (!ent.grantedPermissions.has(p)) return { allow: false, reason: `missing permission: ${p}` };
  }

  // 3. Permissible-purpose (R5): the declared purpose must be one this capability may serve.
  if (!spec.compliance.permissiblePurposes.includes(purpose)) {
    return { allow: false, reason: `purpose "${purpose}" not permissible for ${key}` };
  }

  // 4. Pluggable policy/compliance decision-providers — a single DENY vetoes (Compliance
  //    Officer can always stop a call). Rules live in plugins; the gate lives here.
  for (const pdp of registry.policies()) {
    const d = pdp.decide({ actor, key, spec, purpose });
    if (!d.allow) return { allow: false, reason: `${pdp.id}: ${d.reason}` };
  }

  return { allow: true, reason: "authorized" };
}
