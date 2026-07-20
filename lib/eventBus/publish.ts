// Platform Event Bus — the Publisher (Sprint 8). The single door onto the bus:
//
//   flag → validate (contract + PII) → authorize → assemble → persist (idempotent)
//        → audit → fanout (fresh only)
//
// Fail-closed at every step (flag off, unknown contract, invalid payload, or an
// unauthorized identity all reject WITHOUT persisting or fanning out). Retry-safe: a
// persist failure surfaces (the store rethrows), so a retry re-runs cleanly; the
// deterministic tenant-scoped id makes the retry an ON CONFLICT no-op → replayed. A
// replayed event never re-fans-out.
//
// AUDIT: a successful publish is SELF-AUDITING — the EventEnvelope row is an immutable,
// correlationId-carrying who/when/what record. Denials/failures are logged on the app's
// existing console path. (Routing publishes through the kernel dispatch → KernelAudit
// hash-chain is a deferred, owner-gated step — it requires activating the durable
// kernel, KERNEL_DURABLE, which is intentionally OFF today.)
import { getContract, currentVersion } from "./contracts";
import { validateEvent } from "./validate";
import { deriveEventId, type DraftEvent, type EventType, type PlatformEvent, type PublishIdentity } from "./envelope";
import { appendEvent } from "./store";
import { deliver } from "./registry";
import { eventBusEnabled } from "./flags";

export interface PublishInput {
  type: EventType;
  payload: unknown;
  identity: PublishIdentity;   // resolved SERVER-SIDE (requestIdentity/systemIdentity) — never client input
  dedupeKey: string;           // stable natural key for idempotency (e.g. "letter:<id>:generated")
  source?: string;             // overrides the contract default
  version?: number;            // overrides the current version
  correlationId?: string;      // stable across retries; defaults to the event id
}

export type PublishResult =
  | { ok: true; event: PlatformEvent; replayed: boolean }
  | { ok: false; code: "disabled" | "invalid" | "forbidden"; error: string };

// Authorization: enforce the contract's scope AND its required permission against the
// SERVER-resolved identity. A trusted system publisher (the platform itself) satisfies
// scope by construction but is still bound to a specific tenant. Fail-closed on any
// unknown scope. This is the PEP for publishing — never bypassed.
export function authorizePublish(
  contract: { scope: "self" | "agency" | "platform"; requiredPermission?: string },
  identity: PublishIdentity,
): { ok: true } | { ok: false; reason: string } {
  if (!identity.actorId || !identity.tenantId) return { ok: false, reason: "unresolved identity" };

  if (!identity.trusted) {
    switch (contract.scope) {
      case "self": break; // any authenticated identity may publish about its OWN (server-derived) tenant
      case "agency": if (!identity.isAgency) return { ok: false, reason: "agency scope requires an agency account" }; break;
      case "platform": if (!identity.isAdmin) return { ok: false, reason: "platform scope requires admin" }; break;
      default: return { ok: false, reason: "unknown scope" };
    }
    if (contract.requiredPermission && !identity.grantedPermissions.has(contract.requiredPermission)) {
      return { ok: false, reason: `missing permission: ${contract.requiredPermission}` };
    }
  }
  return { ok: true };
}

export async function publish(input: PublishInput): Promise<PublishResult> {
  // 1. Flag — fail-closed no-op when the bus is disabled.
  if (!eventBusEnabled()) return { ok: false, code: "disabled", error: "event bus disabled" };

  // 2. Contract + payload validation (fail-closed; includes the PII structural guard).
  const version = input.version ?? currentVersion(input.type);
  const contract = getContract(input.type, version);
  if (!contract) return { ok: false, code: "invalid", error: `unknown contract ${input.type}@${version}` };
  const valid = validateEvent(input.type, version, input.payload);
  if (!valid.ok) return { ok: false, code: "invalid", error: valid.error };

  if (!input.dedupeKey) return { ok: false, code: "invalid", error: "missing dedupeKey (idempotency requires a stable key)" };

  // 3. Authorize (PEP) — never bypassed.
  const authz = authorizePublish(contract, input.identity);
  if (!authz.ok) {
    console.warn(`eventBus: publish DENIED ${input.type} for actor=${input.identity.actorId} tenant=${input.identity.tenantId}: ${authz.reason}`);
    return { ok: false, code: "forbidden", error: authz.reason };
  }

  // 4. Assemble the immutable envelope. id is deterministic + tenant-scoped (idempotency
  //    key); correlationId is stable across retries (defaults to the id).
  const source = input.source ?? contract.defaultSource;
  const id = deriveEventId(input.identity.tenantId, input.type, source, input.dedupeKey);
  const draft: DraftEvent = {
    id,
    type: input.type,
    version,
    tenantId: input.identity.tenantId,
    agencyId: input.identity.agencyId,
    actorId: input.identity.actorId,
    source,
    correlationId: input.correlationId ?? id,
    payload: valid.payload,
  };

  // 5. Persist idempotently (retry-safe; rethrows on real failure).
  const { event, replayed } = await appendEvent(draft);

  // 6. Fanout — fresh events only, so a replay never re-delivers. Best-effort (a
  //    subscriber error never un-persists the event; it catches up via replay).
  if (!replayed) await deliver(event);

  return { ok: true, event, replayed };
}
