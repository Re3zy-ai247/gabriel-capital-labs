// Kai Kernel guards (Sprint 1). Unit + property + integration. Pure — no DB, no AI.
// Tests the mechanism-only kernel AND the red-team bindings: tenant isolation, default-deny
// PEP, idempotency (no double execution), permissible-purpose, monotonic clock, namespace
// grammar, append-only audit, capability-resolution matrix, event bus.
// Run: npx tsx scripts/kernel.test.ts
import {
  Kernel, resolve, authorize, Registry, parseKey, formatKey, isValidKey, domainOf, memoryClock,
  inMemoryAudit, inMemoryEventLog, inMemoryMemory,
  type Actor, type CapabilityKey, type CapabilitySpec, type EntitlementSnapshot, type KaiModule,
  type MemoryNode, type PolicyDecisionProvider, type Version,
} from "../lib/os/kernel";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }
function throws(fn: () => void): boolean { try { fn(); return false; } catch { return true; } }

const K = (s: string) => s as CapabilityKey;
const CREATE = K("credit.dispute.create");

// ---- Fixtures: a fake first-party "credit" module ----
let ran = 0;
function creditModule(): KaiModule {
  return {
    id: "credit", name: "Kai Credit", trust: "first_party",
    capabilities: (): CapabilitySpec[] => [{
      key: CREATE, requiredPermissions: ["letters:generate"],
      compliance: { regimes: ["FCRA"], permissiblePurposes: ["dispute"] }, reasoning: "deterministic",
    }],
    execute: () => { ran++; return { ok: true, data: { letterId: "L1" }, receipt: { summary: "drafted dispute", evidence: ["tradeline X"] }, confidence: { level: "high", basis: "deterministic" } }; },
  };
}
// Compliance PDP: denies a marketing purpose outright (Compliance Officer veto).
const compliancePDP: PolicyDecisionProvider = { id: "compliance", decide: (pc) => pc.purpose === "marketing" ? { allow: false, reason: "marketing purpose forbidden on FCRA data" } : { allow: true, reason: "ok" } };

const ent = (over: Partial<{ caps: CapabilityKey[]; flags: [CapabilityKey, boolean][]; perms: string[] }> = {}): EntitlementSnapshot => ({
  grantedCapabilities: new Set(over.caps ?? [CREATE]),
  flags: new Map(over.flags ?? [[CREATE, true]]),
  grantedPermissions: new Set(over.perms ?? ["letters:generate"]),
});
const alice: Actor = { id: "u_alice", tenantId: "t_a", trust: "first_party" };
const bob: Actor = { id: "u_bob", tenantId: "t_b", trust: "first_party" };

// ---- 1. Namespace grammar (property + unit) ----
{
  ok("parse valid key", JSON.stringify(parseKey("credit.dispute.create")) === JSON.stringify({ domain: "credit", entity: "dispute", action: "create", major: 1 }));
  ok("parse versioned key", parseKey("funding.sba.qualify@2")?.major === 2);
  ok("reject malformed (2 segments)", parseKey("credit.dispute") === null);
  ok("reject uppercase", parseKey("Credit.Dispute.Create") === null);
  ok("reject @0 / bad version", parseKey("credit.dispute.create@0") === null && parseKey("a.b.c@x") === null);
  ok("isValidKey + domainOf", isValidKey("credit.dispute.create") && domainOf("credit.dispute.create") === "credit" && domainOf("bad") === null);
  // property: format∘parse round-trips
  const keys = ["credit.dispute.create", "funding.sba.qualify@2", "mortgage.preapproval.check@10"];
  ok("property: formatKey(parseKey(k)) === k", keys.every((k) => formatKey(parseKey(k)!) === k));
}

// ---- 2. Clock: strictly monotonic versions ----
{
  const c = memoryClock();
  const vs: Version[] = [c.nextVersion(), c.nextVersion(), c.nextVersion()];
  ok("clock versions strictly increasing", vs[0] < vs[1] && vs[1] < vs[2]);
}

// ---- 3. Registry ----
{
  const r = new Registry(); r.registerModule(creditModule());
  ok("registry: capability routes to module", r.moduleFor(CREATE)?.id === "credit" && r.isRegistered(CREATE));
  ok("registry: duplicate domain rejected", throws(() => r.registerModule(creditModule())));
  const bad: KaiModule = { ...creditModule(), id: "other" };
  ok("registry: capability outside its domain rejected", throws(() => new Registry().registerModule(bad)));
}

// ---- 4. Capability resolution matrix ----
{
  const r = new Registry(); r.registerModule(creditModule());
  ok("resolve: unregistered → unavailable", resolve(K("nope.x.y"), r, ent()) === "unavailable");
  ok("resolve: flag off → coming_soon", resolve(CREATE, r, ent({ flags: [[CREATE, false]] })) === "coming_soon");
  ok("resolve: not granted → not_entitled", resolve(CREATE, r, ent({ caps: [] })) === "not_entitled");
  ok("resolve: granted + flag on → available", resolve(CREATE, r, ent()) === "available");
}

