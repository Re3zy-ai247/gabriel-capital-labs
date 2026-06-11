'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const steps = [
  {
    number: 1,
    title: 'Complete Your Profile',
    description: 'Add your name and address so we can generate accurate dispute letters.',
    action: 'Go to Settings',
    href: '/settings',
    color: 'from-blue-500 to-blue-600',
  },
  {
    number: 2,
    title: 'Upload Your Credit Reports',
    description: 'Download your free reports from AnnualCreditReport.com and upload them here.',
    action: 'Upload Reports',
    href: '/upload',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    number: 3,
    title: 'Review Your Inaccuracies',
    description: 'We'll analyze your reports and show you everything that can be disputed.',
    action: 'View Tradelines',
    href: '/tradelines',
    color: 'from-purple-500 to-purple-600',
  },
  {
    number: 4,
    title: 'Generate Dispute Letters',
    description: 'Use our AI-powered tools to create professional dispute letters.',
    action: 'Start Generator',
    href: '/letters',
    color: 'from-orange-500 to-orange-600',
  },
  {
    number: 5,
    title: 'Track Your Progress',
    description: 'Monitor what's being fixed across your 90-day journey.',
    action: 'View Journey',
    href: '/journey',
    color: 'from-pink-500 to-pink-600',
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold mb-4">Welcome to Gabriel Capital Labs 👋</h1>
        <p className="text-xl text-slate-400 mb-8">
          Let's get you set up. Follow these 5 simple steps to start fixing your credit.
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-2 mb-12">
          <div
            className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="space-y-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-slate-600 transition"
            >
              <div className="flex items-start gap-6">
                {/* Step Number */}
                <div
                  className={`bg-gradient-to-br ${step.color} w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0`}
                >
                  <span className="text-2xl font-bold">{step.number}</span>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                  <p className="text-slate-400 mb-4">{step.description}</p>

                  <button
                    onClick={() => handleStepClick(step.number, step.href)}
                    className={`bg-gradient-to-r ${step.color} hover:opacity-90 text-white px-6 py-2 rounded-lg font-semibold transition`}
                  >
                    {step.action}
                  </button>
                </div>

                {/* Completion Check */}
                {completedSteps.includes(step.number) && (
                  <div className="text-emerald-500 text-3xl">✓</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border border-slate-700 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to upgrade to Premium?</h2>
          <p className="text-slate-400 mb-6">
            Premium members get unlimited dispute letters and AI refinement. Start your free trial.
          </p>
          <Link
            href="/pricing"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-lg font-semibold transition"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
