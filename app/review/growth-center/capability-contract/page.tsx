import { notFound } from "next/navigation";
import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import {
  resolveCapabilityReviewRequest,
  type CapabilityReviewProjection,
} from "@/lib/growthNetwork/capabilityContract";
import { growthCapabilityContractPreviewEnabled } from "@/lib/growthNetwork/capabilityPreviewFlags";
import { growthCenterPreviewEnabled } from "@/lib/growthNetwork/previewFlags";

// Growth Experience Phase 1B — protected, synthetic Founder-review annex.
//
// All three build-time controls are evaluated before the client stage is
// imported. Unknown query keys, duplicate values, and unrecognized values are
// represented by the deterministic unsupported projection; they never fall
// back to a favorable fixture.
export const dynamic = "force-dynamic";

type ReviewSearchParams = Record<
  string,
  string | readonly string[] | undefined
>;

interface CapabilityContractReviewPageProps {
  searchParams?: ReviewSearchParams;
}

function resolveInitialProjection(
  searchParams: ReviewSearchParams = {},
): CapabilityReviewProjection {
  const keys = Object.keys(searchParams);
  if (keys.some((key) => key !== "contract" && key !== "fixture")) {
    return resolveCapabilityReviewRequest([], []);
  }

  return resolveCapabilityReviewRequest(
    searchParams.contract,
    searchParams.fixture,
  );
}

export default async function CapabilityContractReviewPage({
  searchParams,
}: CapabilityContractReviewPageProps) {
  const reviewAllowed = reviewBuildAllowed();
  const growthCenterAllowed = growthCenterPreviewEnabled();
  const capabilityContractAllowed =
    growthCapabilityContractPreviewEnabled();

  if (
    !reviewAllowed ||
    !growthCenterAllowed ||
    !capabilityContractAllowed
  ) {
    notFound();
  }

  const initialProjection = resolveInitialProjection(searchParams);
  const { GrowthCapabilityContractStage } = await import("./stage");

  return (
    <GrowthCapabilityContractStage initialProjection={initialProjection} />
  );
}
