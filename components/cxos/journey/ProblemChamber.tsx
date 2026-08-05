import { Reveal } from "@/components/landing/Reveal";
import { AlertCircle } from "lucide-react";

// CXOS Phase 3 · Chapter 1 — THE PROBLEM CHAMBER (#problem).
//
// Purpose: make credit-report confusion FELT — the same account, told three
// different ways by three bureaus, with nothing connecting them. Quiet
// tension, not fear: the fragments drift slightly apart as the visitor
// scrolls (choreography in globals.css on --cxp), and nothing resolves here —
// resolution belongs to Chapter 2.
//
// Server component. All copy is in the HTML at t=0; the fragment cards are
// aria-hidden illustrative visuals (the KaiChatVisual convention), and the
// no-JS / reduced-motion / tier-C rest state is this exact composition.
export function ProblemChamber() {
  return (
    <section
      id="problem"
      data-chapter="problem"
      className="cx-chamber relative overflow-hidden border-y border-ink-800/60 bg-ink-950"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="aurora aurora-app left-[-14%] top-[10%] h-[420px] w-[420px] bg-ocean-500/25" />
      </div>

      <div className="container-x section relative grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Reveal>
            <span className="eyebrow">The problem</span>
            <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">
              Three bureaus. Three versions of your story.
            </h2>
            <p className="lede mt-4">
              Equifax, Experian, and TransUnion each keep their own file on you — and the dates,
              balances, and statuses don&apos;t always agree. Spread across three reports, those
              differences are easy to miss and hard to chase.
            </p>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-400 pretty">
              Deadlines run whether you&apos;ve found the problem or not. Until the reports are read
              side by side, you&apos;re working with information — without control.
            </p>
          </Reveal>
        </div>

        {/* The fragments — one account, three tellings, nothing connecting them.
            Depth planes cx-frag-a/b/c drift on --cxp (tiers A/B); the rest state
            is this scattered composition, fully legible. */}
        <div aria-hidden className="relative h-[360px] select-none sm:h-[400px]">
          <div className="cx-frag cx-frag-a absolute left-0 top-2 w-[240px]">
            <FragmentCard bureau="Equifax" line="Auto loan · Open" detail="Balance $8,214" meta="Reported May 12" />
          </div>
          <div className="cx-frag cx-frag-b absolute right-2 top-[108px] w-[240px]">
            <FragmentCard bureau="Experian" line="Auto loan · Open" detail="Balance $7,940" meta="Reported Apr 28" tone="warn" />
          </div>
          <div className="cx-frag cx-frag-c absolute bottom-6 left-8 w-[240px]">
            <FragmentCard bureau="TransUnion" line="Auto loan · Closed" detail="Balance —" meta="Not reported" tone="cold" />
          </div>
          <div className="cx-frag cx-frag-d absolute bottom-0 right-6 inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-ink-900/80 px-3 py-1.5 text-[11px] font-medium text-gold-400">
            <AlertCircle className="h-3.5 w-3.5" /> 31 days — response window
          </div>
          <p className="absolute -bottom-6 right-0 text-[10px] text-slate-600">Illustrative example.</p>
        </div>
      </div>
    </section>
  );
}

function FragmentCard({
  bureau,
  line,
  detail,
  meta,
  tone = "base",
}: {
  bureau: string;
  line: string;
  detail: string;
  meta: string;
  tone?: "base" | "warn" | "cold";
}) {
  const detailTone =
    tone === "warn" ? "text-gold-400" : tone === "cold" ? "text-slate-500" : "text-slate-200";
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-900/80 p-4 shadow-card backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{bureau}</div>
      <div className="mt-2 text-sm font-medium text-slate-200">{line}</div>
      <div className={`mt-1 text-sm tabular-nums ${detailTone}`}>{detail}</div>
      <div className="mt-2 text-[11px] text-slate-500">{meta}</div>
    </div>
  );
}
