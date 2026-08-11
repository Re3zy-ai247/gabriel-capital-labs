import { redirect } from "next/navigation";

// Cinematic Transition Runtime — Wave T1 (app/review/transition-runtime/page.tsx)
//
// Demo index: redirects to the first room. No second reviewBuildAllowed()
// gate here — app/review/layout.tsx already 404s this entire subtree in
// production (spec §5).
export default function TransitionRuntimeIndexPage() {
  redirect("/review/transition-runtime/atrium");
}
