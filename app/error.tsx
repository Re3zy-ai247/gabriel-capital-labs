"use client";

import { useEffect } from "react";
import { RotateCcw, LayoutDashboard } from "lucide-react";

// Segment error boundary (RC1 P0-2). Catches an unhandled render/data error in any route below the
// root layout and shows a calm, on-brand fallback with a retry — instead of a white screen. Logs
// the error digest (Vercel captures client console). Client-side alerting/error-tracking is RC2
// (needs an owner-supplied SDK/DSN).
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
          The connection dropped mid-request. Try again — nothing was lost. Nothing about your report
          or your credit caused this.
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
