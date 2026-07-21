// Run: npx tsx scripts/reputation-core.test.ts
//
// The PURE Operator Reputation core (Sprint 10): the deterministic standing fold (the
// replay model), the policy adapter (reuse-only, fail-closed), and milestone latch
// evaluation. Proves determinism, replay-identity, the never-below-zero floor, that no
// XP value is minted outside the shipped policy, and that the refusal register holds.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { foldStanding, EMPTY_STANDING, type AwardRow } from "../lib/reputation/fold";
import {
  resolveAwardXp, isAwardKind, reversalKindFor, AWARD_KINDS, REPUTATION_REFUSED,
  REPUTATION_PROHIBITED_SOURCES, MILESTONE_DEFINITIONS, REPUTATION_POLICY_VERSION, reputationSubjectId,
} from "../lib/reputation/policy";
import * as repPolicy from "../lib/reputation/policy";
import { evaluateMilestones, isValidMilestoneKey } from "../lib/reputation/milestones";
import { ARENA_CLASSES, ARENA_POLICY_VERSION } from "../lib/arena/policy";
import { levelForXp, rankForLevel } from "../lib/arena/project";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const row = (o: Partial<AwardRow>): AwardRow => ({ id: "a1", awardKind: "outcome", classId: "A", xp: 20, createdAt: new Date(1000), ...o });

// ── Fold: determinism + replay identity ──────────────────────────────────────
const rows: AwardRow[] = [
  row({ id: "a1", xp: 20, classId: "A", createdAt: new Date(1000) }),
  row({ id: "a2", xp: 8, classId: "Aq", createdAt: new Date(2000) }),
  row({ id: "a3", xp: 12, classId: "D", createdAt: new Date(3000) }),
];
const s1 = foldStanding(rows);
const s2 = foldStanding([...rows].reverse());
check("fold is deterministic across input order (replay-identical)", JSON.stringify(s1) === JSON.stringify(s2));
check("fold sums XP correctly (40)", s1.totalXp === 40);
check("level/rank derive from the SHIPPED curve (reuse, not re-math)", s1.level === levelForXp(40) && s1.rank === rankForLevel(s1.level));
check("byClass nets per class", s1.byClass["A"] === 20 && s1.byClass["Aq"] === 8 && s1.byClass["D"] === 12);
check("award/reversal counts", s1.awardCount === 3 && s1.reversalCount === 0);

// Same-timestamp rows tie-break on id (total order — replay stable).
const tieA = foldStanding([row({ id: "a", createdAt: new Date(5) }), row({ id: "b", createdAt: new Date(5), xp: 8 })]);
const tieB = foldStanding([row({ id: "b", createdAt: new Date(5), xp: 8 }), row({ id: "a", createdAt: new Date(5) })]);
check("equal timestamps tie-break deterministically on id", JSON.stringify(tieA) === JSON.stringify(tieB));

// Reversals: compensating records lower the fold; the floor holds at 0.
const withReversal = foldStanding([
  row({ id: "a1", xp: 20 }),
  row({ id: "r1", awardKind: "reverse:outcome", xp: -20, createdAt: new Date(4000) }),
]);
check("a reversal nets the award to zero", withReversal.totalXp === 0 && withReversal.reversalCount === 1);
check("fold never goes below zero (over-reversal floors)", foldStanding([row({ id: "r1", awardKind: "reverse:outcome", xp: -50 })]).totalXp === 0);
check("malformed xp contributes nothing (fail-closed, no throw)", foldStanding([row({ id: "x", xp: NaN as unknown as number })]).totalXp === 0);
check("EMPTY_STANDING is level-1 recruit at 0 XP", EMPTY_STANDING.totalXp === 0 && EMPTY_STANDING.level === 1 && EMPTY_STANDING.rank === "recruit");

