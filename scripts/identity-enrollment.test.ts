// Guard for Implementation Slice 2 — Enrollment Runtime.
// Identity Constitution v1.0 §2.8, §5.1, §5.2, §5.4, §5.5, §11.2, §14.6, §15.9.
//
// PURE + EXECUTED, no database. `decideEnrollment` is total, so the decision space is
// enumerated EXHAUSTIVELY rather than sampled. The commands are exercised against the
// real fail-closed ladder.
//
// THE CENTRAL INVARIANT: enrollment creates eligibility and evidence, NEVER authority.
// No path activates an operator, creates Membership, assigns an Organization, or emits
// anything carrying an authority class other than the literal "NONE".
//
// Run: npx tsx scripts/identity-enrollment.test.ts
import { readFileSync } from "node:fs";
import {
  decideEnrollment, canTransitionEnrollment, isTerminalEnrollmentState,
  enrollmentExecutionBlock, invitationVerifierAvailable, enrollmentEventId,
  sealEnrollment, enrollmentDecisionDigest, replayedEnrollment,
  consentEpisodeDigest, isValidConsentEpisode,
  requestEnrollment, acceptEnrollment, expireEnrollment, revokeEnrollment,
  ENROLLMENT_STATES, ENROLLMENT_ENTRIES, ENROLLMENT_ACTORS, ENROLLMENT_BASES,
  ENROLLMENT_POLICY_VERSION, ENTRY_INITIAL_STATE, _ENROLLMENT_TRANSITIONS,
  CONSENT_PURPOSES, CONSENT_MECHANISMS,
  type EnrollmentState, type EnrollmentEntry, type EnrollmentActor,
  type EnrollmentBasis, type ConsentEpisode,
} from "../lib/identity/enrollment";
import { loadEnrollmentStore } from "../lib/identity/enrollmentStore";
import {
  enrollmentRequestedEvent, enrollmentAcceptedEvent, enrollmentExpiredEvent, enrollmentRevokedEvent,
} from "../lib/identity/events";
import { validateEvent, assertNoPII, PII_DENYLIST } from "../lib/eventBus/validate";
import { getContract } from "../lib/eventBus/contracts";
import { operatorEnrollmentEnabled } from "../lib/identity/flags";

let pass = 0, fail = 0; const bad: string[] = [];
const check = (l: string, c: boolean) => { c ? pass++ : (fail++, bad.push(`FAIL: ${l}`)); };

const STATES = [...ENROLLMENT_STATES] as EnrollmentState[];
const ENTRIES = [...ENROLLMENT_ENTRIES] as EnrollmentEntry[];
const ACTORS = [...ENROLLMENT_ACTORS] as EnrollmentActor[];
const BASES = [...ENROLLMENT_BASES] as EnrollmentBasis[];

const T0 = 1_700_000_000_000;
const CONSENT: ConsentEpisode = {
  purpose: "OPERATOR_ENROLLMENT", scope: "operator:enrollment:acme",
  mechanism: "EXPLICIT_CHECKBOX", policyVersion: "operator-terms@1",
  actorId: "acct-sub", effectiveAt: T0, granted: true,
};

function decide(o: Partial<Parameters<typeof decideEnrollment>[0]> = {}) {
  return decideEnrollment({
    from: "INVITED", to: "ACCEPTED", entry: "INVITATION", actor: "SUBJECT",
    basis: "SUBJECT_ACCEPTED", actorIsSubject: true, organizationMatches: true,
    expiresAt: T0 + 1000, effectiveAt: T0, invitationVerified: true, consent: CONSENT, ...o,
  });
}

// ── 1. State machine (§2.8) ─────────────────────────────────────────────────
check("1· five ratified states, no ACTIVE", STATES.length === 5 && !STATES.includes("ACTIVE" as EnrollmentState));
check("1b· ACCEPTED / EXPIRED / REVOKED are terminal",
  ["ACCEPTED", "EXPIRED", "REVOKED"].every((s) => isTerminalEnrollmentState(s)));
