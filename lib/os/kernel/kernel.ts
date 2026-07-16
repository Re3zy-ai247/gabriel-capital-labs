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

// The idempotency ledger (ADR-0028). THREE-STATE, claim-before-effect: `claim` is atomic — the
// FIRST caller for a key gets "won" (row created PENDING) and is the only one that may execute; a
// concurrent caller gets the current state ("pending"/"committed") and must NOT re-execute. A
// "failed" key is reclaimable (a transient failure is NOT recorded as done — the D-07 fix). `settle`
// records the terminal state + the hash-only receipt for an exact replay. Durable adapter (host,
// Postgres INSERT…ON CONFLICT) makes this survive serverless cold starts; in-mem is the reference.
export type IdemState = "won" | "pending" | "committed" | "failed";
export interface ReplayReceipt { summary: string; ok: boolean }
// Methods may be sync (in-mem reference) or async (durable Postgres adapter) — dispatch is already
// async and awaits them, so the durable claim/settle is "an explicit await inside dispatch" (ADR-0028
// §1.2). Await of a non-promise is a no-op, so the in-mem impl stays synchronous.
export interface IdempotencyStore {
  claim(key: string): IdemState | Promise<IdemState>;                          // atomic; first caller "won"
  settle(key: string, state: "committed" | "failed", receipt?: ReplayReceipt): void | Promise<void>;
  lookup(key: string): ({ state: IdemState; receipt?: ReplayReceipt } | null) | Promise<{ state: IdemState; receipt?: ReplayReceipt } | null>;
}
export interface KernelPorts { clock: ClockSource; audit: AuditSink; events: EventLog; memory: MemoryStore; idempotency?: IdempotencyStore }

function matches(pattern: string, type: string): boolean {
  return pattern === "*" || pattern === type || (pattern.endsWith(".*") && type.startsWith(pattern.slice(0, -1)));
}

export class Kernel {
  readonly registry = new Registry();
  private idem: IdempotencyStore;
  // Event fan-out dedupe stays an in-process set (needs no durability — a subscriber firing twice
  // within one process is the only case, and handlers are idempotent anyway). ADR-0028 §1.2.
  private eventSeen = new Set<string>();
  constructor(private ports: KernelPorts) {
    this.idem = ports.idempotency ?? inMemoryIdempotency();
  }

  // Persist buffered durable audit/event records. The host AWAITS this after dispatch, before the
  // HTTP response — never fire-and-forget (a serverless freeze after `return` would drop an
  // un-awaited write). In-mem adapters have no `flush` → no-op. ADR-0028 §1.1.
  async flush(): Promise<void> {
    await this.ports.audit.flush?.();
    await this.ports.events.flush?.();
  }

  // ---- Registration is the only door ----
  register(m: KaiModule): void { this.registry.registerModule(m); }
  registerPolicy(p: PolicyDecisionProvider): void { this.registry.registerPolicy(p); }
  subscribe(pattern: string, handler: (type: string) => void): void { this.registry.subscribe(pattern, handler); }

  // ---- Capability Resolution ("what CAN this actor do?") ----
  resolve(key: CapabilityKey, ent: EntitlementSnapshot): CapabilityState {
    return resolve(key, this.registry, ent);
  }

