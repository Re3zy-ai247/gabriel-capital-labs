// Operator Reputation — milestone evaluation (Sprint 10). PURE, no I/O.
//
// A milestone is a LATCHED fact (VECTOR-XP.md §4B): earned once when its condition
// holds, immune to future policy re-weighting, never removed by a later XP dip. The
// durable latch is the UNIQUE(operatorId, milestoneKey) row; this module only decides
// WHICH defined milestones a standing satisfies. Definitions are owner-gated policy
// (zero built-in — policy.ts MILESTONE_DEFINITIONS is empty until the owner ratifies
// values); evaluation is fail-closed on malformed keys/definitions.
import type { MilestoneDefinition } from "./policy";
import type { ReputationStanding } from "./fold";

// Bounded machine key: 3–60 chars, lowercase alphanumeric with . _ - separators.
const MILESTONE_KEY_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
export function isValidMilestoneKey(key: string): boolean {
  return typeof key === "string" && key.length >= 3 && key.length <= 60 && MILESTONE_KEY_RE.test(key);
}

// Which DEFINED milestones does this standing satisfy that are not already latched?
// Deterministic; a throwing/malformed definition is skipped (fail-closed), never fatal.
export function evaluateMilestones(
  definitions: readonly MilestoneDefinition[],
  standing: ReputationStanding,
  alreadyLatched: ReadonlySet<string>,
): string[] {
  const earned: string[] = [];
  for (const def of definitions) {
    if (!def || !isValidMilestoneKey(def.key) || typeof def.test !== "function") continue;
    if (alreadyLatched.has(def.key)) continue; // latched: never re-earned
    try {
      if (def.test({ totalXp: standing.totalXp, level: standing.level, awardCount: standing.awardCount }) === true) {
        earned.push(def.key);
      }
    } catch {
      // fail-closed: a broken definition earns nothing
    }
  }
  return earned.sort(); // deterministic order
}
