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

// ── 1 · hosted identity is server-authoritative and fail-closed ──────────────
{
  const policyStart = mode.indexOf("export function resolveReviewBuildDecision");
  const policyEnd = mode.indexOf("export function reviewServerBuildAllowed");
  const serverPolicy = mode.slice(policyStart, policyEnd);
  check("review mode exposes a pure server-authoritative policy",
    policyStart >= 0 && policyEnd > policyStart);
  check("the server gate reads canonical VERCEL_ENV before public/manual hints",
    serverPolicy.indexOf("environment.VERCEL_ENV") >= 0 &&
    serverPolicy.indexOf("environment.VERCEL_ENV") < serverPolicy.indexOf("environment.NEXT_PUBLIC_VERCEL_ENV") &&
    serverPolicy.indexOf("environment.VERCEL_ENV") < serverPolicy.indexOf("environment.NEXT_PUBLIC_CXOS_REVIEW"));
  check("only exact canonical preview may authorize a hosted build",
    /hostedIdentity !== "preview"/.test(serverPolicy) &&
    /publicIdentity === undefined \|\| publicIdentity === "preview"/.test(serverPolicy));
  check("a Vercel-hosted build with missing canonical identity fails closed",
    /if \(vercelMarkerPresent\)[\s\S]{0,180}allowed: false[\s\S]{0,120}HOSTED_UNKNOWN/.test(serverPolicy));
  check("a malformed Vercel marker fails closed before any identity can authorize review",
    /vercelMarkerPresent && environment\.VERCEL !== "1"/.test(serverPolicy) &&
    /Vercel hosting marker is malformed or unknown/.test(serverPolicy));
  check("public identity cannot substitute for canonical server identity",
    /if \(publicIdentity !== undefined\)[\s\S]{0,180}allowed: false/.test(serverPolicy));
  check("local capture override is evaluated only after hosted/public denial",
    serverPolicy.indexOf("if (vercelMarkerPresent)") <
      serverPolicy.indexOf("NEXT_PUBLIC_CXOS_REVIEW") &&
    serverPolicy.indexOf("if (publicIdentity !== undefined)") <
      serverPolicy.indexOf("NEXT_PUBLIC_CXOS_REVIEW"));
  check("server wrapper delegates process.env only to the pure policy",
    /reviewServerBuildAllowed\(\): boolean \{[\s\S]{0,100}resolveReviewBuildDecision\(process\.env\)\.allowed/.test(mode));
  check("client presentation consumes a server-stamped document bit, not a public env authority",
    /document\.documentElement\.dataset\.cxosReviewAllowed === "true"/.test(mode));
}
check("reviewBuildAllowed delegates server authorization separately from client presentation",
  /typeof window === "undefined"[\s\S]{0,100}reviewServerBuildAllowed\(\)[\s\S]{0,100}reviewClientPresentationAllowed\(\)/.test(mode));
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
  check("all ten mandated rooms are registered (plus the landing journey, passage, and Phase 6 Agency Command prototype)",
    ["threshold", "hero", "mission-control", "arena", "academy", "kai", "marketplace",
     "operator-network", "dashboard", "enterprise", "landing-journey", "passage",
     "agency-command"].every((k) => keys.includes(k)));
  check("PLANNED rooms exist and are never given a fake live entry",
    /status: "PLANNED"/.test(rooms) && /no entry yet/.test(hub));
  const agencyCommand = rooms.match(/\{\s*key: "agency-command"[\s\S]*?\n  \},/)?.[0] ?? "";
  check("Agency Command is an honest Phase 6.2 review prototype at its isolated route",
    /name: "Agency Command"/.test(agencyCommand) &&
    /href: "\/review\/agency-command"/.test(agencyCommand) &&
    /status: "PROTOTYPE"/.test(agencyCommand) &&
    /phase: "Phase 6\.2"/.test(agencyCommand) &&
    /Seven-district agency headquarters/.test(agencyCommand) &&
    /six-beat arrival/.test(agencyCommand) &&
    /deterministic natural-language Kai command surface/.test(agencyCommand) &&
    /No live agency data, persistence/.test(agencyCommand));
  const academy = rooms.match(/\{\s*key: "academy"[\s\S]*?\n  \},/)?.[0] ?? "";
  check("Academy is unscheduled pending D-5 (no invented Phase 7)",
    /phase: "Unscheduled \(needs product definition D-5\)"/.test(academy) &&
    !/Phase [67]/.test(academy));
  check("exactly six PROTOTYPE rooms today (Threshold · Landing Journey · Mission Control · Arena · The Passage · Agency Command)",
    (rooms.match(/status: "PROTOTYPE"/g) ?? []).length === 6);
}

console.log(`\ncxos-review.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
