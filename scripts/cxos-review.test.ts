// Run: npx tsx scripts/cxos-review.test.ts
//
// SOURCE-LEVEL guard for the CXOS Founder Review System — labelled as such; the
// behavioural evidence is the Playwright pass in the review-system report.
//
// THE ONE INVARIANT THAT MATTERS: review instruments NEVER exist on production.
// Everything else here keeps the system honest — noindex, reduced-motion never
// overridden, session memory never consumed by review runs, heavy code never
// entering the public bundle, and the room registry never faking a planned room
// as live.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const mode = readFileSync(join(root, "lib/cxos/reviewMode.ts"), "utf8");
const rooms = readFileSync(join(root, "lib/cxos/rooms.ts"), "utf8");
const hud = readFileSync(join(root, "components/cxos/DirectorHUD.tsx"), "utf8");
const gate = readFileSync(join(root, "components/cxos/ThresholdGate.tsx"), "utf8");
const thr = readFileSync(join(root, "components/cxos/Threshold.tsx"), "utf8");
const layout = readFileSync(join(root, "app/review/layout.tsx"), "utf8");
const hub = readFileSync(join(root, "app/review/page.tsx"), "utf8");
const stage = readFileSync(join(root, "app/review/threshold/page.tsx"), "utf8");
const page = readFileSync(join(root, "app/page.tsx"), "utf8");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

// ── 1 · production is HARD OFF, and the check is FIRST ───────────────────────
{
  const fn = mode.slice(mode.indexOf("export function reviewBuildAllowed"));
  const firstReturn = fn.indexOf("return");
  check("reviewBuildAllowed's FIRST statement is the production hard-off",
    /if \(process\.env\.NEXT_PUBLIC_VERCEL_ENV === "production"\) return false;/.test(
      fn.slice(0, firstReturn + 60)));
  check("the manual override cannot beat the hard-off (it is checked after)",
    fn.indexOf('NEXT_PUBLIC_VERCEL_ENV === "production"') <
    fn.indexOf('NEXT_PUBLIC_CXOS_REVIEW'));
}
check("previews are review-enabled automatically (protected by Vercel Authentication)",
  /NEXT_PUBLIC_VERCEL_ENV === "preview"\) return true/.test(mode));
check("every review surface gates through reviewBuildAllowed",
  [hub, stage].every((f) => /reviewBuildAllowed\(\)/.test(f)) && /reviewBuildAllowed\(\)/.test(page));

// ── 2 · never indexed, never public-linked ───────────────────────────────────
check("/review is noindex,nofollow", /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(layout));
check("the review param set is exactly director|cxos|review",
  /\(director\|cxos\|review\)/.test(mode));

// ── 3 · review never overrides accessibility or the visitor's experience ─────
check("the gate checks reduced motion BEFORE honoring the director param",
  gate.indexOf("prefers-reduced-motion") < gate.indexOf('sessionStorage.getItem("cx-threshold")') &&
  /const director = isDirectorActive\(\);[\s\S]*prefers-reduced-motion/.test(gate));
check("director bypasses ONLY session memory, never reduced motion",
  /if \(!director && sessionStorage\.getItem\("cx-threshold"\) === "1"\)/.test(gate) &&
  // the reduced-motion return must be UNCONDITIONED — any director term on this
  // exact line is the accessibility override this guard exists to forbid
  /if \(window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\) return lift\(\);/.test(gate));
check("the review stage respects reduced motion too", /blocked-motion/.test(stage));
check("review runs never consume the visitor's first impression (no session write)",
  /if \(!review\) \{ try \{ sessionStorage\.setItem\("cx-threshold", "1"\)/.test(thr));

// ── 4 · the public bundle never pays for the console ─────────────────────────
check("DirectorHUD is imported only by the lazy Threshold chunk",
  /from "\.\/DirectorHUD"/.test(thr) && !/DirectorHUD/.test(gate) && !/DirectorHUD/.test(page));
check("the review stage loads the experience via dynamic import only",
  /import\("@\/components\/cxos\/Threshold"\)/.test(stage) && !/from "@\/components\/cxos\/Threshold"/.test(stage));

// ── 5 · the console is real instrumentation ──────────────────────────────────
check("HUD reads frame timings and reports fps + avg + p95",
  /frameTimes/.test(hud) && /p95/.test(hud) && /fps/.test(hud));
check("HUD can jump to every beat and scrub the timeline",
  /BEATS/.test(hud) && /setProgress\(Number\(e\.target\.value\)/.test(hud));
check("HUD controls density, intensity, speed, pause and parallax",
  ["setDensity", "setIntensity", "setSpeed", "setPaused", "setParallaxEnabled"].every((m) => hud.includes(m)));
check("the review stage LOOPS instead of finishing (Escape exits)",
  /if \(review\) \{ target = 0; actual = 0; \}/.test(thr));

// ── 6 · the room registry stays honest ───────────────────────────────────────
{
  const keys = [...rooms.matchAll(/key: "([a-z-]+)"/g)].map((m) => m[1]);
  check("all ten mandated rooms are registered (plus the Phase 3 landing journey)",
    ["threshold", "hero", "mission-control", "arena", "academy", "kai", "marketplace",
     "operator-network", "dashboard", "enterprise", "landing-journey"].every((k) => keys.includes(k)));
  check("PLANNED rooms exist and are never given a fake live entry",
    /status: "PLANNED"/.test(rooms) && /no entry yet/.test(hub));
  check("exactly two PROTOTYPE rooms today (Threshold · Landing Journey)",
    (rooms.match(/status: "PROTOTYPE"/g) ?? []).length === 2);
}

console.log(`\ncxos-review.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
