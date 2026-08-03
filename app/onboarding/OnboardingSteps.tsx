"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { trackClient } from "@/lib/trackClient";

export interface OnboardingStepDef {
  number: number;
  title: string;
  description: string;
  action: string;
  href: string;
}

// Presentational + funnel analytics only (Phase 1A, Agent E). Completion
// truth is computed server-side (lib/onboarding.ts, the SAME signals each
// step's own target page already reads) and passed in as `completedSteps` —
// this component invents nothing; it never marks a step done because it was
// clicked (row 7: no fake visited-state stands in for "done").
export function OnboardingSteps({ steps, completedSteps }: { steps: OnboardingStepDef[]; completedSteps: number[] }) {
  const startedTracked = useRef(false);
  const enteredTracked = useRef(false);

  // Private Alpha funnel: onboarding viewed (unchanged event, once per visit).
  useEffect(() => {
    if (startedTracked.current) return;
    startedTracked.current = true;
    trackClient("onboarding_started");
  }, []);

  // First engagement with a step = entered the product from onboarding
  // (unchanged funnel semantics — a UI-engagement event, not a claim that any
  // step is "done"; the checkmarks below are the only completion signal).
  function trackFirstEntry() {
    if (enteredTracked.current) return;
    enteredTracked.current = true;
    trackClient("onboarding_completed");
  }

  const done = new Set(completedSteps);

  return (
    <div className="space-y-6">
      {steps.map((step) => (
        <div key={step.number} className="card p-8">
          <div className="flex items-start gap-6">
            <div className="bg-gradient-to-br from-brand-500 to-ocean-600 w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-white keep-white">{step.number}</span>
            </div>

            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
              <p className="text-slate-400 mb-4">{step.description}</p>

              <Link href={step.href} onClick={trackFirstEntry} className="btn-primary">
                {step.action}
              </Link>
            </div>

            {done.has(step.number) && (
              <div className="text-success-400 text-3xl" aria-label="Step completed">✓</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
