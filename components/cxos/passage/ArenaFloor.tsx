import { Lock } from "lucide-react";
import { REFUSED_V1 } from "@/lib/arena/policy";
import type { PassageFixture } from "./fixtures";

// CXOS Phase 5.1 — §FLOOR · the Arena environment.
//
// The gold ceremonial register: a materially different ground (warm
// umber-to-ink rising from the floor line), light entering from BELOW,
// radial geometry, engraved typography. Station A is a full-viewport
// establishing chamber whose ring geometry the passage's final frame
// match-cuts into. Stations B–E each hold ONE semantic surface; all
// content is plain DOM, fully readable with zero motion. The depth
// scaffold (min-height, sticky stages) applies only under
// html[data-cxpassage] — the no-JS / tier C / tier D document is
// natural height with plain links.

export function ArenaFloor({
  fx,
  cinematic,
  arrived,
  onReturn,
}: {
  fx: PassageFixture;
  cinematic: boolean;
  // true when the visitor crossed via the passage this session — the
  // greeting tail (Kai's line + the walk hint) is anchored here.
  arrived: boolean;
  onReturn: () => void;
}) {
  const r = fx.record;
  const pct = r.xpForNextLevel > 0 ? Math.min(100, Math.round((r.xpIntoLevel / r.xpForNextLevel) * 100)) : 100;
  // overflow-CLIP, never hidden: overflow:hidden would make this element the
  // sticky container and silently kill the depth scaffold (adversarial review
  // finding, 2026-07-29). clip contains paint without becoming a scroller.
  return (
    <div id="arena-floor" className="cx-p-arena relative overflow-clip text-white">
      {/* the ground: warm umber rising from the floor line; light from BELOW */}
      <div aria-hidden className="cx-p-ar-ground pointer-events-none absolute inset-0" />
      <div aria-hidden className="cx-p-ar-perimeter pointer-events-none absolute inset-x-0 bottom-0 h-80" />

      {/* Station A — the establishing chamber (the match-cut target) */}
      <section className="cx-p-station relative flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
        <div aria-hidden className="cx-p-est mx-auto">
          <div className="cx-p-est-ring" />
          <div className="cx-p-est-engrave" />
        </div>
        <p className="cx-p-engraved mt-6 text-[26px] font-bold tracking-[0.5em] text-amber-100/90 md:text-4xl">
          THE ARENA
        </p>
        <h1 className="sr-only">The Arena</h1>
        {arrived && (
          <div className="cx-p-greet-tail mt-4 max-w-md">
            <div className="flex items-center justify-center gap-2">
              <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-amber-200">KAI</span>
              <span className="text-[11px] text-slate-400">reading your record</span>
            </div>
            <p className="mt-1.5 text-sm text-slate-300">The floor is ready.</p>
          </div>
        )}
        <p className="mt-8 text-[11px] tracking-[0.25em] text-slate-500">
          {cinematic ? "SCROLL TO WALK THE FLOOR" : "THE FLOOR, STATION BY STATION"}
        </p>
        <p className="mt-4 inline-block rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-[11px] font-bold tracking-widest text-gold-400">
          SYNTHETIC REVIEW DATA — no real account, no database, no reputation read
        </p>
        {fx.note && fx.key === "data-error" && (
          <p className="mt-4 max-w-md rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-left text-sm text-rose-300">
            {fx.note}
          </p>
        )}
      </section>

      {/* Station B — the standing core */}
      <section className="cx-p-station relative px-6" aria-label="Standing core">
        <div className="cx-p-stage mx-auto flex max-w-2xl flex-col items-center justify-center text-center">
          <div className="cx-p-depth" data-station="b">
            <div className="cx-p-dais relative mx-auto grid h-56 w-56 place-items-center">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(#f5c76e ${pct * 3.6}deg, rgba(148,163,184,0.14) 0deg)`,
                  WebkitMask: "radial-gradient(circle, transparent 64%, black 65%)",
                  mask: "radial-gradient(circle, transparent 64%, black 65%)",
                }}
              />
              <div>
                <div className="text-4xl font-semibold text-slate-100 tnum">{r.totalXp}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">lifetime XP</div>
                <div className="mt-1 text-[12px] capitalize text-amber-200/90">
                  {r.rank} · Level {r.level}
                </div>
              </div>
            </div>
            <h2 className="mt-6 text-sm font-semibold tracking-[0.2em] text-slate-300">STANDING CORE</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              {r.awardCount > 0
                ? `${r.xpIntoLevel} of ${r.xpForNextLevel} XP through this level. Permanent, evidence-derived, never spent.`
                : "The dais holds at zero. Only evidenced activity builds this record."}
            </p>
          </div>
        </div>
      </section>

      {/* Station C — the evidence vault */}
      <section className="cx-p-station relative px-6" aria-label="Evidence vault">
        <div className="cx-p-stage mx-auto flex max-w-2xl flex-col items-center justify-center">
          <div className="cx-p-depth w-full" data-station="c">
            <h2 className="text-center text-sm font-semibold tracking-[0.2em] text-slate-300">EVIDENCE VAULT</h2>
            {r.awards.length > 0 ? (
              <ul className="mt-6 space-y-3">
                {r.awards.map((a, i) => (
                  <li key={a.label + i} className="cx-p-plaque flex items-baseline justify-between gap-4 rounded-lg border border-amber-400/20 bg-ink-900/50 px-4 py-3">
                    <span className="text-sm text-slate-300">{a.label}</span>
                    <span className="shrink-0 font-mono text-sm text-amber-200 tnum">
                      +{a.xp} <span className="text-[10px] text-slate-500">{a.cls} evidence</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-center text-sm text-slate-400">
                Only evidenced activity builds this record.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Station D — the milestone gallery */}
      <section className="cx-p-station relative px-6" aria-label="Milestone gallery">
        <div className="cx-p-stage mx-auto flex max-w-2xl flex-col items-center justify-center text-center">
          <div className="cx-p-depth" data-station="d">
            <h2 className="text-sm font-semibold tracking-[0.2em] text-slate-300">MILESTONE GALLERY</h2>
            {r.badges.length > 0 ? (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {r.badges.map((b) => (
                  <span key={b} className="cx-p-sealpos rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-[12px] font-semibold tracking-wide text-amber-200">
                    {b}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-400">
                Nothing earned yet — the gallery holds only what has been recognized.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Station E — the sealed competition threshold (REFUSED_V1 truth) */}
      <section className="cx-p-station relative px-6" aria-label="Competition threshold">
        <div className="cx-p-stage mx-auto flex max-w-2xl flex-col items-center justify-center text-center">
          <div className="cx-p-depth" data-station="e">
            <div className="cx-p-thresh relative mx-auto grid h-40 w-64 place-items-end overflow-hidden rounded-t-[8rem] border border-ink-600/70 pb-4">
              <Lock className="mx-auto h-5 w-5 text-slate-500" aria-hidden />
            </div>
            <h2 className="mt-5 text-sm font-semibold tracking-[0.2em] text-slate-300">COMPETITION THRESHOLD</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              {REFUSED_V1.includes("seasons")
                ? "Seasons and competitions are deliberately not part of policy v1 — this threshold opens only when real competition truth exists."
                : "Not yet defined."}
            </p>
            <span className="mt-3 inline-block rounded-full border border-ink-600 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-slate-500">
              PLANNED
            </span>
          </div>
        </div>
      </section>

      {/* the floor's end — Kai observation point + the return */}
      <section className="relative px-6 pb-24 pt-8">
        <div className="mx-auto max-w-2xl">
          <div className="border-l-2 border-amber-400/40 pl-4">
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-amber-200">KAI</span>
              <span className="text-[11px] text-slate-500">observation point</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              {r.awardCount === 0
                ? "Your vault is empty. Only evidenced activity builds this record — logging a real bureau response to a dispute is what starts it."
                : `Your record holds ${r.awardCount} evidenced award${r.awardCount === 1 ? "" : "s"} at level ${r.level}. ${Math.max(0, r.xpForNextLevel - r.xpIntoLevel)} XP of documented work reaches the next level — the evidence, not the number, is the asset.`}
            </p>
          </div>
          <div className="mt-10 text-center">
            {cinematic ? (
              <button
                type="button"
                data-cxp-return
                onClick={onReturn}
                className="rounded-lg border border-ink-600 px-5 py-2 text-sm text-slate-300 transition hover:border-brand-500/50 hover:text-slate-100"
              >
                ← Return to Mission Control
              </button>
            ) : (
              <a
                href="#top"
                data-cxp-return
                className="inline-block rounded-lg border border-ink-600 px-5 py-2 text-sm text-slate-300 transition hover:border-brand-500/50 hover:text-slate-100"
              >
                ← Return to Mission Control
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
