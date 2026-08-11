import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { currentUserOrDemo } from "@/lib/session";
import { loadOnboardingStatus } from "@/lib/onboarding";
import { OnboardingSteps, type OnboardingStepDef } from "./OnboardingSteps";

export const dynamic = "force-dynamic";

// Copy stays inside the CROA bar: process language only — no "fix your credit",
// no absolute detection claims, no offers (free trial) that don't exist.
const STEPS: OnboardingStepDef[] = [
  {
    number: 1,
    title: "Complete Your Profile",
    description: "Add your name and address so your dispute letters are accurate and mail-ready.",
    action: "Go to Settings",
    href: "/settings",
  },
  {
    number: 2,
    title: "Upload Your Credit Reports",
    description: "Download your free reports from AnnualCreditReport.com and upload them here.",
    action: "Upload Reports",
    href: "/upload",
  },
  {
    number: 3,
    title: "Review What Kai Found",
    description: "Your reports are analyzed account by account — what may be disputable, and why.",
    action: "View Tradelines",
    href: "/tradelines",
  },
  {
    number: 4,
    title: "Generate Dispute Letters",
    description: "FCRA-grounded letters, drafted for you — review, print, and mail them yourself.",
    action: "Start Generator",
    href: "/letters",
  },
  {
    number: 5,
    title: "Track Your Progress",
    description: "Follow every dispute through the bureaus’ response windows on your timeline.",
    action: "View Timeline",
    href: "/journey",
  },
];

// Onboarding (Phase 1A, Agent E — ROOM-RECOMMENDATIONS row 7). Was: five
// steps whose "✓" meant only "you clicked this once" — fabricated progress
// (SIM-REVIEW: "the product's only fabricated-progress surface"). Now: each
// step's completion is a real row/field this account already has (see
// lib/onboarding.ts) — the SAME facts /settings, /upload, /tradelines,
// /letters, and /journey's own checklist already treat as done. A brand-new,
// zero-data account renders every step honestly incomplete; nothing here is
// ever a placeholder standing in for a fact that isn't there.
export default async function OnboardingPage() {
  const user = await currentUserOrDemo();
  if (!user) {
    return (
      <AppShell title="/ Getting started">
        <p className="text-slate-400">Please sign in.</p>
      </AppShell>
    );
  }

  const { completedSteps } = await loadOnboardingStatus(user.id);
  const completedCount = completedSteps.length;

  return (
    <div className="min-h-screen bg-ink-950 text-white">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Getting started</span>
        </div>
        <h1 className="text-5xl font-bold mb-4">Welcome to CreditVector™</h1>
        <p className="text-xl text-slate-400 mb-8">
          Five steps and your file is under command. I&apos;ll be working at every one of them.
        </p>

        {/* Progress Bar — real completion, not visits (row 7 fix). */}
        <div
          className="w-full bg-ink-700 rounded-full h-2 mb-4"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={completedCount}
          aria-label={`Getting started: ${completedCount} of ${STEPS.length} steps completed`}
        >
          <div
            className="bg-brand-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <OnboardingSteps steps={STEPS} completedSteps={completedSteps} />

        {/* Bottom CTA */}
        <div className="mt-16 card p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Want the full engine?</h2>
          <p className="text-slate-400 mb-6">
            Professional includes unlimited dispute letters and letter refinement. The free tier stays free — 3 letters a month.
          </p>
          <Link href="/pricing" className="btn-primary btn-lg inline-flex">
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
