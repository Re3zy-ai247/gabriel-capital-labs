// Guard for Implementation Slice 1 — Operator Lifecycle Runtime.
// Identity Constitution v1.0 §1.11, §1.16, §4, §9.1, §10.4, §11.2.
//
// PURE + EXECUTED, no database. The decision function is total, so the whole transition
// space is enumerated exhaustively rather than sampled: every (from, to, authority, basis,
// actorIsSubject, stepUp, ownsOrg) combination is decided and cross-checked against the
// frozen state machine. The command path is exercised with the flag OFF, which is the
// only reachable runtime state today.
//
// Run: npx tsx scripts/identity-lifecycle.test.ts
import { readFileSync } from "node:fs";
import {
  decideTransition, canonicalJson, decisionDigest, transitionOperator,
  transitionRequiresStepUp, stepUpCapabilityAvailable, platformAuthorityVerifierAvailable,
  ownerControlResolverAvailable, lifecycleExecutionBlock, lifecycleEventId,
  replayedLifecycleTransition,
  OPERATOR_LIFECYCLE_POLICY_VERSION, TRANSITION_AUTHORITIES, TRANSITION_BASES,
  type TransitionAuthority, type TransitionBasis, type AuthenticationStepUpFact,
} from "../lib/identity/lifecycle";
import { canTransitionOperator, OPERATOR_STATES, type OperatorState } from "../lib/identity/state";
import { buildOperatorStateChangedEvent, draftIdentityEvent, type EvidenceInput } from "../lib/identity/events";
import { validateEvent } from "../lib/eventBus/validate";
import { getContract, currentVersion } from "../lib/eventBus/contracts";
import { assertNoPII } from "../lib/eventBus/validate";

let pass = 0, fail = 0; const bad: string[] = [];
const check = (label: string, cond: boolean) => { cond ? pass++ : (fail++, bad.push(`FAIL: ${label}`)); };

const STATES = [...OPERATOR_STATES] as OperatorState[];
const STEP_UP: AuthenticationStepUpFact = { method: "test", verifiedAt: 1 };

function decide(
  from: OperatorState, to: OperatorState, authority: TransitionAuthority, basis: TransitionBasis,
  opts: { actorIsSubject?: boolean; stepUp?: AuthenticationStepUpFact | null; ownsOrg?: boolean } = {},
) {
  return decideTransition({
    from, to, authority, basis,
    actorIsSubject: opts.actorIsSubject ?? (authority === "SELF"),
    stepUp: opts.stepUp ?? null,
    ownsActiveOrSuspendedOrganization: opts.ownsOrg ?? false,
  });
}

// ── 1. The frozen transition table is the hardest gate (§4.2) ────────────────
// Exhaustive: no combination of authority/basis/step-up/ownership can ever open an edge
// the state machine does not declare.
{
  let leaked = 0, checked = 0;
  for (const from of STATES) for (const to of STATES) {
    if (canTransitionOperator(from, to)) continue;
    for (const authority of TRANSITION_AUTHORITIES) for (const basis of TRANSITION_BASES) {
      for (const actorIsSubject of [true, false]) for (const stepUp of [null, STEP_UP]) for (const ownsOrg of [true, false]) {
        checked++;
        const d = decideTransition({ from, to, authority, basis, actorIsSubject, stepUp, ownsActiveOrSuspendedOrganization: ownsOrg });
        if (d.allowed) leaked++;
      }
    }
  }
  check(`1· EXHAUSTIVE: no illegal edge is ever allowed (${checked} combinations, 0 leaks)`, leaked === 0 && checked > 0);
}

