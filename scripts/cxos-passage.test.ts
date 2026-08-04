// Run: npx tsx scripts/cxos-passage.test.ts
//
// SOURCE-LEVEL guard for CXOS Phase 5.1 — THE PASSAGE (Mission Control →
// Arena review journey). Labelled as such; the behavioural evidence is the
// Playwright pass in the Phase 5.1 report.
//
// WHAT THIS HOLDS
//  1. Production hard-off: the route gates through reviewBuildAllowed().
//  2. Review isolation: fixtures only — no prisma/fetch/session/reputation
//     write surface anywhere in the passage components.
//  3. Honesty: no invented numbers (standing renders fixture properties,
//     never literals), the clearance evidence line branches on the record,
//     data-error fails closed to the EMPTY record, the competition
//     threshold is PLANNED with no live branch, milestones absent = absent.
//  4. The SYNTHETIC label: unconditional in both settled environments AND
//     inside the overlay outside every beat conditional (minimized, never
//     removed).
//  5. Two-phase escape: call/clearance CANCEL to origin; passage onward
//     settles forward. Wheel/touch are passive skip intent — never a
//     hijack; no preventDefault, no scroll lock, no history mutation, and
//     every programmatic scroll is explicitly instant (the base
//     stylesheet's scroll-behavior:smooth must never drive a settle).
//  6. Containment: both environments are inert while the honest non-modal
//     review dialog plays (Director remains deliberately operable), focus
//     moves to the destination heading BEFORE the overlay unmounts, and
//     cancel returns focus to the activation control.
//  7. Environment replacement: the two rooms render mutually exclusively
//     under the cinematic tiers; the swap happens behind the opaque veil
//     at the threshold beat; the overlay's final frame and the floor's
//     establishing view share the same geometry (the match cut).
//  8. Safety ordering, NUMERIC: journey end < JS watchdog < pure-CSS
//     safety; first ≤ 12 s (the ratified first-entry ceiling), returning
//     ≤ 1.5 s; the CSS literal mirrors the timeline constant.
//  9. Tier law: only A/B stamp html[data-cxpassage]; the depth scaffold
//     and every --cxs rule are scoped under the stamp; reduced motion has
//     the belt-and-braces veil reset.
// 10. The semantic ledger covers every shipped element (with fallback
//     treatment); no session marker exists on this route at all — review
//     runs can never consume a real visitor's first entry (there is no
//     marker to consume; the live cx-mc/cx-arena keys are never touched).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolvePassageProjection,
  type PassageCapabilities,
} from "../components/cxos/passage/projection";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const journey = read("components/cxos/passage/PassageJourney.tsx");
const overlay = read("components/cxos/passage/PassageOverlay.tsx");
const origin = read("components/cxos/passage/MissionControlOrigin.tsx");
const floor = read("components/cxos/passage/ArenaFloor.tsx");
const tray = read("components/cxos/passage/PassageTray.tsx");
const projection = read("components/cxos/passage/projection.ts");
const fixtures = read("components/cxos/passage/fixtures.ts");
const timeline = read("lib/cxos/passageTimeline.ts");
const ledger = read("lib/cxos/passageLedger.ts");
const page = read("app/review/mission-control-to-arena/page.tsx");
// The shipped Arena entry: Phase 5.1 moved its technical clearance line
// behind the director instruments, so its ceremonial copy is now this
// guard's business too.
const entry = read("components/cxos/arena/ArenaEntry.tsx");
// Comment-stripped view: a copy BAN must test rendered code, never the
// comment that explains the ban (the recurring house hazard).
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const entryCode = stripComments(entry);
const css = read("app/globals.css");

// The component bundle: everything that renders — fixtures.ts is the ONE
// place standing literals are permitted.
const bundle = journey + overlay + origin + floor + tray + projection;

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

// ── 1 · production hard-off + review isolation ──────────────────────────────
check("the route gates through reviewBuildAllowed() with the not-enabled fallback",
  /reviewBuildAllowed\(\)/.test(page) && /Founder Review is not enabled in this build\./.test(page));
