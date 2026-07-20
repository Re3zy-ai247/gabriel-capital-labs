// Run: npx tsx scripts/eventbus-idempotency-replay.test.ts
//
// DB-LESS proofs of the publisher's deterministic parts: fanout dedupe (a subscriber
// fires at most once per event), pattern matching, and every fail-closed publish
// REJECT path (flag off / unknown contract / invalid payload / missing dedupeKey /
// unauthorized) returns BEFORE any persistence. The DB-backed idempotency + full-payload
// replay + cross-tenant isolation are proven end-to-end against the preview Postgres by
// scripts/eventbus-preview-integration.mjs (run with the preview DATABASE_URL).
import { subscribe, deliver, clearSubscriptions, subscriberIds } from "../lib/eventBus/registry";
import { publish } from "../lib/eventBus/publish";
import { deriveEventId, systemIdentity, type PlatformEvent } from "../lib/eventBus/envelope";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const withFlag = async (v: string | undefined, fn: () => Promise<void>) => {
  const prev = process.env.EVENT_BUS_ENABLED;
  if (v === undefined) delete process.env.EVENT_BUS_ENABLED; else process.env.EVENT_BUS_ENABLED = v;
  try { await fn(); } finally {
    if (prev === undefined) delete process.env.EVENT_BUS_ENABLED; else process.env.EVENT_BUS_ENABLED = prev;
  }
};
const ev = (over: Partial<PlatformEvent> = {}): PlatformEvent => ({
  id: "evt_1", type: "SYSTEM_EVENT", version: 1, tenantId: "t", agencyId: null, actorId: "sys",
  source: "system", correlationId: "evt_1", payload: { kind: "test" }, createdAt: new Date(0).toISOString(), redactedAt: null, ...over,
});

async function run() {
  // ── Registry fanout + dedupe ────────────────────────────────────────────────
  clearSubscriptions();
  let aCount = 0, starCount = 0, otherCount = 0;
  subscribe("a", "SYSTEM_EVENT", () => { aCount++; });
  subscribe("star", "*", () => { starCount++; });
  subscribe("other", "LETTER_SENT", () => { otherCount++; });

  await deliver(ev({ id: "evt_A" }));
  check("exact-type subscriber fires", aCount === 1);
  check("wildcard subscriber fires", starCount === 1);
  check("non-matching subscriber does NOT fire", otherCount === 0);

  // Re-deliver the SAME event id → per-(event,sub) dedupe → no second fire
  await deliver(ev({ id: "evt_A" }));
  check("redelivery of the same event does not double-fire (dedupe)", aCount === 1 && starCount === 1);

  // A DIFFERENT event id fires again
  await deliver(ev({ id: "evt_B" }));
  check("a distinct event fires the handler again", aCount === 2);

  // Re-subscribing the same id replaces, never doubles
  subscribe("a", "SYSTEM_EVENT", () => { aCount += 10; });
  check("re-subscribe with same id does not duplicate the subscription", subscriberIds().filter((x) => x === "a").length === 1);

  // A throwing handler never breaks fanout of the others
  clearSubscriptions();
  let survived = 0;
  subscribe("boom", "*", () => { throw new Error("handler boom"); });
  subscribe("ok", "*", () => { survived++; });
  await deliver(ev({ id: "evt_C" }));
  check("a throwing subscriber does not prevent others from receiving", survived === 1);
  clearSubscriptions();

  // ── deriveEventId idempotency + tenant scoping ──────────────────────────────
  check("same (tenant,source,dedupeKey) => same id (idempotent)", deriveEventId("t1", "letters", "l:1") === deriveEventId("t1", "letters", "l:1"));
  check("different tenant => different id (no cross-tenant collision)", deriveEventId("t1", "letters", "l:1") !== deriveEventId("t2", "letters", "l:1"));
  check("different dedupeKey => different id", deriveEventId("t1", "letters", "l:1") !== deriveEventId("t1", "letters", "l:2"));

  // ── Publish reject paths (fail-closed, all return BEFORE persistence) ────────
  const valid = { type: "SYSTEM_EVENT" as const, payload: { kind: "deploy" }, identity: systemIdentity("t1"), dedupeKey: "sys:deploy:1" };

  await withFlag(undefined, async () => {
    const r = await publish(valid);
    check("flag OFF => disabled no-op (no persist)", r.ok === false && r.code === "disabled");
  });

  await withFlag("true", async () => {
    const unknown = await publish({ ...valid, type: "NOT_A_TYPE" as any });
    check("unknown contract => invalid", unknown.ok === false && unknown.code === "invalid");

    const badPayload = await publish({ type: "LETTER_SENT" as const, payload: {}, identity: systemIdentity("t1"), dedupeKey: "x" });
    check("invalid payload => invalid (no persist)", badPayload.ok === false && badPayload.code === "invalid");

    const noKey = await publish({ ...valid, dedupeKey: "" });
    check("missing dedupeKey => invalid (idempotency requires a key)", noKey.ok === false && noKey.code === "invalid");

    // Unauthorized: a self-scope event that requires a permission the identity lacks.
    const { requestIdentity } = await import("../lib/eventBus/envelope");
    const unpriv = requestIdentity({ id: "u1", role: "USER", isAgency: false }, { id: "u1", managedByAgencyId: null }, new Set());
    const forbidden = await publish({ type: "LETTER_GENERATED" as const, payload: { letterId: "l1", status: "generated" }, identity: unpriv, dedupeKey: "letter:l1:generated" });
    check("unauthorized publish => forbidden (no persist, no fanout)", forbidden.ok === false && forbidden.code === "forbidden");

    // A non-admin cannot publish a platform event.
    const platformDenied = await publish({ type: "SYSTEM_EVENT" as const, payload: { kind: "x" }, identity: unpriv, dedupeKey: "sys:x" });
    check("non-admin cannot publish SYSTEM_EVENT => forbidden", platformDenied.ok === false && platformDenied.code === "forbidden");
  });

  console.log(`\neventbus-idempotency-replay.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
run();
