// The single platform entry point. Loads the snapshot ONCE and composes every
// module — future products (Funding Hub, Credit Builder, Business Credit,
// Monitoring, Mobile, the public AI API) call THIS and never compute their own
// intelligence. `assembleIntelligence` is pure (over a snapshot) so the whole
// platform is unit-testable with no DB.
import { loadSnapshot, type IntelSnapshot } from "./snapshot";
import * as M from "./modules";
import type { CreditIntelligence } from "./types";

export function assembleIntelligence(s: IntelSnapshot): CreditIntelligence {
  return {
    generatedAtNote: "Computed deterministically from your file — no AI, no estimated deletions, no fabricated numbers.",
    hasReport: s.hasReport,
    profile: M.creditProfile(s),
    health: M.creditHealth(s),
    risk: M.riskAnalysis(s),
    opportunities: M.opportunities(s),
    readiness: M.readiness(s),
    builder: M.builderIntelligence(s),
    business: M.businessReadiness(s),
    timeline: M.timelineIntel(s),
  };
}

export async function creditIntelligence(userId: string): Promise<CreditIntelligence> {
  return assembleIntelligence(await loadSnapshot(userId));
}
