'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade(plan: 'premium' | 'agency' = 'premium') {
    setError(null);
    if (!session) {
      router.push(`/register?next=${plan === 'agency' ? '/agency' : '/pricing'}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
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
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold mb-6">Simple, Transparent Pricing</h1>
        <p className="text-xl text-slate-400 mb-8">
          Start resolving inaccuracies on your credit report. No hidden fees.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-8 items-start">
          {/* Free Plan */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-2">Free</h3>
            <p className="text-slate-400 mb-6">Perfect for exploring</p>

            <div className="mb-6">
              <div className="text-4xl font-bold mb-2">$0</div>
              <p className="text-slate-400 text-sm">Forever free</p>
            </div>

            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                Upload your credit reports
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                View all inaccuracies found
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                3 dispute letters per month
              </li>
              <li className="flex items-center">
                <span className="text-slate-500 mr-3">✗</span>
                <span className="text-slate-400">Unlimited letters</span>
              </li>
              <li className="flex items-center">
                <span className="text-slate-500 mr-3">✗</span>
                <span className="text-slate-400">AI letter refinement</span>
              </li>
            </ul>

            <Link
              href={session ? '/dashboard' : '/register'}
              className="w-full block text-center bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition"
            >
              {session ? 'Go to Dashboard' : 'Get Started Free'}
            </Link>
          </div>

          {/* Premium Plan */}
          <div className="bg-gradient-to-br from-emerald-900 to-slate-800 border-2 border-emerald-500 rounded-lg p-8 relative">
            <div className="absolute -top-4 left-8 bg-emerald-500 text-slate-900 px-4 py-1 rounded-full text-sm font-bold">
              MOST POPULAR
            </div>

            <h3 className="text-2xl font-bold mb-2">Premium</h3>
            <p className="text-slate-300 mb-6">Unlimited dispute letters</p>

            <div className="mb-6">
              <div className="text-4xl font-bold mb-2">$99</div>
              <p className="text-slate-300 text-sm">/month, cancel anytime</p>
            </div>

            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-center">
                <span className="text-emerald-400 mr-3">✓</span>
                Everything in Free
              </li>
              <li className="flex items-center">
                <span className="text-emerald-400 mr-3">✓</span>
                <span className="font-bold text-white">Unlimited dispute letters</span>
              </li>
              <li className="flex items-center">
                <span className="text-emerald-400 mr-3">✓</span>
                AI-powered letter refinement
              </li>
              <li className="flex items-center">
                <span className="text-emerald-400 mr-3">✓</span>
                90-day progress tracking
              </li>
              <li className="flex items-center">
                <span className="text-emerald-400 mr-3">✓</span>
                Priority email support
              </li>
            </ul>

            <button
              onClick={() => upgrade('premium')}
              disabled={busy}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white keep-white py-3 rounded-lg font-semibold transition"
            >
              {busy ? 'Redirecting to checkout…' : session ? 'Upgrade to Premium' : 'Get Premium'}
            </button>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <p className="mt-3 text-center text-xs text-slate-400">
              Secure checkout by Stripe · 30-day money-back guarantee
            </p>
          </div>

          {/* Agency Plan */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-800 border border-indigo-500/60 rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-2">Agency</h3>
            <p className="text-slate-300 mb-6">Run your own credit-repair business</p>

            <div className="mb-6">
              <div className="text-4xl font-bold mb-2">$399</div>
              <p className="text-slate-300 text-sm">/month, cancel anytime</p>
            </div>

            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-center">
                <span className="text-indigo-300 mr-3">✓</span>
                Everything in Premium
              </li>
              <li className="flex items-center">
                <span className="text-indigo-300 mr-3">✓</span>
                <span className="font-bold text-white">Unlimited managed clients</span>
              </li>
              <li className="flex items-center">
                <span className="text-indigo-300 mr-3">✓</span>
                A dedicated workspace per client
              </li>
              <li className="flex items-center">
                <span className="text-indigo-300 mr-3">✓</span>
                Follow-up clock + roster KPI reporting
              </li>
              <li className="flex items-center">
                <span className="text-indigo-300 mr-3">✓</span>
                Full AI analysis &amp; letter engine for each client
              </li>
            </ul>

            <button
              onClick={() => upgrade('agency')}
              disabled={busy}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white keep-white py-3 rounded-lg font-semibold transition"
            >
              {busy ? 'Redirecting to checkout…' : session ? 'Start Agency Plan' : 'Get Agency'}
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">
              Secure checkout by Stripe · cancel anytime
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">Common Questions</h2>

        <div className="space-y-6">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-bold mb-2">Can I cancel anytime?</h3>
            <p className="text-slate-400">Yes! No contracts, no penalties. Cancel your subscription at any time from your billing dashboard.</p>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-bold mb-2">How many reports can I upload?</h3>
            <p className="text-slate-400">Unlimited! Upload reports from all three bureaus (Equifax, Experian, TransUnion) and we'll track all inaccuracies.</p>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-bold mb-2">Do you handle the disputes for me?</h3>
            <p className="text-slate-400">No, but we generate professional dispute letters you can mail yourself. You control the process, we handle the accuracy.</p>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-bold mb-2">What if I need help?</h3>
            <p className="text-slate-400">Premium members get priority email support. Plus, every letter comes with guidance on how to submit it.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
