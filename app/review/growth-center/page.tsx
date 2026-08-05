import { notFound } from "next/navigation";
import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import { growthCenterPreviewEnabled } from "@/lib/growthNetwork/previewFlags";

// Growth Center Foundation Preview — Founder review only.
//
// Both controls must pass before the client stage is imported. The parent review
// layout is noindex. Production and unknown build identities fail closed through
// reviewBuildAllowed(), even if the subordinate Growth preview flag is present.
// This route reads no auth, participant, organization, Community, Marketplace,
// billing, economic, model, API, or database state.
export const dynamic = "force-dynamic";

export default async function GrowthCenterReviewPage() {
  if (!reviewBuildAllowed() || !growthCenterPreviewEnabled()) {
    notFound();
  }

  const { GrowthCenterStage } = await import("./stage");
  return <GrowthCenterStage />;
}
