// Run: npx tsx scripts/identity-events.test.ts
//
// The Operator Identity event integration (Sprint 9): the 6 identity contracts on the
// Event Fabric, the pure event builders, and recordIdentityEvent's fail-closed gate.
// Proves: refs-only payloads (no PII key), only a trusted/admin identity can emit an
// identity event (forgery defense), deterministic (replay-safe) ids, enum lockstep, no
// fanout, and that recording is a no-op when the flag is off. DB-less.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getContract } from "../lib/eventBus/contracts";
import { validateEvent } from "../lib/eventBus/validate";
import { authorizePublish } from "../lib/eventBus/publish";
import { deriveEventId, systemIdentity, type PublishIdentity } from "../lib/eventBus/envelope";
import {
  IDENTITY_EVENT_TYPES, recordIdentityEvent,
  operatorRegisteredEvent, buildOperatorStateChangedEvent, organizationCreatedEvent,
  membershipAddedEvent, membershipRoleChangedEvent, membershipRemovedEvent,
  type EvidenceInput,
} from "../lib/identity/events";
import { OPERATOR_STATES } from "../lib/identity/state";
import { ORG_ROLES } from "../lib/identity/rbac";
import { OPERATOR_LIFECYCLE_POLICY_VERSION, decisionDigest } from "../lib/identity/lifecycle";

// A canonical Slice 1 evidence record (§11.2 minimum envelope).
const EV_SEALED = {
  policyVersion: OPERATOR_LIFECYCLE_POLICY_VERSION, operatorId: "op1", from: "ACTIVE" as const,
  to: "SUSPENDED" as const, authorityClass: "SELF", basis: "SUBJECT_SELF_SERVICE_EXIT",
  actorId: "act", commandId: "cmd-0", effectiveAt: 1_700_000_000_000, stepUp: false,
};
const EV: EvidenceInput = { ...EV_SEALED, decisionDigest: decisionDigest(EV_SEALED), causationId: null };
import { ORGANIZATION_KINDS } from "../lib/identity/validation";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const eventsSrc = readFileSync(join(__dirname, "..", "lib/identity/events.ts"), "utf8");
const schema = readFileSync(join(__dirname, "..", "prisma/schema.prisma"), "utf8");

// ── All 6 identity contracts registered, sourced "identity", scope "platform" ─
for (const t of IDENTITY_EVENT_TYPES) {
  const c = getContract(t, 1);
  check(`contract ${t}@1 registered`, !!c);
  check(`${t} defaultSource=identity`, c?.defaultSource === "identity");
  check(`${t} scope=platform`, c?.scope === "platform");
  check(`${t} declares no requiredPermission (audit, no entitlement gate)`, c?.requiredPermission === undefined);
}

// ── Refs-only: valid payloads accepted; PII-named key / extra key rejected ────
check("OPERATOR_REGISTERED valid", validateEvent("OPERATOR_REGISTERED", 1, { operatorId: "op1", accountId: "a1" }).ok === true);
check("OPERATOR_REGISTERED rejects extra key (strict)", validateEvent("OPERATOR_REGISTERED", 1, { operatorId: "op1", accountId: "a1", email: "x@y.z" } as any).ok === false);
check("OPERATOR_STATE_CHANGED valid enums", validateEvent("OPERATOR_STATE_CHANGED", 1, { operatorId: "op1", from: "ACTIVE", to: "SUSPENDED" }).ok === true);
check("OPERATOR_STATE_CHANGED rejects bad enum", validateEvent("OPERATOR_STATE_CHANGED", 1, { operatorId: "op1", from: "ACTIVE", to: "ZOMBIE" } as any).ok === false);
check("MEMBERSHIP_ADDED valid role", validateEvent("MEMBERSHIP_ADDED", 1, { organizationId: "o1", operatorId: "op1", role: "MEMBER" }).ok === true);
check("MEMBERSHIP_ADDED rejects bad role", validateEvent("MEMBERSHIP_ADDED", 1, { organizationId: "o1", operatorId: "op1", role: "GOD" } as any).ok === false);
check("ORGANIZATION_CREATED valid", validateEvent("ORGANIZATION_CREATED", 1, { organizationId: "o1", ownerAccountId: "a1", kind: "AGENCY" }).ok === true);
check("ORGANIZATION_CREATED accepts a non-AGENCY kind (generic org)", validateEvent("ORGANIZATION_CREATED", 1, { organizationId: "o1", ownerAccountId: "a1", kind: "ENTERPRISE" }).ok === true);
check("ORGANIZATION_CREATED contract kind === every schema OrganizationKind", [...ORGANIZATION_KINDS].every((k) => validateEvent("ORGANIZATION_CREATED", 1, { organizationId: "o1", ownerAccountId: "a1", kind: k }).ok === true));

// No identity payload carries a PII-named key (the guard denylists reason/name/etc.).
{
  const samples = [
    { ver: 1, e: operatorRegisteredEvent({ id: "op1", accountId: "a1" }, "act") },
    // Slice 1: OPERATOR_STATE_CHANGED is now the versioned evidence contract (@2).
    { ver: 2, e: buildOperatorStateChangedEvent({ id: "op1", accountId: "a1" }, EV, "act") },
    { ver: 1, e: organizationCreatedEvent({ id: "o1", ownerAccountId: "a1", kind: "AGENCY" }, "act") },
    { ver: 1, e: membershipAddedEvent({ organizationId: "o1", operatorId: "op1", role: "MEMBER" }, "a1", "act") },
    { ver: 1, e: membershipRoleChangedEvent({ organizationId: "o1", operatorId: "op1" }, "MEMBER", "ADMIN", "a1", "act", 123) },
    { ver: 1, e: membershipRemovedEvent({ organizationId: "o1", operatorId: "op1" }, "a1", "act") },
  ];
  const piiKey = /(email|ssn|name|phone|address|reason|body|token|secret|password)/i;
  check("every builder payload passes validate (refs-only, contract-clean)",
    samples.every((s) => validateEvent(s.e.type, s.ver, s.e.payload).ok === true));
  check("no builder payload has a PII-named key", samples.every((s) => !Object.keys(s.e.payload).some((k) => piiKey.test(k))));
}

