"use client";
import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { Markdown } from "@/components/Markdown";

// Premium AI action-plan generator. Free users see an upgrade prompt; premium
// users get an Opus-generated, sequenced 90-day plan grounded in their items.
export function AiPlan() {
  const [plan, setPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    setUpgrade(false);
    try {
      const res = await fetch("/api/strategist/plan", { method: "POST" });
      const j = await res.json();
      if (res.status === 402) {
        setError(j.error);
        setUpgrade(true);
        return;
      }
      if (!res.ok) {
        setError(j.error || "Could not generate the plan.");
        return;
      }
      setPlan(j.plan);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mb-5 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-brand-300" aria-hidden="true" /> AI Action Plan{" "}
            <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">
              KAI
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            A personalized, sequenced 90-day plan written by Claude Opus 4.8 from your actual items — which to dispute
            first, which strategy to use, and why.
          </p>
        </div>
        <button onClick={generate} disabled={busy} className="btn-primary shrink-0">
          {busy ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {busy ? "I'm working…" : plan ? "Regenerate" : "Generate my plan"}
        </button>
      </div>

      {busy && (
        <p className="mt-3 text-xs text-slate-400" role="status" aria-live="polite">
          I&apos;m weighing every item against the strategy catalog…
        </p>
      )}

      {error && (
        <div className="mt-3 text-xs text-rose-400">
          {error}{" "}
          {upgrade && (
            <Link href="/pricing" className="font-semibold text-brand-300 underline">
              Upgrade to Premium →
            </Link>
          )}
        </div>
      )}

      {plan && (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-900/60 p-5">
          <Markdown source={plan} />
        </div>
      )}
    </div>
  );
}
