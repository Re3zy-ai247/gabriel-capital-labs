import { Suspense } from "react";
import { notFound } from "next/navigation";
import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";

// CXOS Phase 1A-CX2 (C) — the Founder Walkthrough (Founder review runtime).
//
// One coherent, orchestrated tour across the approved cinematic surfaces —
// composed from their existing public exports (see ./stage.tsx), never a
// new room interior. Gated exactly like every other review route:
// production and unknown Vercel identities resolve to the ordinary 404
// boundary BEFORE the client stage is ever imported.
//
// Suspense: the stage reads `?step=`/`?persona=` via useSearchParams(),
// which Next.js requires a Suspense boundary for during static rendering
// (the same pattern already used by app/billing/page.tsx).
export default async function FounderWalkthroughReview() {
  if (!reviewBuildAllowed()) notFound();

  const { FounderWalkthroughStage } = await import("./stage");
  return (
    <Suspense fallback={null}>
      <FounderWalkthroughStage />
    </Suspense>
  );
}
