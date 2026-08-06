"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  ScrollTrigger,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  DESKTOP_REDUCED_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { reveal, pinEnd } from "@/lib/motion";
import { mission } from "@/content/site";

// R3.1 — finding 12/11: literal hex twins of --gcl-platinum / --gcl-steel
// (app/globals.css:13,12). GSAP's color tween can't resolve a custom
// property at tween-build time (it snapshots the computed value once, and
// these two never change at runtime), so the values are duplicated here
// rather than tweened through the var. If the tokens ever move, both
// copies need updating together.
const PILLAR_TITLE_ACTIVE = "#e6e6e6"; // --gcl-platinum
const PILLAR_TITLE_RECEDED = "#a7a9ac"; // --gcl-steel

// R3.1 — finding 12: the full-motion recede ceiling (0.35) was tuned for a
// pillar that was ALSO spatially recessed (scale 0.97, y -12). Under
// reduce there is no spatial cue at all, so 0.35 read as "two things
// equally present" rather than "one thing receding behind another."
// Dropped well under the 0.35 full-motion value; full-motion is untouched.
const RECEDE_OPACITY_FULL = 0.35;
const RECEDE_OPACITY_REDUCED = 0.18;

// R3.2 — finding 12: dropping the ceiling (above) narrows the overlap
// window but a linear recede/enter pair that both start at the same "at"
// still cross near their midpoints — while enter's opacity is climbing
// through ~0.5, recede (on its own 0.4-unit ramp) is also still above
// 0.45, so "no two pillars both in [0.45,1.0] at once" fails regardless of
// the ceiling value. Strictly under-reduce: full-motion pillars carry
// scale/y depth cues finding 12 doesn't touch, so full-motion's "at"
// positions stay byte-for-byte the same (stagger = 0 there — see the call
// sites). Reduced: the retiring pillar's recede start is untouched, but
// the entering pillar's start is delayed by this much — enough that
// recede has already crossed below 0.35 well before enter climbs through
// 0.6, so "exactly one pillar dominant" holds by sequencing, not curves.
const RECEDE_ENTER_STAGGER_REDUCED = 0.2;

