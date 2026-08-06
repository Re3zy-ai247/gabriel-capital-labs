"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { mission } from "@/content/site";

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
        },
        (context) => {
          const { isReduced, isMobile, isDesktop } = context.conditions as {
            isReduced: boolean;
            isMobile: boolean;
            isDesktop: boolean;
          };

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

          if (isDesktop) {
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
            // D7 — targets come from the content data (mission.pillars),
            // never from the DOM: the count-up's own onUpdate overwrites
            // the numeral's textContent, so re-parsing the DOM on a
            // remount (matchMedia breakpoint cross, or Replay-style reset)
            // can pick up an already-mutated value (observed: stuck at
            // "00"). content/site.ts is the single source of truth for
            // what each pillar's numeral actually is.
            const numeralTargets = mission.pillars.map((p) => parseInt(p.numeral, 10));

            gsap.set(pillars[0], { opacity: 1, scale: 1, y: 0 });
            gsap.set([pillars[1], pillars[2]], { opacity: 0, scale: 0.96, y: 28 });
            numerals.forEach((el) => {
              if (el) el.textContent = "00";
            });

            const segGeometry = [
              measureConnectorSegment(pillars[0], pillars[1], pinRef.current),
              measureConnectorSegment(pillars[1], pillars[2], pinRef.current),
            ];

            const segs = segRefs.current;
            segs.forEach((seg, i) => {
              const geo = segGeometry[i];
              if (!seg || !geo) return;
              // D6 — both segments snap to the SAME shared y (see
              // measureConnectorSegment) and never receive a transform:
              // rotate at all — horizontal travel only, structurally, not
              // just numerically.
              seg.style.left = `${geo.x1}px`;
              seg.style.top = `${geo.y}px`;
              seg.style.width = `${geo.length}px`;
              seg.style.transform = "none";
              seg.style.display = geo.length > 0 ? "block" : "none";
            });
            gsap.set(
              segs.filter((el): el is HTMLDivElement => Boolean(el)),
              { scaleX: 0, transformOrigin: "left center", opacity: 0 }
            );

            // D3 — the pin trigger IS the pin element itself (not the
            // whole section, which still carries the chapter-mark's own
            // leading margin/padding above the pin): pinning engages the
            // instant the pin's own top reaches the viewport top, so the
            // 100svh stage is always flush with the fold the moment it
            // takes over — never offset down by whatever sits above it in
            // the document. D13 — trimmed from +=180% to +=150%.
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: pinRef.current,
                start: "top top",
                end: "+=150%",
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

            const countUp = (index: number, at: number) => {
              const el = numerals[index];
              const target = numeralTargets[index];
              if (!el) return;
              const counter = { val: 0 };
              tl.to(
                counter,
                {
                  val: target,
                  duration: 0.5,
                  ease: "none",
                  onUpdate: () => {
                    // D7 — clamp: never show more than the pillar's own
                    // numeral, regardless of any easing overshoot.
                    const clamped = Math.min(target, Math.max(0, Math.round(counter.val)));
                    el.textContent = String(clamped).padStart(2, "0");
                  },
                },
                at
              );
            };

            // D4/D6 — segment opacity is driven continuously off the
            // ACTUAL rendered opacity of the two pillars it connects
            // (never its own independent keyframes), capped at the 0.35
            // resting ceiling once drawn: "segment opacity ≤ its source
            // pillars' opacity at every sample" holds by construction,
            // and a segment whose scaleX hasn't drawn yet stays at 0.
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

            // Beat 1 — pillar 1 holds, numeral counts up.
            countUp(0, 0.05);

            // Transition 1→2 — pillar 1 recedes (depth cue), pillar 2
            // enters from the opposite third, connector segment 1 draws.
            tl.to(pillars[0], { opacity: 0.35, scale: 0.97, y: -12, duration: 0.4, ease: "none" }, 0.8)
              .to(pillars[1], { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "none" }, 0.8);
            if (segs[0]) {
              tl.to(segs[0], { scaleX: 1, duration: 0.3, ease: "none" }, 0.85);
            }

            // Beat 2 — pillar 2 holds, numeral counts up.
            countUp(1, 1.1);

            // Pillar 3 will share pillar 1's (opposite-third) screen slot.
            // Pillar 1's depth-recede ghost — left at 0.35 opacity after
            // transition 1 — has to be fully gone before pillar 3 starts
            // becoming legible there, or the two double-expose. Clear it
            // during beat 2 (while pillar 2 holds, no visual competition
            // for that slot), well ahead of transition 2→3 below —
            // sequenced, not crossfaded with pillar 3's entrance. D4 — it
            // fades fully to 0 (a replaced scene, not context), and
            // connector segment 1 (bound to pillar 1's live opacity above)
            // fades out with it automatically.
            tl.to(pillars[0], { opacity: 0, duration: 0.5, ease: "none" }, 1.2);

            // Transition 2→3 — pillar 2 recedes, pillar 3 enters,
            // connector segment 2 draws.
            tl.to(pillars[1], { opacity: 0.35, scale: 0.97, y: -12, duration: 0.4, ease: "none" }, 1.6)
              .to(pillars[2], { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "none" }, 1.6);
            if (segs[1]) {
              tl.to(segs[1], { scaleX: 1, duration: 0.3, ease: "none" }, 1.65);
            }

            // Beat 3 — pillar 3 holds, numeral counts up. D4 — pillar 2's
            // recede ghost fades fully to 0 once pillar 3 is settled
            // (never rests at a permanent low-contrast 0.35); connector
            // segment 2 fades out with it via the same live binding.
            countUp(2, 1.9);
            tl.to(pillars[1], { opacity: 0, duration: 0.5, ease: "none" }, 2.0);

            return () => {
              tl.scrollTrigger?.kill();
            };
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
