'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';

interface Status {
  plan: 'free' | 'premium' | 'agency' | 'agency_pro';
  isAgency: boolean;
  letterCredits?: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  memberSince: string | null;
  hasStripeCustomer: boolean;
  entitlement: {
    premium: boolean;
    lettersUsedThisMonth: number;
    letterLimit: number | null;
    lettersRemaining: number | null;
  };
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white" />}>
      <BillingInner />
    </Suspense>
  );
}

function BillingInner() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const justCheckedOut = params.get('checkout') === 'success';

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    async function load() {
      const res = await fetch('/api/billing/status');
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setStatus(data);
        setLoading(false);
      }
    }
    load();
    // After returning from checkout, Stripe's webhook may land a beat later —
    // poll briefly so the page reflects the new subscription.
    if (justCheckedOut) {
      const t = setInterval(load, 2500);
      setTimeout(() => clearInterval(t), 15000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [authStatus, justCheckedOut]);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else {
        setError(data.error || 'Could not start checkout.');
        setBusy(false);
      }
    } catch {
      setError('The connection dropped mid-request. Try again — nothing was lost.');
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else {
        setError(data.error || 'Could not open the billing portal.');
        setBusy(false);
      }
    } catch {
      setError('The connection dropped mid-request. Try again — nothing was lost.');
      setBusy(false);
    }
  }

  if (authStatus !== 'authenticated') return null;

  const isAgencyPro = status?.plan === 'agency_pro';
  const isAgency = status?.plan === 'agency' || isAgencyPro;
  const premium = status?.plan === 'premium' || isAgency;
  const planLabel = isAgencyPro ? 'Agency Pro' : isAgency ? 'Agency' : premium ? 'Professional' : 'Free';
  const monthlyCost = isAgencyPro ? '$699.00' : isAgency ? '$399.00' : premium ? '$99.00' : '$0.00';

  return (
    <AppShell title="/ Billing">
      <div className="max-w-4xl">
        <h1 className="text-xl font-semibold mb-2">Billing &amp; Subscription</h1>
        <p className="text-slate-400 mb-8">Manage your plan and payment settings</p>

        {justCheckedOut && (
          <div className="mb-8 rounded-lg border border-success-500/40 bg-success-500/10 px-5 py-4 text-success-300">
            🎉 Welcome{isAgency ? ' to Agency' : ' to Professional'}! Your subscription is being activated — this page will update momentarily.
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">Pulling up your plan…</p>
        ) : (
          <>
            {/* Current Plan */}
            <div className="card p-6 mb-8">
              <h2 className="text-2xl font-bold mb-6">Your Current Plan</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <div className="text-slate-400 text-sm mb-2">PLAN TYPE</div>
                  <div className="text-3xl font-bold mb-2">{planLabel}</div>
                  {premium && status?.subscriptionStatus && (
                    <div className="inline-block text-xs uppercase tracking-wide px-2 py-1 rounded bg-slate-800 text-slate-300 mb-4">
                      {status.subscriptionStatus.replace('_', ' ')}
                    </div>
                  )}
                  <p className="text-slate-400 mb-6">
                    {isAgency
                      ? `Manage each client in their own workspace with the full AI analysis and letter engine — up to ${isAgencyPro ? '40' : '15'} active client workspaces on your plan.`
                      : premium
                      ? 'Unlimited AI-refined dispute letters, the Kai Strategy Desk, and 90-day tracking.'
                      : 'You have 3 dispute letters per month. Upgrade for unlimited letters + AI refinement.'}
                  </p>
                  {premium ? (
                    <button
                      onClick={openPortal}
                      disabled={busy}
                      className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white px-6 py-2 rounded-lg font-semibold transition"
                    >
                      {busy ? 'Opening…' : 'Manage / Cancel Subscription'}
                    </button>
                  ) : (
                    <button
                      onClick={startCheckout}
                      disabled={busy}
                      className="btn-primary px-6"
                    >
                      {busy ? 'Redirecting…' : 'Upgrade to Professional — $99/mo'}
                    </button>
                  )}
                  {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
                </div>

                <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-6">
                  <div className="space-y-4">
                    <div>
                      <div className="text-slate-400 text-sm">Monthly Cost</div>
                      <div className="text-2xl font-bold">{monthlyCost}</div>
                    </div>
                    {premium && (
                      <div className="border-t border-slate-700 pt-4">
                        <div className="text-slate-400 text-sm">
                          {status?.subscriptionStatus === 'canceled' ? 'Access Until' : 'Next Billing Date'}
                        </div>
                        <div className="text-lg font-semibold">{formatDate(status?.currentPeriodEnd ?? null)}</div>
                      </div>
                    )}
                    <div className="border-t border-slate-700 pt-4">
                      <div className="text-slate-400 text-sm">Letters This Month</div>
                      <div className="text-lg font-semibold tnum">
                        {status?.entitlement.lettersUsedThisMonth ?? 0}
                        {status?.entitlement.letterLimit !== null
                          ? ` / ${status?.entitlement.letterLimit}`
                          : ' (unlimited)'}
                      </div>
                      {status?.entitlement.letterLimit !== null && (
                        <p className="mt-1 text-xs text-slate-400">
                          <span className="mr-1.5 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                          {status?.entitlement.lettersRemaining ?? 0} letter{(status?.entitlement.lettersRemaining ?? 0) === 1 ? '' : 's'} remaining — your allotment resets on the 1st of each month.
                        </p>
                      )}
                    </div>
                    <div className="border-t border-slate-700 pt-4">
                      <div className="text-slate-400 text-sm">Member Since</div>
                      <div className="text-lg font-semibold">{formatDate(status?.memberSince ?? null)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* What's Included */}
            <div className="card p-6 mb-8">
              <h2 className="text-2xl font-bold mb-6">{premium ? "What's Included" : 'Unlock Professional'}</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  ['Unlimited Dispute Letters', 'Generate as many professional dispute letters as you need.'],
                  ['AI-Powered Refinement', 'KAI grounds every letter in FCRA, FDCPA, and case law.'],
                  ['90-Day Progress Tracking', 'Monitor disputes across all three bureaus.'],
                  ['Priority Support', 'Faster help when you need it.'],
                ].map(([title, desc]) => (
                  <div key={title} className="flex items-start gap-3">
                    <span className={`text-2xl flex-shrink-0 ${premium ? 'text-success-500' : 'text-slate-600'}`}>
                      {premium ? '✓' : '○'}
                    </span>
                    <div>
                      <div className="font-semibold">{title}</div>
                      <p className="text-slate-400 text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment & invoices via Stripe portal */}
            <div className="card p-6">
              <h2 className="text-2xl font-bold mb-4">Payment &amp; Invoices</h2>
              <p className="text-slate-400 text-sm mb-6">
                Payments are processed securely by Stripe — your card details never touch our servers. Update your card,
                view receipts, or cancel anytime in the billing portal.
              </p>
              {status?.hasStripeCustomer ? (
                <button
                  onClick={openPortal}
                  disabled={busy}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white px-6 py-2 rounded-lg font-semibold transition"
                >
                  {busy ? 'Opening…' : 'Open Billing Portal'}
                </button>
              ) : (
                <p className="text-slate-500 text-sm">No billing history yet. Upgrade to Professional to get started.</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
