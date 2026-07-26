// Guard for Implementation Slice 3 — Organizations Runtime.
// Identity Constitution v1.0 §2.4, §2.5, §5.3, §6.1-6.7, §8.1 gate 5, §11.2, §17.3,
// as amended by ICAP-1 A-6 (the definition of "owner Membership").
//
// PURE + EXECUTED, no database. `decideOrganizationTransition` and
// `evaluateOwnerInvariant` are total, so both decision spaces are enumerated EXHAUSTIVELY
// rather than sampled.
//
// THE PRIMARY OBJECTIVE is the owner invariant: every ACTIVE Organization must resolve to
// exactly ONE valid owner, via account -> OperatorIdentity -> Membership, and a second
// ownership authority must be impossible.
//
// Run: npx tsx scripts/identity-organizations.test.ts
import { readFileSync } from "node:fs";
import {
  evaluateOwnerInvariant, ownerVerdictIsValid, decideOrganizationTransition,
  ownerControlResolverAvailable, platformAuthorityVerifierAvailable,
  suspensionAuthorityLedgerAvailable, organizationCreationBlock, organizationExecutionBlock,
  sealOrganization, organizationDecisionDigest, replayedOrganization, organizationEventId,
  suspendOrganization, archiveOrganization, reinstateOrganization, validateOrganizationOwner,
  ORGANIZATION_POLICY_VERSION, ORGANIZATION_AUTHORITIES, ORGANIZATION_BASES, OWNER_VERDICTS,
  type OrganizationAuthority, type OrganizationBasis, type OwnerFacts, type OwnerVerdict,
} from "../lib/identity/organizations";
import { ORGANIZATION_STATES, canTransitionOrganization, type OrganizationState } from "../lib/identity/state";
import { ASSIGNABLE_ORG_ROLES, ORG_ROLES } from "../lib/identity/rbac";
import {
  organizationSuspendedEvent, organizationArchivedEvent, ownerValidatedEvent,
} from "../lib/identity/events";
import { validateEvent, assertNoPII, PII_DENYLIST } from "../lib/eventBus/validate";
import { getContract } from "../lib/eventBus/contracts";

let pass = 0, fail = 0; const bad: string[] = [];
const check = (l: string, c: boolean) => { c ? pass++ : (fail++, bad.push(`FAIL: ${l}`)); };

const STATES = [...ORGANIZATION_STATES] as OrganizationState[];
const AUTHS = [...ORGANIZATION_AUTHORITIES] as OrganizationAuthority[];
const BASES = [...ORGANIZATION_BASES] as OrganizationBasis[];
const VERDICTS = [...OWNER_VERDICTS] as OwnerVerdict[];
const T0 = 1_700_000_000_000;

const GOOD: OwnerFacts = {
  organizationFound: true, organizationState: "ACTIVE", ownerAccountId: "acct-owner",
  ownerOperatorId: "op-owner", ownerOperatorState: "ACTIVE", ownerMembershipState: "ACTIVE",
  rivalOwnerClaims: 0,
};

function decide(o: Partial<Parameters<typeof decideOrganizationTransition>[0]> = {}) {
  return decideOrganizationTransition({
    from: "ACTIVE", to: "SUSPENDED", authority: "OWNER", basis: "OWNER_REQUESTED",
    organizationMatches: true, ownerVerdict: "OWNER_RESOLVED", suspendingAuthority: null, ...o,
  });
}

// ── 1. State machine (§6.1, §6.2) ───────────────────────────────────────────
check("1· three ratified states", STATES.length === 3
  && ["ACTIVE", "SUSPENDED", "ARCHIVED"].every((s) => STATES.includes(s as OrganizationState)));
