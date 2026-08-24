'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { openBillingPortal } from '@/lib/portalClient';
import { resolveAgencyCapacity } from '@/lib/agencyCapacity';

// RC1-S6b. This page now renders /api/billing/status's RC1-S6a semantics, where
// the historical record and the live entitlement are explicitly different
// things: `plan` / `subscriptionStatus` / `currentPeriodEnd` / `letterCredits`
// are records of what an account bought while consumer plans were sold, and
// `planIsHistorical` + `letterCreditsFrozen` + `consumerSalesClosed` say so on
// the wire. Nothing here may present a historical field as a live benefit or as
// a reason to buy — and nothing may erase it either.
interface Status {
  plan: 'free' | 'premium' | 'agency' | 'agency_pro';
  planIsHistorical?: boolean;
  isAgency: boolean;
  letterCredits?: number;
  letterCreditsFrozen?: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  memberSince: string | null;
  hasStripeCustomer: boolean;
  consumerSalesClosed?: boolean;
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

  // RC1-S6b: `startCheckout()` lived here and POSTed to /api/stripe/checkout to
  // sell a Professional subscription. S6a closed consumer sales — that route now
  // refuses every consumer purchase with a 410 — so the function could only ever
  // have produced a dead-end. Removed rather than disabled: a checkout call that
  // exists is one config change away from firing again.

