// Run: npx tsx scripts/cxos-journey.test.ts
//
// SOURCE-LEVEL guard for CXOS Phase 3 — the Living Landing Journey and the
// cinematic route-transition system. Labelled as such; the behavioural
// evidence is the Playwright pass in the Phase 3 report.
//
// WHAT THIS HOLDS — the laws that let a cinematic journey coexist with an
// honest, accessible, never-hijacked website:
//   1. Native scroll stays authoritative: no wheel/touch handlers, no
//      preventDefault on scroll input, passive listeners only.
//   2. Content is visible by default: choreography is scoped under
//      html[data-cxjourney] — the no-JS / tier-D document matches none of it.
//   3. Links remain real links: only a plain, unmodified left-click on a
//      same-origin non-download link is ever intercepted, and the critical-
//      route denylist is consulted BEFORE the registry.
//   4. Navigation is never hostage: router.push at cover-in end, an
//      unconditional location.assign fail-open clock, Escape skip, popstate
//      untouched.
//   5. Reduced motion is tier D absolutely — checked before every other
//      signal, unoverridable by the Director tier cycle.
//   6. Durations stay inside the Level 3 law (0.4–1.5 s total).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const cap = readFileSync(join(root, "lib/cxos/capability.ts"), "utf8");
const reg = readFileSync(join(root, "lib/cxos/transitions/registry.ts"), "utf8");
const runtime = readFileSync(join(root, "components/cxos/journey/JourneyRuntime.tsx"), "utf8");
const shell = readFileSync(join(root, "components/cxos/transitions/TransitionShell.tsx"), "utf8");
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const chamber = readFileSync(join(root, "components/cxos/journey/ProblemChamber.tsx"), "utf8");
const awakens = readFileSync(join(root, "components/cxos/journey/IntelligenceAwakens.tsx"), "utf8");
const toggle = readFileSync(join(root, "components/cxos/CinematicToggle.tsx"), "utf8");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

