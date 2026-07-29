import { Reveal } from "@/components/landing/Reveal";
import { Check } from "lucide-react";

// CXOS Phase 3 · Chapter 2 — INTELLIGENCE AWAKENS (#awakens).
//
// Purpose: order emerging from evidence. The same three tellings from the
// Problem Chamber align into ONE evidence column as the visitor scrolls:
// rows settle to zero rotation/offset by p=0.6, classification chips light at
// p=.35/.45/.55, and the evidence path draws p=.3→.7 (the Draw primitive).
// Every movement is computation, alignment, or state change — nothing is
// decoration.
//
// Kai is present as the executive intelligence only — a wordmark chip on the
// column header. No mascot, no avatar. The body copy is VERBATIM from the
// landing page's existing "How it works" step 2 (compliance-authoritative).
//
// Reduced-motion / tier-C / no-JS rest state: the RESOLVED column — aligned,
// classified, path drawn. The narrative's meaning survives without motion.
export function IntelligenceAwakens() {
  return (
    <section
      id="awakens"
      data-chapter="awakens"
      className="cx-chamber relative overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="aurora left-[-10%] top-[-8%] h-[420px] w-[420px] bg-brand-500/20" />
      </div>

      <div className="container-x section relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        {/* The evidence column — the fragments, aligned and classified. */}
        <div aria-hidden className="relative order-last select-none lg:order-first">
          <div className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-5 shadow-card backdrop-blur">
            <div className="mb-4 flex items-center justify-between border-b border-ink-700/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                <span className="text-xs font-semibold text-slate-300">Cross-bureau read · one account</span>
              </div>
              <span className="cx-chip cx-chip-3 rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-brand-300">
                Response window · tracked
              </span>
            </div>

            {/* the drawn evidence spine (Draw primitive, --cxp-driven) */}
            <svg aria-hidden className="absolute left-[30px] top-[74px] h-[132px] w-[2px] overflow-visible" viewBox="0 0 2 132" fill="none">
              <path d="M1 0 V132" stroke="url(#cx-spine)" strokeWidth="2" pathLength={1} className="cx-spine" />
              <defs>
                <linearGradient id="cx-spine" x1="0" y1="0" x2="0" y2="132" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#22d3ee" /><stop offset="1" stopColor="#2563eb" />
                </linearGradient>
              </defs>
            </svg>

            <div className="space-y-2.5">
              <AlignedRow cls="cx-align-a" bureau="Equifax" fact="Balance $8,214 · May 12" chip="Cross-bureau mismatch" chipCls="cx-chip-1" />
              <AlignedRow cls="cx-align-b" bureau="Experian" fact="Balance $7,940 · Apr 28" chip="Potential inaccuracy" chipCls="cx-chip-2" />
              <AlignedRow cls="cx-align-c" bureau="TransUnion" fact="Closed · not reported" chip="Unverifiable" chipCls="cx-chip-3" />
            </div>
            <p className="mt-3 text-[10px] text-slate-500">Illustrative. Kai flags items for YOUR review — the bureaus decide each outcome.</p>
          </div>
        </div>

        <div>
          <Reveal>
            <span className="eyebrow">Intelligence awakens</span>
            <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">
              Kai reads all three — and the noise becomes evidence.
            </h2>
            <p className="lede mt-4">
              Potential inaccuracies, inconsistencies, and unverifiable items are flagged and
              explained across Equifax, Experian, and TransUnion.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "The same account, read side by side across bureaus",
                "Each flagged item explained in plain English",
                "Response-window deadlines tracked automatically",
              ].map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-300">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function AlignedRow({
  cls,
  bureau,
  fact,
  chip,
  chipCls,
}: {
  cls: string;
  bureau: string;
  fact: string;
  chip: string;
  chipCls: string;
}) {
  return (
    <div className={`${cls} flex items-center justify-between gap-3 rounded-lg border border-ink-700/50 bg-ink-800/40 py-2.5 pl-6 pr-3`}>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{bureau}</div>
        <div className="truncate text-xs font-medium tabular-nums text-slate-200">{fact}</div>
      </div>
      <span className={`${chipCls} cx-chip shrink-0 rounded-full border border-brand-500/25 bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-300`}>
        {chip}
      </span>
    </div>
  );
}
