import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import { ArenaStage } from "./stage";

// CXOS Phase 5 — the Arena review stage (Founder Review System).
//
// Everything here is SYNTHETIC review data: no authentication, no database,
// no reputation read or write — the fixtures are literals in a review-only
// route. The stage lets the Founder review the entry choreography and every
// chamber state before touching the real dormant surface (which stays gated
// by flag + cohort exactly as before).
export default function ArenaReview() {
  if (!reviewBuildAllowed()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-950 p-8 text-slate-400">
        <p className="text-sm">Founder Review is not enabled in this build.</p>
      </main>
    );
  }
  return <ArenaStage />;
}
