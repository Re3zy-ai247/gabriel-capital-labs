import type { PassageFixture } from "./fixtures";

// CXOS Phase 5.1 — §ORIGIN · the Mission Control environment.
//
// The blue analytical register: light enters from ABOVE, geometry is
// rectilinear, typography is instrument-grade mono. The section ends on a
// full-viewport terminal wall holding the Arena call — so no scroll
// position ever shows both rooms' grammars at once. Every figure quotes
// the labeled synthetic fixture. The call renders ONLY when the fixture
// grants access (mirroring the real server gate's no-teaser law); in the
// cinematic tiers it is a real <button>, otherwise a plain in-page link.

export function MissionControlOrigin({
  fx,
  cinematic,
  quiet,
  onProceed,
}: {
  fx: PassageFixture;
  cinematic: boolean;
  // Phase 5.2 — the power-down. Set the moment the Arena is called: the
  // instruments recede, the panels dim and the command axis contracts, all
  // while the veil is still transparent, so the room is SEEN acknowledging
  // the call before anything moves.
  quiet?: boolean;
  onProceed: () => void;
}) {
  return (
    <div data-cxp-quiet={quiet ? "" : undefined} className="cx-p-mc relative overflow-hidden bg-[#030711] text-white">
      {/* light from above — the analytical register */}
      <div aria-hidden className="cx-p-mc-light pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div aria-hidden className="grid-texture absolute inset-0 opacity-30" />

      <div className="relative mx-auto flex min-h-[100svh] max-w-4xl flex-col px-6 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-300">
          Founder Review · Phase 5.1 · The Passage
        </p>
        <h1 className="h-display mt-2 text-3xl md:text-4xl">Mission Control</h1>
        <p className="mt-2 inline-block self-start rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-[11px] font-bold tracking-widest text-gold-400">
          SYNTHETIC REVIEW DATA — no real account, no database, no reputation read
        </p>

        {/* the instrument wall — rectilinear, quiet, controlled */}
        <div className="cx-p-mc-wall mt-8 grid gap-3 sm:grid-cols-3">
          <OriginPanel label="EXECUTION QUEUE" value="3 in motion" sub="2 awaiting bureau responses" />
          <OriginPanel label="SYSTEMS" value="All signals green" sub="report · letters · billing" />
          <OriginPanel label="KAI — EXECUTIVE BRIEF" value="Round 2 response window open" sub="next action staged" />
        </div>

        {/* command axis */}
        <div aria-hidden className="cx-p-mc-axis my-10" />

        {/* the terminal wall — the sealed aperture, or honest absence */}
        <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          {fx.access ? (
            <div className="cx-p-call relative w-full max-w-md rounded-2xl border border-ink-700/70 bg-ink-900/40 px-6 py-8">
              <div aria-hidden className="cx-p-call-seam pointer-events-none absolute inset-0 rounded-2xl" />
              <div aria-hidden className="cx-p-call-ring mx-auto mb-5" />
              <div className="text-[10px] font-bold tracking-[0.3em] text-amber-200/80">
                ARENA CLEARANCE AVAILABLE
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {fx.key === "data-error"
                  ? "Clearance confirmed. The Arena is open."
                  : "Your standing is confirmed. The Arena is open."}
              </p>
              <p className="mt-1 font-mono text-[12px] text-slate-500 tnum">
                {fx.key === "data-error"
                  ? "record unavailable — fail-safe standing shown"
                  : `${fx.record.rank} · Level ${fx.record.level} · ${fx.record.totalXp} lifetime XP`}
              </p>
              {cinematic ? (
                <button
                  type="button"
                  data-cxp-proceed
                  onClick={onProceed}
                  className="mt-5 rounded-lg border border-amber-400/50 bg-amber-400/10 px-5 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20"
                >
                  Proceed to the floor
                </button>
              ) : (
                <a
                  href="#arena-floor"
                  data-cxp-proceed
                  className="mt-5 inline-block rounded-lg border border-amber-400/50 bg-amber-400/10 px-5 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20"
                >
                  Proceed to the floor
                </a>
              )}
            </div>
          ) : (
            // Honest absence: outside the gate there is no call, no teaser,
            // no implied purchase path — the wall is simply a wall.
            <div className="w-full max-w-md rounded-2xl border border-ink-700/50 bg-ink-900/30 px-6 py-8 text-sm text-slate-400">
              {fx.note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OriginPanel({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="cx-p-mc-panel rounded-xl border border-ink-700/60 bg-ink-900/40 p-4">
      <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500">{label}</div>
      <div className="mt-1.5 text-sm text-slate-200">{value}</div>
      <div className="mt-0.5 font-mono text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
