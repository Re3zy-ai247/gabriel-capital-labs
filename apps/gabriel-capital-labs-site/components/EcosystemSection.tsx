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
import { revealFromTo } from "@/lib/motion";
import { ecosystem } from "@/content/site";

// D15 — each wing gets its own restrained architectural identity rather
// than four identical blocks: an alternating numeral gutter, one
// full-measure wing, and a staggered hairline inset. No added ornament,
// just grid position/measure variation, matched 1:1 to the four domains.
const WING_VARIANTS = ["", "offset", "wide", "inset"];

// R3.1 — finding 5 fix (HIGH): the D4 "previous wing recedes" dim used to
// drop straight to 0.5, which is fine under full-motion (D4 there rides
// alongside a spatial recede cue) but under reduce it's the ONLY cue, and
// 0.5 composited every wing-* text token below the 4.5:1 AA floor (axe:
// numeral 2.85:1, designation/desc 3.18:1, status 2.86:1) plus the gold
// focus ring below the 3:1 non-text floor. 0.82 keeps the worst-case token
// (steel numeral / gold status, both ~8.3:1 at full opacity) comfortably
// above 4.5:1 (~5.8:1) with margin — verified against every wing color
// token, not assumed. Full-motion keeps its original 0.5; only the reduced
// channel gets a contrast floor.
const REDUCED_WING_DIM_OPACITY = 0.82;

// R3.1 — finding 11 fix (MEDIUM): literal hex twins of --gcl-gateway-gold /
// --gcl-gateway-gold-dim (app/globals.css:14-15) for the same reason
// MissionSection duplicates --gcl-platinum/--gcl-steel — GSAP's color tween
// snapshots a computed value once and can't re-resolve a custom property,
// so the two static tokens are copied here rather than tweened through the
// var. Used to give the reduced wing-rule a luminance channel (dim → lit)
// alongside its existing opacity fade, so the hairline reads as brightening
// into focus rather than just appearing.
const WING_RULE_DIM = "rgba(212, 161, 70, 0.35)"; // --gcl-gateway-gold-dim
const WING_RULE_LIT = "#d4a146"; // --gcl-gateway-gold