check("1b· ARCHIVED is terminal — no outbound edge", STATES.every((to) => !canTransitionOrganization("ARCHIVED", to)));
check("1c· the four ratified edges exist",
  canTransitionOrganization("ACTIVE", "SUSPENDED") && canTransitionOrganization("ACTIVE", "ARCHIVED")
  && canTransitionOrganization("SUSPENDED", "ACTIVE") && canTransitionOrganization("SUSPENDED", "ARCHIVED"));
check("1d· no self-transition", STATES.every((s) => !canTransitionOrganization(s, s)));
check("1e· unknown states denied",
  !canTransitionOrganization("GHOST", "ACTIVE") && !canTransitionOrganization("ACTIVE", "ZOMBIE"));

// ── 2. EXHAUSTIVE: no illegal edge is ever allowed ──────────────────────────
{
  let leaked = 0, checked = 0, archivedLeaks = 0;
  for (const from of STATES) for (const to of STATES) for (const authority of AUTHS)
    for (const basis of BASES) for (const orgMatches of [true, false])
      for (const verdict of VERDICTS) for (const susp of [null, ...AUTHS]) {
        checked++;
        const d = decideOrganizationTransition({
          from, to, authority, basis, organizationMatches: orgMatches,
          ownerVerdict: verdict, suspendingAuthority: susp,
        });
        if (d.allowed && !canTransitionOrganization(from, to)) leaked++;
        if (d.allowed && from === "ARCHIVED") archivedLeaks++;
      }
  check(`2· EXHAUSTIVE: no illegal edge ever allowed (${checked} combinations, 0 leaks)`, leaked === 0 && checked > 0);
  check("2b· EXHAUSTIVE: nothing ever leaves ARCHIVED", archivedLeaks === 0);
}

// ── 3. OWNER INVARIANT (§6.4, ICAP-1 A-6) — the primary objective ───────────
check("3· a fully resolved owner is valid", evaluateOwnerInvariant(GOOD) === "OWNER_RESOLVED"
  && ownerVerdictIsValid("OWNER_RESOLVED"));
check("3b· MISSING OWNER: no organization", evaluateOwnerInvariant({ ...GOOD, organizationFound: false }) === "ORGANIZATION_NOT_FOUND");
check("3c· MISSING OWNER: dangling ownerAccountId", evaluateOwnerInvariant({ ...GOOD, ownerAccountId: null }) === "OWNER_ACCOUNT_MISSING");
check("3d· MISSING OWNER: owner account has no OperatorIdentity",
  evaluateOwnerInvariant({ ...GOOD, ownerOperatorId: null }) === "OWNER_OPERATOR_MISSING");
check("3e· §6.4: the owner's OperatorIdentity must be ACTIVE",
  ["PENDING", "SUSPENDED", "DEACTIVATED"].every((st) =>
    evaluateOwnerInvariant({ ...GOOD, ownerOperatorState: st }) === "OWNER_OPERATOR_NOT_ACTIVE"));
check("3f· §6.4: the owner must hold a Membership in their own Organization",
  evaluateOwnerInvariant({ ...GOOD, ownerMembershipState: null }) === "OWNER_MEMBERSHIP_MISSING");
check("3g· §6.4: the owner Membership must be ACTIVE",
  ["SUSPENDED", "REMOVED"].every((st) =>
    evaluateOwnerInvariant({ ...GOOD, ownerMembershipState: st }) === "OWNER_MEMBERSHIP_NOT_ACTIVE"));
check("3h· EXHAUSTIVE: only the fully-resolved fact set is ever valid",
  [null, "acct-owner"].every((acct) => [null, "op-owner"].every((op) =>
    [null, "PENDING", "ACTIVE", "SUSPENDED", "DEACTIVATED"].every((os) =>
      [null, "ACTIVE", "SUSPENDED", "REMOVED"].every((ms) => [0, 1].every((rivals) => {
        const v = evaluateOwnerInvariant({ ...GOOD, ownerAccountId: acct, ownerOperatorId: op, ownerOperatorState: os, ownerMembershipState: ms, rivalOwnerClaims: rivals });
        const shouldBeValid = acct !== null && op !== null && os === "ACTIVE" && ms === "ACTIVE" && rivals === 0;
        return ownerVerdictIsValid(v) === shouldBeValid;
      }))))));

