import { cn } from "@/lib/utils";
import type { Probability } from "@prisma/client";

const MAP: Record<Probability, string> = {
  HIGH: "bg-brand-500/15 text-brand-300 border border-brand-500/30",
  MEDIUM: "bg-gold-500/15 text-gold-400 border border-gold-500/30",
  LOW: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  NOT_RECOMMENDED: "bg-rose-500/10 text-rose-300 border border-rose-500/30",
};
const LABEL: Record<Probability, string> = {
  HIGH: "High", MEDIUM: "Medium", LOW: "Low", NOT_RECOMMENDED: "Not recommended",
};

export function ProbabilityBadge({ p }: { p: Probability }) {
  return <span className={cn("pill", MAP[p])}>{LABEL[p]}</span>;
}

export function BureauBadges({ bureaus }: { bureaus: string[] }) {
  if (!bureaus.length) return <span className="text-slate-500">—</span>;
  return (
    <span className="flex gap-1">
      {bureaus.map((b) => (
        <span key={b} className="pill border border-ink-600 bg-ink-700/60 text-slate-300">{b}</span>
      ))}
    </span>
  );
}
