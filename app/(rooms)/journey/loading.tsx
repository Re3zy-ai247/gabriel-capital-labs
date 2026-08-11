// Route-level loading state for the Timeline. One column of event bones on the
// rail, matching the real timeline's shape so nothing shifts on arrival.
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your timeline">
        <div className="mb-5 h-6 w-48 animate-pulse rounded bg-ink-700/70" />
        <div className="relative space-y-5 border-l border-ink-700/50 pl-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ opacity: 1 - i * 0.13 }}>
              <div className="absolute -left-[5px] h-2.5 w-2.5 animate-pulse rounded-full bg-ink-700/70" />
              <div className="h-3 w-28 animate-pulse rounded bg-ink-700/40" />
              <div className="mt-2 h-4 w-2/3 max-w-full animate-pulse rounded bg-ink-700/60" />
              <div className="mt-1.5 h-3 w-4/5 max-w-full animate-pulse rounded bg-ink-700/30" />
            </div>
          ))}
        </div>
      </div>
  );
}