  // ---- The Marketplace catalog: every registered capability's self-describing metadata.
  //      Powers discovery, versioning, pricing, and "capability usage" observability. ----
  manifest() { return this.registry.allSpecs(); }

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
          const evKey = `ev:${id}:${s.pattern}`;
          if (matches(s.pattern, type) && !this.eventSeen.has(evKey)) {
            this.eventSeen.add(evKey);
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

  // ---- Dispatch (the syscall): authorize → [claim] → execute → audit + emit → [settle]. Async so
  //      generative/retrieval capabilities (which await a provider) work uniformly. Keyed dispatch
  //      is CLAIM-BEFORE-EFFECT (the D-07 fix, ADR-0028 §1.3); keyless dispatch is byte-identical
  //      to Sprint 1 (pure, repeatable capabilities pass no key). ----
  async dispatch(actor: Actor, key: CapabilityKey, input: unknown, ent: EntitlementSnapshot, purpose: PurposeToken, idempotencyKey?: string): Promise<ModuleResult> {
    const ctx = this.buildContext(actor, ent);
    const correlationId = idempotencyKey ?? `${key}:${stamp(this.ports.clock).version}`;
    const pluginId = this.registry.moduleFor(key)?.id;
    const audit = (decision: AuditEntry["decision"], reason: string) =>
      ctx.audit({ actorId: actor.id, tenantId: actor.tenantId, pluginId, correlationId, key, decision, reason });

    const decision = authorize(actor, key, purpose, this.registry, ent);
    if (!decision.allow) { audit("deny", decision.reason); return denial(decision.reason); }

    // CLAIM before any effect. Only the "won" caller executes; a concurrent caller never re-runs
    // the effect (fixes the TOCTOU double-send) and never gets a fabricated success.
    const opKey = idempotencyKey ? `op:${idempotencyKey}` : null;
    if (opKey) {
      const state = await this.idem.claim(opKey);
      if (state === "committed") {                        // replay: return the ORIGINAL receipt, never a synthetic ok:true
        const prior = (await this.idem.lookup(opKey))?.receipt;
        audit("event", "idempotent replay — original receipt returned (not re-executed)");
        return { ok: prior?.ok ?? true, receipt: { summary: prior?.summary ?? "idempotent replay", evidence: [] }, confidence: { level: "high", basis: "prior committed execution" }, replay: true };
      }
      if (state === "pending") {                          // a concurrent invocation holds the claim → honest INDETERMINATE
        audit("event", "in-flight — claim held by a concurrent invocation; not re-executed");
        return { ok: false, receipt: { summary: "in-flight — not re-executed", evidence: [] }, confidence: { level: "insufficient", basis: "idempotency claim held elsewhere" }, pending: true };
      }
      // state === "won" → we own the claim; fall through to execute + settle.
    }

    const mod = this.registry.moduleFor(key)!; // guaranteed by authorize()
    let result: ModuleResult;
    try {
      result = await mod.execute(ctx, key, input);
    } catch (e) {
      // A thrown effect is NOT "done" — release the claim to "failed" so a retry can re-run it
      // (never mark-on-failure). Then rethrow (the host owns transport error handling).
      if (opKey) await this.idem.settle(opKey, "failed");
      audit("error", `execute threw: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
    audit(result.ok ? "allow" : "error", result.receipt.summary);
    // SETTLE on the actual outcome: committed only on success (stores the replay receipt); failed
    // on !ok so the key is reclaimable (a transient failure never silently suppresses a retry).
    if (opKey) await this.idem.settle(opKey, result.ok ? "committed" : "failed", { summary: result.receipt.summary, ok: result.ok });
    ctx.emit(`${key}.done`, { ok: result.ok }, correlationId);
    return result;
  }
}

function denial(reason: string): ModuleResult {
  return { ok: false, receipt: { summary: `denied: ${reason}`, evidence: [] }, confidence: { level: "high", basis: "policy enforcement point" } };
}

// In-memory reference 3-state ledger. Models the durable INSERT…ON CONFLICT semantics: the first
// claim on a fresh/failed key wins (→ pending); concurrent claims observe the current state without
// mutating it. Not durable across processes (that is the host Postgres adapter) — the reference for
// tests + the KERNEL_DURABLE-off default.
export function inMemoryIdempotency(): IdempotencyStore {
  const m = new Map<string, { state: IdemState; receipt?: ReplayReceipt }>();
  return {
    claim(key) {
      const cur = m.get(key);
      if (!cur || cur.state === "failed") { m.set(key, { state: "pending" }); return "won"; }
      return cur.state; // "pending" (in-flight) or "committed" (done)
    },
    settle(key, state, receipt) { m.set(key, { state, receipt }); },
    lookup(key) { return m.get(key) ?? null; },
  };
}
