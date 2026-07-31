// Run: npx --no-install tsx scripts/cxos-agency-command.test.ts
//
// SOURCE + PURE-BEHAVIOUR guard for the CXOS Phase 6.2 Agency Headquarters
// Founder Review. Browser and visual evidence still belongs in the Phase 6.2 QA
// ledger; this guard holds the architectural boundary:
//
//   deterministic local fixtures -> one bounded local command resolver
//     -> seven review-only districts -> no production effect
//
// No live Agency workspace, auth/session state, API, database, billing, storage,
// product navigation, model, clock, or random value may cross that boundary.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  AGENCY_AUTHORIZED_SOURCES,
  AGENCY_DISTRICTS,
  AGENCY_FIXTURE_STATES,
  AGENCY_HEALTH_DRIVERS,
  AGENCY_KAI_NO_ACTION_RECEIPT,
  AGENCY_KAI_WORKFLOWS,
  AGENCY_PORTFOLIO,
  AGENCY_QUEUE,
  resolveAgencyKaiIntent,
  type AgencyDistrictId,
  type KaiWorkflowId,
} from "../app/review/agency-command/fixtures";

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

function sourceBetween(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  return startAt >= 0
    ? source.slice(startAt, endAt >= 0 ? endAt : undefined)
    : "";
}

const page = read("app/review/agency-command/page.tsx");
const stage = read("app/review/agency-command/stage.tsx");
const fixtures = read("app/review/agency-command/fixtures.ts");
const css = read("app/review/agency-command/agency-command.module.css");
const pageCode = codeOf(page);
const stageCode = codeOf(stage);
const fixtureCode = codeOf(fixtures);
const presentationCode = `${stageCode}\n${fixtureCode}`;

