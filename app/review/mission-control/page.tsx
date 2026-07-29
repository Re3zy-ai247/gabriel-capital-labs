import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import { MissionControlStage } from "./stage";

// CXOS Phase 4 — the Mission Control review stage (Founder Review System).
//
// Everything on this stage is SYNTHETIC review data — no authentication, no
// database, no customer record can appear here by construction (the fixtures
// are literals in the client bundle of a review-only route). The stage lets
// the Founder review the authenticated entry and the room's shell in every
// projection before the real thing is reviewable live on an isolated preview.
export default function MissionControlReview() {
  if (!reviewBuildAllowed()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-950 p-8 text-slate-400">
        <p className="text-sm">Founder Review is not enabled in this build.</p>
      </main>
    );
  }
  return <MissionControlStage />;
}
