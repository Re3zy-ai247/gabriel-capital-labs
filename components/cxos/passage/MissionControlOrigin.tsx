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
      <div aria-hidden className="cx-p-mc-vault pointer-events-none absolute inset-0" />
      <div aria-hidden className="cx-p-mc-horizon pointer-events-none absolute inset-x-0" />

      <div className="cx-p-mc-shell relative mx-auto flex min-h-[100svh] max-w-[90rem] flex-col px-5 py-7 sm:px-8 sm:py-9 lg:px-12">
        <header className="cx-p-mc-identity flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-brand-300 sm:text-[11px]">
              Founder Review · CXOS Release Candidate
            </p>
            <h1 className="h-display mt-2 text-3xl md:text-4xl">Mission Control</h1>
          </div>
          <p className="cx-p-honesty mt-1 text-[10px] font-bold tracking-[0.2em] text-gold-400 sm:text-[11px]">
            <span aria-hidden>SYNTHETIC REVIEW · NO LIVE DATA</span>
            <span className="sr-only">SYNTHETIC REVIEW DATA — no real account, no database, no reputation read</span>
          </p>
        </header>

        {/* One room, not a dashboard: two instrument banks flank a single
            command threshold. The facts are unchanged; their hierarchy is
            now architectural and the Arena call is the lone protagonist. */}
        <div className="cx-p-mc-room relative grid flex-1 items-center py-8 sm:py-10">
          <div aria-hidden className="cx-p-mc-runway pointer-events-none absolute inset-x-0 bottom-0" />

          <aside className="cx-p-mc-bank cx-p-mc-bank-left" aria-label="Mission instruments">
            <p className="cx-p-mc-bank-label">ACTIVE INSTRUMENTS</p>
            <div className="cx-p-mc-wall">
              <OriginPanel label="EXECUTION QUEUE" value="3 in motion" sub="2 awaiting bureau responses" />
              <OriginPanel label="SYSTEMS" value="All signals green" sub="report · letters · billing" />
            </div>
          </aside>

          {/* the terminal threshold — a sealed aperture, or honest absence */}
          <div className="cx-p-mc-command relative flex flex-col items-center justify-center text-center">
            <div aria-hidden className="cx-p-mc-axis pointer-events-none absolute inset-x-0 top-1/2" />
            {fx.access ? (
              <div className="cx-p-call relative z-[1] w-full max-w-md px-5 py-7 sm:px-7 sm:py-9">
                <div aria-hidden className="cx-p-call-seam pointer-events-none absolute inset-0" />
                <div aria-hidden className="cx-p-call-ring mx-auto mb-6">
                  <span className="cx-p-call-core" />
                </div>
                <div className="text-[10px] font-bold tracking-[0.3em] text-amber-200/80">
                  ARENA CLEARANCE AVAILABLE
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {fx.key === "data-error"
                    ? "Clearance confirmed. The Arena is open."
                    : "Your standing is confirmed. The Arena is open."}
                </p>
                <p className="mt-1 font-mono text-[12px] text-slate-400 tnum">
                  {fx.key === "data-error"
                    ? "record unavailable — fail-safe standing shown"
                    : `${fx.record.rank} · Level ${fx.record.level} · ${fx.record.totalXp} lifetime XP`}
                </p>
                {cinematic ? (
                  <button
                    type="button"
                    data-cxp-proceed
                    onClick={onProceed}
                    className="cx-p-proceed mt-6 border border-amber-400/50 bg-amber-400/10 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20"
                  >
                    Proceed to the floor
                  </button>
                ) : (
                  <a
                    href="#arena-floor"
                    data-cxp-proceed
                    onClick={() => {
                      window.requestAnimationFrame(() => {
                        const heading = document.querySelector<HTMLElement>("#arena-floor h1");
                        if (!heading) return;
                        heading.setAttribute("tabindex", "-1");
                        heading.focus({ preventScroll: true });
                      });
                    }}
                    className="cx-p-proceed mt-6 inline-block border border-amber-400/50 bg-amber-400/10 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20"
                  >
                    Proceed to the floor
                  </a>
                )}
              </div>
            ) : (
              // Honest absence: outside the gate there is no call, no teaser,
              // no implied purchase path — the wall is simply a wall.
              <div className="cx-p-call cx-p-call-dormant relative z-[1] w-full max-w-md px-6 py-8 text-sm text-slate-400">
                {fx.note}
              </div>
            )}
          </div>

          <aside className="cx-p-mc-bank cx-p-mc-bank-right" aria-label="Kai executive instrument">
            <p className="cx-p-mc-bank-label">EXECUTIVE CHANNEL</p>
            <div className="cx-p-mc-wall">
              <OriginPanel label="KAI — EXECUTIVE BRIEF" value="Round 2 response window open" sub="next action staged" />
            </div>
            <div aria-hidden className="cx-p-mc-bank-mark">
              <span>03</span>
              <span>ONLINE</span>
            </div>
          </aside>
        </div>

        <div aria-hidden className="cx-p-mc-footerline flex items-center justify-between">
          <span>COMMAND AXIS</span>
          <span>MC / ARENA THRESHOLD</span>
        </div>
      </div>
    </div>
  );
}

function OriginPanel({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="cx-p-mc-panel px-1 py-4">
      <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.25em] text-slate-400">
        <span aria-hidden className="cx-p-mc-signal" />
        {label}
      </div>
      <div className="mt-1.5 text-sm text-slate-200">{value}</div>
      <div className="mt-0.5 font-mono text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}
