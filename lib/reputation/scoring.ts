// Operator Reputation — canonical scoring policy (Sprint 10 ownership move).
//
// THIS IS THE SINGLE SOURCE OF TRUTH for XP weights, contribution classes, evidence
// caps, refusals, the idempotency-key rule, and the level/rank curve. It was moved here
// VERBATIM from lib/arena/policy.ts + lib/arena/project.ts (the numbers are byte-
// identical — the ownership moved, not the values): Reputation is the PLATFORM SERVICE
// that owns reputation policy; Arena is an EXPERIENCE that consumes it. lib/arena/policy.ts
// and lib/arena/project.ts now RE-EXPORT from here (compatibility for the arena UI), so
// this module has ZERO dependency on Arena — the prior Reputation→Arena inversion is gone.
//
// PURE and deterministic: no I/O, no clock, no randomness. XP is a function of verified
// evidence, nothing else. The human-readable policy doc is ARENA-CONTRIBUTION-POLICY.md;
// this file is its machine truth. Load-bearing conclusions (read before changing a number):
//
//   1. THERE IS NO "VERIFIED" OUTCOME EVIDENCE TODAY. Every VerifiedOutcome.outcome is
//      AI-classified from user-pasted text (self-attested, fabricable), so it caps at
//      "documented"; there is NO high/verified tier.
//   2. XP BELONGS TO THE EVIDENCE OWNER, never the session (the consumer whose file it is).
//   3. IDEMPOTENCY IS KEYED ON THE STABLE ENTITY (letterId), never the mutable outcome.
//   4. NO CROSS-USER LEADERBOARD SHIPS (CROA §1679b / FTC §5). Own-XP only; ranked
//      surfaces are REFUSED pending display-consent + CCO sign-off.
//   5. STREAKS, SEASONS, CASH AFFILIATE PAYOUTS are refused for v1 (refusal register).

export const ARENA_POLICY_VERSION = 1 as const;

// Evidence states, weakest to strongest. Only "verified" may carry top-tier weight, and
// it is UNREACHABLE today (no mechanism produces it). Promotion (documented -> verified)
// requires a durable, user-uncontrolled attestation column that does not exist.
export type EvidenceState = "documented" | "corroborated" | "verified";
export const EVIDENCE_STATES: readonly EvidenceState[] = ["documented", "corroborated", "verified"];
export const MAX_LIVE_EVIDENCE_STATE: EvidenceState = "documented";

// Favorable outcomes, byte-identical to the Engine-1 vocabulary (lib/outcomeLedger.ts).
export const FAVORABLE_OUTCOMES: ReadonlySet<string> = new Set(["deleted", "updated"]);
// Logged + responded-to but not favorable — honest activity, token acknowledgement.
export const DOCUMENTED_OUTCOMES: ReadonlySet<string> = new Set(["verified", "no_response"]);

// Contribution classes. `live` = has a real durable evidence source TODAY and is scored.
// Nothing non-live ever mints. (Class names kept as the legacy A/Aq/… ids for byte-
// equivalence with the shipped arena UI; ownership — not naming — is what moved.)
export type ArenaClassId = "A" | "Aq" | "B" | "C" | "D" | "E" | "F";

export interface ArenaClass {
  id: ArenaClassId;
  label: string;
  live: boolean;
  baseXp: number; // signed base weight, awarded once per source entity
  evidenceClass: "documented"; // HARD cap — no "verified" tier exists
  note: string;
}

