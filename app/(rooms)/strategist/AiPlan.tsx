"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Sparkles, Loader2, RotateCw } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { trackClient } from "@/lib/trackClient";

// The KAI 90-day action plan. It persists on the user's own device (localStorage,
// keyed per user) so it survives refresh and navigation and reads like a standing
// dossier rather than a disposable AI reply. The plan is NOT stored server-side:
// persisting a Kai AI output server-side is gated on founder approval (ADR-0006,
// the blocked KaiAnswer store), and on-device caching keeps the user's own
// strategy on their own machine. A staleness note appears when their dispute
// queue has changed since the plan was generated.
interface StoredPlan {
  plan: string;
  generatedAt: string; // ISO
  items: number; // queue size the plan was built from
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function AiPlan({ currentItemCount, storageKey }: { currentItemCount: number; storageKey: string | null }) {
  const [plan, setPlan] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);

  // Restore any saved plan for this user on mount, so it survives refresh/navigation.
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as StoredPlan;
      if (saved && typeof saved.plan === "string") {
        setPlan(saved.plan);
        setGeneratedAt(saved.generatedAt ?? null);
        setPlanItems(typeof saved.items === "number" ? saved.items : null);
      }
    } catch {
      /* corrupt cache is non-fatal — the user can just regenerate */
    }
  }, [storageKey]);

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
      const when = new Date().toISOString();
      const items = typeof j.items === "number" ? j.items : currentItemCount;
      setPlan(j.plan);
      setGeneratedAt(when);
      setPlanItems(items);
      if (storageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify({ plan: j.plan, generatedAt: when, items } as StoredPlan));
        } catch {
          /* storage full / disabled — the plan still shows this session */
        }
      }
    } catch {
      setError("The connection dropped mid-request. Try again — nothing was lost.");
    } finally {
      setBusy(false);
    }
  }

  // Private Alpha funnel: fire once per mount when a plan first becomes visible
  // (restored from storage or freshly generated).
  const viewedRef = useRef(false);
  useEffect(() => {
    if (plan && !viewedRef.current) {
      viewedRef.current = true;
      trackClient("ai_plan_viewed");
    }
  }, [plan]);

  // Deterministic, no-cost staleness signal: the queue changed size since the plan
  // was built. Keeps the dossier honest without a paid re-run.
  const stale = plan != null && planItems != null && planItems !== currentItemCount;

  return (
    <div className="card mb-5 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-brand-300" aria-hidden="true" /> Action Plan{" "}
            <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">
              KAI Intelligence
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            KAI analyzes every account in your credit profile, identifies the strongest dispute opportunities,
            prioritizes them by dispute strength, and generates a personalized 90-day strategy explaining what to
            dispute first, which legal approach to use, and why.
          </p>
          {plan && generatedAt && (
            <p className="mt-2 text-[11px] text-slate-500">Generated {relativeTime(generatedAt)}</p>
          )}
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
              Upgrade to Professional →
            </Link>
          )}
        </div>
      )}

      {stale && !busy && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-2.5 text-[11px] text-gold-300">
          <RotateCw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Your dispute queue has changed since this plan was written — regenerate to bring the strategy up to date.</span>
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
