import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import { notFound } from "next/navigation";

// CXOS Phase 4 — the Mission Control review stage (Founder Review System).
//
// Everything on this stage is SYNTHETIC review data — no authentication, no
// database, no customer record can appear here by construction (the fixtures
// are literals in the client bundle of a review-only route). The stage lets
// the Founder review the authenticated entry and the room's shell in every
// projection before the real thing is reviewable live on an isolated preview.
export default async function MissionControlReview() {
  if (!reviewBuildAllowed()) notFound();
  const { MissionControlStage } = await import("./stage");
  return <MissionControlStage />;
}