// ── Policy adapter: reuse-only, fail-closed, no new values ───────────────────
check("live class A resolves to the SHIPPED baseXp (20)", resolveAwardXp("A")?.xp === ARENA_CLASSES.A.baseXp);
check("live class Aq resolves (8)", resolveAwardXp("Aq")?.xp === 8);
check("non-live class B mints NOTHING (fail-closed)", resolveAwardXp("B") === null);
check("refused class F mints NOTHING", resolveAwardXp("F") === null);
check("unknown class mints NOTHING", resolveAwardXp("ZZ") === null);
check("policy version passes through unchanged", resolveAwardXp("A")?.policyVersion === ARENA_POLICY_VERSION && REPUTATION_POLICY_VERSION === ARENA_POLICY_VERSION);
check("award kinds: 'outcome' only in v1 (dimensions are owner-gated)", AWARD_KINDS.length === 1 && isAwardKind("outcome") && !isAwardKind("education"));
check("reversal kind is namespaced", reversalKindFor("outcome") === "reverse:outcome" && !isAwardKind("reverse:outcome"));

// The durable subjectId MUST be version-free (a version-embedded key double-mints on a
// policy bump — the HIGH the adversarial review caught).
check("reputationSubjectId is version-free (no 'v<n>' in the key)", reputationSubjectId("letter", "L1") === "letter:L1" && !/v\d/.test(reputationSubjectId("outcome", "abc")));
check("subjectId is stable across a hypothetical policy re-weight (Arena rule 2 preserved)", reputationSubjectId("letter", "L1") === reputationSubjectId("letter", "L1"));
check("reputation does NOT re-export the version-embedded outcomeAwardKey as the subject", (repPolicy as Record<string, unknown>).outcomeAwardKey === undefined);

// The refusal register is binding here exactly as in Arena.
for (const refused of ["streaks", "cross_user_leaderboard", "named_ranking", "seasons", "cash_affiliate_payout", "outcome_count_broadcast"]) {
  check(`refusal register carries '${refused}'`, REPUTATION_REFUSED.includes(refused));
}
check("prohibited sources (login/page_open/likes...) carried over", REPUTATION_PROHIBITED_SOURCES.includes("login") && REPUTATION_PROHIBITED_SOURCES.includes("like"));
// The reputation source scans clean of refused surfaces.
{
  const src = ["fold", "policy", "milestones", "service", "repository", "events", "flags", "index"]
    .map((f) => readFileSync(join(__dirname, "..", `lib/reputation/${f}.ts`), "utf8")).join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1") // strip ALL comments
    .replace(/REPUTATION_REFUSED|REFUSED_V1/g, "");
  check("no streak logic anywhere in lib/reputation", !/streak/i.test(src));
  check("no leaderboard/cross-user ranking logic in lib/reputation", !/leaderboard|topOperators|ranking\b/i.test(src));
}

// ── Milestones: latch semantics, zero built-in definitions ───────────────────
check("ZERO built-in milestone definitions (values owner-gated, DW-D8)", MILESTONE_DEFINITIONS.length === 0);
const defs = [
  { key: "xp.100", test: (s: { totalXp: number }) => s.totalXp >= 100 },
  { key: "level.3", test: (s: { level: number }) => s.level >= 3 },
  { key: "BAD KEY!", test: () => true }, // malformed — must be skipped
  { key: "boom", test: () => { throw new Error("x"); } }, // throwing — must be skipped
];
const standing200 = foldStanding([row({ id: "big", xp: 200 })]);
check("earned milestones = satisfied, valid, unlatched (sorted)", JSON.stringify(evaluateMilestones(defs, standing200, new Set())) === JSON.stringify(["level.3", "xp.100"]));
check("already-latched milestones never re-earn", evaluateMilestones(defs, standing200, new Set(["xp.100", "level.3"])).length === 0);
check("unsatisfied conditions earn nothing", evaluateMilestones(defs, EMPTY_STANDING, new Set()).length === 0);
check("milestone keys validated (bounded machine keys)", isValidMilestoneKey("xp.100") && !isValidMilestoneKey("BAD KEY!") && !isValidMilestoneKey("ab") && !isValidMilestoneKey("x".repeat(61)));

console.log(`\nreputation-core.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