check("1c· INVITED and REQUESTED are not terminal",
  !isTerminalEnrollmentState("INVITED") && !isTerminalEnrollmentState("REQUESTED"));
check("1d· no self-transition", STATES.every((s) => !canTransitionEnrollment(s, s)));
check("1e· unknown states denied",
  !canTransitionEnrollment("GHOST", "ACCEPTED") && !canTransitionEnrollment("INVITED", "ZOMBIE"));
check("1f· entry mode fixes the initial state (§5.2)",
  ENTRY_INITIAL_STATE.INVITATION === "INVITED" && ENTRY_INITIAL_STATE.APPLICATION === "REQUESTED");
check("1g· every transition endpoint is a declared state",
  Object.entries(_ENROLLMENT_TRANSITIONS).every(([f, ts]) =>
    STATES.includes(f as EnrollmentState) && ts.every((t) => STATES.includes(t as EnrollmentState))));

// ── 2. EXHAUSTIVE: nothing opens an undeclared edge, nothing leaves a terminal ──
{
  let leaked = 0, checked = 0, terminalLeaks = 0;
  for (const from of STATES) for (const to of STATES) for (const entry of ENTRIES)
    for (const actor of ACTORS) for (const basis of BASES)
      for (const actorIsSubject of [true, false]) for (const orgMatches of [true, false])
        for (const verified of [true, false]) for (const consent of [CONSENT, null]) {
          checked++;
          const d = decideEnrollment({
            from, to, entry, actor, basis, actorIsSubject, organizationMatches: orgMatches,
            expiresAt: T0 + 1000, effectiveAt: T0, invitationVerified: verified, consent,
          });
          if (d.allowed && !canTransitionEnrollment(from, to)) leaked++;
          if (d.allowed && isTerminalEnrollmentState(from)) terminalLeaks++;
        }
  check(`2· EXHAUSTIVE: no undeclared edge ever allowed (${checked} combinations)`, leaked === 0 && checked > 0);
  check("2b· EXHAUSTIVE: no transition ever leaves a terminal state", terminalLeaks === 0);
}

// ── 3. The two ratified entry paths (§5.2) ──────────────────────────────────
check("3· INVITATION: subject accepts", decide().allowed);
check("3b· APPLICATION: organization approves",
  decide({ entry: "APPLICATION", from: "REQUESTED", actor: "ORGANIZATION", basis: "ORGANIZATION_APPROVED", actorIsSubject: false }).allowed);
check("3c· INVITATION: the ORGANISATION may not also accept (it already invited — §5.5 no self-approval)",
  !decide({ actor: "ORGANIZATION", basis: "ORGANIZATION_APPROVED", actorIsSubject: false }).allowed);
check("3d· APPLICATION: the SUBJECT may not also approve (it already applied)",
  !decide({ entry: "APPLICATION", from: "REQUESTED", actor: "SUBJECT", basis: "SUBJECT_ACCEPTED" }).allowed);
{
  const d = decide({ entry: "APPLICATION", from: "REQUESTED", actor: "ORGANIZATION", basis: "ORGANIZATION_APPROVED", actorIsSubject: true });
  check("3e· an actor claiming ORGANIZATION while BEING the subject is self_approval", !d.allowed && d.code === "self_approval");
}
{
  const d = decide({ actorIsSubject: false });
  check("3f· an actor claiming SUBJECT who is not the subject is wrong_actor", !d.allowed && d.code === "wrong_actor");
}

