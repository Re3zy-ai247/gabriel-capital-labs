"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  scrollTimeline,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  DESKTOP_REDUCED_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { reveal } from "@/lib/motion";
import { lab } from "@/content/site";

// R3.1 — finding 11 fix (MEDIUM): literal hex twins of --gcl-gateway-gold /
// --gcl-gateway-gold-dim (app/globals.css:14-15) — same rationale as
// EcosystemSection's copies: GSAP's color tween snapshots a computed value
// once and can't re-resolve a custom property at tween-build time. Used to
// give the reduced row-rule a luminance channel (dim → lit) alongside its
// existing opacity fade, matching the treatment given to Ecosystem's wing
// hairline.
const ROW_RULE_DIM = "rgba(212, 161, 70, 0.35)"; // --gcl-gateway-gold-dim
const ROW_RULE_LIT = "#d4a146"; // --gcl-gateway-gold

export default function LabSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const indexRef = useRef<HTMLDivElement | null>(null);
  const gridBgRef = useRef<HTMLDivElement | null>(null);
  const introLineRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    // R3.1 — finding 1 fix (BLOCKER, fallback half): same belt-and-braces
    // as EcosystemSection (the section where the deep-link crash actually
    // reproduced) — a cinematic layer must never be able to remove all
    // page content, even if scene construction throws for a reason
    // specific to this section.
    function applyStaticFallback() {
      gsap.set(".lab__row", { opacity: 1, y: 0 });
      gsap.set(".lab__row-rule", { scaleX: 1, opacity: 1, backgroundColor: ROW_RULE_LIT });
      if (introLineRef.current) gsap.set(introLineRef.current, { y: "0%", opacity: 1 });
      gsap.set(rootRef.current, { "--gcl-rule-scale": 1, "--gcl-rule-opacity": 1 } as any);
    }

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
            // R3.1 — finding 1 fix (BLOCKER): never let scene construction
            // exceptions unwind through React and blank the page.
            try {
              return buildScene(true);
            } catch (err) {
              console.error("[LabSection] desktop-reduced scene failed, falling back to static", err);
              applyStaticFallback();
              return undefined;
            }
          }

          if (isReduced) {
            gsap.set(".lab__row", { opacity: 1, y: 0 });
            gsap.set(".lab__row-rule", { scaleX: 1 });
            // R3.1 — finding 9 fix (HIGH): buildScene(true)'s intro-line
            // pre-hide writes `opacity: 0` (see below); resetting only `y`
            // on the way back into this sub-1024 branch left it stuck at 0
            // after any 1440→800 crossing under reduce — see
            // EcosystemSection's identical fix for the full mechanism.
            if (introLineRef.current) gsap.set(introLineRef.current, { y: "0%", opacity: 1 });
            gsap.set(rootRef.current, { "--gcl-rule-scale": 1 } as any);
            return undefined;
          }

          if (isMobile) {
            // Exactly the pre-R2 behavior — untouched.
            gsap.to(".lab__row", {
              opacity: 1,
              y: 0,
              duration: 0.7,
              ease: "power2.out",
              stagger: 0.09,
              scrollTrigger: {
                trigger: indexRef.current,
                start: "top 80%",
                once: true,
              },
            });
            return undefined;
          }

          // R3 — one shared scene builder for both desktop policies: same
          // intro-line reveal, hairline draw, and row-index reveal
          // structure. Under reduce the row's translateY pre-hide (its
          // reduce CSS twin) fades in place via reveal(), the row rule
          // fades opacity instead of drawing, and the hairline draws via
          // --gcl-rule-opacity instead of --gcl-rule-scale. The blueprint
          // parallax has no vestibular-safe equivalent and is dropped.
          function buildScene(reduced: boolean) {
            // D9 — the intro heading mask-reveals and the chapter-mark's
            // hairline draws (via --gcl-rule-scale, see globals.css) as
            // the header scrolls in — matches Ecosystem's treatment,
            // removing a dead scroll zone before the row index reveals.
            // R3.2 — root-cause fix for the deep-link crash (see lib/gsap.ts
            // scrollTimeline): this used to be a plain gsap.fromTo with the
            // scrollTrigger inlined on the tween, which refreshes
            // SYNCHRONOUSLY on creation. Hosting it in a Timeline instead
            // (scrollTrigger on the timeline, not the child tween) takes
            // GSAP's own deferred-refresh path, matching every other
            // trigger this section builds.
            if (introLineRef.current) {
              if (reduced) {
                gsap.set(introLineRef.current, { y: 0, opacity: 0 });
                scrollTimeline({ trigger: rootRef.current, start: "top 75%", once: true }).fromTo(
                  introLineRef.current,
                  { opacity: 0 },
                  { opacity: 1, duration: 0.8 }
                );
              } else {
                gsap.set(introLineRef.current, { y: "110%" });
                scrollTimeline({ trigger: rootRef.current, start: "top 75%", once: true }).fromTo(
                  introLineRef.current,
                  { y: "110%" },
                  { y: "0%", duration: 0.8, ease: "power3.out" }
                );
              }
            }
            scrollTimeline({ trigger: rootRef.current, start: "top 80%", once: true }).fromTo(
              rootRef.current,
              { [reduced ? "--gcl-rule-opacity" : "--gcl-rule-scale"]: 0 } as any,
              {
                [reduced ? "--gcl-rule-opacity" : "--gcl-rule-scale"]: 1,
                duration: 0.6,
                ease: "power2.out",
              } as gsap.TweenVars
            );

            // R2 2.5 — keep the index reveal, but row hairlines now DRAW
            // (scaleX 0→1) instead of simply fading in with the row, and
            // the blueprint-grid gets a subtle parallax drift. The grid
            // element is oversized (110%) via CSS headroom so translating
            // it within ±4% never reveals an edge — transform-only,
            // compositor-cheap, no background-position repaint.
            const rows = gsap.utils.toArray<HTMLElement>(".lab__row");
            // R3 fix — under reduce, reveal() strips the `y` key from the
            // per-row tween below so nothing spatial ever animates, but the
            // CSS pre-hide (`html.js .lab__row { transform: translateY(14px) }`)
            // still applies at mount and is never otherwise cleared, leaving
            // every row permanently offset 14px after it "reveals". Explicit
            // neutral, same anti-stale-transform pattern as MissionSection's
            // pillars.
            if (reduced) {
              gsap.set(rows, { y: 0 });
            }
            rows.forEach((row) => {
              const rule = row.querySelector<HTMLElement>(".lab__row-rule");
              const tl = gsap.timeline({
                scrollTrigger: { trigger: row, start: "top 85%", once: true },
              });
              tl.to(
                row,
                reveal(reduced, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }),
                0
              );
              if (rule) {
                if (reduced) {
                  // R3.1 — finding 11 fix (MEDIUM): the row-rule's resting
                  // color is already --gcl-gateway-gold-dim in both
                  // policies (see globals.css), so full-motion never
                  // brightens it — only draws it (scaleX). Under reduce,
                  // pairing the opacity fade with a dim→lit colour
                  // interpolation gives this row a luminance cue the
                  // full-motion path gets from the draw itself, so the row
                  // reads as resolving into place rather than just fading.
                  tl.fromTo(
                    rule,
                    { opacity: 0, backgroundColor: ROW_RULE_DIM },
                    { opacity: 1, backgroundColor: ROW_RULE_LIT, duration: 0.6 },
                    0.1
                  );
                } else {
                  tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.out" }, 0.1);
                }
              }
            });

            // R3 — parallax is movement by definition; DROPPED under
            // reduce, no replacement. The static grid texture remains
            // (decorative depth, not architecture).
            if (gridBgRef.current && !reduced) {
              // R3.2 — same scrollTimeline root-cause fix as above.
              scrollTimeline({
                trigger: rootRef.current,
                start: "top bottom",
                end: "bottom top",
                scrub: 0.8,
              }).fromTo(
                gridBgRef.current,
                { xPercent: -2, yPercent: -2 },
                { xPercent: 2, yPercent: 2, ease: "none" },
              );
            }

            return undefined;
          }

          if (isDesktop) {
            // R3.1 — finding 1 fix (BLOCKER): same belt-and-braces as the
            // desktop-reduced branch above.
            try {
              return buildScene(false);
            } catch (err) {
              console.error("[LabSection] desktop scene failed, falling back to static", err);
              applyStaticFallback();
              return undefined;
            }
          }

          return undefined;
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="lab" ref={rootRef} className="lab" aria-labelledby="lab-heading">
      <div ref={gridBgRef} className="lab__grid-bg" aria-hidden="true" />
      <div className="container lab__header">
        <p className="chapter-mark">{lab.chapterMark}</p>
        <h2 id="lab-heading" className="lab__intro">
          <span className="lab__intro-mask">
            <span ref={introLineRef} className="lab__intro-line">
              {lab.intro}
            </span>
          </span>
        </h2>
      </div>

      <div className="container lab__index" ref={indexRef}>
        {lab.domains.map((domain) => (
          <div className="lab__row" key={domain.numeral}>
            <span className="lab__row-numeral">{domain.numeral}</span>
            <h3 className="lab__row-title">{domain.title}</h3>
            <span className="lab__row-rule" aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  );
}
