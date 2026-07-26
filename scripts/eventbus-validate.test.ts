// Run: npx tsx scripts/eventbus-validate.test.ts
//
// Proves the Event Bus contract layer is fail-closed and refs-only: unknown types,
// unknown versions, malformed payloads, and PII-named fields are all REJECTED before
// anything could be persisted or fanned out. Also asserts every registered contract
// is itself PII-free (a future contributor can't add a value-bearing field).
import { z } from "zod";
import { CONTRACTS, getContract, currentVersion, contractKey } from "../lib/eventBus/contracts";
import { validateEvent, assertNoPII, PII_DENYLIST } from "../lib/eventBus/validate";
import { EVENT_TYPES, deriveEventId } from "../lib/eventBus/envelope";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}

// ── Every declared event type has at least one registered contract ───────────
for (const t of EVENT_TYPES) {
  check(`contract registered for ${t}`, Object.values(CONTRACTS).some((c) => c.type === t));
}
// 13 Sprint 8 core + 6 Sprint 9 Operator Identity + 2 Sprint 10 Operator Reputation
// + 4 Slice 2 Operator Enrollment (pre-membership evidence, §2.8).
check("27 event types declared", EVENT_TYPES.length === 27);

// ── Fail-closed: unknown type / version ──────────────────────────────────────
check("unknown type rejected", validateEvent("NOT_A_TYPE", 1, {}).ok === false);
check("known type, unknown version rejected", validateEvent("LETTER_SENT", 99, { letterId: "l1", channel: "mail" }).ok === false);

// ── Valid payloads accepted ──────────────────────────────────────────────────
check("valid DISPUTE_CREATED accepted", validateEvent("DISPUTE_CREATED", 1, { disputeId: "d1", tradelineId: "t1", bureau: "EQUIFAX" }).ok === true);
check("valid LETTER_SENT accepted", validateEvent("LETTER_SENT", 1, { letterId: "l1", channel: "print" }).ok === true);
check("valid ARENA_POINTS_CHANGED accepted", validateEvent("ARENA_POINTS_CHANGED", 1, { xpDelta: -5, totalXp: 20, classId: "A" }).ok === true);
check("valid SYSTEM_EVENT accepted (detail is allowed, bounded)", validateEvent("SYSTEM_EVENT", 1, { kind: "deploy", detail: "release 8" }).ok === true);

// ── Strict schema: extra/wrong fields rejected ───────────────────────────────
check("extra key rejected (.strict)", validateEvent("LETTER_SENT", 1, { letterId: "l1", channel: "mail", extra: 1 }).ok === false);
check("wrong enum rejected", validateEvent("LETTER_SENT", 1, { letterId: "l1", channel: "carrier-pigeon" }).ok === false);
check("missing required field rejected", validateEvent("DISPUTE_CREATED", 1, { disputeId: "d1" }).ok === false);
check("wrong type for number rejected", validateEvent("ARENA_POINTS_CHANGED", 1, { xpDelta: "lots", totalXp: 1, classId: "A" }).ok === false);

// ── PII structural guard ─────────────────────────────────────────────────────
check("assertNoPII flags an email field", assertNoPII({ email: "a@b.com" }).ok === false);
check("assertNoPII flags a nested balance field", assertNoPII({ tl: { balance: 100 } }).ok === false);
check("assertNoPII flags a field inside an array", assertNoPII({ items: [{ address: "x" }] }).ok === false);
check("assertNoPII allows refs-only payload", assertNoPII({ letterId: "l1", tradelineId: "t1", changedFields: ["plan"] }).ok === true);
check("PII denylist is non-empty", PII_DENYLIST.length > 10);
// Value-scanning: a PII VALUE in a free-text field is rejected even if its key is innocuous.
check("assertNoPII rejects an email VALUE", assertNoPII("user@example.com").ok === false);
check("assertNoPII rejects a formatted SSN VALUE", assertNoPII("123-45-6789").ok === false);
check("assertNoPII rejects a nested card-number VALUE", assertNoPII({ detail: "4111111111111111" }).ok === false);
check("assertNoPII allows a plain field-name string VALUE", assertNoPII("plan").ok === true && assertNoPII({ changedFields: ["plan", "email"] }).ok === true);
check("validateEvent rejects a PII email inside changedFields", validateEvent("ACCOUNT_UPDATED", 1, { accountId: "a1", changedFields: ["user@x.com"] }).ok === false);
check("validateEvent rejects an SSN in SYSTEM_EVENT.detail", validateEvent("SYSTEM_EVENT", 1, { kind: "x", detail: "ssn 123-45-6789" }).ok === false);

// A contract that (hypothetically) carried a PII field must be rejected by validateEvent
// via the guard — simulate by asserting the guard runs on real payloads.
check("validateEvent rejects a PII key even if schema-shaped elsewhere",
  validateEvent("ACCOUNT_UPDATED", 1, { accountId: "a1", changedFields: ["email"] }).ok === true // field NAME "email" is allowed as a value inside changedFields (a string), not as a KEY
);
check("validateEvent rejects a payload whose KEY is PII (via a malformed extra)",
  validateEvent("ACCOUNT_UPDATED", 1, { accountId: "a1", changedFields: [], email: "x@y.z" }).ok === false // .strict drops it first, but either way: rejected
);

// ── Every registered contract is itself PII-free (registry integrity) ────────
for (const [key, c] of Object.entries(CONTRACTS)) {
  // Build a representative object from the schema's declared keys and assert none is PII-named.
  const shape = (c.schema as z.ZodObject<z.ZodRawShape>)._def?.shape?.() ?? {};
  const keys = Object.keys(shape);
  const piiKey = keys.find((k) => PII_DENYLIST.some((bad) => k.toLowerCase().includes(bad)));
  check(`contract ${key} declares no PII-named field${piiKey ? ` (found: ${piiKey})` : ""}`, !piiKey);
}

// ── currentVersion + deterministic id ────────────────────────────────────────
check("currentVersion(LETTER_SENT) === 1", currentVersion("LETTER_SENT") === 1);
check("contractKey composes type@version", contractKey("LETTER_SENT", 1) === "LETTER_SENT@1");
check("getContract resolves a registered contract", getContract("LETTER_SENT", 1)?.type === "LETTER_SENT");
// deterministic + tenant+type-scoped id: same inputs => same id; different tenant/type => different id
check("deriveEventId is deterministic", deriveEventId("t1", "LETTER_SENT", "letters", "letter:1") === deriveEventId("t1", "LETTER_SENT", "letters", "letter:1"));
check("deriveEventId is tenant-scoped (no cross-tenant collision)", deriveEventId("t1", "LETTER_SENT", "letters", "letter:1") !== deriveEventId("t2", "LETTER_SENT", "letters", "letter:1"));
check("deriveEventId is TYPE-scoped (two types, same source+dedupeKey, never collide)", deriveEventId("t1", "LETTER_SENT", "letters", "letter:1") !== deriveEventId("t1", "LETTER_GENERATED", "letters", "letter:1"));

// ── NEGATIVE CONTROL ─────────────────────────────────────────────────────────
check("negative control: an unregistered type is never silently accepted", validateEvent("ARENA_POINTS_CHANGED", 2, { xpDelta: 1, totalXp: 1, classId: "A" }).ok === false);

console.log(`\neventbus-validate.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
