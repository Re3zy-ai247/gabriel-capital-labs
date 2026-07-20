// Run against the PREVIEW database ONLY:
//   set -a && . /tmp/p/.env.preview && set +a
//   EVENTBUS_INTEGRATION=1 EVENT_BUS_ENABLED=true npx tsx scripts/eventbus-preview-integration.ts
//
// Proves — on real Postgres — the parts the DB-less tests cannot: append idempotency
// (ON CONFLICT replay), FULL-payload replay (the log is not hash-only), deterministic
// cursor ordering, and cross-tenant read isolation. Self-cleans its own rows. SKIPS
// (exit 0) unless EVENTBUS_INTEGRATION=1 + DATABASE_URL are set, so it is safe in the
// repo's DB-less test convention.
import { prisma } from "../lib/prisma";
import { publish } from "../lib/eventBus/publish";
import { readSince, replayEvents, type AuthContext } from "../lib/eventBus/store";
import { subscribe, clearSubscriptions } from "../lib/eventBus/registry";
import { requestIdentity, systemIdentity } from "../lib/eventBus/envelope";

const GO = process.env.EVENTBUS_INTEGRATION === "1" && !!process.env.DATABASE_URL;
if (!GO) {
  console.log("eventbus-preview-integration: SKIP (set EVENTBUS_INTEGRATION=1 + preview DATABASE_URL to run)");
  process.exit(0);
}

const TA = "eb-int-TA", TB = "eb-int-TB";
let pass = 0, fail = 0;
const check = (label: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); } };

async function cleanup() {
  await prisma.eventEnvelope.deleteMany({ where: { tenantId: { in: [TA, TB] } } });
}

async function main() {
  process.env.EVENT_BUS_ENABLED = "true";
  await cleanup(); // start clean

  const ctxA: AuthContext = { tenantId: TA, agencyId: null, isAgency: false, isAdmin: false };
  const ctxB: AuthContext = { tenantId: TB, agencyId: null, isAgency: false, isAdmin: false };

  // 1. Publish a system event to TA, then publish the SAME (dedupeKey) again → idempotent replay.
  const r1 = await publish({ type: "SYSTEM_EVENT", payload: { kind: "deploy", detail: "rc8" }, identity: systemIdentity(TA), dedupeKey: "sys:deploy:1" });
  check("first publish succeeds, not replayed", r1.ok === true && r1.replayed === false);
  const r2 = await publish({ type: "SYSTEM_EVENT", payload: { kind: "deploy", detail: "rc8" }, identity: systemIdentity(TA), dedupeKey: "sys:deploy:1" });
  check("second publish (same dedupeKey) is an idempotent replay", r2.ok === true && r2.replayed === true);
  check("replay returns the SAME event id", r1.ok && r2.ok && r1.event.id === r2.event.id);

  // 2. A request-identity self event with the required permission, full ref payload.
  const userId = requestIdentity({ id: TA, role: "USER", isAgency: false }, { id: TA, managedByAgencyId: null }, new Set(["letters:generate"]));
  const r3 = await publish({ type: "LETTER_GENERATED", payload: { letterId: "L1", status: "generated" }, identity: userId, dedupeKey: "letter:L1:generated" });
  check("self LETTER_GENERATED persists", r3.ok === true && r3.replayed === false);

  // 3. A SYSTEM_EVENT for a DIFFERENT tenant TB.
  const rB = await publish({ type: "SYSTEM_EVENT", payload: { kind: "deploy" }, identity: systemIdentity(TB), dedupeKey: "sys:deploy:1" });
  check("TB event persists (same dedupeKey as TA but different tenant → different id, no collision)", rB.ok === true && rB.replayed === false && (r1.ok && rB.ok && r1.event.id !== rB.event.id));

  // 4. Cross-tenant read isolation.
  const readA = await readSince(ctxA, { limit: 50 });
  const readB = await readSince(ctxB, { limit: 50 });
  check("tenant A reads exactly its 2 events", readA.events.length === 2 && readA.events.every((e) => e.tenantId === TA));
  check("tenant A NEVER sees a tenant B event", !readA.events.some((e) => e.tenantId === TB));
  check("tenant B reads exactly its 1 event, none of A's", readB.events.length === 1 && readB.events.every((e) => e.tenantId === TB));

  // 5. FULL-payload replay (proves not hash-only) + deterministic order.
  const replayed = await replayEvents(ctxA, { limit: 50 });
  const sys = replayed.find((e) => e.type === "SYSTEM_EVENT");
  check("replay returns full payload (kind+detail present, not a hash)", !!sys && (sys.payload as any).kind === "deploy" && (sys.payload as any).detail === "rc8");
  const orderStable = replayed.map((e) => `${new Date(e.createdAt).getTime()}:${e.id}`);
  check("replay order is deterministic [createdAt asc, id asc]", JSON.stringify(orderStable) === JSON.stringify([...orderStable].sort()));

  // 6. In-process fanout delivers a fresh event to a live subscriber (not a replay).
  clearSubscriptions();
  let got: string | null = null;
  subscribe("int-test", "SYSTEM_EVENT", (e) => { got = e.id; });
  const r4 = await publish({ type: "SYSTEM_EVENT", payload: { kind: "fanout" }, identity: systemIdentity(TA), dedupeKey: "sys:fanout:1" });
  check("fanout delivered the fresh event to the subscriber", r4.ok === true && got === r4.event.id);
  clearSubscriptions();

  await cleanup(); // leave preview clean
  await prisma.$disconnect();
  console.log(`\neventbus-preview-integration: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => { console.error("integration error:", e); await cleanup().catch(() => {}); await prisma.$disconnect().catch(() => {}); process.exit(1); });
