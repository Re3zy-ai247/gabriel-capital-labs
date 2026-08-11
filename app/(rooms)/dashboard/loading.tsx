import { EduBanner } from "@/components/Disclaimer";
import gxl from "@/components/mission/mc.module.css";

// Route-level loading state for Mission Control. Mirrors page.tsx's real shape —
// the GXL room wrapper, the identity header, the next-action receipt, then the
// Executive Queue register — so nothing shifts when the data lands.
//
// Design Bible: skeletons, never spinners; a quiet pulse, no shimmer. The ambient
// GxlField is deliberately NOT mounted here: it is a client island whose density
// derives from real aggregates, and there are no aggregates yet — rendering it on
// invented state would be fabricated aliveness (GXL L10).
export default function Loading() {
  return (
    <div className={`${gxl.room} relative isolate -mx-5 -my-6 px-5 py-6`}>
        <div role="status" aria-busy="true" aria-label="Loading Mission Control">
          <EduBanner />

          {/* Identity header bone — KAI chip + the record-register greeting line. */}
          <div className="mb-4">
            <div className="flex items-baseline gap-2.5">
              <div className="h-4 w-10 shrink-0 animate-pulse rounded bg-brand-500/20" />
              <div className="h-7 w-64 max-w-full animate-pulse rounded bg-ink-700/70" />
            </div>
            <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-ink-700/40" />
          </div>

          {/* Next-action receipt bone — the single lifted, gold-flagged slab. */}
          <div className="mb-5 rounded-lg border border-ink-700/60 bg-ink-800/40 p-5">
            <div className="h-3 w-28 animate-pulse rounded bg-gold-500/25" />
            <div className="mt-3 h-5 w-2/3 max-w-full animate-pulse rounded bg-ink-700/70" />
            <div className="mt-2.5 h-3.5 w-full animate-pulse rounded bg-ink-700/40" />
            <div className="mt-2 h-3.5 w-4/5 animate-pulse rounded bg-ink-700/30" />
            <div className="mt-4 h-9 w-40 animate-pulse rounded-lg bg-ink-700/50" />
          </div>

          {/* Executive Queue bones — folio hairline rows, receding with depth so the
              settled past reads quieter than the actionable top (mc depth law). */}
          <div className="mb-2 h-3 w-36 animate-pulse rounded bg-ink-700/50" />
          <div className="divide-y divide-ink-700/40 border-y border-ink-700/40">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 py-3.5" style={{ opacity: 1 - i * 0.14 }}>
                <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-ink-700/50" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-ink-700/60" />
                  <div className="mt-1.5 h-3 w-3/4 animate-pulse rounded bg-ink-700/30" />
                </div>
                <div className="hidden h-3 w-20 shrink-0 animate-pulse rounded bg-ink-700/40 sm:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
  );
}
