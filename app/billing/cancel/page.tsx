'use client';

import { useCallback, useEffect, useState } from 'react';

// The ONLY surface a suspended account can reach. Every ordinary page resolves
// through currentUser()/currentAccount(), which fail closed on `disabled` and
// bounce a suspended user to /login — so without this page the cancellation route
// would exist but be unreachable, and a suspended subscriber would keep paying.
//
// It is deliberately standalone: no AppShell, no navigation, no account data. It
// renders its own copy from a booleans-only eligibility call and offers exactly one
// action — cancel. It restores NO application access: there is no link into the app
// anywhere on this page, and nothing here re-enables the account.
type Eligibility = { eligible: boolean; reason: string; message: string };

export default function CancelSubscriptionPage() {
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/self-cancel', { cache: 'no-store' });
      if (res.status === 401) {
        setSignedOut(true);
        return;
      }
      setElig((await res.json()) as Eligibility);
    } catch {
      setError('We could not load your billing status. Check your connection and reload.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/self-cancel', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (res.ok) setResult(data.message ?? 'Your subscription is canceled.');
      else setError(data.error ?? 'We could not cancel your subscription. Please try again shortly.');
    } catch {
      // A dropped request must never look like a completed cancellation — but it
      // must not claim the opposite either. The request may have reached the server
      // and applied before the connection died, so the honest answer is "unknown",
      // plus the fact that makes it safe to act on: retrying is idempotent, and a
      // retry after a cancellation that did land reports it as already cancelled.
      setError('The connection dropped before we could confirm, so we cannot tell you yet whether it went through. Please try again — it is safe to retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-2xl font-semibold">Cancel your subscription</h1>

        {loading && <p className="mt-4 text-slate-400">Checking your billing status…</p>}

        {signedOut && (
          <p className="mt-4 text-slate-300">
            Please sign in first. If you cannot sign in, email support@creditvector.app from the
            address on your account and we will cancel your subscription for you.
          </p>
        )}

        {!loading && !signedOut && elig && (
          <>
            <p className="mt-4 text-slate-300">{elig.message}</p>

            {elig.eligible && !result && (
              <>
                <p className="mt-4 text-sm text-slate-400">
                  Cancelling stops future billing at the end of the period you have already paid
                  for. It does not restore access to your account, and it does not delete your data.
                </p>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={busy}
                  className="mt-6 w-full rounded-lg bg-red-600 px-4 py-3 font-medium text-white transition hover:bg-red-500 disabled:opacity-60"
                >
                  {busy ? 'Cancelling…' : 'Cancel my subscription'}
                </button>
              </>
            )}

            {result && (
              <p className="mt-6 rounded-lg border border-emerald-800 bg-emerald-950/50 p-4 text-emerald-200">
                {result}
              </p>
            )}
          </>
        )}

        {error && (
          <p className="mt-6 rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-amber-200">
            {error}
          </p>
        )}

        <p className="mt-8 text-xs text-slate-500">
          Questions about your account status? Email support@creditvector.app.
        </p>
      </div>
    </main>
  );
}
