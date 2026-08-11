import { EduBanner } from "@/components/Disclaimer";

// Route-level loading state for the Operator Network — skeletons that match the
// true shape of the incoming shell (Design Bible §4.3: skeletons, not spinners;
// a quiet pulse, no aggressive shimmer). Layout mirrors page.tsx exactly so
// there is zero shift when content arrives (CLS budget < 0.05).
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading the network">
        {/* Real static banner (zero data deps) — pixel-exact with the page. */}
        <EduBanner />
        {/* Operational-strip bone (mirrors the page's chrome strip exactly) */}
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-ink-700/50 pb-3">
          <div className="h-5 w-36 animate-pulse rounded bg-ink-700/70" />
          <div className="h-4 w-56 max-w-full animate-pulse rounded bg-ink-700/40" />
        </div>
        {/* Channel-chip bones (small viewports) */}
        <div className="mb-4 flex gap-2 overflow-hidden lg:hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-9 w-24 shrink-0 animate-pulse rounded-lg bg-ink-700/40" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
        {/* Network-state disclosure bone (small viewports) */}
        <div className="card mb-4 h-11 animate-pulse bg-ink-800/60 xl:hidden" />

        <div className="grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_280px]">
          {/* Rail bones */}
          <div className="hidden space-y-1 lg:block">
            <div className="mb-1.5 h-3 w-20 animate-pulse rounded bg-ink-700/50" />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-[52px] animate-pulse rounded-lg bg-ink-700/40" style={{ opacity: 1 - i * 0.1 }} />
            ))}
          </div>

          {/* Feed bones */}
          <div className="min-w-0 space-y-2">
            <div className="card h-12 animate-pulse bg-ink-800/60" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-ink-700/50" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card space-y-2.5 p-4" style={{ opacity: 1 - i * 0.15 }}>
                <div className="h-3 w-40 animate-pulse rounded bg-ink-700/50" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-ink-700/70" />
                <div className="h-3 w-full animate-pulse rounded bg-ink-700/40" />
              </div>
            ))}
          </div>

          {/* Now panel bones */}
          <div className="hidden space-y-3 xl:block">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-ink-700/50 p-4" style={{ opacity: 1 - i * 0.2 }}>
                <div className="h-3 w-24 animate-pulse rounded bg-ink-700/50" />
                <div className="h-3 w-full animate-pulse rounded bg-ink-700/40" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-ink-700/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
  );
}
