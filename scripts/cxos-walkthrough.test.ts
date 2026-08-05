// Run: npx tsx scripts/cxos-walkthrough.test.ts
//
// SOURCE-LEVEL guard for the CXOS Phase 1A-CX2 (C) Founder Walkthrough — the
// director/orchestrator over the six existing review rooms. Labelled as
// such; the behavioural evidence is the live gstack click-through in this
// task's Return.
//
// WHAT THIS HOLDS:
//   1. The route is gated exactly like every other review surface, and the
//      registry advertises it as the entry point.
//   2. Every composed ceremony (Threshold, MissionEntry) is forced into
//      review mode explicitly — this route's own ?step=/?persona= query
//      string does not satisfy isDirectorActive()'s param sniff, so an
//      un-forced component here would silently treat a Founder walkthrough
//      run as a real visitor and write production session state.
//   3. The walkthrough's own session guards are namespaced separately from
//      the production cx-threshold/cx-mc/cx-arena keys — restart clears
//      only its own two keys.
//   4. The simulated sign-in beat is a labeled theatrical beat, not a form:
//      no <form>, no <input>.
//   5. Composition, not reimplementation: the six rooms are imported via
//      their public exports, never rebuilt.
//   6. No network/database/auth surface, and no scattered magic-number
//      duration — the one new pacing token is centralized and reduced
//      motion adds nothing new.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (relativePath: string): string =>
  existsSync(join(root, relativePath)) ? readFileSync(join(root, relativePath), "utf8") : "";

// Every structural check below runs against comment-stripped source (the
// same codeOf() pattern scripts/cxos-agency-command.test.ts and
// scripts/cxos-pacing.test.ts already use) — this file's OWN doc comments
// necessarily narrate the negatives it enforces ("NOT a <form>", "no
// next-auth, no @/lib/auth"), and a raw-source regex would false-positive
// on its own prose. Positive presence checks (the banner text, the sign-in
// label) are unaffected: that copy lives in real JSX, not a comment.
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const page = codeOf(read("app/review/cxos/page.tsx"));
const stage = codeOf(read("app/review/cxos/stage.tsx"));
const steps = codeOf(read("app/review/cxos/steps.ts"));
const fixtures = codeOf(read("app/review/cxos/fixtures.ts"));
const session = codeOf(read("app/review/cxos/session.ts"));
const progressRail = codeOf(read("components/cxos/walkthrough/ProgressRail.tsx"));
const simulatedSignIn = codeOf(read("components/cxos/walkthrough/SimulatedSignIn.tsx"));
const rooms = read("lib/cxos/rooms.ts");
const pacing = read("lib/cxos/pacing.ts");

const newFiles: [string, string][] = [
  ["page.tsx", page],
  ["stage.tsx", stage],
  ["steps.ts", steps],
  ["fixtures.ts", fixtures],
  ["session.ts", session],
  ["ProgressRail.tsx", progressRail],
  ["SimulatedSignIn.tsx", simulatedSignIn],
];
const bundle = newFiles.map(([, src]) => src).join("\n");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

// ── 1 · every new file exists ────────────────────────────────────────────
for (const [name, src] of newFiles) {
  check(`walkthrough file exists and is non-empty: ${name}`, src.length > 0);
}

// ── 2 · gated exactly like every other review surface ────────────────────
check("page.tsx checks reviewBuildAllowed() before doing anything else, and notFound()s",
  page.indexOf("reviewBuildAllowed()") !== -1 &&
  page.indexOf("reviewBuildAllowed()") < page.indexOf("await import(\"./stage\")") &&
  /if \(!reviewBuildAllowed\(\)\) notFound\(\);/.test(page));
