// Arena Contribution Policy v1 — the single versioned source of truth for XP.
//
// This file is PURE and deterministic: no I/O, no clock, no randomness. XP is a
// function of verified evidence, nothing else. It is scored read-time by
// lib/arena/project.ts.
//
// It was written AFTER an adversarial review that reshaped it, and those
// conclusions are load-bearing — read them before changing a number:
//
//   1. THERE IS NO "VERIFIED" OUTCOME EVIDENCE TODAY. Every VerifiedOutcome.outcome
//      is AI-classified from text the USER pasted (lib/outcomeLedger.ts + the
//      response route). It is self-attested, not bureau-confirmed, and letters are
//      unlimited self-service — so a "verified deletion" is trivially fabricable.
//      Per the frozen evidence-scale law, AI-classified evidence caps at
//      "documented". So Arena awards a MODEST documented weight for a favorable
//      logged outcome and has NO high/verified tier. A real verified tier needs a
//      human-attestation or independent signal that does not exist in the schema.
//
//   2. XP BELONGS TO THE EVIDENCE OWNER, never the session. The award earner is
//      VerifiedOutcome.userId (the consumer whose file it is), copied verbatim —
//      never currentAccount()/currentUser(). Otherwise an agency operating a
//      client's workspace would farm the client's outcome XP onto itself.
//
//   3. IDEMPOTENCY IS KEYED ON THE STABLE ENTITY (letterId), never the mutable
//      outcome value. One letter yields at most one active award; a later revision
//      is reflected by re-reading current truth (project.ts), not by a second award.
//
//   4. NO CROSS-USER LEADERBOARD SHIPS. A public ranking of "who deleted the most"
//      is an implied-typical-results surface (CROA §1679b / FTC §5) and the
//      corpus-consent record does not authorize a named competitive board. Own-XP
//      (self only) is the sole cross-user-free surface. Any ranked surface is
//      REFUSED pending a separate display-consent record + CCO sign-off.
//
//   5. STREAKS, SEASONS, and CASH AFFILIATE PAYOUTS are refused for v1 (refusal
//      register). They are declared here as future classes, weight 0, never scored.

export const ARENA_POLICY_VERSION = 1 as const;

// Evidence states, weakest to strongest. Only the top-tier "verified" may ever carry
// top-tier XP weight — and it is UNREACHABLE today, deliberately, because no
// mechanism produces it. This is documented so a future contributor cannot quietly
// promote AI-classified text to "verified".
//
//   documented   — the user logged it; an AI classified their pasted text. This is
//                  all the outcome ledger produces today. Self-attested, fabricable,
//                  so it carries only a modest weight. (Every live class is here.)
//   corroborated — a second independent signal agrees (e.g. a mailed-letter record
//                  plus a response within the §611 window, or a staff spot-check).
//                  No such corroboration pipeline exists yet.
//   verified     — an independent, non-user-controlled source confirms it (a bureau
//                  API, a human attestation record, a document the user could not
//                  forge). The schema has NO field for this. Until one exists, no
//                  outcome may be promoted past "documented".
//
// PROMOTION REQUIREMENT (documented -> verified): a durable attestation column on
// VerifiedOutcome populated by a source the user does not control, plus a policy
// version that references it. This does not exist. Do not add compliance claims or
// imply a verified tier is live.
export type EvidenceState = "documented" | "corroborated" | "verified";
export const EVIDENCE_STATES: readonly EvidenceState[] = ["documented", "corroborated", "verified"];
export const MAX_LIVE_EVIDENCE_STATE: EvidenceState = "documented";

// Favorable outcomes, byte-identical to the Engine-1 vocabulary (lib/outcomeLedger.ts:23)
// so Arena and the outcome ledger can never disagree on what "favorable" means.
export const FAVORABLE_OUTCOMES: ReadonlySet<string> = new Set(["deleted", "updated"]);

// Outcomes that are logged and responded-to but not favorable — honest activity,
// worth a token acknowledgement, never treated as a win.
export const DOCUMENTED_OUTCOMES: ReadonlySet<string> = new Set(["verified", "no_response"]);

// Contribution classes. `live` = has a real durable evidence source TODAY and is
// scored. `pending` = declared for the policy's shape but NOT scored, because the
// evidence does not exist yet or the surface is refused. Nothing pending ever mints.
export type ArenaClassId = "A" | "Aq" | "B" | "C" | "D" | "E" | "F";

export interface ArenaClass {
  id: ArenaClassId;
  label: string;
  live: boolean;
  baseXp: number; // signed base weight, awarded once per source entity
  evidenceClass: "documented"; // HARD cap — no "verified" tier exists (see note 1)
  note: string;
}

// Weights preserve the owner-ratified RELATIVE ordering while honoring the
// documented cap: a favorable logged outcome is the most an AI-classified,
// self-attested signal may carry, and it is deliberately modest so fabrication
// buys little. Everything richer is pending real evidence.
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
// This list is asserted by the guard so no future rule can quietly award them.
export const PROHIBITED_XP_SOURCES: readonly string[] = [
  "login", "page_open", "letter.generated", "report.uploaded", "report.analyzed",
  "message_count", "reply_count", "thread_count", "like", "bookmark", "share",
  "kai_event", "outcome.unknown", "invite_sent", "referral_click", "unpaid_signup",
  "self_acceptance",
];

// The refused surfaces, declared so the intent is explicit and testable — v1 ships
// none of these.
export const REFUSED_V1: readonly string[] = [
  "cross_user_leaderboard", "named_ranking", "streaks", "seasons", "cash_affiliate_payout",
  "outcome_count_broadcast",
];

// The stable idempotency key for an outcome-sourced award: the letterId ONLY. The
// mutable outcome value is deliberately excluded (note 3). One key per letter.
export function outcomeAwardKey(letterId: string): string {
  return `arena:v${ARENA_POLICY_VERSION}:outcome:${letterId}`;
}

// Classify a single outcome value into its live class (or null = no award).
export function classifyOutcome(outcome: string | null | undefined): ArenaClassId | null {
  if (!outcome) return null;
  if (FAVORABLE_OUTCOMES.has(outcome)) return "A";
  if (DOCUMENTED_OUTCOMES.has(outcome)) return "Aq";
  return null; // "unknown" (AI-classification failure) and anything else mint nothing
}

// XP for a single outcome, deterministic. Returns 0 for non-awarding outcomes.
export function xpForOutcome(outcome: string | null | undefined): number {
  const cls = classifyOutcome(outcome);
  return cls ? ARENA_CLASSES[cls].baseXp : 0;
}
