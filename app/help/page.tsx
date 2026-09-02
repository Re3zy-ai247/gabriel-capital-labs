'use client';

import Link from 'next/link';
import { SiteNav } from '@/components/marketing/SiteNav';
import { SiteFooter } from '@/components/marketing/SiteFooter';
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
  // RC1-S6b: this card described a $99/month subscription with upgrade and
  // downgrade paths. There is no consumer subscription to describe. What is
  // left is what a consumer actually has: an account, and — for anyone who paid
  // before — a preserved billing record they can still act on.
  {
    title: 'Your Account',
    icon: '💳',
    items: [
      { title: 'What CreditVector Costs', description: 'Free to use today — no plan to choose, no card required' },
      { title: 'A Plan You Paid For Before', description: 'Your billing history and past purchases are preserved on your billing page' },
      { title: 'Your Account Settings', description: 'Update profile, email, and preferences' },
    ],
  },
];

// RC1 S2 (A1-09), STRUCTURAL ONLY. /help is served publicly and returns 200 to
// anyone, but it rendered a bare full-bleed div: no SiteNav, no SiteFooter, no
// AppShell. A visitor arriving from search had no logo, no home link and no way
// to sign in — on the page a locked-out consumer is most likely to reach first.
// It also had no route INTO it: the only two /help references in the codebase
// sat inside the authenticated Credit Builder engine. It is now linked from the
// sidebar (components/Sidebar.tsx) and from /login.
//
// The monetization copy S2 deliberately left alone ("$99/month plan", "free
// tier (3 letters/month)") and the tier-gated support SLA were swept by RC1-S6b:
// the Billing card became an Account card, and the priority-support promise is
// gone (see the support paragraph below).
export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <SiteNav />
      <div id="main" className="max-w-6xl mx-auto w-full px-6 py-16">
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
            {/* RC1-S6b (S-32). This sentence promised "Professional and Agency
                members get priority email support — we aim to reply within one
                business day." Three things were wrong with it at once: the
                plans it named are not sold to consumers, the pricing page's own
                comparison marked priority support as NOT included for those
                tiers, and lib/support.ts has no plan branch at all — every
                signed-in user has always gone into the same queue. */}
            Open a ticket and the team picks it up from there. Every ticket goes into the same queue — there is no
            faster lane to buy, and no plan changes where yours lands.
          </p>
          <Link href="/support" className="inline-block bg-brand-500 hover:bg-brand-600 text-white keep-white px-8 py-3 rounded-lg font-semibold transition">
            Open a ticket
          </Link>
          {/* A1-09: the ticket desk needs a session, so it is not an answer for
              someone who cannot sign in. The address below already exists in the
              product (app/billing/cancel/page.tsx) and needs no account. */}
          <p className="mt-5 text-sm text-slate-400">
            Can&apos;t sign in? Email{' '}
            <a href="mailto:support@creditvector.app" className="font-medium text-brand-300 underline underline-offset-2 transition hover:text-brand-200">
              support@creditvector.app
            </a>{' '}
            — no account needed.
          </p>
        </div>

        {/* Quick Tips */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold mb-8">Pro Tips</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <div className="text-2xl mb-3">💡</div>
              {/* RC1-S6b: "Try the free tier (3 letters/month) to get familiar
                  with the system before upgrading." — a quota that does not
                  exist, and an upgrade there is nothing to upgrade to. */}
              <h3 className="font-bold mb-2">Start with One Report</h3>
              <p className="text-slate-400 text-sm">
                Upload a single bureau report first and get familiar with the system. Add the other two whenever you
                like — cross-bureau comparison gets stronger with each one.
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
      <SiteFooter />
    </div>
  );
}