// -- 1 · exact, isolated Phase 6.2 route surface -----------------------------
for (const file of expectedRouteFiles) {
  check(`route file exists: ${file}`, existsSync(join(routeDir, file)));
}
const actualRouteFiles = existsSync(routeDir)
  ? readdirSync(routeDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort()
  : [];
check(
  "the Phase 6.2 route contains exactly the four reviewed source files",
  JSON.stringify(actualRouteFiles) === JSON.stringify(expectedRouteFiles),
);
check(
  "route metadata and visible stage labels identify Phase 6.2",
  /CXOS Phase 6\.2/.test(page) &&
    /CXOS Phase 6\.2/.test(stage) &&
    /Phase 6\.2 is presentation-only/.test(stage) &&
    /CXOS Phase 6\.2/.test(fixtures) &&
    !/Phase 6\.1/.test(`${page}\n${stage}\n${fixtures}`),
);

// -- 2 · production hard-off and truthful review fallback -------------------
const gateAt = page.indexOf("reviewBuildAllowed()");
const stageAt = page.indexOf("<AgencyCommandStage");
check(
  "page is a server component gated through reviewBuildAllowed",
  page.length > 0 &&
    !/^["']use client["'];/m.test(page) &&
    /from ["']@\/lib\/cxos\/reviewMode["']/.test(page) &&
    gateAt !== -1 &&
    stageAt !== -1 &&
    gateAt < stageAt,
);
check(
  "review-disabled branch renders the established truthful fallback",
  /if\s*\(\s*!reviewBuildAllowed\(\)\s*\)\s*\{[\s\S]*<main[\s\S]{0,180}id="main"[\s\S]*Founder Review is not enabled in this build\./.test(
    page,
  ),
);
check(
  "allowed branch renders only the local Agency Command stage",
  /return\s*<AgencyCommandStage\s*\/>/.test(page),
);

const pageImports = importSources(page);
const allowedPageImports = new Set(["@/lib/cxos/reviewMode", "./stage"]);
check(
  "page imports only the review gate and local stage",
  pageImports.length === allowedPageImports.size &&
    pageImports.every((source) => allowedPageImports.has(source)) &&
    [...allowedPageImports].every((source) => pageImports.includes(source)),
);

// -- 3 · strict client import boundary --------------------------------------
const stageImports = importSources(stage);
const allowedStageImports = new Set([
  "react",
  "./fixtures",
  "./agency-command.module.css",
]);
check(
  "stage imports only React, local fixtures, and its CSS module",
  stageImports.length === allowedStageImports.size &&
    stageImports.every((source) => allowedStageImports.has(source)) &&
    [...allowedStageImports].every((source) => stageImports.includes(source)),
);
check(
  "fixtures import nothing and remain literal deterministic review data",
  importSources(fixtures).length === 0 && !/\brequire\s*\(/.test(fixtureCode),
);
check(
  "stage has no dynamic import or CommonJS escape hatch",
  !/\bimport\s*\(|\brequire\s*\(/.test(stageCode),
);
check(
  "stage cannot reach Next navigation, AppShell, or shared/live components",
  !/next\/(?:link|navigation)|\bAppShell\b|@\/components|@\/lib/.test(stageCode),
);

// -- 4 · seven exact districts, with no eighth source of room truth ----------
const expectedDistricts: readonly {
  id: AgencyDistrictId;
  index: string;
  name: string;
}[] = [
  { id: "central-command", index: "01", name: "Central Command" },
  { id: "client-operations", index: "02", name: "Client Operations Floor" },
  { id: "team-operations", index: "03", name: "Team Operations Room" },
  { id: "business-health", index: "04", name: "Business Health Observatory" },
  { id: "evidence-archive", index: "05", name: "Activity and Evidence Archive" },
  { id: "kai-suite", index: "06", name: "Kai Executive Suite" },
  { id: "growth-threshold", index: "07", name: "Growth / Capacity Threshold" },
];
check(
  "fixture exports the exact seven Phase 6.2 districts in journey order",
  JSON.stringify(
    AGENCY_DISTRICTS.map(({ id, index, name }) => ({ id, index, name })),
  ) === JSON.stringify(expectedDistricts),
);
check(
  "district ids, names, indices, and suggestions are complete and unique",
  new Set(AGENCY_DISTRICTS.map((district) => district.id)).size === 7 &&
    new Set(AGENCY_DISTRICTS.map((district) => district.name)).size === 7 &&
    new Set(AGENCY_DISTRICTS.map((district) => district.index)).size === 7 &&
    AGENCY_DISTRICTS.every(
      (district) =>
        district.purpose.length > 0 &&
        district.truthBoundary.length > 0 &&
        district.kaiContext.length > 0 &&
        district.suggestions.length === 3,
    ),
);
const renderedDistrictIndexes = [
  ...stage.matchAll(/district=\{AGENCY_DISTRICTS\[(\d)\]\}/g),
].map((match) => Number(match[1]));
check(
  "the stage renders each canonical district exactly once",
  JSON.stringify(renderedDistrictIndexes) === JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
);
check(
  "the directory and district shell share canonical district metadata",
  /AGENCY_DISTRICTS\.map\(\(district\)\s*=>/.test(stageCode) &&
    /data-agency-district=\{district\.id\}/.test(stage) &&
    /aria-labelledby=\{`\$\{district\.id\}-heading`\}/.test(stage) &&
    /DISTRICT \{district\.index\} \/ 07/.test(stage) &&
    /\{district\.truthBoundary\}/.test(stage) &&
    /\{district\.kaiContext\}/.test(stage) &&
    /Continue to \{nextDistrict\.name\}/.test(stage),
);

// -- 5 · six deterministic arrival beats ------------------------------------
const activationRailSource = sourceBetween(
  stage,
  "function ActivationRail",
  "function CapacityHorizon",
);
const activationTuples = [
  ...activationRailSource.matchAll(
    /\[\s*"(0[1-6])",\s*"([^"]+)",\s*"([^"]+)"\s*\]/g,
  ),
].map((match) => match.slice(1));
const expectedLoadingBeats = [
  ["01", "Origin acknowledged", "Mission Control transfer"],
  ["02", "Authority recognized", "Synthetic operator only"],
  ["03", "Facility acquisition", "Fixture scope unresolved"],
  ["04", "Systems held", "No occupancy inferred"],
  ["05", "Kai channel held", "Awaiting displayed sources"],
  ["06", "Command settlement", "Complete static state available"],
];
const expectedSettledBeats = [
  ["01", "Origin acknowledged", "Mission Control transfer"],
  ["02", "Authority recognized", "Synthetic operator only"],
  ["03", "Facility acquired", "Agency scope resolved"],
  ["04", "Systems online", "Fixed horizon and ledgers"],
  ["05", "Kai greeting", "Deterministic channel ready"],
  ["06", "Command settled", "Seven districts available"],
];
check(
  "loading and resolved arrival projections each expose the exact six beats",
  JSON.stringify(activationTuples.slice(0, 6)) ===
    JSON.stringify(expectedLoadingBeats) &&
    JSON.stringify(activationTuples.slice(6)) ===
      JSON.stringify(expectedSettledBeats),
);
check(
  "arrival is sequenced, replayable, skippable, and Escape settles it",
  /data-arrival-settled=\{arrivalSettled \? "true" : "false"\}/.test(stage) &&
    /setArrivalSettled\(false\)[\s\S]{0,120}setArrivalKey/.test(stageCode) &&
    /event\.key !== "Escape"/.test(stageCode) &&
    /Skip arrival/.test(stage) &&
    /agencyIdentityAcquire/.test(css) &&
    /agencySystemActivate/.test(css) &&
    /agencyCapacityForm/.test(css) &&
    /agencyLedgerActivate/.test(css) &&
    /agencyKaiArrive/.test(css),
);
check(
  "facility pulse names the six purpose-bound operating channels",
  ["capacity", "client-flow", "queue-pressure", "evidence", "bottleneck", "kai"].every(
    (channel) =>
      (stage.match(new RegExp(`data-channel="${channel}"`, "g")) ?? []).length === 1,
  ),
);

// -- 6 · pure deterministic Kai resolver executes all supported boundaries ---
const expectedWorkflowIds: readonly KaiWorkflowId[] = [
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
check(
  "fixtures expose exactly the 11 canonical Kai intents",
  JSON.stringify(AGENCY_KAI_WORKFLOWS.map((workflow) => workflow.id)) ===
    JSON.stringify(expectedWorkflowIds) &&
    new Set(AGENCY_KAI_WORKFLOWS.map((workflow) => workflow.id)).size === 11,
);

const supportedCommands: readonly [KaiWorkflowId, string][] = [
  ["note-taking", "Take a note about Client 014"],
  ["reminders", "Remind me to review this response tomorrow"],
  ["scheduling", "Build my schedule for today"],
  ["activity-summary", "Summarize agency activity"],
  ["task-preparation", "Prepare my morning priorities"],
  ["bottleneck-identification", "Identify current bottlenecks"],
  ["follow-up-planning", "Create a follow-up plan"],
  ["client-work-organization", "Organize today's client work"],
  ["meeting-preparation", "Prepare my team meeting"],
  ["operational-explanation", "Explain the current agency condition"],
  ["suggested-next-actions", "Suggest what I should do next"],
];
for (const [workflowId, command] of supportedCommands) {
  const result = resolveAgencyKaiIntent(command);
  check(
    `pure resolver maps the canonical ${workflowId} command`,
    result.status === "supported" &&
      result.workflowId === workflowId &&
      result.responseLines.length > 0 &&
      result.receipt.includes(AGENCY_KAI_NO_ACTION_RECEIPT),
  );
}

const normalized = resolveAgencyKaiIntent(
  "  ＳＵＭＭＡＲＩＺＥ   ＡＧＥＮＣＹ   ＡＣＴＩＶＩＴＹ  ",
);
check(
  "resolver applies NFKC, case, whitespace, and trim normalization",
  normalized.status === "supported" &&
    normalized.workflowId === "activity-summary" &&
    normalized.normalizedCommand === "summarize agency activity",
);
const blank = resolveAgencyKaiIntent(" \n\t ");
check(
  "blank commands prepare no artifact",
  blank.status === "empty" &&
    blank.workflowId === null &&
    blank.receipt === AGENCY_KAI_NO_ACTION_RECEIPT,
);
const unknown = resolveAgencyKaiIntent("Book a vacation");
check(
  "unknown commands fail closed",
  unknown.status === "unsupported" &&
    unknown.workflowId === null &&
    /unavailable/.test(unknown.headline.toLowerCase()),
);
const ambiguous = resolveAgencyKaiIntent(
  "Summarize activity and explain the agency condition",
);
check(
  "ambiguous commands fail closed instead of choosing a default intent",
  ambiguous.status === "unsupported" &&
    ambiguous.workflowId === null &&
    /one synthetic command at a time/i.test(ambiguous.headline) &&
    /more than one fixture intent/i.test(ambiguous.responseLines.join(" ")),
);
const effectSeeking = resolveAgencyKaiIntent("Send the activity summary");
check(
  "effect-seeking commands override an otherwise supported match",
  effectSeeking.status === "unsupported" &&
    effectSeeking.workflowId === null &&
    /synthetic review boundary/i.test(effectSeeking.sources),
);
const createEffect = resolveAgencyKaiIntent("Create a reminder tomorrow");
check(
  "create/save semantics never escape through reminder matching",
  createEffect.status === "unsupported" && createEffect.workflowId === null,
);
const legal = resolveAgencyKaiIntent(
  "Explain the legal advice deadline for Client 014",
);
check(
  "legal and outcome requests fail closed even when another intent matches",
  legal.status === "unsupported" &&
    legal.workflowId === null &&
    /synthetic review boundary/i.test(legal.sources),
);
const overlength = resolveAgencyKaiIntent(
  `Summarize agency activity ${"fixture ".repeat(80)}`,
);
check(
  "overlength commands are normalized to the 240-character local ceiling",
  overlength.status === "unsupported" &&
    overlength.workflowId === null &&
    overlength.normalizedCommand.length === 240,
);
for (const command of [
  "Book a meeting",
  "Cancel the meeting",
  "Update Client 027",
  "Mark Client 027 complete",
  "Explain why this violates the FCRA",
  "Suggest what I should do next to dispute everything",
]) {
  const result = resolveAgencyKaiIntent(command);
  check(
    `effect/legal adversary fails closed: ${command}`,
    result.status === "unsupported" &&
      result.workflowId === null &&
      /synthetic review boundary/i.test(result.sources),
  );
}
check(
  "resolver is deterministic for identical input",
  JSON.stringify(resolveAgencyKaiIntent("Prepare my morning priorities")) ===
    JSON.stringify(resolveAgencyKaiIntent("Prepare my morning priorities")),
);

const resolverSource = fixtures.slice(
  fixtures.indexOf("export function resolveAgencyKaiIntent"),
);
check(
  "resolver is a pure fixed matcher with explicit normalization and one-intent fail-closed logic",
  /\.normalize\("NFKC"\)[\s\S]{0,180}\.toLocaleLowerCase\("en-US"\)[\s\S]{0,180}\.replace\(\/\\s\+\/g, " "\)[\s\S]{0,120}\.trim\(\)[\s\S]{0,120}\.slice\(0, 240\)/.test(
    resolverSource,
  ) &&
    /matchingRules\.length === 1/.test(resolverSource) &&
    /signalMatches\.length === 1/.test(resolverSource) &&
    /signalMatches\.length > 1/.test(resolverSource) &&
    !/\b(?:window|document|navigator|fetch|useState|useEffect|Date|performance\.now|Math\.random|crypto)\b/.test(
      codeOf(resolverSource),
    ),
);

const expectedFixtureStates = [
  "populated",
  "empty",
  "loading",
  "unavailable",
  "error",
  "permission",
  "capacity",
];
check(
  "all seven inherited fixture states remain available in exact order",
  JSON.stringify(AGENCY_FIXTURE_STATES.map((state) => state.key)) ===
    JSON.stringify(expectedFixtureStates),
);
check(
  "every fixture state has an explicit qualitative-health projection",
  JSON.stringify(Object.keys(AGENCY_HEALTH_DRIVERS)) ===
    JSON.stringify(expectedFixtureStates) &&
    AGENCY_HEALTH_DRIVERS.populated.length === 4 &&
    AGENCY_HEALTH_DRIVERS.empty.length === 4 &&
    AGENCY_HEALTH_DRIVERS.unavailable.length === 4 &&
    AGENCY_HEALTH_DRIVERS.error.length === 4 &&
    AGENCY_HEALTH_DRIVERS.capacity.length === 4 &&
    AGENCY_HEALTH_DRIVERS.loading.length === 0 &&
    AGENCY_HEALTH_DRIVERS.permission.length === 0,
);
check(
  "queue, portfolio, and Kai fixture inventories preserve their reviewed counts",
  AGENCY_QUEUE.length === 5 &&
    AGENCY_PORTFOLIO.length === 5 &&
    AGENCY_KAI_WORKFLOWS.length === 11,
);
check(
  "empty, loading, unavailable, and error heartbeat boundaries remain explicit",
  /truthfully idle: no illustrative work is staged/.test(stage) &&
    /manually held while fixture sources are unresolved/.test(stage) &&
    /available source boundary remains visible/.test(stage) &&
    /held at the disclosed display-error boundary/.test(stage),
);
check(
  "loading never presents resolved occupancy, portfolio, or evidence as fact",
  /Unresolved · no occupancy inferred/.test(stage) &&
    /Fixture sources are unresolved\. No receipt, document state, or history is asserted\./.test(
      stage,
    ) &&
    /state === "loading" \? \(\s*<StaticSkeleton/.test(stage),
);
check(
  "the empty fixture renders no portfolio rows and only a proposed intake boundary",
  /fixtureState === "empty"\s*\? \[\]/.test(stageCode) &&
    /No illustrative portfolio or evidence history is staged/.test(stage) &&
    /future authorized product flow/.test(stage) &&
    /No Phase 6[\s\S]{0,80}(?:flow|workflow) is connected here/.test(stage),
);

// -- 7 · exactly one bounded natural-language command surface ----------------
const formTags = [...stage.matchAll(/<form\b[\s\S]*?>/g)].map((match) => match[0]);
const inputTags = [...stage.matchAll(/<input\b[\s\S]*?>/g)].map((match) => match[0]);
const textareaTags = [...stage.matchAll(/<textarea\b[\s\S]*?>/g)].map((match) => match[0]);
check(
  "the route has exactly one natural-language form and one text input",
  formTags.length === 1 &&
    inputTags.length === 1 &&
    textareaTags.length === 0 &&
    /className=\{styles\.kaiCommandForm\}\s+onSubmit=\{onSubmit\}/.test(formTags[0]),
);
check(
  "the command input is bounded, private-by-design, labelled, and not form-addressable",
  /\bid="kai-synthetic-command"/.test(inputTags[0] ?? "") &&
    /\btype="text"/.test(inputTags[0] ?? "") &&
    /\bmaxLength=\{240\}/.test(inputTags[0] ?? "") &&
    /\bspellCheck=\{false\}/.test(inputTags[0] ?? "") &&
    /\bautoComplete="off"/.test(inputTags[0] ?? "") &&
    /\baria-describedby="kai-command-boundary"/.test(inputTags[0] ?? "") &&
    !/\bname\s*=/.test(inputTags[0] ?? "") &&
    /<label htmlFor="kai-synthetic-command">/.test(stage) &&
    /<small id="kai-command-boundary">/.test(stage),
);
check(
  "the one submit stays local and calls the pure resolver exactly once",
  (stage.match(/type="submit"/g) ?? []).length === 1 &&
    /const prepareKaiCommand\s*=\s*\(event: React\.FormEvent<HTMLFormElement>\)/.test(
      stageCode,
    ) &&
    /event\.preventDefault\(\)/.test(
      sourceBetween(stageCode, "const prepareKaiCommand", "const reviseKaiTurn"),
    ) &&
    (stageCode.match(/resolveAgencyKaiIntent\(/g) ?? []).length === 1 &&
    /const sourceCommand = kaiCommand\.slice\(0, 240\)/.test(stageCode),
);
check(
  "command continuity is bounded and supports revise, cancel, and clear",
  /return \[\.\.\.withoutEdited, nextTurn\]\.slice\(-8\)/.test(stageCode) &&
    /const reviseKaiTurn\s*=/.test(stageCode) &&
    /const cancelKaiTurn\s*=/.test(stageCode) &&
    /const clearKaiCommand\s*=/.test(stageCode) &&
    /Revise command/.test(stage) &&
    /Cancel synthetic preview/.test(stage) &&
    /Clear route-local Kai session/.test(stage),
);
check(
  "double submission is guarded within the animation frame",
  /if \(kaiSubmitLockedRef\.current\) return[\s\S]{0,180}kaiSubmitLockedRef\.current = true[\s\S]{0,180}requestAnimationFrame[\s\S]{0,180}kaiSubmitLockedRef\.current = false/.test(
    stageCode,
  ),
);
check(
  "every prepared or rejected command carries the exact no-action receipt",
  AGENCY_KAI_NO_ACTION_RECEIPT ===
    "Nothing was saved, sent, scheduled, assigned, created, contacted, or changed." &&
    /AGENCY_KAI_NO_ACTION_RECEIPT/.test(stageCode) &&
    /Nothing was saved, sent, scheduled, assigned, created, contacted, or changed\./.test(
      fixtures,
    ) &&
    /Kai recommends; the operator reviews\s+and decides\. Educational[\s\S]{0,60}information, not legal advice\./.test(
      stage,
    ),
);
check(
  "revised, canceled, cleared, and staged previews reuse the complete no-action receipt",
  /COMMAND REVISED[\s\S]{0,180}AGENCY_KAI_NO_ACTION_RECEIPT/.test(stageCode) &&
    /PREVIEW CANCELED[\s\S]{0,180}AGENCY_KAI_NO_ACTION_RECEIPT/.test(stageCode) &&
    /COMMAND CLEARED[\s\S]{0,180}AGENCY_KAI_NO_ACTION_RECEIPT/.test(stageCode) &&
    /COMMAND STAGED[\s\S]{0,180}AGENCY_KAI_NO_ACTION_RECEIPT/.test(stageCode) &&
    !/Nothing was saved or changed|No production data changed/.test(stageCode),
);

// -- 8 · route-local reset, exit, and BFCache boundaries ---------------------
const clearSessionSource = sourceBetween(
  stageCode,
  "const clearKaiSession",
  "const applyOperatingModel",
);
check(
  "the route-local Kai reset clears command, turns, edit state, and sequence",
  /setKaiCommand\(""\)/.test(clearSessionSource) &&
    /setKaiTurns\(\[\]\)/.test(clearSessionSource) &&
    /setEditingKaiTurnId\(null\)/.test(clearSessionSource) &&
    /kaiTurnSequenceRef\.current = 0/.test(clearSessionSource),
);
const bfcacheSource = sourceBetween(
  stageCode,
  "useEffect(() => {\n    const clearRouteState",
  "  }, []);",
);
check(
  "pagehide and BFCache restoration clear every route-local command artifact",
  /setKaiCommand\(""\)/.test(bfcacheSource) &&
    /setKaiTurns\(\[\]\)/.test(bfcacheSource) &&
    /setEditingKaiTurnId\(null\)/.test(bfcacheSource) &&
    /kaiTurnSequenceRef\.current = 0/.test(bfcacheSource) &&
    /if \(!event\.persisted\) return[\s\S]{0,100}clearRouteState\(\)/.test(
      bfcacheSource,
    ) &&
    /addEventListener\("pagehide", clearRouteState\)/.test(stageCode) &&
    /addEventListener\("pageshow", clearRestoredRouteState\)/.test(stageCode) &&
    /removeEventListener\("pagehide", clearRouteState\)/.test(stageCode) &&
    /removeEventListener\("pageshow", clearRestoredRouteState\)/.test(stageCode),
);
const exitSource = sourceBetween(
  stageCode,
  "const beginMissionControlReturn",
  "const completeMissionControlReturn",
);
check(
  "every unmodified Mission Control exit clears Kai before any static-tier return",
  exitSource.indexOf("clearKaiSession();") >= 0 &&
    exitSource.indexOf("clearKaiSession();") <
      exitSource.indexOf('resolution.tier === "C"'),
);
check(
  "fixture and operating-model route resets also clear the Kai session",
  /const applyOperatingModel[\s\S]{0,220}clearKaiSession\(\)/.test(stageCode) &&
    /const applyFixtureState[\s\S]{0,260}clearKaiSession\(\)/.test(stageCode) &&
    /const restorePopulatedFixture[\s\S]{0,240}clearKaiSession\(\)/.test(stageCode),
);

// -- 9 · passive district observation; no scroll hijack ---------------------
const observerSource = sourceBetween(
  stageCode,
  "const visibility = new Map<AgencyDistrictId, number>()",
  "useEffect(() => {\n    if (activeDistrict",
);
check(
  "active district is derived by one passive IntersectionObserver",
  (stageCode.match(/new IntersectionObserver\(/g) ?? []).length === 1 &&
    /querySelectorAll<HTMLElement>\("\[data-agency-district\]"\)/.test(
      observerSource,
    ) &&
    /entry\.intersectionRatio/.test(observerSource) &&
    /AGENCY_DISTRICTS\.forEach/.test(observerSource) &&
    /observer\.observe\(section\)/.test(observerSource) &&
    /observer\.disconnect\(\)/.test(observerSource),
);
check(
  "the observer activates tall districts at their first intersection",
  /threshold:\s*\[0,\s*0\.01,\s*0\.08,\s*0\.24,\s*0\.5\]/.test(
    observerSource,
  ),
);
check(
  "district navigation defeats inherited smooth scroll and preserves the CSS offset",
  /function scrollElementImmediately[\s\S]{0,420}scrollMarginTop[\s\S]{0,260}scrollWindowImmediately/.test(
    stageCode,
  ) &&
    /if \(district\) scrollElementImmediately\(district\)/.test(stageCode) &&
    /scrollWindowImmediately\(0\)[\s\S]{0,160}const update/.test(stageCode),
);
check(
  "district state is exposed without installing a scroll/wheel/touchmove listener",
  /data-active-district=\{activeDistrict\}/.test(stage) &&
    /data-scroll-ready=/.test(stage) &&
    !/addEventListener\(\s*["'](?:scroll|wheel|touchmove)["']/.test(stageCode) &&
    !/\bonScroll\s*=/.test(stageCode),
);
check(
  "arrival never captures wheel input or prevents scrolling",
  !/\bonWheel\s*=/.test(stageCode) &&
    !/onWheel=\{[\s\S]{0,180}preventDefault/.test(stage) &&
    !/document\.(?:body|documentElement)\.style\.(?:overflow|position)/.test(
      stageCode,
    ),
);
check(
  "CSS performs no external request and never forces smooth scrolling",
  !/@import\b|url\(\s*["']?(?:https?:|\/\/)/i.test(css) &&
    !/scroll-behavior\s*:\s*smooth/i.test(css),
);

// -- 10 · no backend, storage, clock, randomness, or effect authority --------
const forbiddenRuntime: Array<[string, RegExp]> = [
  ["fetch/XHR/WebSocket/EventSource", /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/],
  ["beacon or network client", /\bsendBeacon\s*\(|\b(?:axios|graphql-request|urql|apollo)\b/i],
  ["Prisma/database authority", /\bprisma\b|@\/lib\/prisma|@prisma\/client/i],
  ["NextAuth/session authority", /next-auth|\b(?:useSession|getSession|getServerSession|currentAccount|currentUser|currentWorkspace)\b/],
  ["browser storage or cookies", /\b(?:sessionStorage|localStorage|indexedDB)\b|document\.cookie|\bcookies\s*\(/],
  ["server request context", /next\/headers|server-only|\bheaders\s*\(|["']use server["']/],
  ["API route", /\/api\//],
  ["environment/config read", /\bprocess\.env\b/],
  ["clipboard/share/cross-window transport", /\bnavigator\.(?:clipboard|share)\b|\bpostMessage\s*\(|\bBroadcastChannel\b/],
  ["unsafe HTML or code evaluation", /\bdangerouslySetInnerHTML\b|\.innerHTML\b|\beval\s*\(|\bnew\s+Function\b/],
  ["generative runtime or live Kai import", /@\/lib\/kai|@anthropic-ai|openai|generative-ai/i],
  ["file input", /<input\b[^>]*\btype\s*=\s*["']file["']/i],
];
for (const [label, pattern] of forbiddenRuntime) {
  check(`no ${label}`, !pattern.test(presentationCode));
}
check(
  "the local form declares no action, formAction, HTTP method, or server action",
  formTags.length === 1 &&
    !/\b(?:action|formAction|method)\s*=/.test(formTags[0]) &&
    !/\bmethod\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i.test(presentationCode) &&
    !/\baction\s*=\s*\{/.test(presentationCode),
);
const nondeterministic: Array<[string, RegExp]> = [
  ["Date/clock read", /\bDate\b|\bperformance\.(?:now|timeOrigin)\b/],
  ["randomness or crypto", /\bMath\.random\b|\bcrypto\b|\brandomUUID\b/],
  ["elapsed/frame metric", /\b(?:fps|frameTimes|elapsedMs|durationMs)\b/],
];
for (const [label, pattern] of nondeterministic) {
  check(`determinism: no ${label}`, !pattern.test(presentationCode));
}
check(
  "the only timer is the bounded return-navigation fallback",
  (presentationCode.match(/\bsetTimeout\b/g) ?? []).length === 1 &&
    /returnFallbackRef\.current\s*=\s*window\.setTimeout\(\s*commitMissionControlReturn,\s*800\s*\)/.test(
      stageCode,
    ) &&
    !/\b(?:setInterval|requestIdleCallback)\b/.test(presentationCode),
);

const anchorTags = [...stage.matchAll(/<a\b[\s\S]*?>/g)].map((match) => match[0]);
check(
  "anchors remain local to the room or Founder Review",
  !/<Link\b/.test(stageCode) &&
    anchorTags.length > 0 &&
    anchorTags.every((tag) =>
      /href=(?:"#|\{`#\$\{|"\/review)/.test(tag),
    ),
);
check(
  "no live product route is an interactive destination",
  !/\bhref\s*=\s*["']\/(?:agency|dashboard|campaigns|mail|letters|billing|pricing)(?:[/?#][^"']*)?["']/i.test(
    stageCode,
  ),
);
const reviewReturnCall = 'window.location.assign("/review/mission-control")';
const stageWithoutReviewReturn = stageCode.replace(reviewReturnCall, "");
check(
  "the only imperative navigation is the explicit Mission Control review return",
  (stageCode.match(/window\.location\.assign\("\/review\/mission-control"\)/g) ?? [])
    .length === 1 &&
    !/\b(?:router\.(?:push|replace)|location\.(?:assign|replace)|window\.location)\b/.test(
      stageWithoutReviewReturn,
    ),
);

// -- 11 · purpose-bound heartbeat and distributed source ownership -----------
for (const motion of ["entering", "advancing", "waiting", "blocked", "resolving"]) {
  check(
    `heartbeat fixture includes exactly one ${motion} signal`,
    (fixtures.match(new RegExp(`motion: "${motion}"`, "g")) ?? []).length === 1,
  );
}
check(
  "heartbeat permanently discloses fixed choreography and unchanged facts",
  /DETERMINISTIC FIXTURE RHYTHM · NOT LIVE/.test(stage) &&
    /Motion replays fixed work[\s\S]{0,200}without[\s\S]{0,140}changing a count, rank, label, record, or canonical fact/.test(
      stage,
    ),
);
check(
  "spatial instruments cover purpose without inventing throughput",
  /CLIENT FLOW RAIL/.test(stage) &&
    /CAPACITY HORIZON/.test(stage) &&
    /WORK PRESSURE FIELD/.test(stage) &&
    /RESPONSE AGING RULER/.test(stage) &&
    /EVIDENCE COVERAGE RAIL/.test(stage) &&
    /BOTTLENECK GATES/.test(stage) &&
    /<dt>Throughput rate<\/dt>[\s\S]{0,100}<dd>Not instrumented<\/dd>/.test(stage),
);
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
  "agencyFacilityChannel",
]);
check(
  "continuous motion is limited to ambient presence and fixed flow-state channels",
  continuousAnimations.length > 0 &&
    continuousAnimations.every((name) => allowedContinuousAnimations.has(name)) &&
    [...allowedContinuousAnimations].every((name) =>
      continuousAnimations.includes(name),
    ),
);
check(
  "heartbeat has no Canvas, WebGL, video, external animation runtime, or JavaScript loop",
  !/<canvas\b|<video\b|\bWebGL\b|\bTHREE\s*\.|\bGSAP\b|\bLottie\b|\bRive\b/i.test(
    presentationCode,
  ) &&
    !/\b(?:setInterval|requestAnimationFrame)\s*\([\s\S]{0,180}\b(?:loop|tick|animate)\b/i.test(
      presentationCode,
    ),
);
const expectedOwners = [
  "Identity",
  "Organizations",
  "Membership",
  "Agency",
  "Billing",
  "Kai",
];
check(
  "authorized future ownership stays with the exact six owning systems",
  JSON.stringify(AGENCY_AUTHORIZED_SOURCES.map((source) => source.owner)) ===
    JSON.stringify(expectedOwners) &&
    new Set(AGENCY_AUTHORIZED_SOURCES.map((source) => source.owner)).size === 6,
);
check(
  "every ownership row is explicit and disconnected in Founder Review",
  AGENCY_AUTHORIZED_SOURCES.every(
    (source) => source.futureSource.length > 0 && source.reviewState.length > 0,
  ) &&
    AGENCY_AUTHORIZED_SOURCES.every((source) =>
      /fixture|specimen|disconnected|no model|not connected/i.test(source.reviewState),
    ) &&
    /AGENCY_AUTHORIZED_SOURCES\.map\(\(source\)\s*=>/.test(stageCode) &&
    /Agency\s+Command orchestrates their display; it does not take ownership/.test(
      stage,
    ),
);

// -- 12 · disclosure, accessibility, reduced motion, and lifecycle -----------
check(
  "persistent synthetic disclosure is an unconditional semantic note",
  /<div className=\{styles\.disclosure\} role="note">[\s\S]{0,700}SYNTHETIC FOUNDER REVIEW[\s\S]{0,700}<\/div>/.test(
    stage,
  ) &&
    /Illustrative deterministic data only/.test(stage) &&
    /No customer records/.test(stage),
);
check(
  "unavailable live capabilities and Team specimen stay visibly labelled",
  /\b(?:PLANNED|NOT CONNECTED)\b/.test(presentationCode) &&
    /Team Specimen/i.test(presentationCode) &&
    /Team Specimen[\s\S]{0,260}(?:NOT CONNECTED|not connected)/i.test(
      presentationCode,
    ),
);
const buttonTags = [...stage.matchAll(/<button\b[\s\S]*?>/g)].map(
  (match) => match[0],
);
check(
  "every button declares its type and only the command button submits",
  buttonTags.length > 0 &&
    buttonTags.every((tag) => /\btype=(?:"button"|"submit")/.test(tag)) &&
    buttonTags.filter((tag) => /\btype="submit"/.test(tag)).length === 1,
);
check(
  "room semantics expose focus, current district, state, and announcements",
  /<main[\s\S]{0,200}id="main"[\s\S]{0,200}tabIndex=\{-1\}/.test(stage) &&
    /<header\b/.test(stage) &&
    /<h1\b/.test(stage) &&
    /<section\b/.test(stage) &&
    /<nav\b/.test(stage) &&
    /aria-current=\{activeDistrict === district\.id \? "location" : undefined\}/.test(
      stage,
    ) &&
    /aria-live="polite"/.test(stage) &&
    /:focus-visible/.test(css),
);
const reducedMotionAt = css.search(
  /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/,
);
const reducedMotionCss = reducedMotionAt >= 0 ? css.slice(reducedMotionAt) : "";
check(
  "reduced motion provides a complete static projection",
  reducedMotionAt >= 0 &&
    /animation:\s*none\s*!important/.test(reducedMotionCss) &&
    /transition:\s*none\s*!important/.test(reducedMotionCss) &&
    /scroll-behavior:\s*auto\s*!important/.test(reducedMotionCss),
);
check(
  "explicit cinema overrides reduced motion only after route-instance consent",
  /data-motion-override/.test(stageCode) &&
    /reducedMotionOverride && projection === "cinematic"/.test(stageCode) &&
    /\.room:not\(\[data-motion-override="true"\]\)/.test(reducedMotionCss) &&
    /Force review cinema/.test(stage),
);
check(
  "Tier C, Tier D, and hidden documents stop nonessential motion",
  /\.room\[data-tier="C"\] \*[\s\S]{0,260}\.room\[data-tier="D"\] \*[\s\S]{0,220}animation:\s*none\s*!important/.test(
    css,
  ) &&
    /\.room\[data-hidden="true"\][\s\S]{0,260}animation-play-state:\s*paused/.test(
      css,
    ),
);
check(
  "Tier D temporarily forces and then restores root auto scrolling",
  /if \(resolution\.tier !== "D"\) return[\s\S]{0,460}setProperty\("scroll-behavior", "auto", "important"\)[\s\S]{0,700}removeProperty\("scroll-behavior"\)/.test(
    stageCode,
  ),
);
check(
  "Mission Control return uses one acknowledged departure and immediate static fallback",
  /const beginMissionControlReturn\s*=/.test(stageCode) &&
    /const commitMissionControlReturn\s*=/.test(stageCode) &&
    /resolution\.tier === "C" \|\| resolution\.tier === "D"/.test(stageCode) &&
    /onAnimationEnd=\{completeMissionControlReturn\}/.test(stage) &&
    /window\.clearTimeout\(returnFallbackRef\.current\)/.test(stageCode) &&
    /data-departing=\{departing \? "true" : "false"\}/.test(stage) &&
    /agencyReturnHandoff 460ms/.test(css),
);
check(
  "the departure handoff owns the exit layer above the disabled Director",
  /\.departureHandoff\s*\{[\s\S]{0,180}z-index:\s*30/.test(css) &&
    /\.room\[data-departing="true"\] \.director\s*\{[\s\S]{0,80}pointer-events:\s*none/.test(
      css,
    ),
);
check(
  "Director closes to its summary and replay restores heading focus plus scroll zero",
  /directorSummaryRef\.current\?\.focus\(\{ preventScroll: true \}\)/.test(
    stageCode,
  ) &&
    /replayFocusPendingRef\.current = true/.test(stageCode) &&
    /roomHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/.test(
      stageCode,
    ) &&
    /scrollWindowImmediately\(0\)/.test(stageCode) &&
    /event\.key !== "Escape" \|\| !directorRef\.current\?\.open/.test(stageCode),
);
check(
  "queue and empty-state handoffs focus the revealed controls without smooth scrolling",
  (stageCode.match(/scrollIntoView\(\{ block: "center", behavior: "auto" \}\)/g) ?? [])
    .length >= 4 &&
    /id="synthetic-intake-handoff-control"/.test(stage) &&
    /aria-expanded=\{intakeOpen\}/.test(stage) &&
    /aria-controls="synthetic-intake-handoff"/.test(stage) &&
    /id="synthetic-intake-handoff"[\s\S]{0,120}hidden=\{!intakeOpen\}/.test(stage),
);
check(
  "Director fixture, projection, and operating-model controls expose selected state",
  (stage.match(/aria-pressed=/g) ?? []).length >= 3 &&
    /AGENCY_FIXTURE_STATES\.map/.test(stageCode) &&
    /\(\["auto", "cinematic", "static"\] as const\)\.map/.test(stageCode) &&
    /\(\["solo", "team"\] as const\)\.map/.test(stageCode),
);
check(
  "constrained capability keeps Cinematic unavailable and names the conservative reason",
  /option === "cinematic" && !resolution\.cinematicAvailable/.test(stageCode) &&
    /Cinematic projection is unavailable on this constrained device/.test(stage) &&
    /Capability detection failed safely/.test(stage),
);
check(
  "initial capability hydration cannot announce a false preference change",
  /if \(capabilities\.detectionFailed\) return[\s\S]{0,260}if \(!capabilitiesHydratedRef\.current\)[\s\S]{0,260}previousReducedMotionRef\.current = current[\s\S]{0,100}return/.test(
    stageCode,
  ),
);
check(
  "mobile safe areas and clipped overflow prevent viewport-width escape",
  /overflow-x:\s*clip/.test(css) &&
    /env\(safe-area-inset-top\)/.test(css) &&
    /env\(safe-area-inset-left\)/.test(css) &&
    /env\(safe-area-inset-right\)/.test(css) &&
    !/width:\s*calc\(100vw/.test(css),
);
check(
  "new district, Kai, arrival, and Founder-navigation targets retain the 44px floor",
  /\.arrivalActions button,[\s\S]{0,320}\.facilityDirectory a,[\s\S]{0,120}\.districtHandoff a[\s\S]{0,120}min-height:\s*2\.75rem/.test(
    css,
  ) &&
    /@media \(pointer: coarse\)[\s\S]{0,500}\.facilityDirectory a,[\s\S]{0,120}\.districtHandoff a[\s\S]{0,120}min-height:\s*3rem/.test(
      css,
    ) &&
    /\.footer a\s*\{[\s\S]{0,160}min-height:\s*2\.75rem/.test(css),
);
check(
  "district floor plans reset inherited command-wall grid names",
  /\.districtBody > \.healthBank,[\s\S]{0,700}\.observatoryGrid > \.healthBank\s*\{[\s\S]{0,80}grid-area:\s*auto/.test(
    css,
  ),
);
check(
  "compact labels never fall below the 12px review floor",
  !/font-size:\s*(?:0\.6875rem|11px)\b/.test(css),
);
check(
  "Director panel contains its own overscroll without trapping the document",
  /\.directorPanel\s*\{[\s\S]{0,220}overscroll-behavior:\s*contain/.test(css) &&
    !/scroll-snap-type|overscroll-behavior:\s*none/.test(css),
);

const languageMarkdown = read("CXOS_LANGUAGE_1_0.md");
const languageHtml = read("CXOS_LANGUAGE_1_0.html");
const governingLaws = [
  "Every operating room requires an observable heartbeat",
  "Every major room requires a deliberate arrival and exit",
  "Every major room must express its internal operating districts spatially",
  "Kai must appear as a continuous contextual executive channel, not a disconnected list of tools",
  "Personalization must be deterministic, authorized, and truthfully sourced",
];
check(
  "CXOS Language 1.0 carries all five exact Phase 6.2 laws in Markdown and HTML",
  governingLaws.every(
    (law) => languageMarkdown.includes(law) && languageHtml.includes(law),
  ),
);
check(
  "language governs Mission Control and future rooms without claiming they changed",
  /Mission Control and future operating rooms are governed[\s\S]{0,240}separately scoped, reviewed, and implemented/.test(
    languageMarkdown,
  ) &&
    /Phase 6\.2 changes no Mission Control or future-room runtime/.test(
      languageMarkdown,
    ) &&
    /Phase 6\.2 changes no Mission Control or future-room runtime/.test(languageHtml),
);

// -- 13 · qualitative health and compliance-safe copy -----------------------
check(
  "health remains qualitative and coverage-honest",
  /\b(?:Healthy|Watch|At[- ]risk|Not rated|Resolving|Insufficient coverage|Display error)\b/i.test(
    presentationCode,
  ) &&
    /SYNTHETIC QUALITATIVE FIXTURE/.test(stage) &&
    /No production scoring formula, financial-health assessment, prediction,[\s\S]{0,80}or compliance certification\./.test(
      stage,
    ),
);
check(
  "no numeric health score or 100-point index exists",
  !/\b(?:healthScore|healthIndex)\b/i.test(presentationCode) &&
    !/\bhealth\s*:\s*\d/i.test(presentationCode) &&
    !/\b\d{1,3}\s*\/\s*100\b/.test(presentationCode),
);
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

// -- 14 · no Phase 6 coupling enters the live /agency surface or APIs --------
const liveAgencySources = [
  read("app/agency/page.tsx"),
  read("app/api/agency/context/route.ts"),
  read("app/api/agency/clients/route.ts"),
  read("app/api/agency/kpi/route.ts"),
  read("app/api/agency/select/route.ts"),
  read("app/api/agency/enable/route.ts"),
].join("\n");
check(
  "live /agency surface and APIs contain no Phase 6 review coupling",
  !/agency-command|AgencyCommand(?:Stage|Fixture)|CXOS Phase 6/i.test(
    liveAgencySources,
  ),
);

console.log(`\ncxos-agency-command.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
