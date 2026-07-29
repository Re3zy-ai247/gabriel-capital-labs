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
//  6. Containment: aria-modal dialog, both environments inert while the
//     overlay plays, focus moves to the destination heading BEFORE the
//     overlay unmounts, cancel returns focus to the activation control.
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

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const journey = read("components/cxos/passage/PassageJourney.tsx");
const overlay = read("components/cxos/passage/PassageOverlay.tsx");
const origin = read("components/cxos/passage/MissionControlOrigin.tsx");
const floor = read("components/cxos/passage/ArenaFloor.tsx");
const tray = read("components/cxos/passage/PassageTray.tsx");
const fixtures = read("components/cxos/passage/fixtures.ts");
const timeline = read("lib/cxos/passageTimeline.ts");
const ledger = read("lib/cxos/passageLedger.ts");
const page = read("app/review/mission-control-to-arena/page.tsx");
const css = read("app/globals.css");

// The component bundle: everything that renders — fixtures.ts is the ONE
// place standing literals are permitted.
const bundle = journey + overlay + origin + floor + tray;

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

// ── 2 · honesty ──────────────────────────────────────────────────────────────
check("no random or clock-derived numbers anywhere in the passage",
  !/Math\.random|Date\.now|new Date\(/.test(bundle));
check("no standing literal outside the fixtures module",
  !/totalXp: \d/.test(bundle) && !/\d+ lifetime XP/.test(bundle) && !/Level \d/.test(bundle));
check("the greeting and floor render fixture properties, never constants",
  /r\.displayName/.test(overlay) && /r\.totalXp/.test(overlay) && /r\.totalXp/.test(floor) &&
  /r\.rank/.test(floor));
check("the clearance evidence line branches on the record (an empty record is told the truth)",
  /awardCount > 0 \? "Evidence in order\." : "No evidence on record\."/.test(overlay));
check("the greeting branches on the record too",
  /awardCount > 0\s*\?\s*`Standing recognized/.test(overlay));
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
check("no teaser for the ungated: honest absence, no upsell vocabulary",
  /fx\.access \? \(/.test(origin) &&
  !/locked|Upgrade to enter|Unlock the Arena|join the waitlist/i.test(bundle));

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
  /CANCEL_PHASES\.includes\(p\)\) settleCancel\(\);\s*else settleForward\(\)/.test(journey));
check("Escape · Space · PageDown skip; wheel/touch are PASSIVE skip intent",
  /e\.key === "Escape" \|\| e\.key === " " \|\| e\.key === "PageDown"/.test(journey) &&
  /addEventListener\("wheel", onWheel, \{ passive: true \}\)/.test(journey) &&
  /addEventListener\("touchmove", onTouch, \{ passive: true \}\)/.test(journey));
check("no preventDefault, no scroll lock, no history mutation anywhere in the passage",
  !/\.preventDefault\(\)/.test(bundle) &&
  !/documentElement\.style\.overflow|body\.style\.overflow/.test(bundle) &&
  !/pushState|replaceState/.test(bundle));
check("every programmatic scroll is explicitly instant (smooth CSS can never drive a settle)",
  /scrollTo\(\{ top: 0, behavior: "instant"/.test(journey) &&
  !/scrollTo\(\s*\d/.test(bundle) &&
  !/scrollIntoView\((?!\{ behavior: "instant")/.test(bundle));
check("double activation cannot stack journeys",
  (journey.match(/if \(CINEMATIC\.has\(phaseRef\.current\)\) return;/g) ?? []).length >= 2);

// ── 5 · containment + focus ──────────────────────────────────────────────────
check("the overlay is an aria-modal dialog naming its escape hatch",
  /role="dialog"/.test(overlay) && /aria-modal="true"/.test(overlay) &&
  /Press Escape to skip\./.test(overlay));
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
  /if \(t === "A" \|\| t === "B"\)[\s\S]{0,120}setAttribute\("data-cxpassage", t\)/.test(journey));
check("reduced motion: the belt-and-braces veil reset exists",
  /\.cx-p-veil \{ animation: none !important; display: none !important; \}/.test(css));
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
  check("first journey respects the ratified ≤ 12 s first-entry ceiling",
    end <= 12000 && end >= 7000);
  check("returning respects the house ≤ 1.5 s law; the return journey stays ≤ 2 s",
    ret <= 1500 && retj <= 2000);
  check("the mobile journey is shorter than the desktop journey",
    endB < end);
  check("safety ordering: journey end < JS watchdog < pure-CSS safety",
    end < dog && dog < safe * 1000 && retj < dog);
  check("the CSS safety literal mirrors the timeline constant",
    new RegExp(`cx-p-safety 0\\.5s ease ${safe}s forwards`).test(css));
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
    /html\[data-cxpassage\] \.cx-p-station \{ min-height: 120svh; \}/.test(css) &&
    /html\[data-cxpassage\] \.cx-p-stage \{ position: sticky/.test(css) &&
    !/^\.cx-p-station \{ min-height/m.test(css));
}
check("the station rAF is passive and hidden-tab aware",
  /addEventListener\("scroll", onScroll, \{ passive: true \}\)/.test(journey) &&
  /document\.hidden/.test(journey));

// ── 9 · the semantic ledger (no row, no ship — with fallback treatment) ─────
{
  const elements = [
    "MC instrument wall", "MC command axis", "MC zone panels", "Arena call aperture",
    "Clearance stencils", "Passage rails", "Conversion arcs", "Threshold gate",
    "Chamber floor ring", "Standing core dais", "Evidence vault plaques",
    "Milestone gallery seals", "Sealed competition threshold", "Kai observation point",
    "Return line", "SYNTHETIC tab",
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

console.log(`\ncxos-passage.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
