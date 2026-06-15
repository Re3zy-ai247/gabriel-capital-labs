'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

type Plan = 'premium' | 'agency' | 'agency_pro';
type Interval = 'month' | 'year';

interface Tier {
  plan: Plan | 'free';
  name: string;
  monthly: number;
  yearly: number;
  blurb: string;
  popular?: boolean;
  features: string[];
  accent: string; // tailwind text color
  border: string;
  button: string;
}

const TIERS: Tier[] = [
  {
    plan: 'free', name: 'Free', monthly: 0, yearly: 0, blurb: 'Explore your report',
    features: ['Upload all three bureaus', 'See every inaccuracy', '3 dispute letters / month'],
    accent: 'text-white', border: 'border-slate-700', button: 'bg-slate-700 hover:bg-slate-600',
  },
  {
    plan: 'premium', name: 'Premium', monthly: 99, yearly: 990, blurb: 'Unlimited disputes', popular: true,
    features: ['Everything in Free', 'Unlimited dispute letters', 'AI letter refinement', 'Dispute strategist', '90-day tracking'],
    accent: 'text-emerald-400', border: 'border-emerald-500', button: 'bg-emerald-500 hover:bg-emerald-600',
  },
  {
    plan: 'agency', name: 'Agency', monthly: 399, yearly: 3990, blurb: 'Run your own business',
    features: ['Everything in Premium', 'Up to 50 managed clients', 'A workspace per client', 'Roster KPIs + follow-up clock'],
    accent: 'text-indigo-300', border: 'border-indigo-500/60', button: 'bg-indigo-500 hover:bg-indigo-600',
  },
  {
    plan: 'agency_pro', name: 'Agency Pro', monthly: 799, yearly: 7990, blurb: 'For high-volume teams',
    features: ['Everything in Agency', 'Unlimited managed clients', 'Priority support'],
    accent: 'text-violet-300', border: 'border-violet-500/60', button: 'bg-violet-500 hover:bg-violet-600',
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>('month');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout(payload: Record<string, unknown>, signedOutNext: string) {
    setError(null);
    if (!session) {
      router.push(`/register?next=${signedOutNext}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else {
        setError(data.error || 'Could not start checkout. Please try again.');
        setBusy(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-xl text-slate-400 mb-8">From a single report to running your own credit-repair business.</p>

        {/* Interval toggle */}
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 p-1">
          <button
            onClick={() => setInterval('month')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${interval === 'month' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval('year')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${interval === 'year' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
          >
            Annual <span className="ml-1 text-[11px] opacity-90">save 2 months</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-start">
          {TIERS.map((t) => {
            const price = interval === 'year' ? t.yearly : t.monthly;
            const isFree = t.plan === 'free';
            return (
              <div
                key={t.plan}
                className={`relative rounded-lg border-2 p-7 ${t.border} ${t.popular ? 'bg-gradient-to-br from-emerald-900/40 to-slate-800' : 'bg-slate-800/70'}`}
              >
                {t.popular && (
                  <div className="absolute -top-3 left-7 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-bold text-slate-900">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold">{t.name}</h3>
                <p className="mb-4 text-sm text-slate-400">{t.blurb}</p>
                <div className="mb-1 text-4xl font-bold">
                  ${interval === 'year' && !isFree ? price.toLocaleString() : price}
                  {!isFree && <span className="text-base font-normal text-slate-400">/{interval === 'year' ? 'yr' : 'mo'}</span>}
                </div>
                <div className="mb-5 h-4 text-[11px] text-slate-500">
                  {!isFree && interval === 'year' ? `≈ $${Math.round(price / 12)}/mo, billed annually` : isFree ? 'Forever free' : 'Billed monthly'}
                </div>
                <ul className="mb-6 space-y-2 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className={t.accent}>✓</span> <span className="text-slate-200">{f}</span>
                    </li>
                  ))}
                </ul>
                {isFree ? (
                  <Link href={session ? '/dashboard' : '/register'} className={`block w-full rounded-lg py-2.5 text-center font-semibold text-white keep-white transition ${t.button}`}>
                    {session ? 'Go to Dashboard' : 'Get Started Free'}
                  </Link>
                ) : (
                  <button
                    onClick={() => checkout({ plan: t.plan, interval }, t.plan === 'premium' ? '/pricing' : '/agency')}
                    disabled={busy}
                    className={`w-full rounded-lg py-2.5 font-semibold text-white keep-white transition disabled:opacity-60 ${t.button}`}
                  >
                    {busy ? 'Redirecting…' : `Get ${t.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

        {/* One-time letter pack */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-6 py-5 sm:flex-row">
          <div>
            <div className="font-semibold">Just need a few more letters?</div>
            <p className="text-sm text-slate-400">Buy a one-time pack of 5 dispute letters — no subscription required.</p>
          </div>
          <button
            onClick={() => checkout({ product: 'letters_5' }, '/letters')}
            disabled={busy}
            className="shrink-0 rounded-lg bg-slate-700 px-6 py-2.5 font-semibold transition hover:bg-slate-600 disabled:opacity-60"
          >
            Buy 5 letters — $19
          </button>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="mb-8 text-center text-3xl font-bold">Common Questions</h2>
        <div className="space-y-6">
          {[
            ['Can I cancel anytime?', 'Yes — no contracts. Cancel from your billing dashboard; access continues to the end of the period.'],
            ['What does Agency Pro add?', 'The Agency plan includes up to 50 managed clients. Agency Pro removes that cap for high-volume teams.'],
            ['Do letter-pack credits expire?', 'No. Purchased letters are used automatically once your free monthly allowance runs out, and they carry over month to month.'],
            ['Do you handle disputes for me?', 'We generate professional, FCRA-grounded letters you review and mail yourself. You stay in control.'],
          ].map(([q, a]) => (
            <div key={q} className="rounded-lg border border-slate-700 bg-slate-800 p-6">
              <h3 className="mb-2 text-lg font-bold">{q}</h3>
              <p className="text-slate-400">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
