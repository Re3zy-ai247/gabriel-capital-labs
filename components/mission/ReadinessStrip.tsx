// Mission Control consuming the Credit Intelligence Platform (Sprint XV). This
// strip renders platform-computed readiness + health — it computes NOTHING itself,
// it only displays what `creditIntelligence()` returned. The pattern every future
// module follows: ask the platform, render the answer.
import type { CreditIntelligence, ReadinessLevel } from "@/lib/intelligence";
import { ShieldCheck } from "lucide-react";

// Colored dot + neutral slate label: theme-robust contrast in both light and dark,
// and the level is never conveyed by color alone (the text label carries it too).
const LEVEL: Record<ReadinessLevel, { label: string; dot: string }> = {
  ready: { label: "Ready", dot: "bg-success-400" },
  almost: { label: "Almost", dot: "bg-gold-400" },
  not_ready: { label: "Not ready", dot: "bg-rose-400" },
  unknown: { label: "—", dot: "bg-slate-500" },
};

export function ReadinessStrip({ intel }: { intel: CreditIntelligence }) {
  // Show the goals with derivable prerequisites (skip the honest "unknown" ones).
  const shown = intel.readiness.filter((r) => r.level !== "unknown").slice(0, 6);
  if (!intel.hasReport || shown.length === 0) return null;
  const topRisk = intel.risk.reasons[0];

  return (
    <section aria-label="Credit readiness" className="card mb-4 p-5">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand-300" aria-hidden />
        <h3 className="text-sm font-semibold">Readiness at a glance</h3>
        <span className="rounded bg-ocean-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ocean-300">Intelligence platform</span>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((r) => (
          <li key={r.goal} className="flex items-center justify-between gap-2 rounded-lg border border-ink-700/70 bg-ink-900/40 px-3 py-2">
            <span className="min-w-0 truncate text-xs text-slate-300">{r.label.replace(/ readiness$/i, "")}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${LEVEL[r.level].dot}`} aria-hidden />
              {LEVEL[r.level].label}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-400">
        Readiness reflects whether your file is in shape for each goal — it is not a lending decision or an approval prediction.
        {topRisk ? ` Top signal: ${topRisk.text}` : ""}
      </p>
    </section>
  );
}
