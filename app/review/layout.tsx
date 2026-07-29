import type { Metadata } from "next";

// CXOS Founder Review — never indexed, never linked from the public site.
// Availability is a BUILD property (lib/cxos/reviewMode.ts): production builds
// render every page below as "not enabled"; previews are additionally behind
// Vercel Authentication.
export const metadata: Metadata = {
  title: "CXOS Founder Review",
  robots: { index: false, follow: false },
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