export const ARENA_CLASSES: Readonly<Record<ArenaClassId, ArenaClass>> = {
  A: {
    id: "A", label: "Favorable outcome logged", live: true, baseXp: 20, evidenceClass: "documented",
    note: "VerifiedOutcome.outcome in {deleted,updated}. Documented, not verified — the evidence is AI-classified from user-pasted text.",
  },
  Aq: {
    id: "Aq", label: "Bureau response logged", live: true, baseXp: 8, evidenceClass: "documented",
    note: "VerifiedOutcome.outcome in {verified,no_response}. Honest logging of a non-favorable response.",
  },
  D: {
    id: "D", label: "Completed dispute cycle", live: true, baseXp: 12, evidenceClass: "documented",
    note: "A logged outcome that is not 'unknown' — a full round reached a recorded result. Excludes failed/blank classifications.",
  },
  B: {
    id: "B", label: "Accepted community contribution", live: false, baseXp: 0, evidenceClass: "documented",
    note: "PENDING: needs a durable 'reply accepted by thread author/ADMIN' signal, which does not exist yet.",
  },
  C: {
    id: "C", label: "Education completion", live: false, baseXp: 0, evidenceClass: "documented",
    note: "PENDING: needs durable Academy completion evidence (a DB row), not client-only progress.",
  },
  E: {
    id: "E", label: "Agency client activation", live: false, baseXp: 0, evidenceClass: "documented",
    note: "PENDING: agency credit, gated on the verified managedByAgencyId edge and a client's first completed cycle.",
  },
  F: {
    id: "F", label: "Affiliate conversion", live: false, baseXp: 0, evidenceClass: "documented",
    note: "REFUSED for v1: cash affiliate payout is refused; a non-cash recognition class needs owner + CCO sign-off.",
  },
} as const;

// Sources that must NEVER mint XP — raw activity a bad actor can generate cheaply.
export const PROHIBITED_XP_SOURCES: readonly string[] = [
  "login", "page_open", "letter.generated", "report.uploaded", "report.analyzed",
  "message_count", "reply_count", "thread_count", "like", "bookmark", "share",
  "kai_event", "outcome.unknown", "invite_sent", "referral_click", "unpaid_signup",
  "self_acceptance",
];

// The refused surfaces — v1 ships none of these.
export const REFUSED_V1: readonly string[] = [
  "cross_user_leaderboard", "named_ranking", "streaks", "seasons", "cash_affiliate_payout",
  "outcome_count_broadcast",
];

// Arena's legacy per-user reconcile-on-read idempotency key (embeds the policy version).
// NOTE: the durable reputation ledger uses a VERSION-FREE subjectId (lib/reputation/policy.ts
// reputationSubjectId) — a version-embedded key double-mints on a policy bump (VECTOR-XP §5).
// Retained here for the arena v1 read path's compatibility.
export function outcomeAwardKey(letterId: string): string {
  return `arena:v${ARENA_POLICY_VERSION}:outcome:${letterId}`;
}

export function classifyOutcome(outcome: string | null | undefined): ArenaClassId | null {
  if (!outcome) return null;
  if (FAVORABLE_OUTCOMES.has(outcome)) return "A";
  if (DOCUMENTED_OUTCOMES.has(outcome)) return "Aq";
  return null; // "unknown" and anything else mint nothing
}

export function xpForOutcome(outcome: string | null | undefined): number {
  const cls = classifyOutcome(outcome);
  return cls ? ARENA_CLASSES[cls].baseXp : 0;
}

// ── Level + rank curve (moved verbatim from lib/arena/project.ts) ─────────────
// Deterministic level curve. xpForLevel(n) = 25*n*(n-1): 0/50/150/300/500/750...
export function xpForLevel(n: number): number {
  return 25 * n * (n - 1);
}
export function levelForXp(xp: number): number {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

// Rank ladder by level. Deterministic, ordered, no ties to break.
const RANKS: readonly { at: number; name: string }[] = [
  { at: 1, name: "recruit" },
  { at: 3, name: "contender" },
  { at: 6, name: "operator" },
  { at: 10, name: "veteran" },
  { at: 15, name: "elite" },
];
export function rankForLevel(level: number): string {
  let name = RANKS[0].name;
  for (const r of RANKS) if (level >= r.at) name = r.name;
  return name;
}
