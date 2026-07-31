// Run: npx --no-install tsx scripts/cxos-agency-command.test.ts
//
// SOURCE-LEVEL guard for the CXOS Phase 6.1 Living Agency Command review room.
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
  ["clipboard, share, cross-window, or broadcast transport", /\bnavigator\.(?:clipboard|share)\b|\bpostMessage\s*\(|\bBroadcastChannel\b/],
  ["unsafe HTML or code evaluation", /\bdangerouslySetInnerHTML\b|\.innerHTML\b|\beval\s*\(|\bnew\s+Function\b/],
  ["generative runtime or live Kai import", /@\/lib\/kai|@anthropic-ai|openai|generative-ai/i],
  ["file input", /<input\b[^>]*\btype\s*=\s*["']file["']/i],
];
for (const [label, pattern] of forbiddenRuntime) {
  check(`no ${label}`, !pattern.test(presentationCode));
}

const forbiddenMutation: Array<[string, RegExp]> = [
  ["HTTP mutation method", /\bmethod\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i],
  ["form submission", /<form\b|\bonSubmit\s*=|type\s*=\s*["']submit["']|\bformAction\s*=/i],
  ["server action", /\baction\s*=\s*\{/],
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
const reviewReturnCall = 'window.location.assign("/review/mission-control")';
const stageWithoutReviewReturn = stageCode.replace(reviewReturnCall, "");
check("the only imperative navigation is the explicit Mission Control review return",
  (stageCode.match(/window\.location\.assign\("\/review\/mission-control"\)/g) ?? []).length === 1 &&
  !/\b(?:router\.(?:push|replace)|location\.(?:assign|replace)|window\.location)\b/.test(
    stageWithoutReviewReturn,
  ) &&
  /href="\/review\/mission-control"[\s\S]{0,180}onClick=\{beginMissionControlReturn\}/.test(
    stage,
  ));

// ── 5 · deterministic fixtures: no clocks, randomness, crypto, or timers ──────
const nondeterministic: Array<[string, RegExp]> = [
  ["Date/clock read", /\bDate\b|\bperformance\.(?:now|timeOrigin)\b/],
  ["randomness", /\bMath\.random\b|\bcrypto\b|\brandomUUID\b/],
  ["frame/elapsed metric", /\b(?:fps|frameTimes|elapsedMs|durationMs)\b/],
];
for (const [label, pattern] of nondeterministic) {
  check(`determinism: no ${label}`, !pattern.test(presentationCode));
}
check("determinism: the only timer is the bounded return-navigation fallback",
  (presentationCode.match(/\bsetTimeout\b/g) ?? []).length === 1 &&
  /returnFallbackRef\.current\s*=\s*window\.setTimeout\(\s*commitMissionControlReturn,\s*800\s*\)/.test(
    stageCode,
  ) &&
  !/\b(?:setInterval|requestIdleCallback)\b/.test(presentationCode));

// ── 5a · purpose-bound operational heartbeat ────────────────────────────────
for (const motion of ["entering", "advancing", "waiting", "blocked", "resolving"]) {
  check(`heartbeat fixture includes exactly one ${motion} signal`,
    (fixtures.match(new RegExp(`motion: "${motion}"`, "g")) ?? []).length === 1);
}
check("heartbeat permanently discloses fixed choreography and unchanged facts",
  /DETERMINISTIC FIXTURE RHYTHM · NOT LIVE/.test(stage) &&
  /Motion replays fixed work[\s\S]{0,180}without[\s\S]{0,120}changing a count, rank, label, record, or canonical fact/.test(
    stage,
  ));
check("spatial instruments cover flow, capacity, workload, response aging, evidence, bottlenecks, and honest throughput",
  /CLIENT FLOW RAIL/.test(stage) &&
  /CAPACITY HORIZON/.test(stage) &&
  /WORK PRESSURE FIELD/.test(stage) &&
  /RESPONSE AGING RULER/.test(stage) &&
  /EVIDENCE COVERAGE RAIL/.test(stage) &&
  /BOTTLENECK GATES/.test(stage) &&
  /<dt>Throughput rate<\/dt>[\s\S]{0,80}<dd>Not instrumented<\/dd>/.test(
    stage,
  ));
check("heartbeat alternatives remain truthful for empty, loading, unavailable, and error",
  /truthfully idle[\s\S]{0,120}no synthetic activity is fabricated/.test(stage) &&
  /manually held[\s\S]{0,140}No timer or simulated completion runs/.test(stage) &&
  /Missing flow positions and evidence are not inferred/.test(stage) &&
  /missing movement is not guessed/.test(stage));
check("loading never presents resolved capacity as fact",
  /fixtureState\s*===\s*"loading"\s*\?\s*"capacity unresolved"/.test(stageCode) &&
  /<ActivationRail state=\{fixtureState\}/.test(stage) &&
  /state\s*===\s*"loading"[\s\S]{0,500}Fixture sources unresolved[\s\S]{0,180}Capacity horizon held[\s\S]{0,180}Ledgers held[\s\S]{0,180}Kai fixture held/.test(
    stageCode,
  ) &&
  /const unresolved\s*=\s*state\s*===\s*"loading"/.test(stageCode) &&
  /Unresolved · no occupancy inferred/.test(stage) &&
  /!unresolved\s*&&\s*Array\.from/.test(stageCode) &&
  /Fixture sources are unresolved[\s\S]{0,100}displays no capacity value/.test(
    stage,
  ));
const continuousAnimations = [
  ...css.matchAll(/animation:\s*([a-zA-Z0-9_-]+)[^;]*\binfinite\b/g),
].map((match) => match[1]);
const allowedContinuousAnimations = new Set([
  "agencySweep",
  "agencyBreath",
  "agencyFlowEntering",
  "agencyFlowAdvancing",
  "agencyFlowWaiting",
  "agencyFlowBlocked",
  "agencyFlowResolving",
]);
check("continuous CSS motion is restricted to room breath, sweep, and fixed flow-state channels",
  continuousAnimations.length > 0 &&
  continuousAnimations.every((name) => allowedContinuousAnimations.has(name)) &&
  [...allowedContinuousAnimations].every((name) =>
    continuousAnimations.includes(name)
  ));
check("heartbeat motion has no Canvas, WebGL, video, external animation dependency, or JavaScript loop",
  !/<canvas\b|<video\b|\bWebGL\b|\bTHREE\s*\.|\bGSAP\b|\bLottie\b|\bRive\b/i.test(
    presentationCode,
  ) &&
  !/\b(?:setInterval|requestAnimationFrame)\s*\([\s\S]{0,180}\b(?:loop|tick|animate)\b/i.test(
    presentationCode,
  ));

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

// ── 6a · Kai operating presence remains local, synthetic, and complete ──────
const kaiWorkflowSource = fixtures.slice(
  fixtures.indexOf("export const AGENCY_KAI_WORKFLOWS"),
);
const requiredKaiWorkflows = [
  "note-taking",
  "reminders",
  "scheduling",
  "activity-summary",
  "task-preparation",
  "bottleneck-identification",
  "follow-up-planning",
  "client-work-organization",
  "meeting-preparation",
  "operational-explanation",
  "suggested-next-actions",
];
for (const workflow of requiredKaiWorkflows) {
  check(`Kai workflow exists exactly once: ${workflow}`,
    (kaiWorkflowSource.match(new RegExp(`id: "${workflow}"`, "g")) ?? []).length === 1);
}
check("Kai workbench carries the exact route-instance and no-real-customer-data boundary",
  /SYNTHETIC KAI WORKBENCH · ROUTE-INSTANCE ONLY/.test(stage) &&
  /discarded on[\s\S]{0,40}refresh or exit/.test(stage) &&
  /does not save notes, create reminders[\s\S]{0,220}trigger production action/.test(
    stage,
  ) &&
  /Do not enter real customer information/.test(stage));
check("every prepared Kai artifact ends with a truthful no-action receipt",
  /PREVIEW PREPARED · Nothing was saved, sent, scheduled, assigned,[\s\S]{0,60}or changed\. Kai recommends; the operator reviews\. Educational[\s\S]{0,40}information, not legal advice\./.test(
    stage,
  ));
check("Kai selectors, prepare, reset, and note changes are real route-state controls",
  /const selectKaiWorkflow\s*=/.test(stageCode) &&
  /const prepareKaiWorkflow\s*=/.test(stageCode) &&
  /const resetKaiWorkbench\s*=/.test(stageCode) &&
  /const updateKaiNoteDraft\s*=/.test(stageCode) &&
  /setPreparedKaiWorkflow\(null\)/.test(stageCode) &&
  /aria-controls="kai-workflow-preview"/.test(stage));
const textareaTags = [...stage.matchAll(/<textarea\b[\s\S]*?>/g)].map(
  (match) => match[0],
);
check("the single fixture-note textarea is bounded, private-by-design, and not form-addressable",
  textareaTags.length === 1 &&
  textareaTags.every((tag) =>
    /\bmaxLength=\{280\}/.test(tag) &&
    /\bspellCheck=\{false\}/.test(tag) &&
    /\bautoComplete="off"/.test(tag) &&
    /\baria-describedby="kai-synthetic-note-boundary"/.test(tag) &&
    !/\bname\s*=/.test(tag)
  ) &&
  /<label htmlFor="kai-synthetic-note">/.test(stage) &&
  /<small id="kai-synthetic-note-boundary">/.test(stage));
check("editable Kai note content is classified as an operator draft, not fact",
  /id:\s*"note-taking"[\s\S]{0,120}classification:\s*"OPERATOR DRAFT"/.test(
    fixtures,
  ) &&
  !/id:\s*"note-taking"[\s\S]{0,120}classification:\s*"DISPLAYED FACT"/.test(
    fixtures,
  ));
check("Kai copy makes no affirmative external-completion or fake-live claim",
  !/\bKai (?:saved|scheduled|sent|assigned|created|updated|notified|contacted)\b/i.test(
    presentationCode,
  ) &&
  !/\b(?:live feed|real-time|just arrived|just now)\b|Kai is continuously monitoring/i.test(
    presentationCode,
  ));

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
check("mobile-first DOM sequence matches the meaningful operating journey",
  stage.indexOf('className={styles.kaiBrief}') <
    stage.indexOf("<OperationalHeartbeat") &&
  stage.indexOf("<OperationalHeartbeat") <
    stage.indexOf("<KaiOperatingDesk") &&
  stage.indexOf("<KaiOperatingDesk") <
    stage.indexOf('className={styles.healthBank}') &&
  stage.indexOf('className={styles.healthBank}') <
    stage.indexOf('className={styles.scopeBank}') &&
  /grid-template-areas:\s*"health brief scope"/.test(css) &&
  /\.kaiBrief\s*\{\s*grid-area:\s*brief/.test(css));
check("mobile intentionally orders Kai, heartbeat, delegation, priority, then health and capacity",
  /@media\s*\(max-width:\s*767px\)[\s\S]*?\.commandWall\s*\{[\s\S]*?grid-template-areas:\s*"brief"\s*"pulse"\s*"desk"\s*"notice"\s*"queue"\s*"health"\s*"scope"/.test(
    css,
  ));
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
check("tablet grid preserves the mobile-first semantic operating order",
  /@media\s*\(max-width:\s*1023px\)[\s\S]*?\.commandWall\s*\{[\s\S]*?grid-template-areas:\s*"brief brief"\s*"pulse pulse"\s*"desk desk"\s*"notice notice"\s*"queue queue"\s*"health scope"/.test(
    css,
  ));
check("arrival is sequenced, replayable, and user input settles it immediately",
  /data-arrival-settled=\{arrivalSettled \? "true" : "false"\}/.test(stage) &&
  /onKeyDown=\{settleArrival\}/.test(stage) &&
  /onPointerDown=\{settleArrival\}/.test(stage) &&
  /onTouchStart=\{settleArrival\}/.test(stage) &&
  /onWheel=\{settleArrival\}/.test(stage) &&
  /setArrivalSettled\(false\)[\s\S]{0,100}setArrivalKey/.test(stageCode) &&
  /agencyIdentityAcquire/.test(css) &&
  /agencySystemActivate/.test(css) &&
  /agencyCapacityForm/.test(css) &&
  /agencyLedgerActivate/.test(css) &&
  /agencyKaiArrive/.test(css));
check("Mission Control return uses a short acknowledged departure and immediate static fallback",
  /const beginMissionControlReturn\s*=/.test(stageCode) &&
  /const commitMissionControlReturn\s*=/.test(stageCode) &&
  /resolution\.tier\s*===\s*"C"\s*\|\|\s*resolution\.tier\s*===\s*"D"/.test(
    stageCode,
  ) &&
  /onAnimationEnd=\{completeMissionControlReturn\}/.test(stage) &&
  /window\.clearTimeout\(returnFallbackRef\.current\)/.test(stageCode) &&
  /data-departing=\{departing \? "true" : "false"\}/.test(stage) &&
  /className=\{styles\.departureHandoff\}/.test(stage) &&
  /agencyReturnHandoff 460ms/.test(css));

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
  /\.room\[data-hidden="true"\]\s+\.ambientSweep,[\s\S]{0,120}\.room\[data-hidden="true"\]\s+\.roomBreath,[\s\S]{0,120}\.room\[data-hidden="true"\]\s+\.flowTrack b[\s\S]{0,80}animation-play-state:\s*paused/.test(
    css,
  ));
check("Tier C, Tier D, and reduced motion keep the complete static final frame",
  /\.room\[data-tier="C"\]\s+\*,[\s\S]{0,260}\.room\[data-tier="D"\]\s+\*[\s\S]{0,220}animation:\s*none/.test(
    css,
  ) &&
  /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/.test(css));
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

const languageMarkdown = read("CXOS_LANGUAGE_1_0.md");
const languageHtml = read("CXOS_LANGUAGE_1_0.html");
const heartbeatLaw =
  "Every operating room must possess an observable operational heartbeat. Motion, rhythm, and ambient state must express that room’s actual purpose without changing canonical facts or fabricating live activity.";
check("CXOS Language 1.0 establishes the exact operational-heartbeat law in Markdown and HTML",
  languageMarkdown.includes(heartbeatLaw) &&
  languageHtml.includes(heartbeatLaw));
check("CXOS Language governs future Mission Control without modifying it in Phase 6.1",
  /Mission Control will later apply the law[\s\S]{0,180}Phase 6\.1 does not modify Mission Control/.test(
    languageMarkdown,
  ) &&
  /Mission Control will later map heartbeat[\s\S]{0,180}Phase 6\.1 does not modify it/.test(
    languageHtml,
  ));

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
