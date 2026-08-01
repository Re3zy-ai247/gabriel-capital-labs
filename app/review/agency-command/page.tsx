import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import { notFound } from "next/navigation";

// CXOS Phase 6.2 — Agency Headquarters Founder Review.
//
// This route is a synthetic experience prototype. The stage imports no Agency
// API, session helper, Prisma client, billing module, or live product component.
// The root application still supplies its existing global providers; the Phase 6.2
// source itself performs no network request, storage access, or data mutation.
// Kai commands use a fixed local resolver and deterministic route-instance state.
//
// The server gate runs before the client stage is imported. Production and
// unknown Vercel identities resolve to the ordinary 404 boundary.
export default async function AgencyCommandReview() {
  if (!reviewBuildAllowed()) notFound();

  const { AgencyCommandStage } = await import("./stage");
  return <AgencyCommandStage />;
}