// ---- 5. PEP: default-deny gate ----
{
  const r = new Registry(); r.registerModule(creditModule()); r.registerPolicy(compliancePDP);
  ok("PEP: allow when available+permitted+purpose+PDP-ok", authorize(alice, CREATE, "dispute", r, ent()).allow);
  ok("PEP: deny missing permission", !authorize(alice, CREATE, "dispute", r, ent({ perms: [] })).allow);
  ok("PEP: deny non-permissible purpose (R5)", !authorize(alice, CREATE, "wealth_pitch", r, ent()).allow);
  ok("PEP: deny on PDP veto (marketing)", !authorize(alice, CREATE, "marketing", r, ent()).allow);
  ok("PEP: deny when not entitled", !authorize(alice, CREATE, "dispute", r, ent({ caps: [] })).allow);
}

// ---- 6-9 + 10: async kernel behaviors (in main() — this package is CJS, no top-level await) ----
async function main() {
  ran = 0;
  const audit = inMemoryAudit(), events = inMemoryEventLog();
  const bnode: MemoryNode = { id: "n1", type: "tradeline", tenantId: "t_b", regime: "FCRA", stamp: { validTime: "x", txTime: "x", version: 1 as Version }, data: {} };
  const anode: MemoryNode = { ...bnode, tenantId: "t_a" };
  const memory = inMemoryMemory([anode, { ...bnode, id: "n2" }]);
  const k = new Kernel({ clock: memoryClock(), audit, events, memory });
  k.register(creditModule()); k.registerPolicy(compliancePDP);
  let delivered = 0; k.subscribe("credit.*", () => { delivered++; });

  // dispatch: authorized executes + audits allow + emits
  const r1 = await k.dispatch(alice, CREATE, {}, ent(), "dispute", "op-1");
  ok("dispatch: authorized runs the module", r1.ok && ran === 1);
  ok("dispatch: emitted event delivered to subscriber", delivered === 1);
  ok("dispatch: audit recorded an allow", audit.entries().some((e) => e.key === CREATE && e.decision === "allow"));

  // idempotency: same op key does NOT re-execute
  const r2 = await k.dispatch(alice, CREATE, {}, ent(), "dispute", "op-1");
  ok("dispatch: idempotent — not re-executed (no double action)", r2.ok && ran === 1);

  // denial: not re-executed, denial result, audit deny
  const r3 = await k.dispatch(alice, CREATE, {}, ent(), "marketing", "op-2");
  ok("dispatch: denied → not executed + denial result", !r3.ok && ran === 1 && /denied/.test(r3.receipt.summary));
  ok("dispatch: denial audited", audit.entries().some((e) => e.decision === "deny"));

  // TENANT ISOLATION (the #1 invariant): Alice cannot read Bob's node.
  const ctxA = k.buildContext(alice, ent());
  ok("tenant isolation: cross-tenant memory read returns null", ctxA.memoryRead("n2", "dispute") === null);
  ok("tenant isolation: own-tenant read works", ctxA.memoryRead("n1", "dispute")?.tenantId === "t_a");
  const ctxB = k.buildContext(bob, ent());
  ok("tenant isolation: Bob sees only his tenant", ctxB.memoryRead("n1", "dispute") === null && ctxB.memoryRead("n2", "dispute")?.tenantId === "t_b");

  // audit append-only + stamped monotonically
  const versions = audit.entries().map((e) => e.stamp.version);
  ok("audit: append-only, monotonic version stamps", versions.length > 0 && versions.every((v, i) => i === 0 || versions[i - 1] < v));

  // event bus idempotent redelivery (same event id delivered once per subscriber)
  const before = delivered;
  ctxA.emit("credit.test", {}, "same-id"); ctxA.emit("credit.test", {}, "same-id");
  ok("event bus: idempotent redelivery (once per subscriber)", delivered === before + 1);

  // ---- 10. Integration: full happy path + compliance stop ----
  ran = 0;
  const ik = new Kernel({ clock: memoryClock(), audit: inMemoryAudit(), events: inMemoryEventLog(), memory: inMemoryMemory() });
  ik.register(creditModule()); ik.registerPolicy(compliancePDP);
  const run = await ik.dispatch(alice, CREATE, {}, ent(), "dispute");
  ok("integration: resolve→available then dispatch(dispute) runs", ik.resolve(CREATE, ent()) === "available" && run.ok && ran === 1);
  const denied = await ik.dispatch(alice, CREATE, {}, ent(), "marketing");
  ok("integration: compliance stops a bad-purpose call", !denied.ok);
}

main().then(() => {
  console.log(failures === 0 ? "\nAll Kai Kernel guards passed." : `\n${failures} guard(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
});
