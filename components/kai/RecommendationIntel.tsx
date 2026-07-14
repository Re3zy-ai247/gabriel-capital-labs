import type { RecommendationIntel } from "@/lib/recommendationIntel";

// The Recommendation Intelligence panels (Sprint X, Engine 2). Renders the
// deterministic "why" behind a recommendation — why this strategy/bureau/now,
// alternatives, expected timeline, next step, case confidence, and the GATED
// historical-support state. Every line is supplied by the engine (own data +
// statutes); this component only lays it out. No client JS, no fetch.
const CONF_TONE: Record<RecommendationIntel["caseConfidence"]["label"], string> = {
  Strong: "border-success-500/30 bg-success-500/10 text-success-300",
  Moderate: "border-brand-500/30 bg-brand-500/10 text-brand-300",
  Building: "border-gold-500/30 bg-gold-500/10 text-gold-400",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xs text-slate-400">{children}</div>
    </div>
  );
}

export function RecommendationIntelPanel({ intel }: { intel: RecommendationIntel }) {
  if (!intel.strategy) return null;
  return (
    <div className="mt-2 rounded-lg border border-ocean-500/25 bg-ocean-500/[0.04] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        <span className="text-xs font-semibold text-slate-200">Why I recommend {intel.strategy.label}</span>
        <span className={`ml-auto pill border ${CONF_TONE[intel.caseConfidence.label]}`}>{intel.caseConfidence.label} grounds</span>
      </div>

      <div className="space-y-2">
        <Row label="Why this strategy">{intel.whyStrategy}</Row>
        {intel.whyBureau && <Row label="Why this recipient">{intel.whyBureau}</Row>}
        <Row label="Why now">{intel.whyNow}</Row>
        <Row label="Expected timeline">{intel.expectedTimeline}</Row>

        {intel.alternatives.length > 0 && (
          <Row label="Alternatives considered">
            <ul className="space-y-1">
              {intel.alternatives.map((a) => (
                <li key={a.id}><span className="text-slate-300">{a.label}</span> — {a.note}</li>
              ))}
              {intel.whyNotAlternatives.map((w, i) => <li key={`x${i}`} className="text-slate-500">{w}</li>)}
            </ul>
          </Row>
        )}

        <Row label="Recommended next step">{intel.recommendedNextStep}</Row>

        {/* Historical similar outcomes — cross-user aggregate, honestly gated. */}
        <Row label="Historical similar outcomes">
          {intel.historicalSupport.available
            ? <ul className="space-y-0.5">{intel.historicalSupport.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            : <span className="italic text-slate-500">{intel.historicalSupport.reason}</span>}
        </Row>

        <p className="border-t border-ink-700/60 pt-2 text-[10px] text-slate-500">
          {intel.caseConfidence.basis} Every line above is derived from your file and the statutes — nothing predicted.
        </p>
      </div>
    </div>
  );
}
