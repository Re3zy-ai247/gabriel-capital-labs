import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { reviewServerBuildAllowed } from "@/lib/cxos/reviewMode";

// CXOS Founder Review — never indexed, never linked from the public site.
// Availability is a BUILD property (lib/cxos/reviewMode.ts): production builds
// render every page below as "not enabled"; previews are additionally behind
// Vercel Authentication.
export const metadata: Metadata = {
  title: "CXOS Founder Review",
  robots: { index: false, follow: false },
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  // This is the authoritative boundary for every /review child. Individual
  // rooms retain their narrower flags, but no child can bypass hosted identity.
  if (!reviewServerBuildAllowed()) notFound();
  return children;
}