// ── 4. DUPLICATE OWNER: a second ownership authority is impossible ─────────
check("4· a membership asserting OrgRole.OWNER is a RIVAL claim, not an owner",
  evaluateOwnerInvariant({ ...GOOD, rivalOwnerClaims: 1 }) === "RIVAL_OWNER_CLAIM");
check("4b· a rival claim is reported BEFORE any missing-hop verdict (never masked)",
  evaluateOwnerInvariant({ ...GOOD, rivalOwnerClaims: 1, ownerAccountId: null, ownerOperatorId: null }) === "RIVAL_OWNER_CLAIM");
check("4c· a rival claim is never valid", !ownerVerdictIsValid("RIVAL_OWNER_CLAIM"));
check("4d· §1.8 — OWNER is derived and NOT assignable to a membership",
  ORG_ROLES.includes("OWNER") && !(ASSIGNABLE_ORG_ROLES as readonly string[]).includes("OWNER"));
check("4e· ownership is a single scalar projection, so two rows cannot both be owner",
  /ownerAccountId\s+String\b/.test(readFileSync("prisma/schema.prisma", "utf8")));
check("4f· EXHAUSTIVE: no verdict other than OWNER_RESOLVED is ever valid",
  VERDICTS.every((v) => ownerVerdictIsValid(v) === (v === "OWNER_RESOLVED")));

// ── 5. OWNERLESS ACTIVE ORGANIZATION cannot authorize itself (§6.4) ────────
check("5· an OWNER-authority act requires a valid canonical owner",
  VERDICTS.filter((v) => v !== "OWNER_RESOLVED").every((v) => {
    const d = decide({ ownerVerdict: v });
    return !d.allowed && d.code === "owner_invariant";
  }));
check("5b· a valid owner may suspend their own Organization", decide().allowed);
check("5c· an ownerless Organization cannot be archived by OWNER authority",
  !decide({ to: "ARCHIVED", basis: "OWNER_CLOSED", ownerVerdict: "OWNER_MEMBERSHIP_MISSING" }).allowed);

// ── 6. Authority + basis coherence (§6.5-6.7, §11.2) ───────────────────────
check("6· PLATFORM_SECURITY may suspend but NOT archive (§6.7)",
  decide({ authority: "PLATFORM_SECURITY", basis: "SECURITY_HOLD" }).allowed
  && !decide({ to: "ARCHIVED", authority: "PLATFORM_SECURITY", basis: "SECURITY_HOLD" }).allowed);
check("6b· PLATFORM_COMPLIANCE may suspend and archive",
  decide({ authority: "PLATFORM_COMPLIANCE", basis: "COMPLIANCE_HOLD" }).allowed
  && decide({ to: "ARCHIVED", authority: "PLATFORM_COMPLIANCE", basis: "COMPLIANCE_CLOSED" }).allowed);
{
  const d = decide({ basis: "SECURITY_HOLD" });
  check("6c· a basis belonging to another authority class is incoherent", !d.allowed && d.code === "basis_incoherent");
}
{
  const d = decide({ to: "ARCHIVED", basis: "OWNER_REQUESTED" });
  check("6d· a suspension basis cannot close an Organization", !d.allowed && d.code === "basis_incoherent");
}
{
  const d = decide({ basis: "OWNER_CLOSED" });
  check("6e· an archival basis cannot merely suspend", !d.allowed && d.code === "basis_incoherent");
}
check("6f· EXHAUSTIVE: every allowed decision pairs its basis with its own authority",
  STATES.every((from) => STATES.every((to) => AUTHS.every((a) => BASES.every((b) => {
    const d = decideOrganizationTransition({ from, to, authority: a, basis: b, organizationMatches: true, ownerVerdict: "OWNER_RESOLVED", suspendingAuthority: a });
    if (!d.allowed) return true;
    const owns = b === "OWNER_REQUESTED" || b === "OWNER_CLOSED";
    return owns === (a === "OWNER");
  })))));

