// The Kai Kernel facade (Sprint 1) — wires the primitives into the two entrypoints every
// call goes through: resolve() ("what CAN") and dispatch() ("do it, now"). Tenant
// isolation is the #1 invariant, enforced here and in the Memory Interface. Dispatch is
// idempotent (E2: at-least-once world — no double execution of outward actions).
import { Registry } from "./registry";
import { authorize } from "./pep";
import { resolve } from "./resolve";
import { stamp } from "./clock";
import type {
  Actor, AuditEntry, AuditSink, CapabilityKey, CapabilityState, ClockSource, EntitlementSnapshot,
  EventLog, KaiEvent, KaiModule, MemoryNode, MemoryStore, ModuleResult, OsContext, PolicyDecisionProvider, PurposeToken,
} from "./types";

// Durable in prod; in-memory reference for Sprint 1. Prevents double-execution on redelivery.
export interface IdempotencyStore { seen(key: string): boolean; mark(key: string): void }
export interface KernelPorts { clock: ClockSource; audit: AuditSink; events: EventLog; memory: MemoryStore; idempotency?: IdempotencyStore }

function matches(pattern: string, type: string): boolean {
  return pattern === "*" || pattern === type || (pattern.endsWith(".*") && type.startsWith(pattern.slice(0, -1)));
}

export class Kernel {
  readonly registry = new Registry();
  private idem: IdempotencyStore;
  constructor(private ports: KernelPorts) {
    this.idem = ports.idempotency ?? inMemoryIdempotency();
  }

  // ---- Registration is the only door ----
  register(m: KaiModule): void { this.registry.registerModule(m); }
  registerPolicy(p: PolicyDecisionProvider): void { this.registry.registerPolicy(p); }
  subscribe(pattern: string, handler: (type: string) => void): void { this.registry.subscribe(pattern, handler); }

  // ---- Capability Resolution ("what CAN this actor do?") ----
  resolve(key: CapabilityKey, ent: EntitlementSnapshot): CapabilityState {
    return resolve(key, this.registry, ent);
  }

  // ---- Build the per-request context ONCE (single-load; R3). Modules only see this. ----
  buildContext(actor: Actor, ent: EntitlementSnapshot): OsContext {
    const { clock } = this.ports;
    const audit = (e: Omit<AuditEntry, "stamp">) => this.ports.audit.append({ ...e, stamp: stamp(clock) });
    return {
      actor,
      clock,
      entitlements: ent,
      audit,
      emit: (type, payload, id) => {
        const ev: KaiEvent = { id, type, tenantId: actor.tenantId, stamp: stamp(clock), payload };
        this.ports.events.append(ev);
        // Sprint 1 in-memory delivery is synchronous + idempotent (prod drains the durable
        // log via a worker — same at-least-once + idempotency contract).
        for (const s of this.registry.subscribers()) {
          if (matches(s.pattern, type) && !this.idem.seen(`ev:${id}:${s.pattern}`)) {
            this.idem.mark(`ev:${id}:${s.pattern}`);
            s.handler(type);
          }
        }
      },
      // Memory reads are TENANT-ISOLATED (the load-bearing invariant): a cross-tenant read
      // returns null and is audited as a denial. Never leaks another tenant's data.
      memoryRead: (id, purpose: PurposeToken): MemoryNode | null => {
        const node = this.ports.memory.read(actor.tenantId, id);
        if (node && node.tenantId !== actor.tenantId) {
          audit({ actorId: actor.id, tenantId: actor.tenantId, key: `memory:${id}`, decision: "deny", reason: "cross-tenant read blocked" });
          return null;
        }
        audit({ actorId: actor.id, tenantId: actor.tenantId, key: `memory:${id}`, decision: node ? "allow" : "error", reason: `read (${purpose})` });
        return node;
      },
    };
  }

  // ---- Dispatch (the syscall): authorize → execute → audit + emit. Idempotent. ----
  dispatch(actor: Actor, key: CapabilityKey, input: unknown, ent: EntitlementSnapshot, purpose: PurposeToken, idempotencyKey?: string): ModuleResult {
    const ctx = this.buildContext(actor, ent);
    const decision = authorize(actor, key, purpose, this.registry, ent);
    if (!decision.allow) {
      ctx.audit({ actorId: actor.id, tenantId: actor.tenantId, key, decision: "deny", reason: decision.reason });
      return denial(decision.reason);
    }
    if (idempotencyKey && this.idem.seen(`op:${idempotencyKey}`)) {
      ctx.audit({ actorId: actor.id, tenantId: actor.tenantId, key, decision: "event", reason: "idempotent replay — not re-executed" });
      return { ok: true, receipt: { summary: "idempotent replay", evidence: [] }, confidence: { level: "high", basis: "prior execution" } };
    }
    const mod = this.registry.moduleFor(key)!; // guaranteed by authorize()
    const result = mod.execute(ctx, key, input);
    ctx.audit({ actorId: actor.id, tenantId: actor.tenantId, key, decision: result.ok ? "allow" : "error", reason: result.receipt.summary });
    if (idempotencyKey) this.idem.mark(`op:${idempotencyKey}`);
    ctx.emit(`${key}.done`, { ok: result.ok }, idempotencyKey ?? `${key}:${stamp(this.ports.clock).version}`);
    return result;
  }
}

function denial(reason: string): ModuleResult {
  return { ok: false, receipt: { summary: `denied: ${reason}`, evidence: [] }, confidence: { level: "high", basis: "policy enforcement point" } };
}

export function inMemoryIdempotency(): IdempotencyStore {
  const seen = new Set<string>();
  return { seen: (k) => seen.has(k), mark: (k) => void seen.add(k) };
}