// ── 2. Every legal edge has at least one authorized path (no dead edges) ─────
{
  const legal: string[] = [];
  for (const from of STATES) for (const to of STATES) if (canTransitionOperator(from, to)) legal.push(`${from}->${to}`);
  check("2· the frozen table has exactly the six ratified edges", legal.length === 6
    && ["PENDING->ACTIVE", "PENDING->DEACTIVATED", "ACTIVE->SUSPENDED", "ACTIVE->DEACTIVATED", "SUSPENDED->ACTIVE", "SUSPENDED->DEACTIVATED"]
      .every((e) => legal.includes(e)));

  // The pure policy exposes only non-terminal edges while Authentication's step-up
  // capability is absent. Executable command reachability is tested separately.
  const reachable = legal.filter((edge) => {
    const [from, to] = edge.split("->") as [OperatorState, OperatorState];
    return TRANSITION_AUTHORITIES.some((a) => TRANSITION_BASES.some((b) =>
      decide(from, to, a, b, { actorIsSubject: a === "SELF", stepUp: STEP_UP }).allowed));
  });
  check("2b· the pure policy exposes each currently non-terminal edge", reachable.length === 3
    && reachable.every((e) => !e.endsWith("->DEACTIVATED")));
}

// ── 3. Legal edges, correct authority (§4.3, §4.5) ──────────────────────────
check("3· PENDING->ACTIVE by Platform Identity Review", decide("PENDING", "ACTIVE", "PLATFORM_IDENTITY_REVIEW", "PLATFORM_REVIEW_APPROVED").allowed);
check("3b· PENDING->ACTIVE by SELF is DENIED (no ratified auto-activation policy, §4.3)",
  !decide("PENDING", "ACTIVE", "SELF", "PLATFORM_REVIEW_APPROVED").allowed);
check("3c· ACTIVE->SUSPENDED by SELF (§4.5 self-service default)",
  decide("ACTIVE", "SUSPENDED", "SELF", "SUBJECT_SELF_SERVICE_EXIT").allowed);
check("3d· ACTIVE->SUSPENDED by Platform Security", decide("ACTIVE", "SUSPENDED", "PLATFORM_SECURITY", "PLATFORM_SECURITY_HOLD").allowed);
check("3e· SUSPENDED->ACTIVE by Platform Security (resolution evidence)",
  decide("SUSPENDED", "ACTIVE", "PLATFORM_SECURITY", "PLATFORM_SECURITY_CLEARED").allowed);
check("3f· SUSPENDED->ACTIVE by SELF is DENIED (no ratified self-reinstatement — fails closed)",
  !decide("SUSPENDED", "ACTIVE", "SELF", "SUBJECT_SELF_SERVICE_EXIT").allowed);

// ── 4. DEACTIVATED is terminal and temporarily hard-fail-closed ───────────────
check("4· step-up capability is absent, so it is fail-closed false", stepUpCapabilityAvailable() === false);
check("4b· only DEACTIVATED requires step-up", STATES.every((s) => transitionRequiresStepUp(s) === (s === "DEACTIVATED")));
for (const from of ["PENDING", "ACTIVE", "SUSPENDED"] as OperatorState[]) {
  const d = decide(from, "DEACTIVATED", "PLATFORM_SECURITY", "PLATFORM_SECURITY_HOLD", { actorIsSubject: false, stepUp: STEP_UP });
  check(`4c· ${from}->DEACTIVATED denied step_up_required even with a pure-policy fact`,
    !d.allowed && d.code === "step_up_required");
}
check("4d· DEACTIVATED is terminal — no outbound edge from any authority", STATES.every((to) =>
  TRANSITION_AUTHORITIES.every((a) => TRANSITION_BASES.every((b) =>
    !decide("DEACTIVATED", to, a, b, { actorIsSubject: true, stepUp: STEP_UP, ownsOrg: false }).allowed))));

// ── 5. §4.7 owner protection ─────────────────────────────────────────────────
{
  const susp = decide("ACTIVE", "SUSPENDED", "SELF", "SUBJECT_SELF_SERVICE_EXIT", { ownsOrg: true });
  check("5· sole owner of an ACTIVE/SUSPENDED Org cannot be SUSPENDED (§4.7, fails closed)",
    !susp.allowed && susp.code === "owner_invariant");
  const deact = decide("ACTIVE", "DEACTIVATED", "SELF", "SUBJECT_CONFIRMED_DEACTIVATION", { ownsOrg: true, stepUp: STEP_UP });
  check("5b· sole owner cannot be DEACTIVATED (§4.7)", !deact.allowed && deact.code === "owner_invariant");
  check("5c· owner invariant is checked BEFORE step-up (ownership denial is not masked)",
    deact.allowed === false && deact.code === "owner_invariant");
  check("5d· a non-owner is unaffected", decide("ACTIVE", "SUSPENDED", "SELF", "SUBJECT_SELF_SERVICE_EXIT", { ownsOrg: false }).allowed);
}