  async function openPortal() {
    setBusy(true);
    setError(null);
    // Single implementation lives in lib/portalClient.ts; on success the browser
    // is already navigating away, so `busy` deliberately stays true.
    const err = await openBillingPortal();
    if (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (authStatus !== 'authenticated') return null;

  const isAgencyPro = status?.plan === 'agency_pro';
  const isAgency = status?.plan === 'agency' || isAgencyPro;
  // A consumer plan ON RECORD. Never a current tier: the route sets
  // planIsHistorical for exactly this row shape, and the entitlement that
  // actually governs the account is identical to everybody else's.
  const hadConsumerPlan = status?.planIsHistorical === true || status?.plan === 'premium';
  const historicalPlanLabel = 'Professional';
  const frozenCredits = Math.max(0, status?.letterCredits ?? 0);
  const hasBillingRecord =
    hadConsumerPlan || frozenCredits > 0 || Boolean(status?.hasStripeCustomer) || Boolean(status?.subscriptionStatus);
  // Workspace capacity is NEVER hardcoded here: it comes from the same canonical
  // resolver the server enforces with (lib/agencyCapacity, ADR-0031 §4), fed the same
  // server-owned inputs the billing status route returns. Hardcoded copy is how a buyer
  // gets sold capacity the server will not honor (pinned in scripts/agency-capacity.test.ts).
  const workspaceLimit = resolveAgencyCapacity({
    plan: status?.plan,
    isAgency: status?.isAgency,
    createdAt: status?.memberSince,
  }).workspaceLimit;
  const workspaceCopy =
    workspaceLimit === null
      ? ' — unlimited active client workspaces on your plan'
      : workspaceLimit > 0
      ? ` — up to ${workspaceLimit} active client workspaces on your plan`
      : '';

  return (
    <AppShell title="/ Billing">
      <div className="max-w-4xl">
        <h1 className="text-xl font-semibold mb-2">Billing &amp; Account</h1>
        <p className="text-slate-400 mb-8">What CreditVector costs you, and the record of anything you paid before</p>

        {/* RC1-S6b: this banner used to read "🎉 Welcome to Professional! Your
            subscription is being activated". No consumer subscription can start
            any more, so the only honest thing left to say is that the page is
            re-reading itself. */}
        {justCheckedOut && (
          <div className="mb-8 rounded-lg border border-ink-700 bg-ink-900/60 px-5 py-4 text-slate-300">
            Re-checking your billing details — this page will update momentarily.
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">Pulling up your billing details…</p>
        ) : (
          <>
            {/* ---- What you pay today ---- */}
            {/* Replaces the old "Your Current Plan" card, which showed a plan
                type, a monthly cost, a letters-this-month meter against a limit
                with "your allotment resets on the 1st of each month" (false even
                under the old paid model — the meter was a rolling append-only
                ledger, never a calendar reset), and an upgrade button carrying
                the monthly price. */}
            <div className="card p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">What you pay</h2>
              <p className="text-3xl font-bold mb-3">Nothing</p>
              <p className="text-slate-400 mb-2">
                CreditVector&apos;s consumer product is free to use today. There is no plan to choose, no card on file
                is required, and no part of the product is held back behind a paid tier.
              </p>
              {isAgency && (
                <p className="text-slate-400">
                  This account also runs an agency workspace{workspaceCopy}. That is a separate product from the free
                  consumer one, and it is billed through the Stripe portal below.
                </p>
              )}
            </div>

            {/* ---- The historical record ---- */}
            {hasBillingRecord && (
              <div className="card p-6 mb-8">
                <h2 className="text-2xl font-bold mb-2">Your billing history</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Kept exactly as it happened. Nothing below has been removed, and nothing below is a plan you are on
                  today.
                </p>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    {hadConsumerPlan && (
                      <div>
                        <div className="text-slate-400 text-sm">Plan you previously paid for</div>
                        <div className="text-lg font-semibold">
                          {historicalPlanLabel}
                          <span className="ml-2 rounded bg-slate-800 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-slate-300">
                            Past plan
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          A record of what you bought, not a tier you are on. CreditVector no longer sells consumer
                          plans, so this grants nothing — and takes nothing away either, because everything it used to
                          unlock is now open to every account.
                        </p>
                      </div>
                    )}
                    {status?.subscriptionStatus && (
                      <div>
                        <div className="text-slate-400 text-sm">Subscription status</div>
                        <div className="text-lg font-semibold">{status.subscriptionStatus.replace('_', ' ')}</div>
                      </div>
                    )}
                    {status?.currentPeriodEnd && (
                      <div>
                        <div className="text-slate-400 text-sm">
                          {status?.subscriptionStatus === 'canceled' ? 'Billed through' : 'Current period ends'}
                        </div>
                        <div className="text-lg font-semibold">{formatDate(status.currentPeriodEnd)}</div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-6">
                    <div className="space-y-5">
                      {frozenCredits > 0 && (
                        <div>
                          <div className="text-slate-400 text-sm">Letter credits</div>
                          <div className="text-lg font-semibold tnum">{frozenCredits}</div>
                          <p className="mt-1 text-xs text-slate-400">
                            Letter credits from a past purchase are preserved on your account. They are not spent when
                            you generate a letter — nothing decrements them — because letters are no longer charged
                            for. The number you see here is the number you will still see afterwards.
                          </p>
                        </div>
                      )}
                      <div>
                        <div className="text-slate-400 text-sm">Letters you have written this month</div>
                        <div className="text-lg font-semibold tnum">{status?.entitlement.lettersUsedThisMonth ?? 0}</div>
                        <p className="mt-1 text-xs text-slate-400">
                          A count of your own activity, not an allowance. There is no monthly limit to run out of.
                        </p>
                      </div>
                      <div className="border-t border-slate-700 pt-4">
                        <div className="text-slate-400 text-sm">Account opened</div>
                        <div className="text-lg font-semibold">{formatDate(status?.memberSince ?? null)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---- Payment settings via the Stripe portal ---- */}
            {/* The portal and self-cancellation are deliberately untouched: a
                consumer who is still on a live subscription must keep every
                control they had over their own money. */}
            <div className="card p-6">
              <h2 className="text-2xl font-bold mb-4">Payment &amp; Invoices</h2>
              <p className="text-slate-400 text-sm mb-6">
                Payments are processed by Stripe — your card details never touch our servers. The portal is where your
                receipts, your saved card, and cancellation live, and it is the authoritative record of any amount you
                were charged.
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
                <p className="text-slate-500 text-sm">
                  No billing history on this account — you have never been charged, and there is nothing to open.
                </p>
              )}
              {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