// ── 1 · native scroll is authoritative ───────────────────────────────────────
const journeyCode = runtime + chamber + awakens;
check("no wheel/touchmove/touchstart handler exists anywhere in the journey",
  !/addEventListener\("(wheel|touchmove|touchstart)"/.test(journeyCode + shell));
check("no preventDefault call in the journey runtime (scroll is never seized)",
  !/\.preventDefault\(\)/.test(journeyCode));
check("scroll/resize listeners are passive",
  /addEventListener\("scroll", schedule, \{ passive: true \}\)/.test(runtime) &&
  /addEventListener\("resize", schedule, \{ passive: true \}\)/.test(runtime));
check("scroll work is rAF-throttled and IO-gated (the Parallax.tsx discipline)",
  /requestAnimationFrame\(update\)/.test(runtime) && /IntersectionObserver/.test(runtime));
check("the runtime pauses when the tab is hidden", /document\.hidden/.test(runtime));

// ── 2 · content visible by default (the structural reveal-safety) ────────────
{
  // every --cxp-driven choreography rule must be scoped under html[data-cxjourney]
  const cxpRules = [...css.matchAll(/^[^\n{]*\{[^}]*var\(--cxp\)[^}]*\}/gm)];
  check("every --cxp choreography rule is scoped under html[data-cxjourney]",
    cxpRules.length > 0 &&
    cxpRules.every((m) => /html\[data-cxjourney=/.test(m[0].split("{")[0])));
  check("tier D stamps nothing: the runtime returns before ANY listener on D",
    /if \(active === null \|\| active === "D"\) return;/.test(runtime));
  check("chapter copy is server-rendered (no \"use client\" in the chapters)",
    !/"use client"/.test(chamber) && !/"use client"/.test(awakens));
  check("chapter visuals are aria-hidden illustrative surfaces with the honest caption",
    /aria-hidden/.test(chamber) && /Illustrative/.test(chamber) &&
    /aria-hidden/.test(awakens) && /Illustrative/.test(awakens));
}

// ── 3 · links remain real links ──────────────────────────────────────────────
check("only plain left-clicks are considered (button, every modifier, defaultPrevented)",
  /e\.defaultPrevented \|\| e\.button !== 0/.test(shell) &&
  /e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey/.test(shell));
check("target=_blank and download links are never intercepted",
  /hasAttribute\("download"\)/.test(shell) && /target && target !== "_self"/.test(shell));
check("cross-origin links are never intercepted", /url\.origin !== window\.location\.origin/.test(shell));
check("in-page anchors are never intercepted", /url\.pathname === window\.location\.pathname/.test(shell));
check("nothing is preventDefaulted before the registry matches",
  shell.indexOf("findTransition(") < shell.indexOf("e.preventDefault()"));
{
  // indexOf-based ordering is vacuous when the line is ABSENT (-1 < anything):
  // the first run of this guard missed exactly that mutation. Presence first.
  const denyIdx = reg.indexOf("if (CRITICAL_NEVER.test(toPath)) return null;");
  const loopIdx = reg.indexOf("for (const t of TRANSITIONS)");
  check("the critical denylist is consulted BEFORE the registry and covers the money/identity/legal surfaces",
    denyIdx !== -1 && loopIdx !== -1 && denyIdx < loopIdx &&
    ["login", "register", "billing", "dashboard", "api", "legal", "support", "admin", "checkout"]
      .every((r) => new RegExp(`CRITICAL_NEVER =[\\s\\S]{0,400}${r}`).test(reg)));
}

// ── 4 · navigation is never hostage ──────────────────────────────────────────
check("navigation fires at cover-in end, not after the full choreography",
  /arm\(\(\) => \{\s*navigatedRef\.current = true;\s*router\.push\(href\);\s*\}, cover\)/.test(shell));
check("the fail-open clock is unconditional location.assign on the timeout",
  /arm\(\(\) => \{\s*window\.location\.assign\(href\);\s*\}, TRANSITION_TIMEOUT_MS\)/.test(shell));
check("no popstate listener exists (back/forward never replay)",
  !/addEventListener\("popstate"/.test(shell) && !/addEventListener\("popstate"/.test(runtime));
check("Escape skips the veil", /e\.key !== "Escape"/.test(shell));
check("returning users get the short projection; Director runs never consume the counter",
  /cx-nav-n/.test(shell) && /if \(!director\) sessionStorage\.setItem\(NAV_COUNT_KEY/.test(shell));
check("the veil is decoration to assistive tech", /aria-hidden/.test(shell));
check("the destination h1 receives focus after the open-out",
  /querySelector<HTMLElement>\("main h1"\)/.test(shell) && /preventScroll: true/.test(shell));
check("the veil ships in the sync bundle (no lazy chunk can strand a navigation)",
  !/import\(/.test(shell));

// ── 5 · reduced motion is absolute ───────────────────────────────────────────
{
  const fn = cap.slice(cap.indexOf("export function detectTier"));
  check("reduced motion is the FIRST signal detectTier reads",
    fn.indexOf('prefers-reduced-motion') < fn.indexOf("cinematicDisabled") &&
    fn.indexOf('prefers-reduced-motion') < fn.indexOf("saveData") &&
    /if \(window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\) return "D";/.test(fn));
  check("detection failure fails DOWNWARD (catch returns a conservative tier, never A)",
    /catch \{\s*return "C";\s*\}/.test(fn) && !/catch[\s\S]{0,40}return "A"/.test(fn));
  // Phase 1A-CX2 (Founder Decision 2026-08-04): CINEMATIC is the default
  // posture — these two guards pin the exact precedence that makes that
  // safe: the persisted opt-out is honored before any device heuristic
  // (rule b before the genuinely-protective downgrades), and the
  // unconditional fallthrough really is the fullest tier, not a re-gated
  // "bonus" (rule c) — a detection failure still fails downward per the
  // check above, so this can only ever be reached by an honest all-clear.
  check("the persisted footer choice is honored before any device heuristic",
    fn.indexOf("cinematicDisabled") < fn.indexOf("saveData") &&
    fn.indexOf("cinematicDisabled") < fn.indexOf("deviceMemory") &&
    /if \(cinematicDisabled\(\)\) return "D";/.test(fn));
  check("the unconditional fallthrough is Tier A — cinematic is the default, not a bonus tier",
    /return "A"; \/\/ the default: nothing above earned a downgrade\./.test(fn) &&
    fn.indexOf('return "A";') > fn.indexOf("max-width: 768px"));
}
check("the Director tier cycle cannot override a reduced-motion visitor",
  /baseTier\.current === "D" \? "D" :/.test(runtime));
check("the shell does nothing at tier D (instant native navigation)",
  /if \(tier === "D"\) return;/.test(shell));
check("the user-facing toggle exists and is honest state (aria-pressed)",
  /aria-pressed/.test(toggle) && /CINEMATIC_PREF_KEY/.test(toggle));
check("every new cx- utility is reduced-motion covered (enumeration lives in cxos-grammar.test.ts)",
  ["cx-frag", "cx-align-a", "cx-chip", "cx-spine", "cx-nav-veil"].every((c) =>
    css.includes(c)));

// ── 6 · the Level 3 duration law ─────────────────────────────────────────────
{
  const nums = (re: RegExp) => [...reg.matchAll(re)].map((m) => Number(m[1]));
  const covers = nums(/coverMs: \{ A: (\d+)/g);
  const opens = nums(/openMs: \{ A: (\d+)/g);
  check("every registered transition's full (tier A) duration is 400–1500 ms",
    covers.length > 0 && covers.every((c, i) => c + opens[i] >= 400 && c + opens[i] <= 1500));
  check("cover-in (the only navigation delay) never exceeds 450 ms",
    covers.every((c) => c <= 450));
  check("the fail-open ceiling is 1800 ms", /TRANSITION_TIMEOUT_MS = 1800/.test(reg));
}

// ── 7 · wiring ───────────────────────────────────────────────────────────────
check("the landing mounts the runtime and both chapters",
  /<JourneyRuntime \/>/.test(page) && /<ProblemChamber \/>/.test(page) && /<IntelligenceAwakens \/>/.test(page));
check("the shell is mounted once, in the root layout", /<TransitionShell \/>/.test(layout));
check("the timeout simulation is gated by reviewBuildAllowed (inert on production)",
  /reviewBuildAllowed\(\) && \/\[\?&\]cxsim=timeout/.test(shell));

console.log(`\ncxos-journey.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