// ── 6. Authority / basis coherence (§7.8, §11.2, §15.14) ────────────────────
check("6· SELF authority requires the actor to BE the subject",
  !decide("ACTIVE", "SUSPENDED", "SELF", "SUBJECT_SELF_SERVICE_EXIT", { actorIsSubject: false }).allowed);
{
  const d = decide("PENDING", "ACTIVE", "PLATFORM_IDENTITY_REVIEW", "PLATFORM_REVIEW_APPROVED", { actorIsSubject: true });
  check("6b· nobody exercises platform authority over their own identity (self_approval)",
    !d.allowed && d.code === "self_approval");
}
{
  const d = decide("ACTIVE", "SUSPENDED", "SELF", "PLATFORM_SECURITY_HOLD");
  check("6c· a platform basis under SELF authority is incoherent", !d.allowed && d.code === "basis_incoherent");
}
check("6d· EXHAUSTIVE: every allowed decision has a basis belonging to its authority class",
  STATES.every((from) => STATES.every((to) => TRANSITION_AUTHORITIES.every((a) => TRANSITION_BASES.every((b) => {
    const d = decide(from, to, a, b, { actorIsSubject: a === "SELF", stepUp: STEP_UP });
    if (!d.allowed) return true;
    return (a === "SELF") === b.startsWith("SUBJECT_");
  })))));
check("6e· Platform Authority verifier is absent, so an enum input cannot grant authority",
  platformAuthorityVerifierAvailable() === false && lifecycleExecutionBlock("PLATFORM_IDENTITY_REVIEW", "ACTIVE") === "forbidden");
// Organizations' current resolver is a read-only, non-composable fact read. §4.7 remains
// hard-blocked until it can participate in this command's mutation/evidence transaction.
check("6f· owner-control remains capability-blocked until the resolver is transaction-composable",
  ownerControlResolverAvailable() === false && lifecycleExecutionBlock("SELF", "SUSPENDED") === "owner_invariant");
check("6f2· §4.7 is still enforced — an owner of an ACTIVE/SUSPENDED Org cannot be suspended",
  (() => { const d = decide("ACTIVE", "SUSPENDED", "SELF", "SUBJECT_SELF_SERVICE_EXIT", { ownsOrg: true });
    return !d.allowed && d.code === "owner_invariant"; })());
check("6g· deactivation is hard-denied until Authentication supplies a verifier",
  lifecycleExecutionBlock("SELF", "DEACTIVATED") === "step_up_required");