// ── Builders: correct subject tenant, actor, dedupeKey ───────────────────────
{
  const e = operatorRegisteredEvent({ id: "op9", accountId: "acc9" }, "admin1");
  check("register: tenant = subject account", e.tenantId === "acc9");
  check("register: actor = principal", e.actorId === "admin1");
  check("register: dedupeKey stable", e.dedupeKey === "operator:op9:registered");

  // Slice 1: the dedupeKey is the commandId alone, so the event stream is the
  // idempotency ledger — distinct commands never collapse, a replay always collides.
  const s1 = buildOperatorStateChangedEvent({ id: "op9", accountId: "acc9" }, { ...EV, commandId: "cmd-1" }, "admin1");
  const s2 = buildOperatorStateChangedEvent({ id: "op9", accountId: "acc9" }, { ...EV, commandId: "cmd-2" }, "admin1");
  check("distinct commandIds produce distinct dedupeKeys (oscillation not collapsed)", s1.dedupeKey !== s2.dedupeKey);
  check("the same commandId replays to the same dedupeKey",
    buildOperatorStateChangedEvent({ id: "op9", accountId: "acc9" }, { ...EV, commandId: "cmd-1" }, "admin1").dedupeKey === s1.dedupeKey);

  const org = organizationCreatedEvent({ id: "o1", ownerAccountId: "acc9", kind: "AGENCY" }, "acc9");
  check("org-created: tenant = owner account", org.tenantId === "acc9");
  check("org-created: agencyId = the org id", org.agencyId === "o1");

  const m = membershipAddedEvent({ organizationId: "o1", operatorId: "op9", role: "MEMBER" }, "acc9", "acc9");
  check("membership: tenant = org owner account", m.tenantId === "acc9");
  check("membership add dedupeKey", m.dedupeKey === "membership:o1:op9:added");
}

// ── Deterministic id (replay-safe): version-independent, same input -> same id ─
{
  const a = deriveEventId("acc9", "OPERATOR_REGISTERED", "identity", "operator:op9:registered");
  const b = deriveEventId("acc9", "OPERATOR_REGISTERED", "identity", "operator:op9:registered");
  check("deriveEventId is deterministic", a === b && a.startsWith("evt_"));
  check("different tenant -> different id (tenant-scoped)", deriveEventId("other", "OPERATOR_REGISTERED", "identity", "operator:op9:registered") !== a);
}

// ── Authorization: only trusted/admin may emit identity (platform-scope) events ─
{
  const idOf = (o: Partial<PublishIdentity>): PublishIdentity => ({
    actorId: "a", tenantId: "t", agencyId: null, isAdmin: false, isAgency: false, grantedPermissions: new Set(), trusted: false, ...o,
  });
  for (const t of IDENTITY_EVENT_TYPES) {
    const c = getContract(t, 1)!;
    check(`${t}: trusted systemIdentity allowed`, authorizePublish(c, systemIdentity("acc9", { actorId: "admin1" })).ok === true);
    check(`${t}: ordinary (non-admin, non-trusted) identity DENIED — no forgery`, authorizePublish(c, idOf({})).ok === false);
  }
}

// ── Enum lockstep with schema ────────────────────────────────────────────────
function enumValues(name: string): string[] {
  const m = schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`));
  return m ? m[1].trim().split(/\s+/).filter(Boolean) : [];
}
check("OPERATOR_STATE_CHANGED enum accepts every OperatorState",
  [...OPERATOR_STATES].every((s) => validateEvent("OPERATOR_STATE_CHANGED", 1, { operatorId: "x", from: "ACTIVE", to: s }).ok === true));
check("contract state values === schema OperatorState enum",
  JSON.stringify([...OPERATOR_STATES].sort()) === JSON.stringify(enumValues("OperatorState").sort()));
check("MEMBERSHIP role values === schema OrgRole enum",
  JSON.stringify([...ORG_ROLES].sort()) === JSON.stringify(enumValues("OrgRole").sort()));

// ── Code-scan: audit path, no fanout, flag-gated ─────────────────────────────
check("events.ts uses the durable appendEvent", /appendEvent\(/.test(eventsSrc));
check("events.ts does NOT fan out (no deliver/registry import)", !/from "@\/lib\/eventBus\/registry"/.test(eventsSrc) && !/\bdeliver\(/.test(eventsSrc));
check("events.ts records under a trusted systemIdentity", /systemIdentity\(/.test(eventsSrc));
check("events.ts checks operatorIdentityEnabled() as the gate", /operatorIdentityEnabled\(\)/.test(eventsSrc));

// ── recordIdentityEvent is a fail-closed no-op when the flag is off ──────────
(async () => {
  const r = await recordIdentityEvent(operatorRegisteredEvent({ id: "op1", accountId: "a1" }, "act"));
  check("recordIdentityEvent fail-closed when OPERATOR_IDENTITY_ENABLED unset (disabled, no DB touch)", r.ok === false && (r as any).code === "disabled");
  console.log(`\nidentity-events.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
