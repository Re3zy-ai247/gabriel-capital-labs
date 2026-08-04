import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import { PassageJourney } from "@/components/cxos/passage/PassageJourney";

// CXOS Phase 5.1 — THE PASSAGE · the end-to-end journey review route.
//
// Everything on this route is SYNTHETIC review data: no authentication, no
// database, no reputation read or write — the fixtures are literals in
// review-only components. The complete journey (Mission Control origin →
// Arena call → clearance → the passage → dimensional conversion →
// threshold → greeting → the floor → the return) is reviewable here
// without touching the real dormant /arena, which stays exactly as gated
// as before. Production builds hard-off this page before any journey code
// renders.
export default function PassageReview() {
  if (!reviewBuildAllowed()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-950 p-8 text-slate-400">
        <p className="text-sm">Founder Review is not enabled in this build.</p>
      </main>
    );
  }
  return <PassageJourney />;
}
