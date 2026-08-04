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
// RC2 wins the lib/cxos/reviewMode.ts overlap (integration governance — see
// step 2/5 of the reconciliation). RC2's reviewBuildAllowed() is a STRICTER
// superset of what this guard originally verified: it hard-offs production
// TWICE — first via server-authoritative, non-spoofable Vercel env vars
// (VERCEL_TARGET_ENV / VERCEL_ENV, read only when typeof window === "undefined"),
// then again via the public NEXT_PUBLIC_* fallback for client-side consumers —
// both checked strictly before the NEXT_PUBLIC_CXOS_REVIEW manual override.
// Hand-verified by tracing every branch of the function; the invariant this
// guard exists to protect ("review instruments NEVER exist on production")
// holds and is enforced by two independent signals, not weakened.
{
  const fn = mode.slice(mode.indexOf("export function reviewBuildAllowed"));
  const firstReturn = fn.indexOf("return");
  check("reviewBuildAllowed's FIRST statement is the production hard-off (RC2: server-authoritative VERCEL_TARGET_ENV/VERCEL_ENV, checked before any public signal or override)",
    /targetEnvironment === "production" \|\|[\s\S]{0,40}deploymentEnvironment === "production"[\s\S]{0,20}\)\s*\{\s*return false;/.test(
      fn.slice(0, firstReturn + 200)));
  check("the manual override cannot beat either hard-off (both are checked strictly before it)",
    fn.indexOf('targetEnvironment === "production"') <
    fn.indexOf('NEXT_PUBLIC_CXOS_REVIEW') &&
    fn.indexOf('publicEnvironment === "production"') <
    fn.indexOf('NEXT_PUBLIC_CXOS_REVIEW'));
}
check("previews are review-enabled automatically — server-authoritative Vercel env first, public fallback second (both protected by Vercel Authentication)",
  /targetEnvironment === "preview" \|\|[\s\S]{0,80}deploymentEnvironment === "preview"/.test(mode) &&
  /publicEnvironment === "preview"\) return true;/.test(mode));
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
// RC2 won the lib/cxos/rooms.ts AND app/review/page.tsx overlaps (integration
// governance) with a deliberately pruned 2-room registry. That pruning had a
// side effect the Opus UX pass caught: four OTHER routes — recovered from
// phase3 and already copied, rendering, and correct — were orphaned from
// this hub, invisible in the Founder's own review surface. Recovery-
// completion (not new room graph) added their entries back, verbatim from
// phase3's own registry (`git show a40a41c:lib/cxos/rooms.ts`), while
// keeping RC2's original two first and untouched. The mandated-room list,
// PLANNED-room check, per-room copy checks, and PROTOTYPE count below are
// updated to the current 6-room reality — every check still enforces "the
// registry claims nothing that isn't real."
{
  // Scoped to the CXOS_ROOMS array body, not the whole file — the CxosRoom
  // interface above it declares `key`/`status` as union-typed fields (e.g.
  // `status: "PROTOTYPE" | "PLANNED"`), and a whole-file regex would count
  // those type-level literals as if they were registered rooms.
  const roomsArray = rooms.slice(rooms.indexOf("export const CXOS_ROOMS"));
  const keys = [...roomsArray.matchAll(/key: "([a-z-]+)"/g)].map((m) => m[1]);
  const MANDATED = ["agency-command", "mission-control", "threshold", "landing-journey", "arena", "passage"];
  check("all six mandated rooms are registered (RC2's original two + the four recovered from phase3) and nothing wider is claimed",
    MANDATED.every((k) => keys.includes(k)) && keys.length === MANDATED.length);
  check("RC2's original two are still listed FIRST, in their original order, untouched",
    keys[0] === "agency-command" && keys[1] === "mission-control");
  check("no PLANNED room is registered — every listed room actually exists and renders, so there is nothing to fake a live entry for",
    !/status: "PLANNED"/.test(roomsArray));
  const agencyCommand = rooms.match(/\{\s*key: "agency-command"[\s\S]*?\n  \},/)?.[0] ?? "";
  check("Agency Command is an honest Phase 6.2 review prototype at its isolated route (RC2's own copy)",
    /name: "Agency Headquarters"/.test(agencyCommand) &&
    /href: "\/review\/agency-command"/.test(agencyCommand) &&
    /status: "PROTOTYPE"/.test(agencyCommand) &&
    /phase: "Phase 6\.2 \+ Core Runtime 1\.0"/.test(agencyCommand) &&
    /Seven-district Agency Headquarters/.test(agencyCommand) &&
    /isolated CXOS Core Runtime reference integration/.test(agencyCommand) &&
    /Synthetic, non-persistent, and review-only/.test(agencyCommand));
  // The four recovered rooms — each checked against phase3's own field
  // values (a40a41c), byte-verified at authoring time via a standalone diff
  // script, not just eyeballed here.
  const RECOVERED: Record<string, { name: string; href: string; phase: string; line: RegExp }> = {
    threshold: { name: "The Threshold", href: "/review/threshold", phase: "Phase 2", line: /Darkness → light → architecture → the name → CreditVector → the opening\. The public entry\./ },
    "landing-journey": { name: "The Landing Journey", href: "/review/landing", phase: "Phase 3", line: /Chapters 1–2 \(Problem Chamber → Intelligence Awakens\) \+ the pricing route transition\. Scroll-directed, native scroll authoritative\./ },
    arena: { name: "Arena", href: "/review/arena", phase: "Phase 5", line: /Clearance → evidence vault → ascent → the chamber\. Own-record only \(policy v1\); live surface stays flag\+cohort gated\./ },
    passage: { name: "The Passage", href: "/review/mission-control-to-arena", phase: "Phase 5\\.1", line: /Mission Control origin → the call → clearance → the passage → dimensional conversion → threshold → greeting → the floor → the return\. Synthetic fixtures, end to end\./ },
  };
  for (const [key, expect] of Object.entries(RECOVERED)) {
    const entry = rooms.match(new RegExp(`\\{\\s*key: "${key}"[\\s\\S]*?\\n  \\},`))?.[0] ?? "";
    check(`recovered room "${key}" matches phase3's own definition verbatim (name/href/status/phase/line)`,
      new RegExp(`name: "${expect.name}"`).test(entry) &&
      new RegExp(`href: "${expect.href.replace(/\//g, "\\/")}"`).test(entry) &&
      /status: "PROTOTYPE"/.test(entry) &&
      new RegExp(`phase: "${expect.phase}"`).test(entry) &&
      expect.line.test(entry));
  }
  check("Academy is still not registered at all (recovery added phase3's SHIPPED routes only — its unbuilt/PLANNED rooms are still excluded; no invented Phase 6 or 7 claim is possible for a room that doesn't exist)",
    !/key: "academy"/.test(rooms));
  check("exactly six PROTOTYPE rooms today (Agency Headquarters · Mission Control · The Threshold · The Landing Journey · Arena · The Passage)",
    (roomsArray.match(/status: "PROTOTYPE"/g) ?? []).length === 6);
}

console.log(`\ncxos-review.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
