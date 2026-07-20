import { AppShell } from "@/components/AppShell";

// Route-level loading state for Tradelines. Shape-matched skeletons (Design Bible:
// skeletons, never spinners) so the account list does not shift when data arrives.
export default function Loading() {
  return (
    <AppShell title="/ Tradelines">
      <div role="status" aria-busy="true" aria-label="Loading your tradelines">
        <div className="mb-5">
          <div className="h-6 w-52 animate-pulse rounded bg-ink-700/70" />
          <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-ink-700/40" />
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card p-4" style={{ opacity: 1 - i * 0.12 }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-48 max-w-full animate-pulse rounded bg-ink-700/70" />
                  <div className="mt-2 h-3 w-64 max-w-full animate-pulse rounded bg-ink-700/40" />
                </div>
                <div className="h-6 w-20 shrink-0 animate-pulse rounded-full bg-ink-700/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
