"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  DESKTOP_REDUCED_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { reveal, pinEnd } from "@/lib/motion";
import { institution } from "@/content/site";

// R3.1 (finding 20) — lib/motion.ts's REDUCED_PIN_SCALE (0.6x) is a single
// flat factor shared by every pinned chapter, which gives the institutional
// thesis — five heading lines plus two support paragraphs, a genuinely
// reading-bound chapter — the SHORTEST hold on the reduced-motion site
// (measured: 360px of scroll vs 810px under full motion, a steeper cut than
// motion-bound chapters that actually have transform-driven beats to strip).
// Reading time is not a function of motion preference, so Institution's
// pinned hold shouldn't be cut as hard as a chapter whose duration exists to
// cover a parallax/recede beat. This overrides the shared scale locally
// (rather than editing REDUCED_PIN_SCALE itself, which every other pinned
// chapter also reads) to 0.85x — close to full-motion length — for this
// chapter only.
const INSTITUTION_REDUCED_PIN_SCALE = 0.85;

export default function InstitutionSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const ruleFillRef = useRef<HTMLDivElement | null>(null);
  const markRef = useRef<HTMLParagraphElement | null>(null);
  const headingLine0Ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    // R3.1 (finding 10) — `html.js` (set by a blocking inline script in
    // layout.tsx) only proves the initial script tag ran; it is present
    // even when the chunk carrying every section's own mount effect fails
    // to load. Several desktop-reduce CSS states (the pinned Mission/
    // Principles staging, the Institution heading pre-hide) are only safe
    // to apply once a GSAP-driving effect has actually mounted — otherwise
    // they degrade a "no JS ran" page into an unreadable one (overlapping
    // Mission pillars, vanished Principles, an Institution heading stuck at
    // opacity:0 with nothing left to reveal it). This marker is that proof.
    // Set here, once, following the same "call from any single mounted
    // component" convention lib/gsap.ts already documents for
    // scheduleScrollTriggerRefresh — Institution mounts unconditionally on
    // every load of this single-page site, so this always runs whenever
    // any section's JS successfully initializes.
    document.documentElement.classList.add("gsap-ready");

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

          const lines = gsap.utils.toArray<HTMLElement>(".institution__heading-line span");
          const paras = gsap.utils.toArray<HTMLElement>(".institution__paragraphs p");

          // R3 — isDesktopReduced MUST be checked before isReduced:
          // REDUCED_MOTION_QUERY also matches desktop widths, and if isReduced
          // won here the pin would vanish again (the exact D-1 bug). The
          // surviving isReduced branch below now only ever fires <1024px.
          if (isDesktopReduced) {
            return buildScene(true);
          }

          if (isReduced) {
            gsap.set(lines, { y: "0%" });
            gsap.set(paras, { opacity: 1, y: 0 });
            if (headingRef.current) gsap.set(headingRef.current, { x: 0 });
            if (markRef.current) gsap.set(markRef.current, { y: 0, opacity: 1 });
            if (headingLine0Ref.current) gsap.set(headingLine0Ref.current, { y: 0, opacity: 1 });
            if (ruleFillRef.current) gsap.set(ruleFillRef.current, { height: "100%" });
            return undefined;
          }

          if (isMobile) {
            // Exactly the pre-R2 behavior — untouched.
            gsap.to(lines, {
              y: "0%",
              duration: 0.9,
              ease: "power3.out",
              stagger: 0.14,
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top 70%",
                once: true,
              },
            });

            gsap.fromTo(
              paras,
              { opacity: 0, y: 16 },
              {
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: "power2.out",
                stagger: 0.12,
                scrollTrigger: {
                  trigger: rootRef.current,
                  start: "top 55%",
                  once: true,
                },
              }
            );

            if (ruleFillRef.current) {
              gsap.to(ruleFillRef.current, {
                height: "100%",
                ease: "none",
                scrollTrigger: {
                  trigger: rootRef.current,
                  start: "top bottom",
                  end: "bottom center",
                  scrub: 0.6,
                },
              });
            }

            return undefined;
          }

          // R3 — one shared scene builder for both desktop policies: same
          // structure (approach drift, pin, line-by-line reveal, statement
          // shift, paragraph beat, rule draw), only the channel differs.
          // Under reduce every spatial var is stripped via reveal()/pinEnd()
          // (see lib/motion.ts) so the exact same beats run on
          // opacity/rule-opacity/pin-hold alone.
          function buildScene(reduced: boolean) {
            // R2 2.1/2.2 — the arrival→institution camera handoff.
            // Institution is provably fully below the viewport for the
            // entire duration of Arrival's extended pull-back pin (its
            // document top only reaches the viewport's bottom edge at the
            // exact instant that pin releases — verified via the pin +
            // spacer geometry), so any pre-animation tied to Arrival's own
            // scrub would run invisibly. Instead this drift is tied to
            // Institution's own approach: from the moment its top touches
            // the bottom of the viewport to the moment it reaches the top
            // (where the pinned reveal below takes over), the chapter-mark
            // and the first heading-line's OUTER wrapper (not the inner
            // span the mask-reveal below owns — kept on separate elements
            // so the two tweens never fight over one transform) drift up
            // into the lower third as the scene approaches — a real,
            // visible camera-handoff rather than an animation that
            // completes off-screen. Under reduce the drift is opacity-only
            // (0.5→1 / 0.6→1) — the y-drift is stripped, same scrub.
            if (markRef.current) {
              // R3.1 (finding 11) — reduced gets an extra `color` key here
              // that full-motion doesn't need (full-motion's approach drift
              // already reads as motion via the y-offset). This bypasses
              // reveal() rather than going through it: reveal() only ever
              // STRIPS spatial keys from a shared vars object, it has no way
              // to ADD a reduced-only key, and the chapter-mark's colour
              // settling from steel to platinum as it approaches is exactly
              // the "architecture resolving" read the reduced path was
              // missing — a second, non-opacity channel for the SAME beat.
              gsap.set(
                markRef.current,
                reduced
                  ? { y: 0, opacity: 0.5, color: "#a7a9ac" /* --gcl-steel */ }
                  : { y: 32, opacity: 0.5 }
              );
            }
            if (headingLine0Ref.current) {
              gsap.set(
                headingLine0Ref.current,
                reduced ? { y: 0, opacity: 0.6 } : { y: 20, opacity: 0.6 }
              );
            }

            const approach = gsap.timeline({
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top bottom",
                end: "top top",
                scrub: 0.5,
              },
            });
            if (markRef.current) {
              approach.to(
                markRef.current,
                reduced
                  ? { y: 0, opacity: 1, color: "#e6e6e6" /* --gcl-platinum */, duration: 1, ease: "none" }
                  : reveal(reduced, { y: 0, opacity: 1, duration: 1, ease: "none" }),
                0
              );
            }
            if (headingLine0Ref.current) {
              approach.to(
                headingLine0Ref.current,
                reveal(reduced, { y: 0, opacity: 1, duration: 1, ease: "none" }),
                0
              );
            }

            // R2 2.2 — pinned scene: the statement mask-reveals line by
            // line (staged, not simultaneous), then the supporting
            // paragraphs fade/rise in a second beat while the statement
            // shifts left ~4% (a spatial separation between statement and
            // support), and the vertical gold rule (now in its own
            // dedicated grid track — R2 defect A, see globals.css
            // .institution__frame) draws top-to-bottom on the same scrub.
            // Under reduce, lines pre-hide via opacity (the reduce CSS
            // twin), paras pre-hide via reveal() (opacity only, y
            // stripped), and the heading's -4% shift is dropped entirely —
            // see below.
            if (reduced) {
              gsap.set(lines, { y: 0, opacity: 0 });
            } else {
              gsap.set(lines, { y: "110%" });
            }
            gsap.set(paras, reveal(reduced, { opacity: 0, y: 16 }));

            // D13 — trimmed from +=110% to +=90% (pin-budget pass); D11 —
            // the heading reveal window is tightened (duration/stagger
            // reduced) so each line finishes its mask-reveal sooner,
            // shrinking the scrub range in which a line sits mid-clip.
            // R3.1 (finding 20) — reduced end uses this chapter's own 0.85x
            // budget (+=76.5%, rounded) instead of pinEnd()'s shared 0.6x
            // (+=54%) — see INSTITUTION_REDUCED_PIN_SCALE above.
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top top",
                end: reduced
                  ? `+=${Math.round(90 * INSTITUTION_REDUCED_PIN_SCALE)}%`
                  : pinEnd(false, 90),
                scrub: 0.6,
                pin: pinRef.current,
                pinSpacing: true,
              },
            });

            if (reduced) {
              tl.to(lines, { opacity: 1, duration: 0.7, ease: "none", stagger: 0.15 }, 0);
            } else {
              tl.to(lines, { y: "0%", duration: 0.7, ease: "none", stagger: 0.15 }, 0);
            }

            // R3 — untranslatable without movement, so it is DROPPED under
            // reduce; the statement/support separation is instead carried
            // by the paragraphs' fade beat arriving at position 0.6 while
            // the statement is already at rest.
            if (!reduced && headingRef.current) {
              tl.to(headingRef.current, { x: "-4%", duration: 0.6, ease: "none" }, 0.55);
            }

            tl.to(
              paras,
              reveal(reduced, { opacity: 1, y: 0, duration: 0.6, ease: "none", stagger: 0.15 }),
              0.6
            );

            if (ruleFillRef.current) {
              if (reduced) {
                // R3 — the rule appears rather than travels: sit the fill
                // at full height and fade its opacity in on the same scrub
                // instead of drawing the height.
                // R3.1 (finding 11) — opacity alone was the only channel any
                // reduced-branch tween on the site used (a sitewide grep for
                // colour/backgroundColor tween keys returned zero hits), so
                // the reduced path read as "fade in" everywhere rather than
                // "architecture resolving." Layer a genuine luminance
                // channel on top of the opacity fade here: the fill's own
                // colour brightens dim gold (--gcl-gateway-gold-dim, its
                // static full-motion colour) to full gold
                // (--gcl-gateway-gold) across the same scrub, so the rule
                // doesn't just appear — it settles into full brightness,
                // same as the physical draw does in the full-motion path.
                // Colour/luminance is on the ruling's allowed list.
                gsap.set(ruleFillRef.current, { height: "100%" });
                tl.fromTo(
                  ruleFillRef.current,
                  { opacity: 0, backgroundColor: "rgba(212, 161, 70, 0.35)" },
                  {
                    opacity: 1,
                    backgroundColor: "rgba(212, 161, 70, 1)",
                    duration: 1.2,
                    ease: "none",
                  },
                  0
                );
              } else {
                tl.fromTo(
                  ruleFillRef.current,
                  { height: "0%" },
                  { height: "100%", duration: 1.2, ease: "none" },
                  0
                );
              }
            }

            return () => {
              approach.scrollTrigger?.kill();
              tl.scrollTrigger?.kill();
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
    <section
      id="institution"
      ref={rootRef}
      className="institution"
      aria-labelledby="institution-heading"
    >
      <div className="container institution__frame">
        {/* R2 defect A — the rule now lives in its own dedicated grid
            track ([line]), never sharing an x-position with the content
            column, so it can never overlap the chapter-mark or heading
            text at any width. */}
        <div className="institution__rule-v" aria-hidden="true">
          <div ref={ruleFillRef} className="institution__rule-v-fill" />
        </div>

        <div className="institution__grid" ref={pinRef}>
          <p className="chapter-mark institution__mark" ref={markRef}>
            {institution.chapterMark}
          </p>

          <h2
            id="institution-heading"
            className="institution__heading"
            ref={headingRef}
          >
            {institution.headingLines.map((line, i) => (
              <span
                className="institution__heading-line"
                key={i}
                ref={i === 0 ? headingLine0Ref : undefined}
              >
                <span>{line}</span>
              </span>
            ))}
          </h2>

          <div className="institution__paragraphs">
            {institution.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
