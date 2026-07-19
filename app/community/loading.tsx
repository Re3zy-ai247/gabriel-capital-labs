import { AppShell } from "@/components/AppShell";

// Route-level loading state for the Operator Network — skeletons that match the
// true shape of the incoming shell (Design Bible §4.3: skeletons, not spinners;
// a quiet pulse, no aggressive shimmer). Layout mirrors page.tsx exactly so
// there is zero shift when content arrives (CLS budget < 0.05).
export default function Loading() {
  return (
    <AppShell title="/ Community">
      <div aria-busy="true" aria-label="Loading the network">
        {/* Masthead bone */}
        <div className="card mb-5 flex items-center gap-4 p-5">
          <div className="h-14 w-14 animate-pulse rounded-full bg-ink-700/70" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-44 animate-pulse rounded bg-ink-700/70" />
            <div className="h-3 w-72 max-w-full animate-pulse rounded bg-ink-700/50" />
            <div className="h-3 w-52 max-w-full animate-pulse rounded bg-ink-700/40" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]">
          {/* Rail bones */}
          <div className="hidden space-y-2 lg:block">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-ink-700/40" style={{ opacity: 1 - i * 0.09 }} />
            ))}
          </div>

          {/* Feed bones */}
          <div className="min-w-0 space-y-2">
            <div className="card h-12 animate-pulse bg-ink-800/60" />
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
              <div key={i} className="card space-y-2 p-4" style={{ opacity: 1 - i * 0.2 }}>
                <div className="h-3 w-24 animate-pulse rounded bg-ink-700/50" />
                <div className="h-3 w-full animate-pulse rounded bg-ink-700/40" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-ink-700/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