// ── 7. §6.6 reactivation requires the imposing authority class ─────────────
check("7· reinstatement by the same authority class is allowed",
  decide({ from: "SUSPENDED", to: "ACTIVE", authority: "PLATFORM_SECURITY", basis: "SECURITY_HOLD", suspendingAuthority: "PLATFORM_SECURITY" }).allowed);
{
  const d = decide({ from: "SUSPENDED", to: "ACTIVE", authority: "OWNER", basis: "OWNER_REQUESTED", suspendingAuthority: "PLATFORM_SECURITY" });
  check("7b· an owner cannot lift a security suspension (§6.6)", !d.allowed && d.code === "authority_insufficient");
}
{
  const d = decide({ from: "SUSPENDED", to: "ACTIVE", authority: "OWNER", basis: "OWNER_REQUESTED", suspendingAuthority: null });
  check("7c· an undeterminable imposing class fails closed", !d.allowed && d.code === "reinstatement_unresolved");
}

// ── 8. Tenant isolation (§8.1 gate 5) ──────────────────────────────────────
{
  const d = decide({ organizationMatches: false });
  check("8· a record from another tenant is denied", !d.allowed && d.code === "wrong_organization");
}
check("8b· EXHAUSTIVE: organizationMatches=false denies every edge",
  STATES.every((from) => STATES.every((to) => AUTHS.every((a) => BASES.every((b) =>
    !decideOrganizationTransition({ from, to, authority: a, basis: b, organizationMatches: false, ownerVerdict: "OWNER_RESOLVED", suspendingAuthority: a }).allowed)))));

