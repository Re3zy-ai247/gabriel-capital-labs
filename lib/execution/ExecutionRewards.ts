// Execution Engine — expected outcomes / unlocks (Sprint XX, ADR-0020). Answers
// "what does this action DO?" and "which action has the highest-impact unlock?"
// FACTUALLY — reusing the Mission Engine's `mission.unlocks`, the Builder OS's
// `expectedImprovement`, and the Roadmap's next stage. Never a promised score,
// never a predicted deletion (CROA bar).
import type { Mission } from "@/lib/missionEngine";
import type { BuilderOS } from "@/lib/builder";
import type { FinancialRoadmap } from "@/lib/roadmap";

// What the action accomplishes — sourced, in priority order, from the engines that
// already computed it. Falls through to a plain, honest "keeps your case moving".
export function expectedOutcome(m: Mission, builder: BuilderOS, roadmap: FinancialRoadmap): string {
  if (m.unlocks) return `Unlocks ${m.unlocks}.`;
  if (m.type === "builder") {
    const rec = builder.recommendations.find((r) => r.status === "recommended");
    if (rec) return rec.expectedImprovement; // already CROA-safe copy from the Builder OS
    return builder.summary;
  }
  const next = roadmap.nextStageId ? roadmap.stages.find((s) => s.id === roadmap.nextStageId) : null;
  if (next) return `Advances your roadmap toward "${next.label}".`;
  return "Keeps your case moving forward.";
}

// The single highest-impact unlock available to act on now — the honest answer to
// "which action moves the needle most?". Determined by the ladder (already ordered)
// and the Mission Engine's own impact flag; NOT a score prediction. Returns the
// first DO_NOW item flagged high-impact, or the first DO_NOW item otherwise.
export function biggestUnlock<T extends { id: string; title: string; expectedOutcome: string; bucket: string }>(
  doNow: T[],
  impactById: Map<string, Mission["impact"]>,
): { title: string; unlock: string; itemId: string } | null {
  const high = doNow.find((i) => impactById.get(i.id) === "high") ?? doNow[0];
  if (!high) return null;
  return { title: high.title, unlock: high.expectedOutcome, itemId: high.id };
}
