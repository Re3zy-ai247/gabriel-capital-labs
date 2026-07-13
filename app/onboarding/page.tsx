'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Copy stays inside the CROA bar: process language only — no "fix your credit",
// no absolute detection claims, no offers (free trial) that don't exist.
const steps = [
  {
    number: 1,
    title: 'Complete Your Profile',
    description: 'Add your name and address so your dispute letters are accurate and mail-ready.',
    action: 'Go to Settings',
    href: '/settings',
  },
  {
    number: 2,
    title: 'Upload Your Credit Reports',
    description: 'Download your free reports from AnnualCreditReport.com and upload them here.',
    action: 'Upload Reports',
    href: '/upload',
  },
  {
    number: 3,
    title: 'Review What Kai Found',
    description: 'Your reports are analyzed account by account — what may be disputable, and why.',
    action: 'View Tradelines',
    href: '/tradelines',
  },
  {
    number: 4,
    title: 'Generate Dispute Letters',
    description: 'FCRA-grounded letters, drafted for you — review, print, and mail them yourself.',
    action: 'Start Generator',
    href: '/letters',
  },
  {
    number: 5,
    title: 'Track Your Progress',
    description: 'Follow every dispute through the bureaus’ response windows on your timeline.',
    action: 'View Timeline',
    href: '/journey',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const handleStepClick = (step: number, href: string) => {
    setCompletedSteps([...completedSteps, step]);
    router.push(href);
  };

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

        {/* Progress Bar */}
        <div
          className="w-full bg-ink-700 rounded-full h-2 mb-4"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={completedSteps.length}
          aria-label={`Onboarding: ${completedSteps.length} of ${steps.length} steps visited`}
        >
          <div
            className="bg-brand-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="space-y-6">
          {steps.map((step) => (
            <div key={step.number} className="card p-8">
              <div className="flex items-start gap-6">
                {/* Step Number */}
                <div className="bg-gradient-to-br from-brand-500 to-ocean-600 w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold text-white keep-white">{step.number}</span>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                  <p className="text-slate-400 mb-4">{step.description}</p>

                  <button onClick={() => handleStepClick(step.number, step.href)} className="btn-primary">
                    {step.action}
                  </button>
                </div>

                {/* Completion Check */}
                {completedSteps.includes(step.number) && (
                  <div className="text-success-400 text-3xl" aria-label="Step visited">✓</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 card p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Want the full engine?</h2>
          <p className="text-slate-400 mb-6">
            Premium includes unlimited dispute letters and AI refinement. The free tier stays free — 3 letters a month.
          </p>
          <Link href="/pricing" className="btn-primary btn-lg inline-flex">
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
