// Run: npx --no-install tsx scripts/cxos-agency-command.test.ts
//
// SOURCE-LEVEL guard for the CXOS Phase 6 Agency Command Founder-review room.
// Behavioural, visual, accessibility, and network evidence still belongs in the
// Phase 6 browser ledger. This guard holds the architectural boundary:
//
//   synthetic local fixtures → local display-state controls → review-only page
//
// No live Agency workspace, auth/session state, API, database, billing, storage,
// product navigation, or time-varying metric may cross that boundary.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const routeDir = join(root, "app/review/agency-command");
const expectedRouteFiles = [
  "agency-command.module.css",
  "fixtures.ts",
  "page.tsx",
  "stage.tsx",
];

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

function read(relativePath: string): string {
  const absolute = join(root, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function importSources(source: string): string[] {
  return [...source.matchAll(
    /^\s*import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["'];?/gm,
  )].map((match) => match[1]);
}

// ── 1 · exact, isolated route surface ────────────────────────────────────────
for (const file of expectedRouteFiles) {
  check(`route file exists: ${file}`, existsSync(join(routeDir, file)));
}
const actualRouteFiles = existsSync(routeDir)
  ? readdirSync(routeDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort()
  : [];
check("the Phase 6 route contains exactly the four reviewed source files",
  JSON.stringify(actualRouteFiles) === JSON.stringify(expectedRouteFiles));

const page = read("app/review/agency-command/page.tsx");
const stage = read("app/review/agency-command/stage.tsx");
const fixtures = read("app/review/agency-command/fixtures.ts");
const css = read("app/review/agency-command/agency-command.module.css");
const pageCode = codeOf(page);
const stageCode = codeOf(stage);
const fixtureCode = codeOf(fixtures);
const presentationCode = `${stageCode}\n${fixtureCode}`;

// ── 2 · production hard-off and truthful review fallback ─────────────────────
const gateAt = page.indexOf("reviewBuildAllowed()");
const stageAt = page.indexOf("<AgencyCommandStage");
check("page is a server component gated through reviewBuildAllowed",
  page.length > 0 &&
  !/^["']use client["'];/m.test(page) &&
  /from ["']@\/lib\/cxos\/reviewMode["']/.test(page) &&
  gateAt !== -1 &&
  stageAt !== -1 &&
  gateAt < stageAt);
check("the review-disabled branch renders the established truthful fallback",
  /if\s*\(\s*!reviewBuildAllowed\(\)\s*\)\s*\{[\s\S]*<main[\s\S]{0,160}id="main"[\s\S]*Founder Review is not enabled in this build\./.test(page));
check("the allowed branch renders only the local Agency Command stage",
  /return\s*<AgencyCommandStage\s*\/>/.test(page));

const pageImports = importSources(page);
const allowedPageImports = new Set([
  "@/lib/cxos/reviewMode",
  "./stage",
]);
check("page imports only the review gate and its local stage",
  pageImports.length >= 2 &&
  pageImports.every((source) => allowedPageImports.has(source)) &&
  [...allowedPageImports].every((source) => pageImports.includes(source)));

// ── 3 · strict client import boundary (transitive coupling starts here) ───────
const stageImports = importSources(stage);
const allowedStageImports = new Set([
  "react",
  "./fixtures",
  "./agency-command.module.css",
]);
check("stage imports are restricted to React, local fixtures, and its CSS module",
  stageImports.length >= 3 &&
  stageImports.every((source) => allowedStageImports.has(source)) &&
  [...allowedStageImports].every((source) => stageImports.includes(source)));
check("fixtures import nothing (literal deterministic review data only)",
  importSources(fixtures).length === 0 && !/\brequire\s*\(/.test(fixtureCode));
check("stage has no dynamic import or CommonJS escape hatch",
  !/\bimport\s*\(|\brequire\s*\(/.test(stageCode));
check("stage cannot reach Next navigation, AppShell, or any shared/live component",
  !/next\/(?:link|navigation)|\bAppShell\b|@\/components|@\/lib/.test(stageCode));

// ── 4 · no backend, session, storage, network, mutation, or product routing ───
const forbiddenRuntime: Array<[string, RegExp]> = [
  ["fetch/XHR/WebSocket/EventSource", /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/],
  ["sendBeacon or network client", /\bsendBeacon\s*\(|\b(?:axios|graphql-request|urql|apollo)\b/i],
  ["Prisma/database authority", /\bprisma\b|@\/lib\/prisma|@prisma\/client/i],
  ["NextAuth/session authority", /next-auth|\b(?:useSession|getSession|getServerSession|currentAccount|currentUser|currentWorkspace)\b/],
  ["browser storage or cookies", /\b(?:sessionStorage|localStorage|indexedDB)\b|document\.cookie|\bcookies\s*\(/],
  ["server request context", /next\/headers|server-only|\bheaders\s*\(|["']use server["']/],
  ["API route", /\/api\//],
  ["environment/config read", /\bprocess\.env\b/],
];
for (const [label, pattern] of forbiddenRuntime) {
  check(`no ${label}`, !pattern.test(presentationCode));
}

const forbiddenMutation: Array<[string, RegExp]> = [
  ["HTTP mutation method", /\bmethod\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i],
  ["form submission", /<form\b|\bonSubmit\s*=|type\s*=\s*["']submit["']|\bformAction\s*=/i],
  ["server action", /\baction\s*=\s*\{/],
  ["imperative navigation", /\b(?:router\.(?:push|replace)|location\.(?:assign|replace)|window\.location)\b/],
];
for (const [label, pattern] of forbiddenMutation) {
  check(`no ${label}`, !pattern.test(presentationCode));
}

const anchorTags = [...stage.matchAll(/<a\b[\s\S]*?>/g)].map((match) => match[0]);
check("plain anchors, when present, stay inside Founder Review",
  !/<Link\b/.test(stageCode) &&
  anchorTags.every((tag) => /\bhref\s*=\s*["']\/review(?:[/?#][^"']*)?["']/.test(tag)));
check("no live product route is an interactive destination",
  !/\bhref\s*=\s*["']\/(?:agency|dashboard|campaigns|mail|letters|billing|pricing)(?:[/?#][^"']*)?["']/i.test(
    stageCode,
  ));

// ── 5 · deterministic fixtures: no clocks, randomness, crypto, or timers ──────
const nondeterministic: Array<[string, RegExp]> = [
  ["Date/clock read", /\bDate\b|\bperformance\.(?:now|timeOrigin)\b/],
  ["randomness", /\bMath\.random\b|\bcrypto\b|\brandomUUID\b/],
  ["metric timer", /\b(?:setTimeout|setInterval|requestIdleCallback)\b/],
  ["frame/elapsed metric", /\b(?:fps|frameTimes|elapsedMs|durationMs)\b/],
];
for (const [label, pattern] of nondeterministic) {
  check(`determinism: no ${label}`, !pattern.test(presentationCode));
}

const requiredStates: Array<[string, RegExp]> = [
  ["populated/operational", /\b(?:populated|operational)\b/i],
  ["empty/new agency", /\bempty\b|new[-_ ]?agency/i],
  ["loading", /\bloading\b/i],
  ["degraded/error", /\b(?:degraded|error|unavailable)\b/i],
  ["permission denied", /permission[-_ ]?denied/i],
  ["capacity pressure/reached", /\bcapacity\b|capacity[-_ ]?(?:pressure|reached)/i],
];
for (const [label, pattern] of requiredStates) {
  check(`fixture state exists: ${label}`, pattern.test(fixtureCode));
}
check("every rendered fixture state has coherent health drivers",
  /AGENCY_HEALTH_DRIVERS:\s*Record<[\s\S]*?populated:\s*\[[\s\S]*?value: "12 of 15"[\s\S]*?empty:\s*\[[\s\S]*?value: "0 of 15"[\s\S]*?unavailable:\s*\[[\s\S]*?value: "2 of 5"[\s\S]*?error:\s*\[[\s\S]*?value: "2 of 5"[\s\S]*?capacity:\s*\[[\s\S]*?value: "15 of 15"/.test(
    fixtures,
  ) &&
  /AGENCY_HEALTH_DRIVERS\[fixtureState\]/.test(stageCode));
check("Kai, queue, and portfolio specimen counts are explicitly aligned",
  /One displayed response record needs an operator decision\./.test(stage) &&
  /One synthetic response specimen is expanded\./.test(stage) &&
  /<dt>Aggregate workspaces<\/dt>/.test(stage) &&
  /<dt>Portfolio rows shown<\/dt>/.test(stage) &&
  /5 of 5 · specimen/.test(stage));
check("the Empty fixture renders zero portfolio rows and uses proposed capability language",
  /const visiblePortfolio\s*=\s*fixtureState\s*===\s*"empty"\s*\?\s*\[\]/.test(
    stageCode,
  ) &&
  /future authorized first-workspace[\s\S]{0,160}No Phase 6 workflow is\s+connected here/.test(
    stage,
  ) &&
  /proposed first-workspace presentation[\s\S]{0,180}No Phase 6[\s\S]{0,80}flow is connected here/.test(
    stage,
  ));

// ── 6 · persistent disclosure and honest unavailable capabilities ─────────────
check("persistent synthetic disclosure is rendered as an unconditional semantic note",
  /<[^>]+\brole\s*=\s*["'](?:note|status)["'][^>]*>[\s\S]{0,600}SYNTHETIC FOUNDER REVIEW[\s\S]{0,600}<\//.test(
    stage,
  ));
check("disclosure states that data is illustrative and no customer record is connected",
  /Illustrative data only/i.test(presentationCode) &&
  /No customer records/i.test(presentationCode) &&
  /not connected/i.test(presentationCode));
check("unavailable live capabilities are visibly labelled",
  /\b(?:PLANNED|NOT CONNECTED)\b/.test(presentationCode));
check("team capability is an explicit disconnected specimen",
  /Team Specimen/i.test(presentationCode) &&
  /Team Specimen[\s\S]{0,240}(?:NOT CONNECTED|not connected)/i.test(presentationCode));

// ── 7 · local controls and semantic/accessibility primitives ─────────────────
const buttonTags = [...stage.matchAll(/<button\b[\s\S]*?>/g)].map((match) => match[0]);
check("the room exposes local display-state buttons",
  /\buseState\b/.test(stageCode) &&
  buttonTags.length > 0 &&
  /\bonClick\s*=/.test(stageCode));
check("every button is explicitly non-submitting",
  buttonTags.length > 0 &&
  buttonTags.every((tag) => /\btype\s*=\s*["']button["']/.test(tag)));
check("state controls expose their selected state",
  /\baria-pressed\s*=/.test(stageCode));
check("root skip link has a real target and the room uses semantic landmarks",
  /<main\b[\s\S]{0,180}\bid\s*=\s*["']main["'][\s\S]{0,180}\btabIndex\s*=\s*\{-1\}/.test(stage) &&
  /<main\b[\s\S]{0,180}\bid\s*=\s*["']main["'][\s\S]{0,180}\btabIndex\s*=\s*\{-1\}/.test(page) &&
  /<header\b/.test(stage) &&
  /<h1\b/.test(stage) &&
  /<section\b/.test(stage) &&
  (/<nav\b/.test(stage) || /<fieldset\b/.test(stage) || /role\s*=\s*["']tablist["']/.test(stage)));
check("dynamic state is announced and metrics use a semantic collection",
  /\baria-live\s*=/.test(stage) &&
  (/<dl\b[\s\S]*<dt\b[\s\S]*<dd\b/.test(stage) ||
    /<(?:ul|ol)\b/.test(stage) ||
    /<article\b/.test(stage)));
check("keyboard focus is visibly styled",
  /:focus-visible/.test(css));
check("Director closes to its visible summary while replay focuses the remounted room",
  /directorSummaryRef\.current\?\.focus\(\{\s*preventScroll:\s*true\s*\}\)/.test(stageCode) &&
  /replayFocusPendingRef\.current\s*=\s*true/.test(stageCode) &&
  /if\s*\(!replayFocusPendingRef\.current\)\s*return[\s\S]{0,260}roomHeadingRef\.current\?\.focus[\s\S]{0,100}scrollWindowImmediately\(0\)/.test(stageCode) &&
  /function scrollWindowImmediately[\s\S]{0,500}setProperty\("scroll-behavior",\s*"auto",\s*"important"\)[\s\S]{0,260}window\.scrollTo\([\s\S]{0,100}behavior:\s*"instant"[\s\S]{0,260}window\.scrollTo\(\{\s*top,\s*left,\s*behavior:\s*"instant"\s*\}\)[\s\S]{0,500}removeProperty\("scroll-behavior"\)/.test(
    stageCode,
  ));
check("queue focus actions reveal the focused control",
  (stageCode.match(/scrollIntoView\(\{\s*block:\s*"center",\s*behavior:\s*"auto"\s*\}\)/g) ?? []).length >= 4);
check("Kai is first in the meaningful DOM sequence while desktop keeps intentional spatial banks",
  stage.indexOf('className={styles.kaiBrief}') <
    stage.indexOf('className={styles.healthBank}') &&
  /grid-template-areas:\s*"health brief scope"/.test(css) &&
  /\.kaiBrief\s*\{\s*grid-area:\s*brief/.test(css));
check("the Kai empty-state CTA focuses the single disclosure control",
  /const focusIntakeHandoffControl\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,420}synthetic-intake-handoff-control[\s\S]{0,260}\.focus\(\{\s*preventScroll:\s*true\s*\}\)[\s\S]{0,220}scrollIntoView/.test(
    stageCode,
  ) &&
  /Review synthetic intake handoff/.test(stage) &&
  /id="synthetic-intake-handoff-control"[\s\S]{0,160}aria-expanded=\{intakeOpen\}[\s\S]{0,100}aria-controls="synthetic-intake-handoff"/.test(
    stage,
  ) &&
  /id="synthetic-intake-handoff"[\s\S]{0,80}tabIndex=\{-1\}[\s\S]{0,80}hidden=\{!intakeOpen\}/.test(
    stage,
  ));
check("tablet queue action has its own non-overlapping grid row",
  /@media\s*\(max-width:\s*1023px\)[\s\S]*?\.queueReason\s*\{[\s\S]*?grid-row:\s*2[\s\S]*?\.queueRow button\s*\{[\s\S]*?grid-row:\s*3/.test(
    css,
  ));

// ── 8 · qualitative health and reduced-motion static projection ──────────────
check("health is a qualitative, coverage-honest state",
  /\b(?:Healthy|Watch|At[- ]risk|Not rated|Resolving|Insufficient coverage|Display error)\b/i.test(
    presentationCode,
  ) &&
  /Qualitative review specimen/i.test(presentationCode));
check("no numeric health score or 100-point index exists",
  !/\b(?:healthScore|healthIndex)\b/i.test(presentationCode) &&
  !/\bhealth\s*:\s*\d/i.test(presentationCode) &&
  !/\b\d{1,3}\s*\/\s*100\b/.test(presentationCode) &&
  !/(?:agency\s+health|health\s+(?:score|index))[^\n]{0,100}\b\d{1,3}\s*%/i.test(
    presentationCode,
  ));

const reducedMotionAt = css.search(
  /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/,
);
const reducedMotionCss = reducedMotionAt >= 0 ? css.slice(reducedMotionAt) : "";
check("CSS module includes a reduced-motion static projection",
  reducedMotionAt >= 0 &&
  /animation(?:-duration)?\s*:\s*none\b/.test(reducedMotionCss) &&
  /transition(?:-duration)?\s*:\s*none\b/.test(reducedMotionCss));
check("explicit review cinema can override reduced motion only after route-instance consent",
  /data-motion-override/.test(stageCode) &&
  /reducedMotionOverride\s*&&\s*projection\s*===\s*"cinematic"/.test(stageCode) &&
  /\.room:not\(\[data-motion-override="true"\]\)/.test(reducedMotionCss) &&
  /Force review cinema/.test(stage));
check("constrained capability keeps the cinematic selector unavailable",
  /option\s*===\s*"cinematic"\s*&&\s*!resolution\.cinematicAvailable/.test(stageCode) &&
  /Cinematic projection is unavailable on this constrained device/.test(stageCode));
check("Tier D is completely static and hidden documents pause ambient presence",
  /\.room\[data-tier="D"\]\s+\*[\s\S]{0,220}animation:\s*none[\s\S]{0,160}transition:\s*none/.test(
    css,
  ) &&
  /\.room\[data-hidden="true"\]\s+\.ambientSweep[\s\S]{0,80}animation-play-state:\s*paused/.test(
    css,
  ));
check("Tier D also overrides and restores the root scrolling behavior",
  /if\s*\(resolution\.tier\s*!==\s*"D"\)\s*return[\s\S]{0,420}document\.documentElement[\s\S]{0,420}setProperty\("scroll-behavior",\s*"auto",\s*"important"\)[\s\S]{0,620}removeProperty\("scroll-behavior"\)/.test(
    stageCode,
  ));
check("initial capability hydration cannot announce a false preference change",
  /if\s*\(capabilities\.detectionFailed\)\s*return[\s\S]{0,220}if\s*\(!capabilitiesHydratedRef\.current\)[\s\S]{0,220}previousReducedMotionRef\.current\s*=\s*current[\s\S]{0,80}return/.test(
    stageCode,
  ));
check("mobile layout honors horizontal safe areas without viewport-width overflow math",
  /env\(safe-area-inset-left\)/.test(css) &&
  /env\(safe-area-inset-right\)/.test(css) &&
  /@media\s*\(max-width:\s*767px\)[\s\S]*?\.director\s*\{[\s\S]*?left:\s*max\([\s\S]*?right:\s*max\([\s\S]*?width:\s*auto/.test(
    css,
  ) &&
  !/width:\s*calc\(100vw/.test(css));
check("the room honors the top display safe area at desktop and mobile widths",
  (css.match(/env\(safe-area-inset-top\)/g) ?? []).length >= 2 &&
  /max\(2rem,\s*calc\(env\(safe-area-inset-top\)\s*\+\s*1rem\)\)/.test(
    css,
  ) &&
  /max\(1\.2rem,\s*calc\(env\(safe-area-inset-top\)\s*\+\s*0\.75rem\)\)/.test(
    css,
  ));
check("Founder navigation links retain 44px minimum targets",
  /\.footer a\s*\{[\s\S]{0,120}min-height:\s*2\.75rem/.test(css));
check("CSS performs no external request and never forces smooth scrolling",
  !/@import\b|url\(\s*["']?(?:https?:|\/\/)/i.test(css) &&
  !/scroll-behavior\s*:\s*smooth/i.test(css));
check("compact labels never fall below the 12px review floor",
  !/font-size:\s*(?:0\.6875rem|11px)\b/.test(css));

// ── 9 · compliance-sensitive copy stays educational and non-promissory ───────
const complianceClaims = presentationCode
  .replace(/\bnot a legal deadline\b/gi, "")
  .replace(/\bno [^.\n]{0,120}\blegal deadlines?\b/gi, "");
const forbiddenCopy: Array<[string, RegExp]> = [
  ["guaranteed outcome", /\bguaranteed?\s+(?:deletion|removal|result|outcome|score|improvement)\b/i],
  ["promised deletion/removal", /\b(?:will|shall)\s+(?:be\s+)?(?:delete|deleted|remove|removed)\b/i],
  ["promised score change", /\b(?:will|shall)\s+(?:increase|improve|raise)\b[^.\n]{0,40}\bscore\b/i],
  ["score-gain marketing", /\b(?:\d+\s*[- ]?point\s+(?:increase|gain)|score (?:gain|improvement))\b/i],
  ["success-rate/results-typical claim", /\b(?:success rate|results? typical)\b/i],
  ["section 609 or Metro 2 deletion myth", /§\s*609|\bMetro[- ]?2\b/i],
  ["legal-deadline overclaim", /\b(?:response|legal)\s+deadline\b|\bwindow (?:closes|passed)\b|\bnext round due\b|\boverdue\b/i],
  ["autonomous/compliance assurance", /\bKai (?:ensures compliance|monitors everything|verified the deadline)\b|\bcompliance (?:green|certified)\b/i],
  ["causal or ranked deletion KPI", /\b(?:accounts deleted|top specialist by deletions?)\b/i],
  ["false live telemetry", /\b(?:real[- ]?time team performance|live agency health|all systems green)\b/i],
  ["financial-health claim", /\byour business is healthy\b|\bprofit forecast\b|\brevenue verified\b/i],
  ["credit-repair outcome service claim", /\bwe (?:delete|remove|repair)\b[^.\n]{0,50}\b(?:credit|negative|tradeline|account)/i],
];
for (const [label, pattern] of forbiddenCopy) {
  check(`compliance copy: no ${label}`, !pattern.test(complianceClaims));
}

// ── 10 · no Phase 6 coupling enters the live /agency surface or APIs ──────────
const liveAgencySources = [
  read("app/agency/page.tsx"),
  read("app/api/agency/context/route.ts"),
  read("app/api/agency/clients/route.ts"),
  read("app/api/agency/kpi/route.ts"),
  read("app/api/agency/select/route.ts"),
  read("app/api/agency/enable/route.ts"),
].join("\n");
check("live /agency surface and APIs contain no Phase 6 review coupling",
  !/agency-command|AgencyCommand(?:Stage|Fixture)|CXOS Phase 6/i.test(liveAgencySources));

console.log(`\ncxos-agency-command.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
