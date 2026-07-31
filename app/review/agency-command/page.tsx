import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import { AgencyCommandStage } from "./stage";

// CXOS Phase 6 — Agency Command Founder Review.
//
// This route is a synthetic experience prototype. The stage imports no Agency
// API, session helper, Prisma client, billing module, or live product component.
// The root application still supplies its existing global providers; the Phase 6
// source itself performs no network request, storage access, or data mutation.
//
// The production guarantee is precise: the review stage is not renderable when
// reviewBuildAllowed() is false. This does not claim a 404 or bundle exclusion.
export default function AgencyCommandReview() {
  if (!reviewBuildAllowed()) {
    return (
      <main
        id="main"
        tabIndex={-1}
        className="flex min-h-screen items-center justify-center bg-ink-950 p-8 text-slate-400"
      >
        <p className="text-sm">Founder Review is not enabled in this build.</p>
      </main>
    );
  }

  return <AgencyCommandStage />;
}