// ── 4. §15.9 invitation properties, re-evaluated AT REDEMPTION ──────────────
{
  const d = decide({ effectiveAt: T0 + 2000 });
  check("4· an invitation past expiry is denied at redemption", !d.allowed && d.code === "expired");
}
check("4b· expiry is evaluated at the boundary (effectiveAt === expiresAt is expired)",
  !decide({ effectiveAt: T0 + 1000 }).allowed);
{
  const d = decide({ invitationVerified: false });
  check("4c· an unverifiable / tampered invitation is denied", !d.allowed && d.code === "invitation_unverified");
}
check("4d· the invitation verifier is fail-closed absent (no unreviewed key reuse)",
  invitationVerifierAvailable() === false);
{
  const d = decide({ from: "REVOKED" });
  check("4e· a REVOKED record cannot be accepted (terminal)", !d.allowed && d.code === "terminal");
}
check("4f· an EXPIRED record cannot be accepted (terminal)",
  !decide({ from: "EXPIRED" }).allowed);
{
  const d = decide({ from: "ACCEPTED" });
  check("4g· duplicate acceptance is denied (ACCEPTED is terminal)", !d.allowed && d.code === "terminal");
}

// ── 5. Tenant isolation (§8.1 gate 5) ───────────────────────────────────────
{
  const d = decide({ organizationMatches: false });
  check("5· a record belonging to another Organization is denied", !d.allowed && d.code === "wrong_organization");
}
check("5b· EXHAUSTIVE: organizationMatches=false denies every edge",
  STATES.every((from) => STATES.every((to) => ENTRIES.every((entry) => ACTORS.every((actor) =>
    !decideEnrollment({ from, to, entry, actor, basis: "SUBJECT_ACCEPTED", actorIsSubject: true,
      organizationMatches: false, expiresAt: T0 + 1000, effectiveAt: T0, invitationVerified: true, consent: CONSENT }).allowed)))));

// ── 6. Consent is evidence, not a flag (§5.1 item 5, §5.5) ──────────────────
{
  const d = decide({ consent: null });
  check("6· acceptance without consent is denied", !d.allowed && d.code === "consent_missing");
}
check("6b· a withheld consent episode is not consent",
  !decide({ consent: { ...CONSENT, granted: false } }).allowed);
check("6c· consumer-scoped purposes cannot satisfy operator enrollment (§5.1 item 5)",
  !decide({ consent: { ...CONSENT, purpose: "OPERATOR_PROFILE" } }).allowed);
check("6d· a malformed consent episode is rejected", [
  { ...CONSENT, scope: "" }, { ...CONSENT, effectiveAt: 0 }, { ...CONSENT, policyVersion: "" },
  { ...CONSENT, actorId: "" }, { ...CONSENT, effectiveAt: 1.5 },
].every((c) => !isValidConsentEpisode(c as ConsentEpisode) && !decide({ consent: c as ConsentEpisode }).allowed));
check("6e· a well-formed episode validates", isValidConsentEpisode(CONSENT));
check("6f· consent carries scope, policy version, mechanism, effective time, actor and purpose",
  ["purpose", "scope", "mechanism", "policyVersion", "actorId", "effectiveAt", "granted"].every((k) => k in CONSENT));
{
  // Append-only: a withdrawal is a NEW episode with its own digest; the grant's digest
  // is unchanged, so history can never be overwritten in place.
  const grant = consentEpisodeDigest(CONSENT);
  const withdrawal = consentEpisodeDigest({ ...CONSENT, granted: false, effectiveAt: T0 + 500 });
  check("6g· a withdrawal is a distinct episode, never an overwrite", grant !== withdrawal);
  check("6h· the original grant digest is unchanged by the withdrawal", consentEpisodeDigest(CONSENT) === grant);
  check("6i· consent digests are deterministic", consentEpisodeDigest({ ...CONSENT }) === grant);
  check("6j· the digest is sha256:<64 hex> and PII-scan-safe",
    /^sha256:[0-9a-f]{64}$/.test(grant) && assertNoPII({ consentDigest: grant }).ok === true);
}

// ── 7. Basis coherence + expiry semantics (§11.2) ───────────────────────────
check("7· a basis that does not belong to the edge is incoherent",
  !decide({ basis: "ORGANIZATION_REVOKED" }).allowed);