// ── 7. Determinism (§1.16) ───────────────────────────────────────────────────
{
  let stable = true;
  for (const from of STATES) for (const to of STATES) for (const a of TRANSITION_AUTHORITIES) for (const b of TRANSITION_BASES) {
    const one = JSON.stringify(decide(from, to, a, b, { stepUp: STEP_UP }));
    const two = JSON.stringify(decide(from, to, a, b, { stepUp: STEP_UP }));
    if (one !== two) stable = false;
  }
  check("7· EXHAUSTIVE: the decision function is deterministic (same request => same decision)", stable);
  const src = readFileSync("lib/identity/lifecycle.ts", "utf8");
  const body = src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  check("7b· no ambient clock or randomness in the lifecycle module", !/Date\.now\(|Math\.random\(|new Date\(/.test(body));
  check("7c· effectiveAt is a sealed input, not derived", /effectiveAt: number/.test(body));
}

// ── 8. Canonical serialization + digest (§10.4 byte-identical replay) ───────
check("8· canonicalJson fixes key order", canonicalJson({ b: 1, a: 2 }) === '{"a":2,"b":1}');
check("8b· canonicalJson is stable across differently-ordered equal objects",
  canonicalJson({ x: { q: 1, p: 2 }, y: [3, 4] }) === canonicalJson({ y: [3, 4], x: { p: 2, q: 1 } }));
check("8c· canonicalJson drops undefined deterministically", canonicalJson({ a: 1, b: undefined }) === '{"a":1}');
check("8d· non-deterministic numbers are rejected", (() => {
  try { canonicalJson({ a: 1.5 }); return false; } catch { return true; }
})());
check("8e· NaN/Infinity rejected", (() => {
  try { canonicalJson({ a: NaN }); return false; } catch { return true; }
})());
{
  const sealed = { policyVersion: OPERATOR_LIFECYCLE_POLICY_VERSION, operatorId: "op1", from: "ACTIVE", to: "SUSPENDED", authorityClass: "SELF", basis: "SUBJECT_SELF_SERVICE_EXIT", actorId: "a1", commandId: "c1", effectiveAt: 1_700_000_000_000, stepUp: false };
  const d1 = decisionDigest(sealed);
  const d2 = decisionDigest({ ...sealed });
  check("8f· BYTE-IDENTICAL: same sealed inputs => same digest", d1 === d2);
  check("8g· digest is sha256:<64 hex>", /^sha256:[0-9a-f]{64}$/.test(d1));
  check("8h· any sealed input change changes the digest", decisionDigest({ ...sealed, to: "DEACTIVATED" }) !== d1);
  check("8i· the digest can never trip the PII value scan (sha256: prefix)", assertNoPII({ decisionDigest: d1 }).ok === true);
}

// ── 9. Evidence contract (§11.2 minimum envelope) ───────────────────────────
{
  const sealed = { policyVersion: OPERATOR_LIFECYCLE_POLICY_VERSION, operatorId: "op1", from: "ACTIVE" as const, to: "SUSPENDED" as const, authorityClass: "SELF", basis: "SUBJECT_SELF_SERVICE_EXIT", actorId: "a1", commandId: "cmd-9", effectiveAt: 1_700_000_000_000, stepUp: false };
  const ev: EvidenceInput = { ...sealed, decisionDigest: decisionDigest(sealed), causationId: null };
  const built = buildOperatorStateChangedEvent({ id: "op1", accountId: "acc1" }, ev, "a1");

  check("9· OPERATOR_STATE_CHANGED current version is 2 (versioned evidence contract, §11.4)", currentVersion("OPERATOR_STATE_CHANGED") === 2);
  check("9b· v1 stays registered so historical rows replay against their own version", getContract("OPERATOR_STATE_CHANGED", 1) !== null);
  check("9c· the evidence payload validates against @2", validateEvent("OPERATOR_STATE_CHANGED", 2, built.payload).ok === true);

  const required = ["policyVersion", "authorityClass", "basis", "actorId", "commandId", "effectiveAt", "stepUp", "decisionDigest", "causationId", "operatorId", "from", "to"];
  check("9d· evidence carries the §11.2 minimum envelope", required.every((k) => k in built.payload));
  check("9e· evidence is refs-only — no PII key or value", assertNoPII(built.payload).ok === true);
  check("9f· no payload key contains 'reason' (the guard denylists it; basis is used instead)",
    !Object.keys(built.payload).some((k) => /reason/i.test(k)));
  check("9g· tenant = the SUBJECT's account, actor = the principal", built.tenantId === "acc1" && built.actorId === "a1");
  check("9h· dedupeKey is the commandId alone (the event stream is the idempotency ledger)",
    built.dedupeKey === "operator-lifecycle:cmd-9");

  // A v1-shaped payload must now FAIL against the current contract — proving new actions
  // cannot silently emit the old, evidence-free shape.
  check("9i· the pre-Slice-1 payload shape is rejected by the current contract",
    validateEvent("OPERATOR_STATE_CHANGED", 2, { operatorId: "op1", from: "ACTIVE", to: "SUSPENDED" }).ok === false);

  // Idempotency: same command => same derived id; different command => different id.
  const evB: EvidenceInput = { ...ev, commandId: "cmd-10", decisionDigest: decisionDigest({ ...sealed, commandId: "cmd-10" }) };
  const a = buildOperatorStateChangedEvent({ id: "op1", accountId: "acc1" }, ev, "a1");
  const b = buildOperatorStateChangedEvent({ id: "op1", accountId: "acc1" }, evB, "a1");
  check("9j· same commandId => identical dedupeKey (replay collides)", a.dedupeKey === built.dedupeKey);
  check("9k· different commandId => different dedupeKey", a.dedupeKey !== b.dedupeKey);
}

// ── 10. Replay compares sealed material inputs, not the current projection ────
{
  const eventId = lifecycleEventId("acc-replay", "cmd-replay");
  const sealed = {
    policyVersion: OPERATOR_LIFECYCLE_POLICY_VERSION, operatorId: "op-replay",
    from: "ACTIVE" as const, to: "SUSPENDED" as const, authorityClass: "SELF",
    basis: "SUBJECT_SELF_SERVICE_EXIT", actorId: "acc-replay", commandId: "cmd-replay",
    effectiveAt: 1_700_000_000_000, stepUp: false,
  };
  const prior = {
    id: eventId, type: "OPERATOR_STATE_CHANGED", version: 2, correlationId: eventId,
    payload: { ...sealed, decisionDigest: decisionDigest(sealed), causationId: null },
  };
  const expected = {
    eventId, operatorId: "op-replay", to: "SUSPENDED" as const, authority: "SELF" as const,
    basis: "SUBJECT_SELF_SERVICE_EXIT" as const, actorId: "acc-replay", commandId: "cmd-replay",
    effectiveAt: 1_700_000_000_000,
  };
  const original = replayedLifecycleTransition(prior, expected);
  check("10· matching replay returns the original transition even after a later projection change",
    original?.from === "ACTIVE" && original.to === "SUSPENDED");
  check("10b· material-input changes never replay", replayedLifecycleTransition(prior, { ...expected, effectiveAt: 2 }) === null);
  check("10c· a mismatched correlation never replays", replayedLifecycleTransition({ ...prior, correlationId: "different" }, expected) === null);
  check("10d· a tampered digest never replays", replayedLifecycleTransition({ ...prior, payload: { ...prior.payload, decisionDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000" } }, expected) === null);
}

// ── 11. Flag OFF: the whole runtime is a no-op (§14.9, §1.15) ───────────────
(async () => {
  check("11· flag is off in this environment", process.env.OPERATOR_IDENTITY_ENABLED !== "true");

  const sealed = { policyVersion: OPERATOR_LIFECYCLE_POLICY_VERSION, operatorId: "op1", from: "ACTIVE" as const, to: "SUSPENDED" as const, authorityClass: "SELF", basis: "SUBJECT_SELF_SERVICE_EXIT", actorId: "a1", commandId: "c", effectiveAt: 1, stepUp: false };
  const draft = draftIdentityEvent(buildOperatorStateChangedEvent({ id: "op1", accountId: "acc1" }, { ...sealed, decisionDigest: decisionDigest(sealed), causationId: null }, "a1"));
  check("11b· draftIdentityEvent is fail-closed disabled with the flag off",
    draft.ok === false && draft.code === "disabled");

  const p = { id: "a1", role: "ADMIN", isAgency: false, disabled: false };
  const cmd = { operatorId: "op1", to: "ACTIVE" as const, authority: "PLATFORM_IDENTITY_REVIEW" as const, basis: "PLATFORM_REVIEW_APPROVED" as const, commandId: "c1", effectiveAt: 1 };
  const r = await transitionOperator(p, cmd);
  check("11c· transitionOperator is disabled with the flag off (no DB touch)", r.ok === false && r.code === "disabled");
  const rNull = await transitionOperator(null, cmd);
  check("11d· null principal + flag off => disabled, never a throw", rNull.ok === false && rNull.code === "disabled");
  const again = await transitionOperator(p, cmd);
  check("11e· repeating the command is byte-identical while disabled (deterministic)",
    JSON.stringify(again) === JSON.stringify(r));

  // The master flag alone can never turn a missing authority/owner/authentication seam
  // into a mutation path. These calls must return before any repository access.
  const priorFlag = process.env.OPERATOR_IDENTITY_ENABLED;
  try {
    process.env.OPERATOR_IDENTITY_ENABLED = "true";
    const platform = await transitionOperator(p, cmd);
    const selfSuspension = await transitionOperator(
      { id: "subject", role: "USER", isAgency: false, disabled: false },
      { operatorId: "op1", to: "SUSPENDED", authority: "SELF", basis: "SUBJECT_SELF_SERVICE_EXIT", commandId: "s1", effectiveAt: 1 },
    );
    const deactivation = await transitionOperator(
      { id: "subject", role: "USER", isAgency: false, disabled: false },
      { operatorId: "op1", to: "DEACTIVATED", authority: "SELF", basis: "SUBJECT_CONFIRMED_DEACTIVATION", commandId: "d1", effectiveAt: 1 },
    );
    check("11f· flag-on caller cannot forge Platform Authority", platform.ok === false && platform.code === "forbidden");
    check("11g· flag-on suspension remains denied before repository access until §4.7 is atomic",
      selfSuspension.ok === false && selfSuspension.code === "owner_invariant");
    check("11h· flag-on deactivation fails before an Authentication verifier exists", deactivation.ok === false && deactivation.code === "step_up_required");
  } finally {
    if (priorFlag === undefined) delete process.env.OPERATOR_IDENTITY_ENABLED;
    else process.env.OPERATOR_IDENTITY_ENABLED = priorFlag;
  }

  // ── 12. Structural guarantees ──────────────────────────────────────────────
  const life = readFileSync("lib/identity/lifecycle.ts", "utf8");
  const svc = readFileSync("lib/identity/service.ts", "utf8");
  const repoSrc = readFileSync("lib/identity/repository.ts", "utf8");

  check("12· the flag is the FIRST gate in the command", life.indexOf("operatorIdentityEnabled()") < life.indexOf("repo.findOperatorById"));
  check("12b· state write and evidence append share one transaction with strict duplicate rollback",
    /\$transaction\(async \(tx\)/.test(life) && /appendEvent\(draft\.event, tx, \{ onDuplicate: "error" \}\)/.test(life));
  check("12c· evidence is NOT written when the guarded state write does not move a row",
    /if \(res\.count !== 1\) return null;/.test(life));
  check("12d· the ledger is checked before pure transition evaluation and collisions fail closed",
    life.indexOf("const prior = await existingReplay()") < life.indexOf("const decision = decideTransition") && /idempotency_conflict/.test(life));
  check("12e· service delegates — exactly one lifecycle implementation (§17)",
    /export \{ transitionOperator \} from "\.\/lifecycle"/.test(svc) && !/updateMany/.test(svc));
  check("12f· the §8.3 forbidden shortcut is gone from the lifecycle path",
    !/isAdmin\(/.test(life));
  check("12g· Platform Authority and owner-control execution are hard-fail-closed before subject lookup",
    life.indexOf("const executionBlock = lifecycleExecutionBlock") < life.indexOf("repo.findOperatorById"));
  const commandShape = life.match(/export interface TransitionCommand \{[\s\S]*?\n\}/)?.[0] ?? "";
  check("12h· executable commands accept no caller-supplied step-up, causation, or correlation assertions",
    !/stepUp|causationId|correlationId/.test(commandShape));
  check("12i· lifecycle command never mutates an Organization", !/organization\.(update|delete|create|upsert)/i.test(life));
  check("12j· repository issues no CREATE TABLE (migration-first)", !/CREATE TABLE/i.test(repoSrc));
  check("12k· lifecycle module creates no schema and runs no migration",
    !/CREATE TABLE|ALTER TABLE|\$executeRaw/i.test(life));
  check("12l· lifecycle does not reopen §4.7 through a global Organization projection count",
    !/countOwnedActiveOrSuspendedOrganizations/.test(life));

  if (bad.length) console.error(bad.join("\n"));
  console.log(`\nidentity-lifecycle.test.ts: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
