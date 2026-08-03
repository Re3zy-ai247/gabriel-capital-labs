import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/session";
import { loadOnboardingStatus, ONBOARDING_STEP_COUNT } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

// Backs the Sidebar's nav-entry probe only — the /onboarding page itself
// loads lib/onboarding.ts directly, server-side. Onboarding is a case-shaped
// checklist (report → tradelines → letters → mailed); an agency owner with no
// workspace open has no case of their own to onboard through (the same
// altitude law Mission Control applies, lib/operatorSession.ts) — never nag
// them to upload THEIR credit report, so it never reads "incomplete" for
// that altitude.
export async function GET() {
  const { account, client } = await currentWorkspace();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (account.isAgency && !client) {
    return NextResponse.json({ incomplete: false });
  }

  const { completedSteps } = await loadOnboardingStatus((client ?? account).id);
  return NextResponse.json({ incomplete: completedSteps.length < ONBOARDING_STEP_COUNT });
}