check("7b· EXPIRED may only be recorded once the invitation has actually lapsed",
  !decide({ to: "EXPIRED", actor: "SYSTEM", basis: "INVITATION_LAPSED", effectiveAt: T0 }).allowed
  && decide({ to: "EXPIRED", actor: "SYSTEM", basis: "INVITATION_LAPSED", effectiveAt: T0 + 2000 }).allowed);
check("7c· only SYSTEM records expiry (it is a fact about time, not a party's decision)",
  !decide({ to: "EXPIRED", actor: "SUBJECT", basis: "INVITATION_LAPSED", effectiveAt: T0 + 2000 }).allowed);
check("7d· either party may revoke/withdraw before acceptance",
  decide({ to: "REVOKED", actor: "ORGANIZATION", basis: "ORGANIZATION_REVOKED", actorIsSubject: false }).allowed
  && decide({ to: "REVOKED", actor: "SUBJECT", basis: "SUBJECT_WITHDREW" }).allowed);

// ── 8. Determinism + byte-identical replay (§1.16, §10.4) ───────────────────
{
  let stable = true;
  for (const from of STATES) for (const to of STATES) for (const entry of ENTRIES) for (const actor of ACTORS) {
    const a = JSON.stringify(decide({ from, to, entry, actor }));
    const b = JSON.stringify(decide({ from, to, entry, actor }));
    if (a !== b) stable = false;
  }
  check("8· EXHAUSTIVE: the decision function is deterministic", stable);

  const sealed = sealEnrollment({
    enrollmentId: "enr1", organizationId: "org1", subjectAccountId: "acct-sub",
    entry: "INVITATION", from: "INVITED", to: "ACCEPTED", actor: "SUBJECT",
    basis: "SUBJECT_ACCEPTED", actorId: "acct-sub", commandId: "cmd-1",
    effectiveAt: T0, expiresAt: T0 + 1000, consentDigest: consentEpisodeDigest(CONSENT),
  });
  check("8b· the sealed record pins the policy version", sealed.policyVersion === ENROLLMENT_POLICY_VERSION);
  check("8c· the sealed record pins authorityClass NONE", sealed.authorityClass === "NONE");
  check("8d· BYTE-IDENTICAL: same sealed inputs => same digest",
    enrollmentDecisionDigest(sealed) === enrollmentDecisionDigest({ ...sealed }));
  check("8e· any sealed input change changes the digest",
    enrollmentDecisionDigest({ ...sealed, commandId: "cmd-2" }) !== enrollmentDecisionDigest(sealed));

  check("8f· the event id is a pure function of subject + commandId",
    enrollmentEventId("acct-sub", "cmd-1") === enrollmentEventId("acct-sub", "cmd-1")
    && enrollmentEventId("acct-sub", "cmd-1") !== enrollmentEventId("acct-sub", "cmd-2")
    && enrollmentEventId("acct-other", "cmd-1") !== enrollmentEventId("acct-sub", "cmd-1"));

  const p1 = { a: 1, b: "x" }, p2 = { b: "x", a: 1 };
  check("8g· replay is decided on canonical equality, not key order", replayedEnrollment(p1, p2).replay);
  check("8h· a reused commandId with different inputs is NOT a replay",
    !replayedEnrollment(p1, { a: 2, b: "x" }).replay);
  const src = readFileSync("lib/identity/enrollment.ts", "utf8");
  const body = src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  check("8i· no ambient clock or randomness in the enrollment module",
    !/Date\.now\(|Math\.random\(|new Date\(/.test(body));
}

// ── 9. Events: refs-only, authority NONE, contract-valid (§2.8, §11.2) ──────
{
  const digest = enrollmentDecisionDigest({ x: 1 });
  const base = {
    enrollmentId: "enr1", organizationId: "org1", subjectAccountId: "acct-sub",
    policyVersion: ENROLLMENT_POLICY_VERSION, actorId: "acct-sub", commandId: "cmd-1",
    effectiveAt: T0, decisionDigest: digest, causationId: "cause-1",
  };
  const samples = [
    { v: 1, e: enrollmentRequestedEvent({ ...base, entry: "INVITATION", state: "INVITED", basis: "ORGANIZATION_INVITED", expiresAt: T0 + 1000 }) },
    { v: 1, e: enrollmentAcceptedEvent({ ...base, entry: "INVITATION", from: "INVITED", basis: "SUBJECT_ACCEPTED", invitationRef: "inv-ref-1", consentPurpose: "OPERATOR_ENROLLMENT", consentScope: CONSENT.scope, consentMechanism: "EXPLICIT_CHECKBOX", consentPolicyVersion: "operator-terms@1", consentEffectiveAt: T0, consentDigest: consentEpisodeDigest(CONSENT) }) },
    { v: 1, e: enrollmentExpiredEvent({ ...base, from: "INVITED", expiresAt: T0 + 1000 }) },
    { v: 1, e: enrollmentRevokedEvent({ ...base, from: "INVITED", basis: "ORGANIZATION_REVOKED" }) },
  ];
  check("9· all four enrollment contracts are registered",
    ["ENROLLMENT_REQUESTED", "ENROLLMENT_ACCEPTED", "ENROLLMENT_EXPIRED", "ENROLLMENT_REVOKED"]
      .every((t) => getContract(t, 1) !== null));
  check("9b· every enrollment payload validates against its contract",
    samples.every((s) => validateEvent(s.e.type, s.v, s.e.payload).ok === true));
  check("9c· every enrollment payload is refs-only (no PII key or value)",
    samples.every((s) => assertNoPII(s.e.payload).ok === true));
  check("9d· no enrollment payload key is PII-denylisted (including 'reason')",
    samples.every((s) => !Object.keys(s.e.payload).some((k) => PII_DENYLIST.some((b) => k.toLowerCase().includes(b)))));
  check("9e· AUTHORITY IS ALWAYS NONE on every enrollment fact",
    samples.every((s) => s.e.payload.authorityClass === "NONE"));
  check("9f· every payload carries policy version, command id, sealed effectiveAt, digest and causation",
    samples.every((s) => ["policyVersion", "commandId", "effectiveAt", "decisionDigest", "causationId"].every((k) => k in s.e.payload)));
  check("9g· tenant = the SUBJECT's account, agency = the Organization",
    samples.every((s) => s.e.tenantId === "acct-sub" && s.e.agencyId === "org1"));
  check("9h· dedupeKey is the commandId alone (the event stream is the idempotency ledger)",
    samples.every((s) => s.e.dedupeKey === "operator-enrollment:cmd-1"));
  check("9i· a payload asserting any authority other than NONE is REJECTED by the contract",
    validateEvent("ENROLLMENT_ACCEPTED", 1, { ...samples[1].e.payload, authorityClass: "PLATFORM_SECURITY" }).ok === false);
  check("9j· an enrollment payload cannot smuggle an operator state",
    validateEvent("ENROLLMENT_ACCEPTED", 1, { ...samples[1].e.payload, operatorState: "ACTIVE" }).ok === false);
  check("9k· the accepted fact records the consent episode by digest + bounded enums",
    ["consentPurpose", "consentScope", "consentMechanism", "consentPolicyVersion", "consentEffectiveAt", "consentDigest"]
      .every((k) => k in samples[1].e.payload));
}

// ── 10. Enrollment NEVER creates authority, Membership, or activation ───────
{
  // Scan CODE, not prose: this module documents at length what it must NOT do, and a
  // naive text scan would match its own explanation. Conservative stripping (block
  // comments + comment-only lines) can never hide a real call site.
  const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const src = strip(readFileSync("lib/identity/enrollment.ts", "utf8"));
  const ev = strip(readFileSync("lib/identity/events.ts", "utf8"));
  check("10· the enrollment module never touches Membership", !/[Mm]embership/.test(src));
  check("10b· the enrollment module never creates an Organization", !/createOrganization|organization\.create/.test(src));
  check("10c· the enrollment module never transitions an operator", !/transitionOperator|OperatorState|registerOperator/.test(src));
  check("10d· the enrollment module never references ACTIVE as an outcome", !/"ACTIVE"/.test(src));
  check("10e· no enrollment contract admits an operator lifecycle state",
    ["ENROLLMENT_REQUESTED", "ENROLLMENT_ACCEPTED", "ENROLLMENT_EXPIRED", "ENROLLMENT_REVOKED"].every((t) =>
      validateEvent(t, 1, { operatorState: "ACTIVE" }).ok === false));
  check("10f· exactly four enrollment facts are emitted, one per ratified event",
    (ev.match(/enrollmentInput\("ENROLLMENT_/g) || []).length === 4);
  check("10g· the enrollment module issues no Platform Authority",
    !/PLATFORM_IDENTITY_REVIEW|PLATFORM_SECURITY|platformAuthority/.test(src));
  check("10h· the enrollment module creates no schema and runs no migration",
    !/CREATE TABLE|ALTER TABLE|\$executeRaw|\$queryRaw/i.test(src));
}

// ── 11. Fail-closed ladder, executed (§1.11, §14.6, §22 #31) ────────────────
(async () => {
  check("11· the master identity flag is off in this environment", process.env.OPERATOR_IDENTITY_ENABLED !== "true");
  check("11b· the enrollment gate is subordinate to the master flag", operatorEnrollmentEnabled() === false);

  const p = { id: "acct-sub", role: "USER", isAgency: false, disabled: false };
  const base = { enrollmentId: "enr1", organizationId: "org1", commandId: "cmd-1", effectiveAt: T0 };
  const results = await Promise.all([
    requestEnrollment(p, { ...base, entry: "INVITATION", subjectAccountId: "acct-sub", expiresAt: T0 + 1000, basis: "ORGANIZATION_INVITED" }),
    acceptEnrollment(p, { ...base, consent: CONSENT, invitationRef: "inv-1" }),
    expireEnrollment(p, { ...base, basis: "INVITATION_LAPSED" }),
    revokeEnrollment(p, { ...base, basis: "ORGANIZATION_REVOKED" }),
  ]);
  check("11c· ALL four enrollment doors are fail-closed disabled with the flags off",
    results.every((r) => r.ok === false && r.code === "disabled"));
  const nullp = await requestEnrollment(null, { ...base, entry: "INVITATION", subjectAccountId: "s", expiresAt: T0 + 1, basis: "ORGANIZATION_INVITED" });
  check("11d· a null principal returns disabled, never a throw", nullp.ok === false && nullp.code === "disabled");
  check("11e· repeating a command is byte-identical while disabled (deterministic)",
    JSON.stringify(await expireEnrollment(p, { ...base, basis: "INVITATION_LAPSED" })) === JSON.stringify(results[2]));

  // ── 12. Persistence port is fail-closed unavailable (Slice 7 dependency) ──
  const store = loadEnrollmentStore();
  check("12· the enrollment store is unavailable", store.available === false);
  check("12b· the execution block names the store as the blocker", enrollmentExecutionBlock() === "store_unavailable");
  let threw = false;
  try { await store.load("enr1"); } catch { threw = true; }
  check("12c· an unavailable store REJECTS rather than returning null (absence !== not-found)", threw);
  let threw2 = false;
  try { await store.transition("enr1", "INVITED", "ACCEPTED"); } catch { threw2 = true; }
  check("12d· an unavailable store rejects transitions too", threw2);

  // ── 13. No migration, no schema ──────────────────────────────────────────
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  check("13· no enrollment/invitation/consent model was added to the schema",
    !/^model (Enrollment|Invitation|Consent|Acceptance)/m.test(schema));
  check("13b· the persistence port declares why it is an interface (Gate D §13.3)",
    /Slice 7/.test(readFileSync("lib/identity/enrollmentStore.ts", "utf8")));

  if (bad.length) console.error(bad.join("\n"));
  console.log(`\nidentity-enrollment.test.ts: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