check("the client stage loads via dynamic import only (matches the house pattern for every other review room)",
  /await import\("\.\/stage"\)/.test(page) && !/^import .*from ["']\.\/stage["'];?$/m.test(page));
check("useSearchParams is wrapped in a Suspense boundary (required for static rendering, same pattern as app/billing/page.tsx)",
  /<Suspense[^>]*>[\s\S]*<FounderWalkthroughStage[\s\S]*<\/Suspense>/.test(page));

// ── 3 · the registry names this the entry point ──────────────────────────
check("the room registry's first entry is the walkthrough, at /review/cxos",
  /export const CXOS_ROOMS: readonly CxosRoom\[\] = \[\s*\{\s*key: "founder-walkthrough",\s*\n\s*name: "Founder Walkthrough",\s*\n\s*href: "\/review\/cxos",/.test(rooms));

// ── 4 · the opening banner mirrors the house idiom and states fixture truth ─
check("the overview screen carries the SYNTHETIC FOUNDER REVIEW banner, in the house vocabulary",
  /SYNTHETIC FOUNDER REVIEW/.test(stage) &&
  /Illustrative deterministic data only/.test(stage) &&
  /No customer\s*\n?\s*records, live AI/.test(stage.replace(/\s+/g, " ")));
check("the overview screen offers a single BEGIN control and a persona toggle",
  /Begin the walkthrough/.test(stage) &&
  /role="radiogroup"/.test(stage) &&
  /Returning Operator/.test(stage) && /New Visitor/.test(stage));
check("the overview screen lists the full room index with direct links (regression review access), reusing the one registry rather than a second copy",
  /CXOS_ROOMS\.filter\(\(room\) => room\.key !== "founder-walkthrough"\)/.test(stage));

// ── 5 · the simulated sign-in beat is theater, not a form ────────────────
check('the simulated sign-in beat carries its exact required label',
  /SIMULATED SIGN-IN — no credentials, no session/.test(simulatedSignIn));
check("the simulated sign-in beat is NOT a form and has no real inputs",
  !/<form[\s>]/i.test(simulatedSignIn) && !/<input[\s>]/i.test(simulatedSignIn));
check("the simulated sign-in beat touches no real auth module and makes no network call",
  !/next-auth|@\/lib\/auth|@\/lib\/session|fetch\(|XMLHttpRequest/.test(simulatedSignIn));

// ── 6 · every composed ceremony is forced into review mode ───────────────
// This route's own query string (?step=/?persona=) does not satisfy
// isDirectorActive()'s param sniff (director|cxos|review) — an un-forced
// Threshold/MissionEntry here would treat a walkthrough run as a real
// visitor and write the PRODUCTION cx-threshold/cx-mc session keys.
check("Threshold is mounted with review forced true, never left to isDirectorActive()'s own detection",
  /<Threshold\s+review\s+onDone=/.test(stage));
check("MissionEntry is mounted with forceReview, never left to isDirectorActive()'s own detection",
  /<MissionEntry[\s\S]{0,80}forceReview/.test(stage));

// ── 7 · session isolation: the walkthrough never touches production keys ─
check("no walkthrough file writes to the PRODUCTION cx-threshold/cx-mc/cx-arena session keys",
  !/sessionStorage\.(setItem|removeItem)\(\s*"cx-threshold"/.test(bundle) &&
  !/sessionStorage\.(setItem|removeItem)\(\s*"cx-mc"/.test(bundle) &&
  !/sessionStorage\.(setItem|removeItem)\(\s*"cx-arena"/.test(bundle));
check("the walkthrough's own session keys are separately namespaced (cx-walkthrough-*)",
  /cx-walkthrough-threshold-seen/.test(session) && /cx-walkthrough-mission-boot-seen/.test(session));
check("restart clears exactly the walkthrough's own two keys — nothing else",
  /export function clearWalkthroughSession\(\): void \{\s*clearBeat\("threshold"\);\s*clearBeat\("mission-boot"\);\s*\}/.test(session));

// ── 8 · composition, not reimplementation ────────────────────────────────
// Every one of these is a next/dynamic-loaded named/default export from its
// OWN existing module — never a reimplementation — so the check accepts
// either a static `from "path"` import or a dynamic `import("path")` call
// resolving the same public export.
const composedImports: [string, RegExp][] = [
  ["Threshold", /import\("@\/components\/cxos\/Threshold"\)\.then\(\(m\) => m\.Threshold\)/],
  ["MissionEntry", /import\("@\/components\/cxos\/mission\/MissionEntry"\)\.then\(\(m\) => m\.MissionEntry\)/],
  ["PassageJourney", /import\("@\/components\/cxos\/passage\/PassageJourney"\)\.then\(\(m\) => m\.PassageJourney\)/],
  ["MissionControlStage", /import\("@\/app\/review\/mission-control\/stage"\)\.then\(\(m\) => m\.MissionControlStage\)/],
  ["ArenaStage", /import\("@\/app\/review\/arena\/stage"\)\.then\(\(m\) => m\.ArenaStage\)/],
  ["AgencyCommandStage", /import\("@\/app\/review\/agency-command\/stage"\)\.then\(\(m\) => m\.AgencyCommandStage\)/],
  ["LandingJourneyReview", /import\("@\/app\/review\/landing\/page"\)/],
];
for (const [name, pattern] of composedImports) {
  check(`stage.tsx composes ${name} via its public export (imported, not reimplemented)`, pattern.test(stage));
}
check("every composed room is next/dynamic-loaded (ssr:false) rather than statically bundled upfront — the walkthrough only pays for the step it's on",
  /import dynamic from "next\/dynamic";/.test(stage) &&
  (stage.match(/ssr:\s*false/g) ?? []).length >= composedImports.length);

// ── 9 · no network/database/auth surface anywhere in the walkthrough ─────
check("no walkthrough file has a network, database, or real-auth import",
  !/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|@\/lib\/prisma|next-auth|@\/lib\/auth\b|@\/lib\/session\b/.test(bundle));

// ── 10 · the one new pacing token is centralized, not a scattered literal ─
check("WALKTHROUGH_STEP_CROSSFADE_MS is exported from lib/cxos/pacing.ts as a number",
  /export const WALKTHROUGH_STEP_CROSSFADE_MS = \d+;/.test(pacing));
check("stage.tsx consumes the token from pacing.ts rather than inlining a raw ms literal in its transition string",
  /from "@\/lib\/cxos\/pacing"/.test(stage) &&
  /WALKTHROUGH_STEP_CROSSFADE_MS/.test(stage) &&
  !/transition: `opacity \d+ms/.test(stage));

// ── 11 · reduced motion: the orchestrator's own crossfade adds nothing new ─
check("the step crossfade checks detectTier() === \"D\" and adds no inline style at all in that branch",
  /const reduced = detectTier\(\) === "D";/.test(stage) &&
  /style=\{\s*\n?\s*reduced\s*\n?\s*\?\s*undefined/.test(stage));

// ── 12 · CinematicToggle is mounted exactly once, inside this shell ──────
check("CinematicToggle is imported and rendered by ProgressRail.tsx",
  /from "@\/components\/cxos\/CinematicToggle"/.test(progressRail) && /<CinematicToggle \/>/.test(progressRail));
check("no OTHER new walkthrough file also mounts CinematicToggle (exactly one mount point)",
  newFiles.filter(([name]) => name !== "ProgressRail.tsx")
    .every(([, src]) => !/<CinematicToggle/.test(src)));

// ── 13 · deep-linkable, clamped, deterministic steps ──────────────────────
check("stage.tsx derives persona/step straight from the URL via useSearchParams (no separate state to desync)",
  /useSearchParams\(\)/.test(stage) && /searchParams\.get\("step"\)/.test(stage) && /searchParams\.get\("persona"\)/.test(stage));
check("resolveStepIndex clamps any absent/invalid/out-of-range ?step= to a valid position — a bad deep link can't render nothing",
  /return Math\.min\(parsed, sequence\.length\);/.test(steps) &&
  /if \(!Number\.isFinite\(parsed\) \|\| parsed < 1\) return 1;/.test(steps));
check("the new-visitor sequence is the returning-operator spine with landing + simulated sign-in prepended (one shared tail, not a duplicated spine)",
  /export const NEW_VISITOR_STEPS: readonly WalkthroughStepKey\[\] = \[\s*"landing",\s*"simulated-signin",\s*\.\.\.RETURNING_OPERATOR_STEPS,\s*\];/.test(steps));

console.log(`\ncxos-walkthrough.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