// ── 9. Determinism + byte-identical replay (§1.16, §10.4) ──────────────────
{
  let stable = true;
  for (const from of STATES) for (const to of STATES) for (const a of AUTHS) for (const b of BASES) {
    const x = JSON.stringify(decide({ from, to, authority: a, basis: b, suspendingAuthority: a }));
    const y = JSON.stringify(decide({ from, to, authority: a, basis: b, suspendingAuthority: a }));
    if (x !== y) stable = false;
  }
  check("9· EXHAUSTIVE: the decision function is deterministic", stable);

  const sealed = sealOrganization({
    organizationId: "org1", ownerAccountId: "acct-owner", from: "ACTIVE", to: "SUSPENDED",
    authorityClass: "OWNER", basis: "OWNER_REQUESTED", ownerVerdict: "OWNER_RESOLVED",
    actorId: "acct-owner", commandId: "cmd-1", effectiveAt: T0,
  });
  check("9b· the sealed record pins the policy version", sealed.policyVersion === ORGANIZATION_POLICY_VERSION);
  check("9c· BYTE-IDENTICAL: same sealed inputs => same digest",
    organizationDecisionDigest(sealed) === organizationDecisionDigest({ ...sealed }));
  check("9d· any sealed input change changes the digest",
    organizationDecisionDigest({ ...sealed, ownerVerdict: "RIVAL_OWNER_CLAIM" }) !== organizationDecisionDigest(sealed));
  check("9e· the digest is sha256:<64 hex> and PII-scan-safe",
    /^sha256:[0-9a-f]{64}$/.test(organizationDecisionDigest(sealed))
    && assertNoPII({ decisionDigest: organizationDecisionDigest(sealed) }).ok === true);
  check("9f· the event id is a pure function of organization + commandId",
    organizationEventId("org1", "cmd-1") === organizationEventId("org1", "cmd-1")
    && organizationEventId("org1", "cmd-1") !== organizationEventId("org1", "cmd-2")
    && organizationEventId("org2", "cmd-1") !== organizationEventId("org1", "cmd-1"));
  check("9g· replay is decided on canonical equality, not key order",
    replayedOrganization({ a: 1, b: "x" }, { b: "x", a: 1 }).replay);
  check("9h· REPLAY ATTACK: a reused commandId with different inputs is NOT a replay",
    !replayedOrganization({ a: 1, b: "x" }, { a: 2, b: "x" }).replay);
  const body = readFileSync("lib/identity/organizations.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  check("9i· no ambient clock or randomness in the organizations module",
    !/Date\.now\(|Math\.random\(|new Date\(/.test(body));
}

// ── 10. Events (§11.2) ─────────────────────────────────────────────────────
{
  const digest = organizationDecisionDigest({ x: 1 });
  const base = {
    organizationId: "org1", ownerAccountId: "acct-owner", ownerVerdict: "OWNER_RESOLVED",
    policyVersion: ORGANIZATION_POLICY_VERSION, actorId: "acct-owner", commandId: "cmd-1",
    effectiveAt: T0, decisionDigest: digest, causationId: "cause-1",
  };
  const samples = [
    organizationSuspendedEvent({ ...base, authorityClass: "OWNER", basis: "OWNER_REQUESTED" }),
    organizationArchivedEvent({ ...base, from: "ACTIVE", authorityClass: "OWNER", basis: "OWNER_CLOSED" }),
    ownerValidatedEvent({ ...base, ownerOperatorId: "op-owner", organizationState: "ACTIVE", valid: true }),
  ];
  check("10· all three organization contracts are registered",
    ["ORGANIZATION_SUSPENDED", "ORGANIZATION_ARCHIVED", "OWNER_VALIDATED"].every((t) => getContract(t, 1) !== null));
  check("10b· ORGANIZATION_CREATED remains registered (Sprint 9, unchanged)", getContract("ORGANIZATION_CREATED", 1) !== null);
  check("10c· every organization payload validates against its contract",
    samples.every((s) => validateEvent(s.type, 1, s.payload).ok === true));
  check("10d· every payload is refs-only (no PII key or value)",
    samples.every((s) => assertNoPII(s.payload).ok === true));
  check("10e· no payload key is PII-denylisted (including 'reason')",
    samples.every((s) => !Object.keys(s.payload).some((k) => PII_DENYLIST.some((b) => k.toLowerCase().includes(b)))));
  check("10f· every payload carries the ownerVerdict so an ownership defect is auditable",
    samples.every((s) => "ownerVerdict" in s.payload));
  check("10g· every payload carries policy version, command id, sealed effectiveAt, digest, causation",
    samples.every((s) => ["policyVersion", "commandId", "effectiveAt", "decisionDigest", "causationId"].every((k) => k in s.payload)));
  check("10h· agencyId is the Organization; dedupeKey is the commandId alone",
    samples.every((s) => s.agencyId === "org1" && s.dedupeKey === "operator-organization:cmd-1"));
  check("10i· ARCHIVED cannot be recorded as a non-terminal target",
    validateEvent("ORGANIZATION_ARCHIVED", 1, { ...samples[1].payload, to: "ACTIVE" }).ok === false);
  check("10j· a suspension fact cannot claim an archival basis",
    validateEvent("ORGANIZATION_SUSPENDED", 1, { ...samples[0].payload, basis: "OWNER_CLOSED" }).ok === false);
  check("10k· an unknown owner verdict is rejected",
    validateEvent("OWNER_VALIDATED", 1, { ...samples[2].payload, ownerVerdict: "FINE_PROBABLY" }).ok === false);
}

// ── 11. Organizations does NOT do Membership / Enrollment / Platform Authority ──
{
  const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const src = strip(readFileSync("lib/identity/organizations.ts", "utf8"));
  check("11· never CREATES or MUTATES a membership (reads only, for §6.4 resolution)",
    !/organizationMembership\.(create|update|delete|upsert|updateMany|deleteMany)/.test(src));
  check("11b· never mutates an OperatorIdentity", !/operatorIdentity\.(create|update|delete|upsert|updateMany)/.test(src));
  check("11c· never runs enrollment", !/[Ee]nrollment/.test(src));
  check("11d· issues no Platform Authority (it verifies, never grants)",
    !/issueAuthority|grantAuthority|mintAuthority/.test(src));
  // The module DOES read `role: "OWNER"` — that is the rival-claim scan (§1.8). What it
  // must never do is WRITE a role, so scope the assertion to write payloads.
  check("11e· grants no organization roles (role appears only in a read filter)",
    !/data:\s*\{[^}]*\brole\b/.test(src) && /where:\s*\{ organizationId, role: "OWNER" \}/.test(src));
  check("11f· creates no schema and runs no migration", !/CREATE TABLE|ALTER TABLE|\$executeRaw|\$queryRaw/i.test(src));
  check("11g· the owner resolution is ATOMIC (one transaction, cannot straddle a change)",
    /\$transaction\(async \(tx\)/.test(src));
}

// ── 12. Capability gates + executed fail-closed ladder ────────────────────
(async () => {
  check("12· Slice 3 supplies the owner-control resolver Slice 1 blocked on", ownerControlResolverAvailable() === true);
  check("12b· Platform Authority verification is absent, so a platform act fails closed",
    platformAuthorityVerifierAvailable() === false && organizationExecutionBlock("PLATFORM_SECURITY", "ACTIVE", "SUSPENDED") === "forbidden");
  check("12c· §6.6 needs the suspension ledger (Slice 6), so reinstatement fails closed",
    suspensionAuthorityLedgerAvailable() === false && organizationExecutionBlock("OWNER", "SUSPENDED", "ACTIVE") === "reinstatement_unresolved");
  check("12d· §5.3 creation is blocked until the owner Membership model exists (Slice 4)",
    organizationCreationBlock() === "membership_runtime_unavailable");

  const svc = readFileSync("lib/identity/service.ts", "utf8");
  check("12e· service.createOrganization consumes the §5.3 block", /organizationCreationBlock\(\)/.test(svc));

  check("12f· the master flag is off in this environment", process.env.OPERATOR_IDENTITY_ENABLED !== "true");
  const p = { id: "acct-owner", role: "USER", isAgency: false, disabled: false };
  const cmd = { organizationId: "org1", authority: "OWNER" as const, basis: "OWNER_REQUESTED" as const, commandId: "c1", effectiveAt: T0 };
  const results = await Promise.all([
    suspendOrganization(p, cmd),
    archiveOrganization(p, { ...cmd, basis: "OWNER_CLOSED" }),
    reinstateOrganization(p, cmd),
    validateOrganizationOwner(p, "org1"),
  ]);
  check("12g· ALL organization doors are fail-closed disabled with the flag off",
    results.every((r) => r.ok === false && r.code === "disabled"));
  const nullp = await suspendOrganization(null, cmd);
  check("12h· a null principal returns disabled, never a throw", nullp.ok === false && nullp.code === "disabled");
  check("12i· repeating a command is byte-identical while disabled (deterministic)",
    JSON.stringify(await suspendOrganization(p, cmd)) === JSON.stringify(results[0]));

  // ── 13. No migration, no schema change ─────────────────────────────────
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  check("13· no new model was added to the schema",
    !/^model (OrganizationOwnership|OwnershipTransfer|OrganizationAudit)/m.test(schema));
  check("13b· ownerAccountId remains the §2.5 current-owner projection",
    /ownerAccountId String/.test(schema.replace(/\s+/g, " ")) || /ownerAccountId\s+String/.test(schema));

  if (bad.length) console.error(bad.join("\n"));
  console.log(`\nidentity-organizations.test.ts: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
