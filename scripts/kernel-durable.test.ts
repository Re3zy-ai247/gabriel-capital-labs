// GIOS #11 Durable Audit — guards for the claim/settle idempotency + the D-07 fix (ADR-0028).
// Proves the LOGIC end-to-end (including the awaited async path a durable Postgres store uses)
// WITHOUT a database: in-memory 3-state store + a fake-async store that models INSERT…ON CONFLICT.
// Run: npx tsx scripts/kernel-durable.test.ts
import { Kernel, inMemoryAudit, inMemoryEventLog, inMemoryMemory, memoryClock, inMemoryIdempotency } from "../lib/os/kernel";
import type { Actor, AuditEntry, AuditSink, CapabilityKey, EntitlementSnapshot, IdempotencyStore, IdemState, KaiModule, ReplayReceipt } from "../lib/os/kernel";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

const KEY = "test.op.run" as CapabilityKey;
const actor: Actor = { id: "u1", tenantId: "u1", trust: "first_party" };
const ent = (): EntitlementSnapshot => ({ grantedCapabilities: new Set([KEY]), flags: new Map([[KEY, true]]), grantedPermissions: new Set(["test:run"]) });

// Controllable fixture: counts executions; `succeed` toggles ok. A pure capability passes no key;
// an "effect-like" capability passes an idempotency key.
let ran = 0;
let succeed = true;
const testModule: KaiModule = {
  id: "test", name: "Test", trust: "first_party",
  capabilities: () => [{ key: KEY, description: "test op", version: 1, owner: "t", plugin: "test", premium: false, experimental: false, securityClass: "internal", requiredPermissions: ["test:run"], inputSchema: "{}", outputSchema: "{}", compliance: { regimes: ["none"], permissiblePurposes: ["test"] }, reasoning: "deterministic" }],
  execute: () => { ran++; return { ok: succeed, data: { ran }, receipt: { summary: `ran #${ran}`, evidence: [] }, confidence: { level: "high", basis: "test" } }; },
};

function build(idem?: IdempotencyStore, audit?: AuditSink): Kernel {
  const k = new Kernel({ clock: memoryClock(), audit: audit ?? inMemoryAudit(), events: inMemoryEventLog(), memory: inMemoryMemory(), idempotency: idem });
  k.register(testModule);
  return k;
}

// A fake ASYNC store that models the durable Postgres INSERT…ON CONFLICT semantics (returns
// Promises), so we exercise dispatch's awaited claim/settle path with no DB.
function fakeAsyncIdem(): IdempotencyStore {
  const m = new Map<string, { state: IdemState; receipt?: ReplayReceipt }>();
  return {
    claim: async (key) => { const cur = m.get(key); if (!cur || cur.state === "failed") { m.set(key, { state: "pending" }); return "won"; } return cur.state; },
    settle: async (key, state, receipt) => { m.set(key, { state, receipt }); },
    lookup: async (key) => m.get(key) ?? null,
  };
}
function fakeDurableAudit(): { sink: AuditSink; flushes: () => number } {
  let flushes = 0; const buf: AuditEntry[] = [];
  return { sink: { append: (e) => { buf.push(e); }, flush: async () => { flushes++; buf.length = 0; } }, flushes: () => flushes };
}

async function main() {
  // 1. Keyless dispatch is UNCHANGED (pure, repeatable — re-executes; byte-identical to Sprint 1).
  {
    ran = 0; succeed = true;
    const k = build();
    const a = await k.dispatch(actor, KEY, {}, ent(), "test");
    const b = await k.dispatch(actor, KEY, {}, ent(), "test");
    ok("keyless: executes every time (pure, no idempotency) — ran twice", a.ok && b.ok && ran === 2 && !a.replay && !a.pending);
  }

  // 2. REPLAY returns the ORIGINAL receipt, never a synthetic ok:true, and does NOT re-execute.
  {
    ran = 0; succeed = true;
    const k = build(inMemoryIdempotency());
    const first = await k.dispatch(actor, KEY, {}, ent(), "test", "op-A");
    const replay = await k.dispatch(actor, KEY, {}, ent(), "test", "op-A");
    ok("keyed: winner executes once (ran===1 after replay)", ran === 1);
    ok("replay: flagged replay + NOT re-executed", replay.replay === true && replay.pending !== true);
    ok("replay: returns the ORIGINAL receipt (summary 'ran #1'), not a synthetic 'idempotent replay'", replay.receipt.summary === "ran #1" && first.receipt.summary === "ran #1");
  }

  // 3. A FAILED op is RECLAIMABLE (never mark-on-failure) — a retry re-executes.
  {
    ran = 0; succeed = false;
    const k = build(inMemoryIdempotency());
    const f1 = await k.dispatch(actor, KEY, {}, ent(), "test", "op-B");
    ok("failure: settled failed → not ok, ran once", !f1.ok && ran === 1 && !f1.replay);
    const f2 = await k.dispatch(actor, KEY, {}, ent(), "test", "op-B");
    ok("failure is reclaimable: retry RE-EXECUTES (ran===2), not suppressed as done", ran === 2 && !f2.replay);
    succeed = true;
    const f3 = await k.dispatch(actor, KEY, {}, ent(), "test", "op-B");
    ok("after success: committed (ran===3, ok)", f3.ok && ran === 3);
    const f4 = await k.dispatch(actor, KEY, {}, ent(), "test", "op-B");
    ok("after commit: replays original, no more executes (ran stays 3)", f4.replay === true && ran === 3);
  }

  // 4. CLAIM-BEFORE-EFFECT (the D-07 fix): a claim held by a concurrent invocation blocks execution
  //    and yields an honest PENDING — NOT a synthetic success, and the effect never runs twice.
  {
    ran = 0; succeed = true;
    const store = inMemoryIdempotency();
    const k = build(store);
    const won = await store.claim("op:race");            // simulate a concurrent invocation holding the claim
    ok("setup: concurrent invocation won the claim", won === "won");
    const blocked = await k.dispatch(actor, KEY, {}, ent(), "test", "race");
    ok("claim-before-effect: held claim → PENDING, effect NOT executed (ran stays 0)", blocked.pending === true && !blocked.ok && ran === 0);
  }

  // 5. flush() is safe (no-op on in-mem adapters).
  {
    const k = build(inMemoryIdempotency());
    let threw = false;
    try { await k.flush(); } catch { threw = true; }
    ok("flush(): no-op safe on in-memory adapters", !threw);
  }

  // 6. The AWAITED ASYNC path a durable Postgres store uses works through dispatch (claim/settle/
  //    lookup all awaited) + the durable AuditSink is flushed by kernel.flush().
  {
    ran = 0; succeed = true;
    const audit = fakeDurableAudit();
    const k = build(fakeAsyncIdem(), audit.sink);
    const a = await k.dispatch(actor, KEY, {}, ent(), "test", "op-Z");
    const b = await k.dispatch(actor, KEY, {}, ent(), "test", "op-Z");
    ok("async durable path: winner executes once, replay via awaited lookup (ran===1)", a.ok && b.replay === true && ran === 1 && b.receipt.summary === "ran #1");
    await k.flush();
    ok("async durable path: kernel.flush() awaits the durable AuditSink flush", audit.flushes() >= 1);
  }
}

main().then(() => {
  console.log(failures === 0 ? "\nAll GIOS #11 Durable Audit guards passed." : `\n${failures} guard(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
});