check("fixtures only: no prisma / fetch / session surface in any passage component",
  // call forms only — prose comments legitimately name these concepts
  !/prisma\.|\bfetch\(|getServerSession\(|currentUser\(|currentAccount\(/.test(bundle));
check("no reputation WRITE surface reachable from the passage",
  !/awardXp|recordAward|appendAward|reputation\/service|reputation\/repository/.test(bundle) &&
  !/from "@\/lib\/reputation/.test(bundle));
check("the only arena-library import is the read-only policy re-export",
  !/from "@\/lib\/arena\/(?!policy")/.test(bundle) && /REFUSED_V1/.test(floor));
check("no session/local storage WRITE exists anywhere on this route (no marker to consume)",
  !/sessionStorage\.setItem|localStorage\.setItem|sessionStorage\.getItem|localStorage\.getItem/.test(bundle));
{
  const desktop: PassageCapabilities = {
    autoTier: "A",
    browserReduced: false,
    applicationEffectsOff: false,
    saveData: false,
    lowMemory: false,
    mobile: false,
    coarsePointer: false,
    detectionFailed: false,
  };
  const withCaps = (
    patch: Partial<PassageCapabilities>
  ): PassageCapabilities => ({ ...desktop, ...patch });
  const tierFor = (
    requested: "auto" | "cinematic" | "static",
    patch: Partial<PassageCapabilities> = {}
  ) => resolvePassageProjection(requested, withCaps(patch));

  check("projection resolver: Auto preserves A/B/D/C capability truth",
    tierFor("auto").tier === "A" &&
    tierFor("auto", { autoTier: "B", mobile: true }).tier === "B" &&
    tierFor("auto", { autoTier: "D", browserReduced: true }).tier === "D" &&
    tierFor("auto", { autoTier: "D", applicationEffectsOff: true }).tier === "D" &&
    tierFor("auto", { autoTier: "C", saveData: true }).tier === "C" &&
    tierFor("auto", { autoTier: "C", lowMemory: true }).tier === "C" &&
    tierFor("auto", { autoTier: "C", detectionFailed: true }).tier === "C");
  check("projection resolver: Static is always D",
    ["A", "B", "C", "D"].every((autoTier) =>
      tierFor("static", { autoTier: autoTier as PassageCapabilities["autoTier"] }).tier === "D"
    ));
  check("projection resolver: Cinematic is A desktop, B mobile/coarse, and may override effects-off",
    tierFor("cinematic").tier === "A" &&
    tierFor("cinematic", { mobile: true }).tier === "B" &&
    tierFor("cinematic", { coarsePointer: true }).tier === "B" &&
    tierFor("cinematic", { applicationEffectsOff: true, autoTier: "D" }).tier === "A");
  check("projection resolver: Cinematic never upgrades constrained conditions",
    [
      tierFor("cinematic", { saveData: true, autoTier: "C" }),
      tierFor("cinematic", { lowMemory: true, autoTier: "C" }),
      tierFor("cinematic", { detectionFailed: true, autoTier: "C" }),
    ].every((result) =>
      result.tier === "C" && result.cinematicAvailable === false
    ));
}

// ── 2 · honesty ──────────────────────────────────────────────────────────────
check("no random or clock-derived numbers anywhere in the passage",
  !/Math\.random|Date\.now|new Date\(/.test(bundle));
check("no standing literal outside the fixtures module",
  !/totalXp: \d/.test(bundle) && !/\d+ lifetime XP/.test(bundle) && !/Level \d/.test(bundle));

// ── 2b · Phase 5.2 · the typography law (the release blocker) ───────────────
check("exactly ONE in-world stencil exists — a stack cannot collide",
  (overlay.match(/className="cx-p-stencil"/g) ?? []).length === 1 &&
  !/cx-p-st-1|cx-p-st-2|cx-p-st-3/.test(overlay + css));
{
  // Read the WHOLE rule body — a fixed-length window silently stopped short
  // of the mutated line and let the nowrap regression through (recorded).
  const ruleBody = (sel: string) => {
    const i = css.indexOf(sel + " {");
    if (i === -1) return "";
    const open = css.indexOf("{", i);
    const close = css.indexOf("}", open);
    return css.slice(open, close + 1);
  };
  const stencil = ruleBody(".cx-p-stencil");
  check("in-flight type is fluid and WRAPS instead of overflowing",
    /font-size: clamp\(/.test(stencil) &&
    /letter-spacing: clamp\(/.test(stencil) &&
    // wrapping is required POSITIVELY, and nowrap is banned outright
    /overflow-wrap: break-word/.test(stencil) && /text-wrap: balance/.test(stencil) &&
    !/white-space:\s*nowrap/.test(stencil) &&
    /width: min\(80vw/.test(stencil) &&
    /font-size: clamp\(/.test(ruleBody(".cx-p-greet")) &&
    /font-size: clamp\(/.test(ruleBody(".cx-p-engraved")));
  check("even the SCALED exit frame fits the narrowest viewport",
    // 80vw × 1.14 = 91vw — the measured clip at 320 px cannot recur
    /scale\(1\.14\)/.test(css) && !/scale\(1\.22\)/.test(css));
}
check("the arrival register is FLOW layout — overlap is impossible by construction",
  floor.includes("cx-p-reg relative mt-8 w-full max-w-sm space-y-2 font-mono") &&
  !/cx-p-reg[\s\S]{0,200}position: absolute/.test(css));
check("the register reserves its final plinth before reveal (no arrival CLS)",
  /cx-p-reg-pending/.test(floor) &&
  /\.cx-p-reg \{[\s\S]{0,120}min-height: 11\.75rem/.test(css) &&
  /\.cx-p-reg-pending \{[\s\S]{0,100}visibility: hidden/.test(css));
check("the register is staggered slowly (≥600 ms apart, ≥0.9 s each)",
  /html\[data-cxpassage\] \.cx-p-reg-1,[\s\S]{0,260}animation: cx-p-regk 0\.9s/.test(css) &&
  /html\[data-cxpassage\] \.cx-p-reg-2 \{ animation-delay: 0\.95s; \}/.test(css) &&
  /html\[data-cxpassage\] \.cx-p-reg-5 \{ animation-delay: 3\.15s; \}/.test(css));
check("the static/fallback narrative includes the complete recognition register",
  /const showRegister = arrived \|\| !cinematic;/.test(floor) &&
  /\{showRegister && \(/.test(floor));
check("the greeting and floor render fixture properties, never constants",
  // Phase 5.2: the overlay speaks only the operator's name; every figure
  // is rendered by the floor, from the fixture record.
  /r\.displayName/.test(overlay) && /r\.totalXp/.test(floor) && /r\.rank/.test(floor) &&
  /r\.level/.test(floor) && /r\.awardCount/.test(floor));
// Phase 5.2 · the arrival register replaced the in-flight caption stack:
// the room reads the record on the SETTLED floor, in flow, and every line
// states only what is true for the state that shows it.
check("the arrival register branches every line on the record",
  /label="CLEARANCE" value="verified"/.test(floor) &&
  /fx\.key === "data-error" \? "fail-safe" : `\$\{r\.rank\} · level \$\{r\.level\}`/.test(floor) &&
  /r\.awardCount > 0\s*\?\s*`\$\{r\.awardCount\} accepted`\s*:\s*"none on record"/.test(floor) &&
  /fx\.key === "data-error" \? "unavailable" : `\$\{r\.totalXp\} XP loaded`/.test(floor));
check("the register is spoken exactly as it is rendered (one source, both channels)",
  /function registerSpeech/.test(journey) && /say\(registerSpeech\(fx\)\)/.test(journey) &&
  /Evidence unavailable\. Lifetime record unavailable\./.test(journey));
check("a failed record read is NEVER told it was located (product + review)",
  // the live entry states only what the server proved — the gate passed
  !/Record located\./.test(entryCode) && /Clearance confirmed\./.test(entryCode) &&
  // no surface anywhere claims a located record
  !/Record located\./.test(stripComments(overlay)) &&
  /record unavailable — fail-safe standing shown/.test(origin));
check("data-error fails closed to the EMPTY record — never a stale or invented standing",
  /case "data-error":[\s\S]{0,600}record: EMPTY_RECORD/.test(fixtures));
check("fixture standing is curve-consistent (the engine's own arithmetic, documented)",
  /25·n·\(n−1\)/.test(fixtures) && /level: 6,\s*\n\s*totalXp: 820/.test(fixtures) &&
  /rank: "recruit",\s*\n\s*level: 1,\s*\n\s*totalXp: 0/.test(fixtures));
check("the competition threshold is PLANNED with no live branch",
  /PLANNED/.test(floor) && /REFUSED_V1\.includes\("seasons"\)/.test(floor) &&
  !/status === "LIVE"|isLive|open === true/.test(floor));
check("milestones: absence renders absence, never placeholder seals",
  /badges\.length > 0 \?/.test(floor) && /Nothing earned yet/.test(floor));
check("no gamification-noise vocabulary anywhere in the passage",
  !/\bstars?\b|star rating|popularity|upvote|like count|leaderboard/i.test(bundle));
check("no ceremony exists for a state the gate refuses — instruments included",
  // beginJourney, jumpTo and scrub each honor fx.access, so no director
  // instrument can conjure a journey (or the floor) for flag-off /
  // outside-cohort fixtures whose origin wall correctly shows no call.
  (journey.match(/if \(!fx\.access\) return;/g) ?? []).length >= 2 &&
  /if \(!fx\.access \|\| !cinematic\) return;/.test(journey));
check("no teaser for the ungated: honest absence, no upsell vocabulary",
  /fx\.access \? \(/.test(origin) &&
  !/\blocked\b|Upgrade to enter|Unlock the Arena|join the waitlist/i.test(stripComments(origin)));

// ── 3 · the SYNTHETIC label law ──────────────────────────────────────────────
check("both settled environments carry the unconditional SYNTHETIC banner",
  /SYNTHETIC REVIEW DATA/.test(origin) && /SYNTHETIC REVIEW DATA/.test(floor));
check("the overlay's minimized SYNTHETIC tab exists OUTSIDE every beat conditional",
  /className="cx-p-tab/.test(overlay) &&
  !/&&\s*\(?\s*<span className="cx-p-tab/.test(overlay) &&
  /OUTSIDE every beat conditional/.test(overlay));

// ── 4 · two-phase escape + interaction law ───────────────────────────────────
check("CANCEL_PHASES is exactly call + clearance",
  /CANCEL_PHASES[\s\S]{0,120}=\s*\["call", "clearance"\]/.test(timeline));
check("skip() branches: cancel before departure, forward after",
  /CANCEL_PHASES\.includes\(p\)\) settleCancel\(\);\s*else settleForward\(true, staticDestination\)/.test(journey));
check("Escape always skips; Space/PageDown only off a control; wheel/touch PASSIVE",
  /if \(e\.key === "Escape"\) return skip\(\);/.test(journey) &&
  /e\.key === " " \|\| e\.key === "PageDown"\) && !onControl/.test(journey) &&
  /closest\("button, a, input, select, textarea, \[tabindex\]"\)/.test(journey) &&
  /addEventListener\("wheel", onWheel, \{ passive: true \}\)/.test(journey) &&
  /addEventListener\("touchmove", onTouch, \{ passive: true \}\)/.test(journey));
check("scroll input is skip intent ONLY when the director tray is closed",
  (journey.match(/if \(!trayOpenRef\.current\) skip\(\);/g) ?? []).length === 2 &&
  /if \(trayOpenRef\.current\) return;/.test(journey));
check("no preventDefault, no scroll lock, no history mutation anywhere in the passage",
  !/\.preventDefault\(\)/.test(bundle) &&
  !/documentElement\.style\.overflow|body\.style\.overflow/.test(bundle) &&
  !/pushState|replaceState/.test(bundle));
check("every programmatic scroll is explicitly instant (smooth CSS can never drive a settle)",
  /scrollTo\(\{\s*top: 0,\s*behavior: "instant"/.test(journey) &&
  !/scrollTo\(\s*\d/.test(bundle) &&
  (() => {
    const calls = bundle.match(/scrollIntoView\(\{[\s\S]{0,180}?\}\)/g) ?? [];
    return calls.length >= 2 &&
      calls.every((call) => /behavior:\s*"instant"/.test(call));
  })());
{
  // Double activation cannot stack journeys, and the ONE deliberate replace
  // path (a director restart) must disarm the replaced run's timers before
  // arming its own — a guard-return that skipped clearTimers left ghost
  // timers that later teleported the page (adversarial review finding).
  const bj = journey.slice(journey.indexOf("const beginJourney"), journey.indexOf("const beginReturn"));
  const guardIdx = bj.indexOf("if (!restart && CINEMATIC.has(phaseRef.current)) return;");
  const clearIdx = bj.indexOf("clearTimers();");
  check("double activation cannot stack journeys (restart replaces, never overlaps)",
    guardIdx !== -1 && clearIdx !== -1 && guardIdx < clearIdx &&
    /if \(CINEMATIC\.has\(phaseRef\.current\)\) return;/.test(journey.slice(journey.indexOf("const beginReturn"))));
  check("every fresh run remounts the overlay so its animation clock starts at zero",
    /setRunNonce\(\(n\) => n \+ 1\)/.test(bj) && /key=\{runNonce\}/.test(journey));
}

// ── 5 · containment + focus ──────────────────────────────────────────────────
check("the overlay is an honest non-modal review dialog naming cancel vs skip",
  /role="dialog"/.test(overlay) && !/aria-modal=/.test(overlay) &&
  /Press Escape to cancel and remain in Mission Control\./.test(overlay) &&
  /Press Escape to skip to the Arena threshold\./.test(overlay));
check("both environments are inert while the overlay plays, cleared on every settle",
  /setAttribute\("inert", ""\)/.test(journey) && /removeAttribute\("inert"\)/.test(journey));
check("focus lands on the destination heading BEFORE the overlay unmounts",
  /h\.focus\(\{ preventScroll: true \}\);\s*\}\s*setPhase\("floor"\);/.test(journey));
check("cancel returns focus to the activation control",
  /\[data-cxp-proceed\]/.test(journey) && /data-cxp-proceed/.test(origin));
check("the skip control is autofocused and the veil itself skips on click",
  /autoFocus/.test(overlay) && /onClick=\{onSkip\}/.test(overlay));

// ── 6 · environment replacement (the arrival is REAL, not an overlay trick) ──
check("the two rooms render mutually exclusively under the cinematic tiers",
  /cinematic && env !== "mc" \? \{ display: "none" \}/.test(journey) &&
  /cinematic && env !== "arena" \? \{ display: "none" \}/.test(journey));
check("the environment swap happens behind the opaque veil at the threshold beat",
  /if \(b\.phase === "threshold"\)[\s\S]{0,400}swapEnv\("arena"\)/.test(journey));
check("the match cut: the overlay's final frame and the floor share the establishing geometry",
  /cx-p-est-ring/.test(overlay) && /cx-p-est-ring/.test(floor));

// ── 7 · tier law + reduced motion + safety ordering ─────────────────────────
check("only tiers A/B stamp the document; C/D never mount the cinema",
  /const cinematic = tier === "A" \|\| tier === "B";/.test(journey) &&
  /if \(tier === "A" \|\| tier === "B"\)[\s\S]{0,140}setAttribute\("data-cxpassage", tier\)/.test(journey) &&
  /const overlayActive = cinematic && CINEMATIC\.has\(phase\);/.test(journey));
check("reduced motion remains static unless this review root has explicit Cinematic",
  /:where\(\.cx-p-review:not\(\[data-cxp-cinematic\]\)\) \.cx-p-veil/.test(css) &&
  /animation: none !important;\s*\n\s*display: none !important;/.test(css) &&
  /data-cxp-cinematic=\{[\s\S]{0,120}projection === "cinematic" && cinematic/.test(journey) &&
  !/html\[data-cxp-cinematic\]/.test(css));
check("projection state begins Auto, stores no consent, and never autoplays on confirmation",
  /useState<PassageProjection>\("auto"\)/.test(journey) &&
  !/sessionStorage|document\.cookie|sendBeacon|XMLHttpRequest/.test(stripComments(bundle)) &&
  !/fetch\(/.test(bundle) &&
  (() => {
    const start = journey.indexOf("const confirmReducedCinematic");
    const end = journey.indexOf("const cancelProjectionPrompt", start);
    const confirm = journey.slice(start, end);
    return start !== -1 && end !== -1 && !/beginJourney/.test(confirm);
  })());
check("reduced Cinematic is pending until explicit confirmation",
  /if \(latest\.browserReduced\) \{\s*\n\s*setProjectionPrompt\("reduced"\)/.test(journey) &&
  /commitProjection\(\s*\n\s*"cinematic",\s*\n\s*latest\.browserReduced/.test(journey) &&
  /projectionPrompt === "reduced"/.test(tray));
check("the reduced-motion warning is exact, inline, and uses the single Journey live region",
  /Your browser requests reduced motion\. Cinematic will\s+animate this synthetic review only and does not change\s+your system setting\./.test(tray) &&
  /Play Cinematic for this review/.test(tray) &&
  /Keep Reduced Motion \/ Static/.test(tray) &&
  (journey.match(/aria-live="polite"/g) ?? []).length === 1 &&
  !/role="alert"|aria-modal/.test(tray));
check("Browser preference and Review projection are disclosed separately",
  /Browser preference:/.test(tray) && /Review projection:/.test(tray) &&
  /Application effects:/.test(tray));
check("projection buttons are 44 px, non-color-only, and locked by raw cinematic phase",
  /min-h-\[44px\]/.test(tray) &&
  /aria-pressed=\{active\}/.test(tray) &&
  /\{active && <span aria-hidden>▸ <\/span>\}/.test(tray) &&
  /capabilities === null \|\| CINEMATIC\.has\(phase\)/.test(journey) &&
  /disabled=\{\s*\n\s*projectionLocked \|\| projectionPrompt !== null/.test(tray));
check("an OS reduced-motion flip revokes the scoped override and requires fresh confirmation",
  /mainRef\.current\?\.removeAttribute\("data-cxp-cinematic"\)/.test(journey) &&
  /projectionRef\.current = "auto"/.test(journey) &&
  /setProjectionPrompt\("reduced"\)/.test(journey) &&
  /reduced\.removeEventListener\?\.\("change", onReduced\)/.test(journey));
check("removing reduced motion clears stale consent UI and resets Auto before the static floor is hidden",
  /current === "reduced" \? null : current/.test(journey) &&
  /browser no longer requests reduced motion[\s\S]{0,120}cinematic-capable Mission Control review/.test(journey));
check("Auto capability revocation preserves the two-phase law with a static Arena destination",
  /skipRef\.current\?\.\(true\)/.test(journey) &&
  /settleForward\(true, staticDestination\)/.test(journey) &&
  /#arena-floor[\s\S]{0,120}scrollIntoView/.test(journey));
check("settled Auto resets focus and scroll when reduced motion changes the document model",
  /browser now requests reduced motion[\s\S]{0,120}complete static review from Mission Control/.test(journey));
check("a removed inline confirmation restores focus to Cinematic when the tray remains open",
  /previousPromptRef/.test(tray) &&
  /previous !== null && projectionPrompt === null/.test(tray) &&
  /cinematicRef\.current\?\.focus/.test(tray));
check("unexplained Tier C is retained as a failed capability read",
  /detected === "C" && !saveData && !lowMemory/.test(projection) &&
  /detectionFailed,/.test(projection));
check("reduced-motion override revocation suppresses Mission Control quiet-state transitions",
  /:where\(\.cx-p-review:not\(\[data-cxp-cinematic\]\)\) :is\([\s\S]{0,320}\.cx-p-mc-panel[\s\S]{0,320}\.cx-p-call-ring[\s\S]{0,100}transition: none !important;/.test(css));
check("tray close/Escape cancels pending confirmation without persisting it",
  /if \(projectionPrompt\) onCancelCinematic\(\);/.test(tray) &&
  /if \(e\.key === "Escape"\)[\s\S]{0,80}close\(\)/.test(tray));
{
  // NUMERIC safety ordering — presence-first, then the arithmetic. A
  // watchdog re-armed to a useless value or a safety fade shorter than the
  // journey fails here, not in prose.
  const end = Number((timeline.match(/JOURNEY_END_MS = (\d+)/) ?? [])[1]);
  const endB = Number((timeline.match(/JOURNEY_END_MOBILE_MS = (\d+)/) ?? [])[1]);
  const ret = Number((timeline.match(/RETURNING_END_MS = (\d+)/) ?? [])[1]);
  const retj = Number((timeline.match(/RETURN_END_MS = (\d+)/) ?? [])[1]);
  const dog = Number((timeline.match(/WATCHDOG_MS = (\d+)/) ?? [])[1]);
  const safe = Number((timeline.match(/CSS_SAFETY_DELAY_S = (\d+)/) ?? [])[1]);
  check("timeline constants exist",
    [end, endB, ret, retj, dog, safe].every((n) => Number.isFinite(n) && n > 0));
  const compactTimeline = timeline.replace(/\s+/g, " ");
  check("the Phase 5.2 beat snapshot is numerically unchanged",
    [
      '{ phase: "call", at: 0 }',
      '{ phase: "clearance", at: 1000 }',
      '{ phase: "passage", at: 3400 }',
      '{ phase: "conversion", at: 5800 }',
      '{ phase: "threshold", at: 8000 }',
      '{ phase: "greeting", at: 10400 }',
      '{ phase: "clearance", at: 900 }',
      '{ phase: "passage", at: 3000 }',
      '{ phase: "conversion", at: 5200 }',
      '{ phase: "threshold", at: 7300 }',
      '{ phase: "greeting", at: 9000 }',
    ].every((beat) => compactTimeline.includes(beat)) &&
    end === 11800 && endB === 10600 && ret === 1400 &&
    retj === 1800 && dog === 14000 && safe === 18);
  check("first journey respects the ratified ≤ 12 s first-entry ceiling",
    end <= 12000 && end >= 7000);
  check("returning respects the house ≤ 1.5 s law; the return journey stays ≤ 2 s",
    ret <= 1500 && retj <= 2000);
  check("the mobile journey is shorter than the desktop journey",
    endB < end);
  // Phase 5.2: the Founder found the condensed run too fast to comprehend.
  check("the mobile journey was SLOWED, not just shortened (≥ 10 s)",
    endB >= 10000);
  check("safety ordering: journey end < JS watchdog < pure-CSS safety",
    end < dog && dog < safe * 1000 && retj < dog);
  check("the CSS safety literal mirrors the timeline constant",
    new RegExp(`cx-p-safety 0\\.5s ease ${safe}s forwards`).test(css));
  const cssDurMs = (className: string) => {
    const raw = (css.match(new RegExp(`\\.${className} \\{ --cxp-dur: ([\\d.]+)s; \\}`)) ?? [])[1];
    return Math.round(Number(raw) * 1000);
  };
  check("every CSS film duration mirrors its state-machine constant",
    cssDurMs("cx-p-run-a") === end &&
    cssDurMs("cx-p-run-b") === endB &&
    cssDurMs("cx-p-run-r") === ret &&
    cssDurMs("cx-p-run-ret") === retj);
}
check("the watchdog forces the truthful forward settle",
  /arm\(\(\) => \{\s*if \(CINEMATIC\.has\(phaseRef\.current\)\) settleForward\(\);\s*\}, WATCHDOG_MS\)/.test(journey));

// ── 8 · depth scaffold scoping (the no-JS document is the rest state) ────────
{
  // var(--cxs, 0.5) carries a fallback — never require the closing paren.
  const cxsRules = [...css.matchAll(/^[^\n{]*\{[^}]*var\(--cxs[^}]*\}/gm)];
  check("every --cxs choreography rule is scoped under html[data-cxpassage]",
    cxsRules.length > 0 && cxsRules.every((m) => /html\[data-cxpassage/.test(m[0].split("{")[0])));
  check("the station scaffold (min-height + sticky) exists ONLY under the stamp",
    /html\[data-cxpassage\] \.cx-p-station \{ min-height: 120vh; min-height: 120svh; \}/.test(css) &&
    /html\[data-cxpassage\] \.cx-p-stage \{\s*\n\s*position: sticky/.test(css) &&
    !/^\.cx-p-station \{ min-height/m.test(css));
  check("svh always carries a vh fallback (a pre-svh engine must not drop the scaffold)",
    /min-height: 120vh; min-height: 120svh;/.test(css) &&
    /min-height: 100vh; min-height: 100svh;/.test(css) &&
    /maxHeight: "60vh"/.test(tray) && /maxBlockSize: "60svh"/.test(tray));
  check("the floor root uses overflow-CLIP — overflow-hidden would kill sticky",
    /className="cx-p-arena relative isolate overflow-clip/.test(floor) &&
    !/cx-p-arena[^"]*overflow-hidden/.test(floor));
}
check("the station rAF is passive and hidden-tab aware",
  /addEventListener\("scroll", onScroll, \{ passive: true \}\)/.test(journey) &&
  /document\.hidden/.test(journey) &&
  /const measurements = stations\.map/.test(journey) &&
  /for \(const \{ el, p \} of measurements\)/.test(journey));
check("hidden documents pause ambient CSS only — never Passage safety/travel",
  /addEventListener\("visibilitychange", onVisibility\)/.test(journey) &&
  /removeEventListener\("visibilitychange", onVisibility\)/.test(journey) &&
  /data-cxp-hidden/.test(journey) &&
  /\.cx-p-review\[data-cxp-hidden\] :is\(/.test(css) &&
  (() => {
    const start = css.indexOf(".cx-p-review[data-cxp-hidden] :is(");
    const end = css.indexOf(") {", start);
    const paused = css.slice(start, end);
    return start !== -1 && end !== -1 &&
      /cx-p-live-core/.test(paused) &&
      /cx-p-floor-seal/.test(paused) &&
      !/cx-p-veil|cx-p-safety|cx-p-world/.test(paused);
  })());

// ── 9 · the semantic ledger (no row, no ship — with fallback treatment) ─────
{
  const elements = [
    "MC instrument wall", "MC command axis", "MC zone panels", "Arena call aperture",
    "Clearance stencils", "Passage rails", "Conversion arcs", "Threshold gate",
    "Chamber floor ring", "Standing core dais", "Evidence vault plaques",
    "Milestone gallery seals", "Sealed competition threshold", "Kai observation point",
    "Return line", "SYNTHETIC tab",
    // Phase 5.2 — the architectural cinematics
    "Mission Control ambient signals", "Mission Control power-down",
    "Departure aperture", "Distant arena light",
    "Floor separation", "Hallway light shafts", "Hallway motes", "Monument colonnade",
    "Arena floor seal", "Arrival register", "Living chamber atmosphere",
  ];
  check("the passage ledger covers every shipped element",
    elements.every((e) => ledger.includes(`"${e}"`)));
  check("every ledger row declares absence, reduced-motion AND fallback treatment",
    // quoted values only — the interface's field declarations don't count
    (ledger.match(/whenAbsent: "/g) ?? []).length === elements.length &&
    (ledger.match(/reducedMotion: "/g) ?? []).length === elements.length &&
    (ledger.match(/fallback: "/g) ?? []).length === elements.length);
}

// ── 10 · the director tray is mobile-safe and yields Escape correctly ────────
check("tray + skip control are safe-area aware",
  /env\(safe-area-inset-bottom\)/.test(tray) && /env\(safe-area-inset-bottom\)/.test(overlay));
check("the tray consumes Escape before the journey handler",
  /if \(trayOpenRef\.current\) return;/.test(journey) &&
  /addEventListener\("keydown", onKey, true\)/.test(tray));
check("the sheet contains its own scroll (no page bleed)",
  /overscrollBehavior: "contain"/.test(tray) && /60svh/.test(tray));
check("the technical clearance truth lives in the tray, not the ceremony",
  /TECHNICAL CLEARANCE/.test(tray) && /internal cohort/.test(tray) &&
  !/internal cohort/.test(overlay));

// ── 10b · Phase 5.2 · architectural cinematics ──────────────────────────────
check("Mission Control powers down when the Arena is called",
  /data-cxp-quiet=\{quiet \? "" : undefined\}/.test(origin) &&
  /quiet=\{\s*overlayActive && env === "mc" && runKind !== "return"\s*\}/.test(journey) &&
  /\.cx-p-mc\[data-cxp-quiet\] \.cx-p-mc-panel/.test(css) &&
  /\.cx-p-mc\[data-cxp-quiet\] \.cx-p-mc-axis/.test(css) &&
  /\.cx-p-mc\[data-cxp-quiet\] \.cx-p-mc-signal/.test(css));
check("the architecture opens: floor separates, aperture forms, light is distant and LATE",
  /cx-p-split-l/.test(overlay) && /cx-p-split-r/.test(overlay) &&
  /className="cx-p-aperture"/.test(overlay) && /className="cx-p-farlight"/.test(overlay) &&
  // Cool architecture leads. Gold is withheld until the later hallway.
  /@keyframes cx-p-farlightk \{\s*\n\s*0%, 34% \{[^}]*opacity: 0;/.test(css) &&
  /@keyframes cx-p-shaftk \{\s*\n\s*0%, 36% \{[^}]*opacity: 0;/.test(css) &&
  /@keyframes cx-p-motesk \{\s*\n\s*0%, 38% \{[^}]*opacity: 0;/.test(css));
check("the Arena's atmosphere bleeds up the hallway before arrival",
  /className="cx-p-shafts"/.test(overlay) && /className="cx-p-motes"/.test(overlay));
check("cold activation is paint-contained and power-down animates no shadow",
  /\.cx-p-veil \{[\s\S]{0,360}contain: layout paint;[\s\S]{0,100}isolation: isolate;/.test(css) &&
  /\.cx-p-mc\[data-cxp-quiet\] \.cx-p-call-ring \{[\s\S]{0,140}transform: scale\(1\.035\)/.test(css) &&
  !/transition: box-shadow/.test(css));
check("the threshold is monumental: a colonnade recedes behind the establishing ring",
  /className="cx-p-colonnade"/.test(overlay) && /cx-p-colonnade/.test(floor));
{
  // Every ambient keyframe's BODY is extracted and tested: atmosphere may
  // only move transform and opacity, or it stops being free.
  const ambient = [
    "cx-p-callwakek",
    "cx-p-signallivek",
    "cx-p-horizonlivek",
    "cx-p-breathek",
    "cx-p-spink",
    "cx-p-shaftbreathek",
    "cx-p-floorsealink",
  ];
  const bodies = ambient.map((n) => {
    const i = css.indexOf(`@keyframes ${n} `);
    if (i === -1) return null;
    const open = css.indexOf("{", i);
    let depth = 0;
    for (let k = open; k < css.length; k++) {
      if (css[k] === "{") depth++;
      else if (css[k] === "}" && --depth === 0) return css.slice(open, k + 1);
    }
    return null;
  });
  const compositorOnly = bodies.every((body) => {
    if (body === null) return false;
    const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    return properties.length > 0 &&
      properties.every((property) =>
        property === "transform" || property === "opacity"
      );
  });
  check("the two rooms are alive — bounded, compositor-only, never JavaScript",
    // Only the establishing monument breathes/rotates. Offscreen evidence
    // geometry remains static and never animates data.
    (floor.match(/cx-p-live-core/g) ?? []).length === 1 &&
    // exact class token — cx-p-live-ring-slow contains the shorter name
    (floor.match(/cx-p-live-ring(?=["\s])/g) ?? []).length === 1 &&
    /cx-p-live-ring-slow/.test(floor) &&
    /cx-p-live-motes/.test(floor) && /cx-p-live-shafts/.test(floor) &&
    /cx-p-live-fog/.test(floor) && /cx-p-live-reflect/.test(floor) &&
    compositorOnly);
  check("ambient channel caps hold: Mission Control ≤3 and Arena ≤3",
    /animation: cx-p-callwakek 6\.4s[^;]*infinite/.test(css) &&
    /animation: cx-p-signallivek 7s[^;]*infinite/.test(css) &&
    /animation: cx-p-horizonlivek 24s[^;]*infinite/.test(css) &&
    /animation: cx-p-breathek 9s[^;]*infinite/.test(css) &&
    (css.match(/animation: cx-p-spink [^;]*infinite/g) ?? []).length === 2 &&
    /animation: cx-p-shaftbreathek 16s[^;]*infinite/.test(css) &&
    !/html\[data-cxpassage\] \.cx-p-live-motes/.test(css));
}
check("Arena ambient motion is genuinely slow (≥ 9 s; rings near-imperceptible)",
  /html\[data-cxpassage\] \.cx-p-live-core \{ animation: cx-p-breathek 9s/.test(css) &&
  /html\[data-cxpassage\] \.cx-p-live-ring \{ animation: cx-p-spink 240s/.test(css) &&
  /html\[data-cxpassage\] \.cx-p-live-ring-slow \{ animation: cx-p-spink 420s/.test(css) &&
  /html\[data-cxpassage\] \.cx-p-live-shafts \{[\s\S]{0,120}cx-p-shaftbreathek 16s/.test(css));
check("Arena arrival resolves the existing floor seal once, never as an ambient loop",
  /data-cxp-arrived=\{arrived \? "" : undefined\}/.test(floor) &&
  /html\[data-cxpassage\] \.cx-p-arena\[data-cxp-arrived\] \.cx-p-floor-seal/.test(css) &&
  /animation: cx-p-floorsealink 1\.7s/.test(css) &&
  /cx-p-floor-seal[\s\S]{0,240}animation: none !important/.test(css));
check("Tier C/D and no-JS keep the settled room static by default",
  /html\[data-cxpassage\] \.cx-p-call-ring \{[\s\S]{0,120}animation: cx-p-callwakek/.test(css) &&
  /html\[data-cxpassage\] \.cx-p-reg-1/.test(css) &&
  /html\[data-cxpassage\] \.cx-p-live-shafts \{[\s\S]{0,120}animation: cx-p-shaftbreathek/.test(css) &&
  !/^\.cx-p-live-core \{[^}]*animation:/m.test(css) &&
  !/^\.cx-p-live-ring \{[^}]*animation:/m.test(css));
check("scroll advances a camera through real depth, per tier",
  /html\[data-cxpassage\] \.cx-p-stage \{ perspective: 1100px; \}/.test(css) &&
  /html\[data-cxpassage="A"\] \.cx-p-depth \{[\s\S]{0,300}translate3d\([\s\S]{0,200}clamp\(-190px/.test(css) &&
  /html\[data-cxpassage="B"\] \.cx-p-depth/.test(css));
check("every Phase 5.2 element carries a ledger row",
  ["Mission Control ambient signals", "Mission Control power-down",
   "Departure aperture", "Distant arena light",
   "Floor separation", "Hallway light shafts", "Hallway motes", "Monument colonnade",
   "Arena floor seal", "Arrival register", "Living chamber atmosphere"].every((e) => ledger.includes(`"${e}"`)));

// ── 11 · laws established by the post-implementation adversarial review ─────
check("a held inspection can always be resumed: resume re-arms settle AND watchdog",
  /const resumeRun = useCallback/.test(journey) &&
  /arm\(\(\) => settleForward\(\), Math\.max\(120, end - from\)\)/.test(journey) &&
  /onResume=\{resumeRun\}/.test(journey));
check("every held beat re-arms the JS watchdog (the CSS fade is never the only exit)",
  (journey.match(/if \(CINEMATIC\.has\(phaseRef\.current\)\) settleForward\(\);\s*\}, WATCHDOG_MS\)/g) ?? []).length >= 3);
check("the veil's OWN safety fade pauses with the world during inspection",
  /\.cx-p-veil\[data-cxp-paused\],\s*\n\.cx-p-veil\[data-cxp-paused\] \* \{ animation-play-state: paused !important; \}/.test(css));
check("the environment scroll runs in a LAYOUT effect — never a post-paint frame",
  /useLayoutEffect\(\(\) => \{[\s\S]{0,600}window\.scrollTo\(\{ top: 0, behavior: "instant"/.test(journey));
check("the footer is inerted with the environments (no operable control under the veil)",
  /footerRef/.test(journey) &&
  /for \(const el of \[o, f, ft\]\)/.test(journey) &&
  /className="mt-16 px-6 pb-24[\s\S]{0,160}sm:mt-0 sm:pb-10"/.test(journey));
check("a mid-journey reduced-motion flip settles instead of stranding an invisible modal",
  /matchMedia\(\s*"\(prefers-reduced-motion: reduce\)"/.test(journey) &&
  /skipRef\.current\?\.\(true\)/.test(journey) &&
  /resetReviewToOrigin\(/.test(journey));
check("Tier C/D Director instruments cannot start an invisible journey",
  (() => {
    const begin = journey.slice(journey.indexOf("const beginJourney"), journey.indexOf("const beginReturn"));
    const ret = journey.slice(journey.indexOf("const beginReturn"), journey.indexOf("// ── two-phase skip"));
    const scrubSource = journey.slice(journey.indexOf("const scrub"), journey.indexOf("const resumeRun"));
    return /if \(!cinematic\) return;/.test(begin) &&
      /if \(!cinematic\) return;/.test(ret) &&
      /!fx\.access \|\| !cinematic/.test(scrubSource);
  })());
check("identical announcements still reach the live region on every repeat",
  /announceFlipRef\.current = !announceFlipRef\.current/.test(journey) &&
  /announceFlipRef\.current \?/.test(journey) && /role="status"/.test(journey));
check("the natural journey end does not stomp the greeting announcement",
  /settleForward\(false\), end\)/.test(journey) && /if \(announceArrival\) say\(/.test(journey));
check("director instruments never steal focus from the open tray",
  (journey.match(/const keepTray = trayOpenRef\.current;/g) ?? []).length >= 4 &&
  /takeFocus=\{!trayOpenRef\.current\}/.test(journey) && /autoFocus=\{takeFocus\}/.test(overlay));
check("cancel has a focus target even when the call does not exist",
  /\[data-cxp-proceed\]"\) \?\?\s*\n\s*document\.querySelector<HTMLElement>\("\.cx-p-mc h1"\)/.test(journey));
check("closing the tray returns focus to its pill, never to body",
  /const close = useCallback\(\(\) => \{[\s\S]{0,140}setOpen\(false\);[\s\S]{0,80}pillRef\.current\?\.focus/.test(tray));
check("the condensed mobile run gets its own readable windows",
  /\.cx-p-run-b \.cx-p-stencil \{ animation-name: cx-p-stk-b; \}/.test(css) &&
  /\.cx-p-run-b \.cx-p-g-1 \{ animation-name: cx-p-g1k-b; \}/.test(css) &&
  /@keyframes cx-p-stk-b/.test(css));
check("active tray controls are never distinguished by colour alone",
  /ring-1 ring-amber-400\/40/.test(tray) && /\{active && <span aria-hidden>▸ <\/span>\}/.test(tray));

// ── 12 · RC accessibility + fallback laws ──────────────────────────────────
check("settled assistive speech always closes over the current fixture",
  /const fx = useMemo\(\(\) => passageFixture\(fxKey\), \[fxKey\]\)/.test(journey) &&
  /\}, \[fx, swapEnv, liftInert, say\]\);/.test(journey));
check("every forward settle reasserts the Arena threshold after native input",
  (journey.match(/window\.scrollTo\(\{\s*top: 0,\s*behavior: "instant"/g) ?? []).length >= 2 &&
  /#arena-floor"\)\?\.scrollIntoView\(\{[\s\S]{0,120}behavior: "instant"/.test(journey) &&
  /Native wheel\/touch\/PageDown default/.test(journey));
check("the global skip target and both fallback fragment paths have focus destinations",
  /id="main"[\s\S]{0,80}tabIndex=\{-1\}/.test(journey) &&
  /href="#arena-floor"[\s\S]{0,520}#arena-floor h1/.test(origin) &&
  /href="#main"[\s\S]{0,520}\.cx-p-mc h1/.test(floor));
check("a short coarse-pointer phone stays on the single-plane projection",
  /max-height: 560px\) and \(pointer: coarse\)/.test(projection) &&
  /detected === "A" && coarseShort \? "B" : detected/.test(projection));
check("review honesty is visually concise and fully exposed to assistive tech",
  (origin.match(/<span className="sr-only">SYNTHETIC REVIEW DATA/g) ?? []).length === 1 &&
  (floor.match(/<span className="sr-only">SYNTHETIC REVIEW DATA/g) ?? []).length === 1);
check("primary passage controls meet the 44 px target",
  /cx-p-proceed[\s\S]{0,180}min-height: 2\.75rem/.test(origin + css) &&
  /min-h-11 min-w-11/.test(overlay) &&
  /cx-p-traypill[\s\S]{0,180}min-h-11/.test(tray));
check("Arena atmosphere is viewport-bound, not animated across the long document",
  /cx-p-ar-ground pointer-events-none fixed inset-0/.test(floor) &&
  /cx-p-live-motes pointer-events-none fixed inset-0/.test(floor) &&
  /cx-p-ar-perimeter pointer-events-none fixed/.test(floor));

console.log(`\ncxos-passage.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