export default function EcosystemSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const introLineRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    // R3.1 — finding 1 fix (BLOCKER, fallback half): a cinematic layer must
    // never be able to remove all page content. If scene construction
    // throws for any reason (see the ordering fix on the D4 loop below for
    // the actual root cause), force every element this section can animate
    // to its final, fully-visible rest state instead of letting the
    // exception unwind through React and leave the section (and everything
    // that would refresh after it) unrendered.
    function applyStaticFallback() {
      const wings = gsap.utils.toArray<HTMLElement>(".ecosystem__wing");
      gsap.set(wings, { clipPath: "none", opacity: 1, x: 0 });
      gsap.set(".ecosystem__wing-rule", { scaleX: 1, opacity: 1, backgroundColor: WING_RULE_LIT });
      gsap.set(
        ".ecosystem__wing-numeral, .ecosystem__wing-name, .ecosystem__wing-designation, .ecosystem__wing-status, .ecosystem__wing-desc, .ecosystem__wing-link",
        { opacity: 1, y: 0 }
      );
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

          const wings = gsap.utils.toArray<HTMLElement>(".ecosystem__wing");

          // R3 — isDesktopReduced MUST be checked before isReduced: see
          // InstitutionSection for the branch-order rationale (identical
          // hazard here).
          if (isDesktopReduced) {
            // R3.1 — finding 1 fix (BLOCKER): buildScene() can throw (the
            // D4 ScrollTrigger.create loop was the reproducible cause —
            // see its fix below); never let that exception escape into
            // React and blank the page.
            try {
              return buildScene(true);
            } catch (err) {
              console.error("[EcosystemSection] desktop-reduced scene failed, falling back to static", err);
              applyStaticFallback();
              return undefined;
            }
          }

          if (isReduced) {
            gsap.set(wings, { clipPath: "none", opacity: 1, x: 0 });
            gsap.set(".ecosystem__wing-rule", { scaleX: 1 });
            gsap.set(
              ".ecosystem__wing-numeral, .ecosystem__wing-name, .ecosystem__wing-designation, .ecosystem__wing-status, .ecosystem__wing-desc, .ecosystem__wing-link",
              { opacity: 1, y: 0 }
            );
            // R3.1 — finding 9 fix (HIGH): buildScene(true)'s intro-line
            // pre-hide now writes `opacity: 0` (see below — R3 added it
            // alongside the pre-existing `y` reset so the reduce entrance
            // has something to cross-fade from). gsap.matchMedia's revert
            // only restores properties a LOWER-priority matched branch
            // doesn't also touch, so crossing 1024px downward into this
            // branch left that opacity stuck at 0 forever — the intro line
            // for this and the Lab section was the only pair of elements
            // whose sub-1024 reset didn't already include `opacity`. Must
            // reset every key the desktop-reduced branch can set, not just
            // the pre-R3 subset.
            if (introLineRef.current) gsap.set(introLineRef.current, { y: "0%", opacity: 1 });
            gsap.set(rootRef.current, { "--gcl-rule-scale": 1 } as any);
            return undefined;
          }

          if (isMobile) {
            // Exactly the pre-R2 behavior — untouched.
            wings.forEach((wing) => {
              gsap.fromTo(
                wing,
                { clipPath: "inset(0 0 100% 0)" },
                {
                  clipPath: "inset(0 0 0% 0)",
                  duration: 0.9,
                  ease: "power3.inOut",
                  scrollTrigger: {
                    trigger: wing,
                    start: "top 82%",
                    once: true,
                  },
                }
              );
            });
            return undefined;
          }

          // R3 — one shared scene builder for both desktop policies: same
          // intro-line reveal, hairline draw, wing entrance/rule/content
          // sequencing, and D4 dim/restore behaviour. Under reduce the
          // wing entrance is a plain opacity fade (no clipPath/x) and the
          // hairline draws via --gcl-rule-opacity instead of
          // --gcl-rule-scale (see globals.css .chapter-mark::before).
          function buildScene(reduced: boolean) {
            // R3.2 — finding 7/LOW: scoped fresh per branch ACTIVATION
            // (not shared across the whole effect) so the drain below only
            // ever unbinds the listeners THIS buildScene call attached.
            // Previously this lived at the effect level and was only
            // drained at unmount, so every 1024px crossing back up re-ran
            // buildScene and bound four more focusin handlers that stayed
            // attached (inertly) below 1024px, accumulating one full set
            // per crossing.
            const focusCleanups: Array<() => void> = [];

            // D9 — the intro heading mask-reveals and the chapter-mark's
            // hairline draws (via the --gcl-rule-scale custom property —
            // see globals.css) as the header scrolls in, so that leading
            // stretch of the section isn't a dead scroll zone before the
            // first wing's own reveal threshold. R3 — under reduce the
            // line pre-hides with opacity alone (its reduce CSS twin) and
            // cross-fades in; the hairline fades via --gcl-rule-opacity.
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

            // R2 2.4 — each wing enters via a horizontal clip-path wipe
            // from alternating sides + a 60px translateX settle + a
            // hairline draw, with its content staggering in
            // (numeral → name → designation → status → description →
            // link, 80ms steps). R3 — under reduce the wing entrance is a
            // plain opacity cross-fade (no clipPath/x) and the rule
            // (pre-set to scaleX(1) via the reduce CSS block) fades its
            // opacity in instead of drawing; timeline positions (0 / 0.2 /
            // 0.35) and the once:true "top 82%" trigger are identical in
            // both policies.
            wings.forEach((wing, i) => {
              const fromLeft = i % 2 === 0;
              const content = wing.querySelectorAll<HTMLElement>(
                ".ecosystem__wing-numeral, .ecosystem__wing-name, .ecosystem__wing-designation, .ecosystem__wing-status, .ecosystem__wing-desc, .ecosystem__wing-link"
              );
              const rule = wing.querySelector<HTMLElement>(".ecosystem__wing-rule");

              const tl = gsap.timeline({
                scrollTrigger: {
                  trigger: wing,
                  start: "top 82%",
                  once: true,
                },
              });

              if (reduced) {
                tl.fromTo(wing, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power3.inOut" }, 0);
              } else {
                tl.fromTo(
                  wing,
                  {
                    clipPath: fromLeft ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)",
                    x: fromLeft ? -60 : 60,
                  },
                  { clipPath: "inset(0 0 0 0)", x: 0, duration: 0.9, ease: "power3.inOut" },
                  0
                );
              }

              if (rule) {
                if (reduced) {
                  // R3.1 — finding 11 fix (MEDIUM): opacity alone made this
                  // hairline "appear" rather than "resolve." Pairing it with
                  // a dim→lit colour interpolation (the second allowed
                  // channel — colour/luminance) gives the reduced path
                  // something the full-motion scaleX draw already implies:
                  // the rule brightening into its final state, not just
                  // fading up at constant brightness.
                  tl.fromTo(
                    rule,
                    { opacity: 0, backgroundColor: WING_RULE_DIM },
                    { opacity: 1, backgroundColor: WING_RULE_LIT, duration: 0.6, ease: "power2.out" },
                    0.2
                  );
                } else {
                  tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.out" }, 0.2);
                }
              }

              const [fromContent, toContent] = revealFromTo(
                reduced,
                { opacity: 0, y: 12 },
                { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.08 }
              );
              tl.fromTo(content, fromContent, toContent, 0.35);

              // R3.1 — finding 6 fix (HIGH): a keyboard user can Tab
              // straight to this wing's link before its once:true
              // ScrollTrigger has ever fired — the browser's native
              // scroll-into-view on focus jumps scrollY directly to the
              // target rather than crossing the trigger's "top 82%" band as
              // a continuous scroll, so the entrance timeline never plays
              // and the focused link sits at opacity 0 (and under 1.4.11 —
              // finding 5 — used to sit under a fully-transparent focus
              // ring too). Forcing the timeline to its end state the
              // instant ANY descendant receives focus guarantees a focused
              // element is always visible, independent of scroll history,
              // in both policies. once:true on the ScrollTrigger already
              // guards against double-firing if the natural trigger fires
              // after this — tl is already at progress 1, so that's a
              // no-op play.
              const onWingFocusIn = () => {
                if (tl.progress() < 1) tl.progress(1);
              };
              wing.addEventListener("focusin", onWingFocusIn);
              focusCleanups.push(() => wing.removeEventListener("focusin", onWingFocusIn));
            });

            // D4 — the "previous wing recedes as the next opens" depth
            // cue is now bidirectional and lives OUTSIDE the once:true
            // entrance timelines above (which only ever fire forward): a
            // dedicated ScrollTrigger per wing boundary dims the wing
            // BEFORE it to 0.5 the moment this wing becomes current
            // (onEnter), and restores it to full opacity the moment the
            // visitor scrolls back up past that boundary (onLeaveBack) —
            // so scrolling all the way down and back up always leaves
            // every wing at full contrast again, never stuck dimmed.
            // R3.1 — finding 5 fix (HIGH): the reduced target is now
            // REDUCED_WING_DIM_OPACITY (0.82, contrast-floor verified — see
            // its definition above), not the full-motion 0.5; full-motion
            // is unchanged.
            //
            // R3.2 — root-cause fix, replacing the previous wave's
            // gsap.delayedCall(0, …) deferral (which only dodged the crash
            // by luck of timing and, per the second adversarial review,
            // could itself land inside a later refresh and cascade). The
            // actual defect: a bare ScrollTrigger.create() (no animation
            // attached) refreshes SYNCHRONOUSLY the instant it's created —
            // same immediate-refresh path as a plain gsap.fromTo/to with an
            // inlined scrollTrigger (see the full mechanism in lib/gsap.ts
            // on scrollTimeline). Hosting each boundary trigger in an
            // (otherwise-empty) Timeline via scrollTimeline — the
            // onEnter/onLeaveBack callbacks are ScrollTrigger-level either
            // way, so behavior is identical — takes GSAP's deferred-refresh
            // path instead, so this loop is now safe to build synchronously,
            // inline, in the same matchMedia callback as everything else.
            wings.forEach((wing, i) => {
              if (i === 0) return;
              scrollTimeline({
                trigger: wing,
                start: "top 82%",
                onEnter: () =>
                  gsap.to(wings[i - 1], {
                    opacity: reduced ? REDUCED_WING_DIM_OPACITY : 0.5,
                    duration: 0.6,
                    ease: "power2.out",
                    overwrite: "auto",
                  }),
                onLeaveBack: () =>
                  gsap.to(wings[i - 1], {
                    opacity: 1,
                    duration: 0.6,
                    ease: "power2.out",
                    overwrite: "auto",
                  }),
              });
            });

            // R3.2 — finding 7/LOW: drain THIS branch's focusin listeners
            // when the branch itself deactivates (matchMedia crossing, in
            // either direction, or unmount via ctx.revert()) — not only at
            // effect unmount. gsap.matchMedia invokes a branch's returned
            // function on both events, matching the pattern MissionSection
            // already uses for its own per-branch cleanup.
            return () => {
              focusCleanups.forEach((cleanup) => cleanup());
            };
          }

          if (isDesktop) {
            // R3.1 — finding 1 fix (BLOCKER): same belt-and-braces as the
            // desktop-reduced branch above — a cinematic layer must never
            // be able to remove all page content, in either policy.
            try {
              return buildScene(false);
            } catch (err) {
              console.error("[EcosystemSection] desktop scene failed, falling back to static", err);
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
    <section id="ecosystem" ref={rootRef} className="ecosystem" aria-labelledby="ecosystem-heading">
      <div className="container ecosystem__header">
        <p className="chapter-mark">{ecosystem.chapterMark}</p>
        <h2 id="ecosystem-heading" className="ecosystem__intro">
          <span className="ecosystem__intro-mask">
            <span ref={introLineRef} className="ecosystem__intro-line">
              {ecosystem.intro}
            </span>
          </span>
        </h2>
      </div>

      <div>
        {ecosystem.domains.map((domain, i) => (
          <article
            key={domain.name}
            className={`ecosystem__wing${WING_VARIANTS[i % WING_VARIANTS.length] ? ` ecosystem__wing--${WING_VARIANTS[i % WING_VARIANTS.length]}` : ""}`}
          >
            <span className="ecosystem__wing-rule" aria-hidden="true" />
            <div className="container">
              <div className="ecosystem__wing-top">
                <span className="ecosystem__wing-numeral">{domain.numeral}</span>
                <h3 className="ecosystem__wing-name">{domain.name}</h3>
              </div>
              <p className="ecosystem__wing-designation">{domain.designation}</p>
              <p className="ecosystem__wing-status">{domain.status}</p>
              <p className="ecosystem__wing-desc">{domain.description}</p>
              {domain.link ? (
                <a
                  className="ecosystem__wing-link"
                  href={domain.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {domain.link.label}
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
