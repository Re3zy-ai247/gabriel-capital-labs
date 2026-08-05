// Onboarding truth (Phase 1A, Agent E — ROOM-RECOMMENDATIONS row 7 / SIM-REVIEW
// "onboarding: MIS-PRESCRIBED — wiring it as-is would ship the product's only
// fabricated-progress surface; fix semantics first or delete"). Each step's
// "completed" is the SAME real signal its own target page already treats as
// progress — never a client-side "the user clicked through here" stand-in.
// Reuses, verbatim, the identical checks app/journey/page.tsx's own 90-day
// phase checklist already performs (report/tradeline/letter counts, mailedAt)
// and the identical mail-ready boolean lib/letter.ts's consumerComplete /
// app/api/identity/*'s identityComplete already compute for a profile. One
// canonical place: both /onboarding itself and the Sidebar's nav-entry probe
// (app/api/onboarding/status) read this — never two independently derived
// truths about the same five facts.
import { prisma } from "@/lib/prisma";

export type OnboardingStepId = 1 | 2 | 3 | 4 | 5;
export const ONBOARDING_STEP_COUNT = 5;

export interface OnboardingStatus {
  completedSteps: OnboardingStepId[];
}

interface OnboardingSignals {
  profileComplete: boolean;
  reportCount: number;
  tradelineCount: number;
  letterCount: number;
  anyMailed: boolean;
}

// Pure — no DB, no clock, deterministic given its inputs. What
// scripts/kai-experience.test.ts exercises directly.
export function deriveOnboardingStatus(s: OnboardingSignals): OnboardingStatus {
  const completedSteps: OnboardingStepId[] = [];
  if (s.profileComplete) completedSteps.push(1); // Step 1 — Complete Your Profile
  if (s.reportCount > 0) completedSteps.push(2); // Step 2 — Upload Your Credit Reports
  if (s.tradelineCount > 0) completedSteps.push(3); // Step 3 — Review What Kai Found
  if (s.letterCount > 0) completedSteps.push(4); // Step 4 — Generate Dispute Letters
  if (s.anyMailed) completedSteps.push(5); // Step 5 — Track Your Progress
  return { completedSteps };
}

export interface ProfileSubject {
  fullName: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

// The SAME boolean lib/letter.ts's consumerComplete and
// app/api/identity/letter+discrepancies routes' identityComplete already
// compute (name + full mailing address) — reused rather than re-authored, so
// a step-1 checkmark can never disagree with whether Settings' own data is
// actually mail-ready.
export function profileIsComplete(u: ProfileSubject): boolean {
  return Boolean(u.fullName && u.addressLine1 && u.city && u.state && u.zip);
}

// The one function that touches the database — mirrors lib/kaiHome.ts's own
// getKaiHomeData split (pure logic above, a thin loader below). `userId` is
// already the effective subject; callers resolve that via lib/session.ts
// first, exactly as every other reader in this codebase does.
export async function loadOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  const [user, reportCount, tradelineCount, letters] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, addressLine1: true, city: true, state: true, zip: true },
    }),
    prisma.report.count({ where: { userId } }),
    prisma.tradeline.count({ where: { userId } }),
    prisma.letter.findMany({ where: { userId }, select: { mailedAt: true } }),
  ]);
  return deriveOnboardingStatus({
    profileComplete: user ? profileIsComplete(user) : false,
    reportCount,
    tradelineCount,
    letterCount: letters.length,
    anyMailed: letters.some((l) => l.mailedAt),
  });
}
