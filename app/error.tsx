"use client";

import { useEffect } from "react";
import { RotateCcw, LayoutDashboard } from "lucide-react";

// Segment error boundary (RC1 P0-2). Catches an unhandled render/data error in any route below the
// root layout and shows a calm, on-brand fallback with a retry — instead of a white screen. Logs
// the error digest (Vercel captures client console). Client-side alerting/error-tracking is RC2
// (needs an owner-supplied SDK/DSN).
//
// A1-12 · copy ADOPTED from the free consumer lane, commit a130d2d ("fix: close bounded consumer
// launch defects"), verbatim. This boundary fires on ANY unhandled render/data error — including
// one thrown AFTER a successful write — so the old line diagnosed a cause it had not observed
// ("the connection dropped") and asserted a fact it could not know ("nothing was lost"). The
// adopted wording states only what is true from here and adds the sentence a credit product owes
// a frightened reader: this is not a credit decision.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", scope: "error-boundary", msg: error.message, digest: error.digest }));
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-6 text-center text-white">
      <div className="relative w-full max-w-lg">
        <div className="aurora left-1/2 top-0 h-72 w-72 -translate-x-1/2 bg-brand-500/20" />
        <h1 className="relative h-display text-2xl text-white md:text-3xl text-balance">Something went wrong on our end</h1>
        <p className="relative mx-auto mt-3 max-w-sm text-slate-400 pretty">
          We hit a technical error. If you were making a change, confirm its status before retrying.
          This message is not a credit decision and does not itself change your credit report.
        </p>
        {error.digest ? <p className="relative mt-2 text-xs text-slate-600">Reference: {error.digest}</p> : null}
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={() => reset()} className="btn-primary btn-lg">
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
          <a href="/dashboard" className="btn-ghost btn-lg">
            <LayoutDashboard className="h-4 w-4" /> Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
