import type { Explanation } from "@/lib/explain";
import { ProbabilityBadge } from "@/components/ui/Badge";

// Renders the Kai Explainability Layer for one item — structured EVIDENCE, never
// chain-of-thought. Server-rendered, zero client JS. Sections that have no real
// data simply don't render (we never fabricate a "why").
export function KaiWhy({ e }: { e: Explanation }) {
  // A "set aside" item was NOT flagged for dispute — its band is a do-not-dispute
  // status, not a confidence level, so it must never wear a confidence badge.
  const setAside = e.confidence === "NOT_RECOMMENDED";
  return (
    <div className="rounded-lg border border-brand-500/25 bg-brand-500/[0.04] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        <span className="text-xs font-semibold text-slate-200">{setAside ? "Why I set this aside" : "Why I flagged this"}</span>
        {setAside ? (
          <span className="ml-auto pill bg-rose-500/10 text-rose-300">set aside</span>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-500">
            confidence <ProbabilityBadge p={e.confidence} />
          </span>
        )}
      </div>

      <Section title="What I observed" items={e.observed} />

      {e.bureauContributions.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Which bureau data contributed</div>
          <ul className="space-y-0.5 text-xs text-slate-400">
            {e.bureauContributions.map((b) => (
              <li key={b.bureau}>
                <span className="font-medium text-slate-300">{b.bureau}:</span> {b.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {e.contradictions.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold-400">Contradictions that raised my confidence</div>
          <ul className="space-y-0.5 text-xs text-slate-400">
            {e.contradictions.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {e.laws.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Which laws apply</div>
          <ul className="space-y-0.5 text-xs text-slate-400">
            {e.laws.map((l) => (
              <li key={l.usc}>
                <span className="font-medium text-slate-300">{l.short}</span> <span className="text-slate-500">({l.usc})</span> — {l.desc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {e.uncertainty.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">What stays uncertain</div>
          {/* Parity with every other section body — the caveat must never render
              quieter than the favorable evidence (FTC clear-and-conspicuous). */}
          <ul className="space-y-0.5 text-xs text-slate-400">
            {e.uncertainty.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <ul className="space-y-0.5 text-xs text-slate-400">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