// R2 2.3/defect B — measures the actual rendered edges of two pillars'
// text content (not a fixed viewport %) and returns the geometry for a
// short connector segment that runs between them, clear of both. Called
// once per transition, before any transform is applied to the pillars
// (scale/opacity don't move their untransformed layout box), so the
// numbers are stable for the life of the pinned scene.
//
// D6 — both segments snap to ONE shared optical y (the average of the two
// pillars' own measured centers) instead of each keeping its own pillar's
// center, which is what previously produced a ~12° rotation on segment 0
// (the two pillars' content blocks don't sit at exactly the same y). The
// return value carries no angle at all now — horizontal travel only, so
// there is no rotation to accidentally reintroduce downstream.
function measureConnectorSegment(fromEl: HTMLElement, toEl: HTMLElement, containerEl: HTMLElement) {
  const contentRect = (el: HTMLElement) => {
    const nodes = Array.from(
      el.querySelectorAll<HTMLElement>(
        ".mission__pillar-numeral, .mission__pillar-title, .mission__pillar-def"
      )
    );
    const rects = nodes.map((node) => node.getBoundingClientRect());
    if (rects.length === 0) return null;
    return {
      left: Math.min(...rects.map((r) => r.left)),
      right: Math.max(...rects.map((r) => r.right)),
      top: Math.min(...rects.map((r) => r.top)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
    };
  };

  const containerRect = containerEl.getBoundingClientRect();
  const rectA = contentRect(fromEl);
  const rectB = contentRect(toEl);
  if (!rectA || !rectB) return null;

  // R2 defect B fix — the pillars alternate left/right (pillar 2 sits on
  // the RIGHT, pillar 3 back on the LEFT), so "fromEl"/"toEl" in DOM order
  // isn't reliably "leftmost"/"rightmost" on screen. Anchor the segment by
  // actual measured horizontal position instead, so it always runs from
  // whichever pillar is physically on the left to whichever is on the
  // right — never a nonsensical reversed/self-intersecting line.
  const centerA = (rectA.left + rectA.right) / 2;
  const centerB = (rectB.left + rectB.right) / 2;
  const leftRect = centerA <= centerB ? rectA : rectB;
  const rightRect = centerA <= centerB ? rectB : rectA;

  const clearance = 20; // px of protected gutter on each side — never touches text
  const x1 = leftRect.right - containerRect.left + clearance;
  const x2 = rightRect.left - containerRect.left - clearance;

  const dx = x2 - x1;
  if (dx <= 0) return null; // columns too close/overlapping — safety net, never render

  const leftCenterY = leftRect.top + (leftRect.bottom - leftRect.top) / 2 - containerRect.top;
  const rightCenterY = rightRect.top + (rightRect.bottom - rightRect.top) / 2 - containerRect.top;
  const sharedY = (leftCenterY + rightCenterY) / 2;

  return { x1, y: sharedY, length: dx };
}

export default function MissionSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const connectorRef = useRef<HTMLDivElement | null>(null);
  const pillarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const segRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    ensureGsapRegistered();

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isReduced: REDUCED_MOTION_QUERY,
          isMobile: MOBILE_MOTION_QUERY,
          isDesktop: DESKTOP_MOTION_QUERY,
          isDesktopReduced: DESKTOP_REDUCED_QUERY,
        },
        (context) => {
          const { isReduced, isMobile, isDesktop, isDesktopReduced } = context.conditions as {
            isReduced: boolean;
            isMobile: boolean;
            isDesktop: boolean;
            isDesktopReduced: boolean;
          };

          // R3 — isDesktopReduced MUST be checked before isReduced: see
          // InstitutionSection for the branch-order rationale (identical
          // hazard here).
          if (isDesktopReduced) {
            return buildScene(true);
          }

          if (isReduced) {
            gsap.set(".mission__pillar", { opacity: 1, y: 0, scale: 1 });
            if (connectorRef.current) gsap.set(connectorRef.current, { scaleY: 1 });
            return undefined;
          }

          if (isMobile) {
            // Exactly the pre-R2 behavior — untouched.
            if (connectorRef.current) {
              gsap.set(connectorRef.current, { scaleY: 0, transformOrigin: "top" });
              gsap.to(connectorRef.current, {
                scaleY: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: bodyRef.current,
                  start: "top 75%",
                  end: "bottom 75%",
                  scrub: 0.6,
                },
              });
            }

            const pillars = gsap.utils.toArray<HTMLElement>(".mission__pillar");
            pillars.forEach((pillar) => {
              gsap.fromTo(
                pillar,
                { opacity: 0, y: 28 },
                {
                  opacity: 1,
                  y: 0,
                  duration: 0.9,
                  ease: "power2.out",
                  scrollTrigger: {
                    trigger: pillar,
                    start: "top 78%",
                    once: true,
                  },
                }
              );
            });

            return undefined;
          }

          // R3 — one shared scene builder for both desktop policies: same
          // three-pillar connected-scene structure (pin, holds, transitions,
          // segment draw, count-ups), only the channel differs. Under
          // reduce every recede/enter is opacity-only (scale/y stripped via
          // reveal()) and the connector segments are pre-set to full
          // measured length instead of scaleX-drawn — see lib/motion.ts.
          function buildScene(reduced: boolean) {
            // R2 2.3/defect B — the three pillars become connected scenes
            // in the SAME pinned viewport rect (absolutely stacked at
            // alternating horizontal thirds via the existing
            // --pillar/--pillar--right widths — see globals.css): pillar 1
            // holds, then yields as pillar 2 enters with a depth cue
            // (pillar 1 recedes to opacity 0.35 / scale 0.97 as a
            // transient mid-transition beat), then pillar 3 likewise. A
            // short gold connector segment — its geometry measured from
            // the pillars' own rendered text edges, never a fixed
            // viewport % — draws between each consecutive pair as the
            // handoff happens. It is never a full-height center divider:
            // each segment only spans the local gutter between the two
            // pillars it connects.
            const pillars = pillarRefs.current.filter((el): el is HTMLDivElement => Boolean(el));
            if (pillars.length !== 3 || !pinRef.current) return undefined;

            const numerals = pillars.map((p) => p.querySelector<HTMLElement>(".mission__pillar-numeral"));
            // R3.1 — finding 12/11: the second allowed-under-reduce channel
            // (luminance/colour) for this scene. Only the title text moves
            // colour — numeral (gold) and definition (steel, already dim)
            // keep their own fixed tokens, so this never fights an
            // existing channel.
            const titles = pillars.map((p) => p.querySelector<HTMLElement>(".mission__pillar-title"));
            // D7 — targets come from the content data (mission.pillars),
            // never from the DOM: the count-up's own onUpdate overwrites
            // the numeral's textContent, so re-parsing the DOM on a
            // remount (matchMedia breakpoint cross, or Replay-style reset)
            // can pick up an already-mutated value (observed: stuck at
            // "00"). content/site.ts is the single source of truth for
            // what each pillar's numeral actually is.
            const numeralTargets = mission.pillars.map((p) => parseInt(p.numeral, 10));

            // R3 — under reduce, y/scale are explicitly pinned to their
            // neutral rest values (not merely stripped from the vars
            // object) so no stale transform from a prior no-preference
            // mount can survive a breakpoint remount.
            gsap.set(pillars[0], reduced ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, scale: 1, y: 0 });
            gsap.set(
              [pillars[1], pillars[2]],
              reduced ? { opacity: 0, y: 0, scale: 1 } : { opacity: 0, scale: 0.96, y: 28 }
            );
            // R3.2 — finding 13: pillar 0 is visible (opacity 1) from the
            // very first frame of the pin — before the scrubbed timeline
            // has advanced past position 0 at all — so it can't wait for a
            // tl.call to correct it; "00" at opacity 1 is exactly the
            // wrong-numeral defect. Pillars 1/2 start at opacity 0, so "00"
            // is a safe placeholder there: it's corrected (see setNumeral
            // below) at the exact instant each one BEGINS entering, while
            // still fully transparent.
            numerals.forEach((el, i) => {
              if (!el) return;
              el.textContent = i === 0 ? String(numeralTargets[0]).padStart(2, "0") : "00";
            });
            // R3.1 — finding 12/11: title colour starts in lockstep with
            // each pillar's own opacity state (active = full luminance,
            // not-yet-entered = receded luminance) so a breakpoint remount
            // can never leave a hidden pillar's title pre-lit.
            if (reduced) {
              if (titles[0]) gsap.set(titles[0], { color: PILLAR_TITLE_ACTIVE });
              const hiddenTitles = [titles[1], titles[2]].filter((el): el is HTMLElement => Boolean(el));
              if (hiddenTitles.length) gsap.set(hiddenTitles, { color: PILLAR_TITLE_RECEDED });
            }

            const segs = segRefs.current;

            // R3.1 — finding 19: geometry used to be measured exactly once,
            // at build time, and written with direct `seg.style.*`
            // assignments — both mean a resize that doesn't cross a
            // matchMedia breakpoint (e.g. 1440 -> 1920, both "isDesktop")
            // left a segment anchored to stale 1440-derived coordinates
            // forever, and a breakpoint crossing DOWN to mobile left those
            // same inline styles behind because `gsap.context.revert()`
            // only undoes writes made through gsap.set/gsap.to. Routed
            // through this one function, called on build AND on every
            // ScrollTrigger "refresh" (which already fires on resize, so
            // no second resize listener is needed), and through gsap.set
            // so revert() actually clears it.
            const applySegGeometry = () => {
              if (!pinRef.current) return;
              const segGeometry = [
                measureConnectorSegment(pillars[0], pillars[1], pinRef.current),
                measureConnectorSegment(pillars[1], pillars[2], pinRef.current),
              ];
              segs.forEach((seg, i) => {
                const geo = segGeometry[i];
                if (!seg) return;
                if (!geo) {
                  gsap.set(seg, { display: "none" });
                  return;
                }
                // D6 — both segments snap to the SAME shared y (see
                // measureConnectorSegment) and never receive a transform:
                // rotate at all — horizontal travel only, structurally,
                // not just numerically.
                // R3.2 — finding 0/BLOCKER: this function is geometry-only
                // and re-runs on every ScrollTrigger "refresh" (including
                // the load-time refresh scheduled by lib/gsap.ts). Writing
                // `transform: "none"` here used to clobber the scaleX seed
                // set once below, so the segment was already at scaleX 1
                // before the pin ever engaged and the draw tween had
                // nothing left to animate. The anti-rotation intent now
                // lives entirely in the one-time seed's `rotation: 0`.
                gsap.set(seg, {
                  left: geo.x1,
                  top: geo.y,
                  width: geo.length,
                  display: "block",
                });
              });
            };
            applySegGeometry();
            const onSegRefresh = () => applySegGeometry();
            ScrollTrigger.addEventListener("refresh", onSegRefresh);

            // R3 — under reduce the segment is pre-set to its full measured
            // length (scaleX: 1) immediately: it never "draws", it only
            // cross-fades into existence via applySegOpacity's live
            // pillar-opacity binding below. That binding's `scaleX <= 0`
            // guard never trips under reduce, so opacity is the sole
            // channel driving the segment's visibility.
            // R3.2 — finding 0/BLOCKER: `rotation: 0` moved here from
            // applySegGeometry's per-refresh gsap.set — this seed call
            // runs exactly once per matchMedia branch build, so it's the
            // correct (and only) place to assert "never rotated" without
            // also re-clobbering the scaleX draw seed on every resize.
            gsap.set(
              segs.filter((el): el is HTMLDivElement => Boolean(el)),
              reduced
                ? { scaleX: 1, rotation: 0, transformOrigin: "left center", opacity: 0 }
                : { scaleX: 0, rotation: 0, transformOrigin: "left center", opacity: 0 }
            );

            // D3 — the pin trigger IS the pin element itself (not the
            // whole section, which still carries the chapter-mark's own
            // leading margin/padding above the pin): pinning engages the
            // instant the pin's own top reaches the viewport top, so the
            // 100svh stage is always flush with the fold the moment it
            // takes over — never offset down by whatever sits above it in
            // the document. D13 — trimmed from +=180% to +=150%. R3 —
            // pinEnd() applies the 0.6x reduced-hold budget (+=90%).
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: pinRef.current,
                start: "top top",
                end: pinEnd(reduced, 150),
                scrub: 0.6,
                pin: pinRef.current,
                pinSpacing: true,
                onLeaveBack: () => {
                  // D7 — belt-and-braces reset: scrubbing back above the
                  // pin's start already re-renders the timeline at
                  // progress 0 (all counters back to 0), but force the
                  // displayed text too so nothing can read stale after a
                  // fast scroll-up.
                  numerals.forEach((el) => {
                    if (el) el.textContent = "00";
                  });
                },
              },
            });

            // R3.2 — finding 13: the full-motion branch's animated counter
            // (val: 0 -> target over a 0.5-unit ramp) was the actual root
            // cause, not just reduce's tighter pin scale — its "at" was the
            // pillar's HOLD position, well after the pillar had already
            // reached opacity 1, so the counter was still visibly ticking
            // through wrong intermediate digits for a real slice of full-
            // opacity time. Binding correctness to "finishes counting
            // before opacity 0.3" doesn't work either: the enter tween's
            // own opacity crosses 0.3 only 0.12 units into its 0.4-unit
            // ramp — nowhere near enough room for a 0.5-unit count to run.
            // The only shape that can't be wrong at any sampled opacity is
            // a discrete set made BEFORE the pillar starts entering at all
            // (opacity still exactly 0) — every call site below passes the
            // same "at" as that pillar's own enter() call. Applies to both
            // branches; full-motion loses the animated tally but finding
            // 13 explicitly requires it (a lying count-up is not an
            // allowed decorative channel).
            const setNumeral = (index: number, at: number) => {
              const el = numerals[index];
              const target = numeralTargets[index];
              if (!el) return;
              tl.call(
                () => {
                  el.textContent = String(target).padStart(2, "0");
                },
                undefined,
                at
              );
            };

            // D4/D6 — segment opacity is driven continuously off the
            // ACTUAL rendered opacity of the two pillars it connects
            // (never its own independent keyframes), capped at the 0.35
            // resting ceiling once drawn: "segment opacity ≤ its source
            // pillars' opacity at every sample" holds by construction,
            // and a segment whose scaleX hasn't drawn yet stays at 0 (this
            // guard is inert under reduce since scaleX is pre-set to 1).
            const applySegOpacity = (segIndex: number, pillarA: HTMLElement, pillarB: HTMLElement) => {
              const seg = segs[segIndex];
              if (!seg) return;
              const scaleX = Number(gsap.getProperty(seg, "scaleX"));
              if (scaleX <= 0) {
                seg.style.opacity = "0";
                return;
              }
              const opA = Number(gsap.getProperty(pillarA, "opacity"));
              const opB = Number(gsap.getProperty(pillarB, "opacity"));
              seg.style.opacity = String(Math.min(0.35, opA, opB));
            };

            tl.eventCallback("onUpdate", () => {
              applySegOpacity(0, pillars[0], pillars[1]);
              applySegOpacity(1, pillars[1], pillars[2]);
            });

            // R3.1 — finding 12/11: recede/enter now carry the title's
            // colour along with the pillar's own opacity, so under reduce
            // the hand-off reads on two allowed channels at once (opacity
            // separation + luminance recession) instead of opacity alone.
            // Full-motion is untouched — it already has scale/y for depth
            // and doesn't need the extra channel — so the colour tween is
            // reduced-only.
            const recede = (pillar: HTMLElement, title: HTMLElement | null, at: number) => {
              tl.to(
                pillar,
                reveal(reduced, {
                  opacity: reduced ? RECEDE_OPACITY_REDUCED : RECEDE_OPACITY_FULL,
                  scale: 0.97,
                  y: -12,
                  duration: 0.4,
                  ease: "none",
                }),
                at
              );
              if (reduced && title) {
                tl.to(title, { color: PILLAR_TITLE_RECEDED, duration: 0.4, ease: "none" }, at);
              }
            };

            const enter = (pillar: HTMLElement, title: HTMLElement | null, at: number) => {
              tl.to(pillar, reveal(reduced, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "none" }), at);
              if (reduced && title) {
                tl.to(title, { color: PILLAR_TITLE_ACTIVE, duration: 0.4, ease: "none" }, at);
              }
            };

            // R3.2 — finding 12: only the ENTER side of each transition
            // shifts under reduce; full-motion keeps its original "at"
            // (stagger = 0) — see RECEDE_ENTER_STAGGER_REDUCED above.
            const enter1At = 0.8 + (reduced ? RECEDE_ENTER_STAGGER_REDUCED : 0);
            const enter2At = 1.6 + (reduced ? RECEDE_ENTER_STAGGER_REDUCED : 0);

            // Beat 1 — pillar 1 holds. Its numeral was already set correct
            // at build time above (visible from progress 0); this call only
            // re-corrects it on a scroll-back-then-forward re-entry (see
            // the onLeaveBack reset above).
            setNumeral(0, 0);

            // Transition 1→2 — pillar 1 recedes (depth cue), pillar 2
            // enters from the opposite third (delayed under reduce so it
            // never climbs through 0.6 before pillar 1 has dropped below
            // 0.35 — finding 12), connector segment 1 draws. The numeral is
            // set in lockstep with pillar 2's own enter start, i.e. while
            // it is still fully transparent (finding 13).
            recede(pillars[0], titles[0], 0.8);
            enter(pillars[1], titles[1], enter1At);
            setNumeral(1, enter1At);
            if (segs[0] && !reduced) {
              tl.to(segs[0], { scaleX: 1, duration: 0.3, ease: "none" }, 0.85);
            }

            // Pillar 3 will share pillar 1's (opposite-third) screen slot.
            // Pillar 1's depth-recede ghost — left at a low residual
            // opacity after transition 1 — has to be fully gone before
            // pillar 3 starts becoming legible there, or the two double-
            // expose. Clear it during pillar 2's hold (no visual
            // competition for that slot), well ahead of transition 2→3
            // below — sequenced, not crossfaded with pillar 3's entrance.
            // D4 — it fades fully to 0 (a replaced scene, not context), and
            // connector segment 1 (bound to pillar 1's live opacity above)
            // fades out with it automatically.
            tl.to(pillars[0], { opacity: 0, duration: 0.5, ease: "none" }, 1.2);

            // Transition 2→3 — pillar 2 recedes, pillar 3 enters (same
            // reduced-only stagger), connector segment 2 draws.
            recede(pillars[1], titles[1], 1.6);
            enter(pillars[2], titles[2], enter2At);
            setNumeral(2, enter2At);
            if (segs[1] && !reduced) {
              tl.to(segs[1], { scaleX: 1, duration: 0.3, ease: "none" }, 1.65);
            }

            // Beat 3 — pillar 3 holds. D4 — pillar 2's recede ghost fades
            // fully to 0 once pillar 3 is settled (never rests at a
            // permanent low-contrast residual); connector segment 2 fades
            // out with it via the same live binding.
            tl.to(pillars[1], { opacity: 0, duration: 0.5, ease: "none" }, 2.0);

            // R3.1 — finding 14: previously the scene's last content
            // change (pillar 2's ghost finishing its fade-to-0) landed at
            // t=2.5, the SAME instant the timeline's own auto-computed
            // duration ended — i.e. progress 1.0/pin-release coincided
            // exactly with "still mid-fade," so the pin let go with zero
            // dwell time on the fully-resolved frame before handing off to
            // the unpinned tail below it. This filler tween adds nothing
            // visible; it only extends the timeline's total duration past
            // the last real change, which — because ScrollTrigger maps the
            // SAME fixed scroll budget (pinEnd above; unchanged by this)
            // across whatever the timeline's total duration is — converts
            // a meaningful share of that already-allocated scroll into a
            // held, fully-inked "pillar 3 settled" frame instead of a
            // razor-thin instant. It does not add scroll distance or
            // change document height.
            tl.to({}, { duration: 1.0 }, 2.5);

            return () => {
              tl.scrollTrigger?.kill();
              // R3.1 — finding 19: the refresh listener closes over this
              // call's `pillars`/`segs` refs; leaving it registered past a
              // matchMedia breakpoint change or unmount would re-measure
              // against a torn-down scene on the next resize.
              ScrollTrigger.removeEventListener("refresh", onSegRefresh);
              // R3.2 — finding 1/HIGH: setNumeral/onLeaveBack write raw
              // textContent (tracked count-up state), which gsap.context's
              // revert() can't see or undo. Restore each numeral from the
              // content source of truth (D7 — mission.pillars, never the
              // DOM) so a matchMedia breakpoint crossing can never leave a
              // count-up-mutated "00" visible below 1024px.
              numerals.forEach((el, i) => {
                if (el) el.textContent = mission.pillars[i].numeral;
              });
              // R3.2 — finding 5/LOW: applySegOpacity also writes raw
              // seg.style.opacity outside GSAP's revert tracking. Route
              // the reset through gsap.set's clearProps so a crossing
              // below 1024px doesn't leave an inline opacity behind.
              gsap.set(segs.filter((el): el is HTMLDivElement => Boolean(el)), {
                clearProps: "opacity",
              });
            };
          }

          if (isDesktop) {
            return buildScene(false);
          }

          return undefined;
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="mission" ref={rootRef} className="mission" aria-labelledby="mission-heading">
      {/* D3 — the chapter-mark now lives INSIDE the pinned composition (as
          a top band) rather than as a separate block before it, so it's
          part of the same 100svh stage instead of scrolling past before
          the pin (which aligns to its own top, see the scrollTrigger
          below) ever engages. No "container" class here — the ancestor
          `.mission__body` already supplies the shared max-width/gutter,
          so this stays aligned with the pillars below it. */}
      <div className="container mission__body" ref={bodyRef}>
        <div className="mission__pin" ref={pinRef}>
          <div className="mission__header">
            <p className="chapter-mark">{mission.chapterMark}</p>
            <h2 id="mission-heading" className="visually-hidden">
              Mission Architecture
            </h2>
          </div>

          <div ref={connectorRef} className="mission__connector" aria-hidden="true" />
          <div ref={(el) => { segRefs.current[0] = el; }} className="mission__connector-seg" aria-hidden="true" />
          <div ref={(el) => { segRefs.current[1] = el; }} className="mission__connector-seg" aria-hidden="true" />

          {mission.pillars.map((pillar, i) => (
            <div
              key={pillar.title}
              ref={(el) => { pillarRefs.current[i] = el; }}
              className={`mission__pillar${i % 2 === 1 ? " mission__pillar--right" : ""}`}
            >
              <span className="mission__pillar-numeral">{pillar.numeral}</span>
              <h3 className="mission__pillar-title">{pillar.title}</h3>
              <p className="mission__pillar-def">{pillar.definition}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
