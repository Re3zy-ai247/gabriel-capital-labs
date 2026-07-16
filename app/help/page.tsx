'use client';

import Link from 'next/link';
import { StatuteCard } from '@/components/StatuteCard';
import { STATUTES, type StatuteKey } from '@/lib/statutes';

const STATUTE_ORDER = Object.keys(STATUTES) as StatuteKey[];

const guides = [
  {
    title: 'Getting Started',
    icon: '🚀',
    items: [
      { title: 'Create Your Account', description: 'Sign up in 2 minutes and get started' },
      { title: 'Complete Your Profile', description: 'Add your name and address for dispute letters' },
      { title: 'Upload Your Reports', description: 'Download free reports from AnnualCreditReport.com' },
    ],
  },
  {
    title: 'Dispute Letters',
    icon: '📄',
    items: [
      { title: 'How to Generate Letters', description: 'Step-by-step guide to creating dispute letters' },
      { title: 'Choosing the Right Strategy', description: 'Pick the best dispute approach for each item' },
      { title: 'Submitting Your Letters', description: 'Tips for mailing and tracking your disputes' },
    ],
  },
  {
    title: 'Tracking Progress',
    icon: '📊',
    items: [
      { title: 'Understanding the 90-Day Journey', description: 'How credit disputes are resolved over time' },
      { title: 'Reading Your Reports', description: 'How to interpret changes in your credit reports' },
      { title: 'Checking Dispute Status', description: 'Track each dispute\'s reinvestigation status across bureaus' },
    ],
  },
  {
    title: 'Billing & Account',
    icon: '💳',
    items: [
      { title: 'Professional Subscription', description: 'What\'s included in the $99/month plan' },
      { title: 'Managing Your Subscription', description: 'Upgrade, downgrade, or cancel anytime' },
      { title: 'Your Account Settings', description: 'Update profile, email, and preferences' },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Briefing room</span>
        </div>
        <h1 className="text-5xl font-bold mb-4">Help & Support</h1>
        <p className="text-xl text-slate-400 mb-12">
          The essentials, explained the way I explain them — plainly. Start with a guide; if it doesn&apos;t settle the question, send it to the team below.
        </p>

        {/* Guides Grid — static reference cards (no false click affordance). */}
        <div className="grid md:grid-cols-2 gap-12">
          {guides.map((guide) => (
            <div key={guide.title}>
              <div className="text-4xl mb-4">{guide.icon}</div>
              <h2 className="text-2xl font-bold mb-6">{guide.title}</h2>

              <div className="space-y-4">
                {guide.items.map((item) => (
                  <div
                    key={item.title}
                    className="w-full text-left bg-slate-900 border border-slate-700 rounded-lg p-4"
                  >
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-sm text-slate-400 mt-1">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* The law, in plain English (W13 statute library) */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold mb-3">The law, in plain English</h2>
          <p className="text-slate-400 mb-8 max-w-3xl">
            Every statute the letters and I cite, decoded — and one click from the actual operative text, because you
            should never have to trust a citation you can&apos;t read. These are your existing legal rights; using them
            is a process, not a guarantee of any outcome.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {STATUTE_ORDER.map((k) => (
              <StatuteCard key={k} statute={k} />
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-16 bg-gradient-to-r from-brand-900/20 to-ocean-700/20 border border-slate-700 rounded-lg p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Didn&apos;t find your answer?</h2>
          <p className="text-slate-400 mb-6 max-w-2xl mx-auto">
            Open a ticket and the team picks it up from there. Professional and Agency members get priority email support — we aim to reply within one business day.
          </p>
          <Link href="/support" className="inline-block bg-brand-500 hover:bg-brand-600 text-white keep-white px-8 py-3 rounded-lg font-semibold transition">
            Open a ticket
          </Link>
        </div>

        {/* Quick Tips */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold mb-8">Pro Tips</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <div className="text-2xl mb-3">💡</div>
              <h3 className="font-bold mb-2">Start with Free Tier</h3>
              <p className="text-slate-400 text-sm">
                Try the free tier (3 letters/month) to get familiar with the system before upgrading.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <div className="text-2xl mb-3">📋</div>
              <h3 className="font-bold mb-2">Use the Strategist</h3>
              <p className="text-slate-400 text-sm">
                Kai, your Credit Intelligence Officer, prioritizes which items to dispute first — and explains why.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <div className="text-2xl mb-3">⏰</div>
              <h3 className="font-bold mb-2">Follow the 90-Day Journey</h3>
              <p className="text-slate-400 text-sm">
                The FCRA gives the bureaus about 30 days to reinvestigate most disputes (§611). Check the journey tab to
                track each one&apos;s window — the process is what we track, not a promised outcome.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
