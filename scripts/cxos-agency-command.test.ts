// Run: npx --no-install tsx scripts/cxos-agency-command.test.ts
//
// SOURCE + PURE-BEHAVIOUR guard for the CXOS Agency Headquarters spatial-
// chambers Founder Review. Browser and visual evidence still belongs in the RC5 QA
// ledger; this guard holds the architectural boundary:
//
//   deterministic local fixtures -> one bounded local command resolver
//     -> seven review-only districts -> no production effect
//
// No live Agency workspace, auth/session state, API, database, billing, storage,
// product navigation, model, clock, or random value may cross that boundary.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  AGENCY_AUTHORIZED_SOURCES,
  AGENCY_DISTRICTS,
  AGENCY_FIXTURE_STATES,
  AGENCY_HEALTH_DRIVERS,
  AGENCY_KAI_NO_ACTION_RECEIPT,
  AGENCY_KAI_WORKFLOWS,
  AGENCY_PERSONALIZATIONS,
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
  "environment.ts",
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
const environmentDefinition = read("app/review/agency-command/environment.ts");
const fixtures = read("app/review/agency-command/fixtures.ts");
const css = read("app/review/agency-command/agency-command.module.css");
const runtimePolicy = read("lib/cxos/runtime.ts");
const runtimeAdapter = read("components/cxos/runtime/useCxosRoomRuntime.ts");
const pageCode = codeOf(page);
const stageCode = codeOf(stage);
const fixtureCode = codeOf(fixtures);
const runtimePolicyCode = codeOf(runtimePolicy);
const runtimeAdapterCode = codeOf(runtimeAdapter);
const presentationCode = `${stageCode}\n${fixtureCode}\n${environmentDefinition}`;
const fixturesSha256 = createHash("sha256").update(fixtures).digest("hex");

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
  "the Phase 6.2 route contains exactly the five reviewed source files",
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
    /from ["']next\/navigation["']/.test(page) &&
    gateAt !== -1 &&
    stageAt !== -1 &&
    gateAt < stageAt,
);
check(
  "review-disabled branch resolves to the ordinary 404 boundary",
  /if\s*\(\s*!reviewBuildAllowed\(\)\s*\)\s*notFound\(\)/.test(page),
);
check(
  "allowed branch renders only the local Agency Command stage",
  /return\s*<AgencyCommandStage\s*\/>/.test(page),
);

const pageImports = importSources(page);
const allowedPageImports = new Set(["@/lib/cxos/reviewMode", "next/navigation"]);
check(
  "page statically imports only the review gate and 404 boundary",
  pageImports.length === allowedPageImports.size &&
    pageImports.every((source) => allowedPageImports.has(source)) &&
    [...allowedPageImports].every((source) => pageImports.includes(source)),
);

// -- 3 · strict client import boundary --------------------------------------
const stageImports = importSources(stage);
const allowedStageImports = new Set([
  "react",
  "@/components/cxos/runtime/useCxosRoomRuntime",
  "@/lib/cxos/runtime",
  "./environment",
  "./fixtures",
  "./agency-command.module.css",
]);
check(
  "stage imports only React, the Core Runtime seam, local fixtures, and CSS",
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
  "stage cannot reach Next navigation, AppShell, or any unapproved shared/live component",
  !/next\/(?:link|navigation)|\bAppShell\b/.test(stageCode) &&
    stageImports.every((source) => allowedStageImports.has(source)),
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
  "the directory and district shell share canonical district metadata, and the threshold/header pair render one unified chamber noun",
  /AGENCY_DISTRICTS\.map\(\(district\)\s*=>/.test(stageCode) &&
    /data-agency-district=\{district\.id\}/.test(stage) &&
    /aria-labelledby=\{`\$\{district\.id\}-heading`\}/.test(stage) &&
    (stage.match(/CHAMBER \{district\.index\} \/ 07/g) ?? []).length === 2 &&
    !/DISTRICT \{district\.index\} \/ 07/.test(stage) &&
    /\{district\.truthBoundary\}/.test(stage) &&
    /contextDistrict\.kaiContext/.test(stage) &&
    /Continue to \{nextDistrict\.name\}/.test(stage),
);
check(
  "RC4 preserves the RC2/RC3 canonical fixture source byte-for-byte",
  fixturesSha256 === "9f212d3ae6db92e05b8ea50e4df3a0141f0688720e627b4ba08b140b97332146",
);
check(
  "valid hydrated chamber mode contributes exactly one active district while fail-closed markup remains complete",
  /districtMode:\s*"chamber"/.test(stageCode) &&
    /const chamberManaged = capabilitiesReady && validation\.valid/.test(
      stageCode,
    ) &&
    /const current = activeDistrict === district\.id/.test(stageCode) &&
    /hidden=\{chamberManaged && !current\}/.test(stage) &&
    (stage.match(/chamberManaged=\{chamberManaged\}/g) ?? []).length === 7 &&
    /chamberManaged \? \(current \? "operating" : "queued"\) : "static"/.test(
      stageCode,
    ) &&
    /data-current=\{current \? "true" : "false"\}/.test(stage) &&
    (stage.match(/data-environment=\{district\.id\}/g) ?? []).length === 1,
);
check(
  "pre-hydration and failed-hydration markup keep all seven districts reachable until native hidden attributes apply",
  !/\.room:not\(\[data-chamber-ready="true"\]\)[\s\S]{0,180}\.district:not\(\[data-current="true"\]\)[\s\S]{0,80}display:\s*none/.test(
    css,
  ),
);
check(
  "each district exposes one pointer-inert measurable rail and decorative spatial field",
  /aria-hidden="true"[\s\S]{0,100}className=\{styles\.districtEnvironment\}/.test(stage) &&
    /aria-hidden="true" className=\{styles\.districtRail\}/.test(stage) &&
    /className=\{styles\.districtThreshold\}/.test(stage) &&
    /data-plane="depth"/.test(stage) &&
    /data-plane="horizon"/.test(stage) &&
    /data-plane="signal"/.test(stage),
);

// -- 5 · seven deterministic arrival beats ----------------------------------
const activationRailSource = sourceBetween(
  stage,
  "function ActivationRail",
  "function CapacityHorizon",
);
check(
  "boundary and operating arrival projections each expose seven truthful beats",
  [
    "mission-control-origin",
    "operator-authority",
    "agency-identity",
    "systems-readiness",
    "kai-recognition",
    "destination-acquisition",
    "command-settlement",
  ].every(
    (beat) =>
      (activationRailSource.match(new RegExp(`"${beat}"`, "g")) ?? []).length === 2,
  ) &&
    /state !== "populated" && state !== "capacity"/.test(activationRailSource) &&
    /Agency identity bounded/.test(activationRailSource) &&
    /No live state inferred/.test(activationRailSource) &&
    /No action connected/.test(activationRailSource) &&
    /Agency identified/.test(activationRailSource) &&
    /Fixed horizon and ledgers/.test(activationRailSource) &&
    /Deterministic channel ready/.test(activationRailSource) &&
    (activationRailSource.match(/`\$\{recommendedDestination\} (?:available|next)`/g) ?? [])
      .length === 2,
);
check(
  "arrival copy is fixture-bound and destination acquisition follows canonical personalization",
  /function resolveAgencyArrivalProjection/.test(stage) &&
    /state === "populated" \|\| state === "capacity"/.test(stage) &&
    /destination: personalization\.recommendedDestination/.test(stage) &&
    AGENCY_PERSONALIZATIONS.solo.recommendedDestination ===
      "Client Operations Floor" &&
    AGENCY_PERSONALIZATIONS.team.recommendedDestination ===
      "Team Operations Room" &&
    /loading:[\s\S]{0,180}Source-backed operating facts remain unresolved/.test(stage) &&
    /empty:[\s\S]{0,180}No illustrative work is staged/.test(stage) &&
    /permission:[\s\S]{0,220}No agency identity is disclosed/.test(stage) &&
    /staticArrival: `Complete static Agency Command projection\. \$\{arrivalProjection\.greeting\}`/.test(
      stage,
    ) &&
    /escapeArrival: `Agency Command arrival skipped\. \$\{arrivalProjection\.greeting\}`/.test(
      stage,
    ) &&
    /if \(fixtureState === "permission"\)[\s\S]{0,260}focus: \{ kind: "room" \}[\s\S]{0,220}no agency identity is disclosed/i.test(
      stage,
    ) &&
    /recommendedDestination=\{arrivalProjection\.destination\}/.test(stage) &&
    /\{arrivalProjection\.destinationLabel\} · \{arrivalProjection\.destination\}/.test(
      stage,
    ),
);
check(
  "arrival is sequenced through the shared runtime, replayable, skippable, and Escape-settled",
  /data-arrival-settled=\{arrivalSettled \? "true" : "false"\}/.test(stage) &&
    /data-arrival-active=\{arrivalActive \? "true" : "false"\}/.test(stage) &&
    /definition: AGENCY_CORE_RUNTIME/.test(stageCode) &&
    /replayRuntimeArrival\(`Arrival replayed in Tier \$\{resolution\.tier\}\."?/.test(
      stageCode,
    ) &&
    /event\.key !== "Escape"/.test(runtimeAdapterCode) &&
    /setArrivalSettled\(false\)[\s\S]{0,120}setArrivalKey/.test(
      runtimeAdapterCode,
    ) &&
    /Skip arrival/.test(stage) &&
    /agencyIdentityAcquire/.test(css) &&
    /agencySystemActivate/.test(css) &&
    /agencyCapacityForm/.test(css) &&
    /agencyLedgerActivate/.test(css) &&
    /agencyKaiArrive/.test(css) &&
    /agencyArrivalRecognition/.test(css) &&
    /\.room\[data-arrival-settled="false"\] \.arrivalThreshold \.activationRail li::before/.test(
      css,
    ),
);
check(
  "arrival cinema uses a non-fixed gate over a permanently laid-out facility frame",
  /const arrivalActive =\s*[\s\S]{0,240}capabilitiesReady[\s\S]{0,120}validation\.valid[\s\S]{0,120}!arrivalSettled[\s\S]{0,160}resolution\.tier === "A"[\s\S]{0,80}resolution\.tier === "B"/.test(
    stageCode,
  ) &&
    /key=\{arrivalKey\}[\s\S]{0,120}className=\{styles\.arrivalGate\}[\s\S]{0,160}data-active=\{arrivalActive \? "true" : "false"\}/.test(
      stage,
    ) &&
    /className=\{styles\.facilityFrame\}[\s\S]{0,180}data-arrival-active=\{arrivalActive \? "true" : "false"\}[\s\S]{0,160}aria-hidden=\{arrivalActive \? "true" : undefined\}[\s\S]{0,120}inert=\{arrivalActive \? true : undefined\}/.test(
      stage,
    ) &&
    /className=\{`\$\{styles\.arrivalThreshold\} \$\{styles\.facilityIdentity\}`\}/.test(
      stage,
    ) &&
    /\.arrivalGate\s*\{[\s\S]{0,120}position:\s*absolute[\s\S]{0,1200}opacity:\s*0[\s\S]{0,100}visibility:\s*hidden/.test(
      css,
    ) &&
    !/\.arrivalGate\s*\{[\s\S]{0,220}position:\s*fixed/.test(css) &&
    !/\.arrivalGate(?:\[data-active="true"\])?\s*\{[^}]*\btransform:/.test(
      css,
    ) &&
    /\.facilityFrame\s*\{[\s\S]{0,180}opacity:\s*1[\s\S]{0,180}transition:\s*opacity/.test(
      css,
    ) &&
    !/\.facilityFrame(?:\[[^\]]+\])?\s*\{[^}]*\btransform:/.test(css) &&
    /\.facilityIdentity,[\s\S]{0,140}\.facilityIdentity\s*\{[\s\S]{0,100}min-height:\s*0/.test(
      css,
    ) &&
    /\.room \.arrival\s*\{[\s\S]{0,180}padding-top:[\s\S]{0,120}padding-bottom:/.test(
      css,
    ) &&
    !/\.facilityFrame(?:\[[^\]]+\])?\s*\{[^}]*\b(?:height|max-height|display):/.test(
      css,
    ),
);
check(
  "natural, Skip, Escape, and static arrival focus wait for the visible facility commit",
  /const arrivalCommitFocusRef = useRef<[\s\S]{0,260}key: number[\s\S]{0,240}announcement: string/.test(
    runtimeAdapterCode,
  ) &&
    /queueArrivalCommitFocus\(options\);[\s\S]{0,80}setArrivalSettled\(true\)/.test(
      runtimeAdapterCode,
    ) &&
    /announcement: messages\.escapeArrival[\s\S]{0,100}\}\);[\s\S]{0,80}setArrivalSettled\(true\)/.test(
      runtimeAdapterCode,
    ) &&
    /announcement: messages\.staticArrival[\s\S]{0,100}\}\);[\s\S]{0,80}setArrivalSettled\(true\)/.test(
      runtimeAdapterCode,
    ) &&
    /useLayoutEffect\(\(\) => \{[\s\S]{0,180}!arrivalSettled[\s\S]{0,140}pending\.key !== arrivalKey[\s\S]{0,1000}focusDistrict\(pending\.focus\.districtId\)/.test(
      runtimeAdapterCode,
    ) &&
    !/setArrivalSettled\(true\);[\s\S]{0,120}requestAnimationFrame/.test(
      runtimeAdapterCode,
    ),
);
check(
  "arrival replay moves focus out of the inert facility and into the visible gate before settlement",
  /const arrivalSkipRef = useRef<HTMLButtonElement>\(null\)/.test(stageCode) &&
    /const replayGateFocusPendingRef = useRef\(false\)/.test(stageCode) &&
    /if \(!arrivalActive\)[\s\S]{0,140}arrivalSettled[\s\S]{0,180}if \(!replayGateFocusPendingRef\.current\) return;[\s\S]{0,220}arrivalSkipRef\.current\?\.focus\(\{ preventScroll: true \}\)/.test(
      stageCode,
    ) &&
    /const replayArrival = \(\) => \{[\s\S]{0,140}directorRef\.current\?\.removeAttribute\("open"\);[\s\S]{0,140}roomRootRef\.current\?\.focus\(\{ preventScroll: true \}\);[\s\S]{0,120}replayGateFocusPendingRef\.current = true;[\s\S]{0,140}replayRuntimeArrival/.test(
      stageCode,
    ) &&
    /<button ref=\{arrivalSkipRef\} type="button" onClick=\{skipArrival\}>/.test(
      stage,
    ),
);
check(
  "arrival description preserves permission-state truth equivalence for assistive technology",
  /id="agency-arrival-summary"[\s\S]{0,180}fixtureState === "permission"[\s\S]{0,220}Authority could not be projected\. No agency identity or operating metadata is shown\./.test(
    stage,
  ) &&
    /fixtureState !== "permission"[\s\S]{0,820}Authority could not be projected\. No agency identity or operating metadata is shown\./.test(
      stage,
    ),
);
check(
  "route skip focus is immediately visible and arrival settlement preserves explicit operator focus",
  /:global\(body\):has\(\.room\) > :global\(\.skip-link\)\s*\{[\s\S]{0,220}min-height:\s*3rem[\s\S]{0,220}top:\s*max\(1rem,[\s\S]{0,160}left:\s*max\(1rem,[\s\S]{0,180}transform:\s*translateY\(calc\(-100%[\s\S]{0,180}transition:\s*none/.test(
    css,
  ) &&
    /:global\(body\):has\(\.room\) > :global\(\.skip-link\):focus-visible\s*\{[\s\S]{0,100}transform:\s*translateY\(0\)/.test(
      css,
    ) &&
    /const operatorMovedFocus =[\s\S]{0,260}activeElement === roomRootRef\.current[\s\S]{0,120}!roomRootRef\.current\?\.contains\(activeElement\)[\s\S]{0,140}if \(!operatorMovedFocus\)/.test(
      runtimeAdapterCode,
    ),
);
check(
  "facility identity geometry is identical before and after every arrival settlement",
  (css.match(/\.room\[data-arrival-settled="false"\] \.facilityIdentity/g) ?? [])
    .length >= 7 &&
    (css.match(/\.room\[data-arrival-settled="true"\] \.facilityIdentity/g) ?? [])
      .length >= 7 &&
    /\.facilityIdentity,[\s\S]{0,180}\.room\[data-arrival-settled="false"\] \.facilityIdentity,[\s\S]{0,180}\.room\[data-arrival-settled="true"\] \.facilityIdentity\s*\{[\s\S]{0,120}min-height:\s*0/.test(
      css,
    ) &&
    !/\.room\[data-arrival-settled="true"\] \.arrivalThreshold/.test(css) &&
    !/\.room\[data-arrival-settled="true"\] \.(?:arrivalOrigin|arrivalGreeting|arrivalActions)/.test(
      css,
    ) &&
    /\.arrivalGate \.arrivalActions\s*\{[\s\S]{0,180}position:\s*fixed/.test(css) &&
    /\.arrivalGate \.arrivalThreshold\s*\{[\s\S]{0,120}padding-bottom:\s*calc\(1\.5rem \+ 4\.25rem\)/.test(
      css,
    ) &&
    !/\.room\[data-arrival-settled="false"\] \.arrivalActions\s*\{[\s\S]{0,180}position:\s*fixed/.test(
      css,
    ),
);
const declaredArrivalBeats = [
  ...sourceBetween(
    stage,
    "const AGENCY_ARRIVAL_BEATS = [",
    "] as const;",
  ).matchAll(/"([a-z-]+)"/g),
].map((match) => match[1]);
const declaredMotionChannels = [
  ...sourceBetween(
    stage,
    "const AGENCY_MOTION_CHANNELS = [",
    "] as const;",
  ).matchAll(/"([a-z-]+)"/g),
].map((match) => match[1]);
check(
  "Agency binds the exact approved arrival and motion contracts to rendered runtime output",
  JSON.stringify(declaredArrivalBeats) ===
    JSON.stringify([
      "mission-control-origin",
      "operator-authority",
      "agency-identity",
      "systems-readiness",
      "kai-recognition",
      "destination-acquisition",
      "command-settlement",
    ]) &&
    JSON.stringify(declaredMotionChannels) ===
      JSON.stringify(["room-breath", "operational-sweep", "client-flow"]) &&
    /arrivalBeats: AGENCY_ARRIVAL_BEATS/.test(stageCode) &&
    /arrivalDurationMs: \{ A: 1500, B: 700 \}/.test(stageCode) &&
    /motionChannels: AGENCY_MOTION_CHANNELS/.test(stageCode) &&
    /beatOrder=\{runtime\.arrivalBeats\}/.test(stage) &&
    // RC2 WP7: the runtime contract's motionChannels field stays bound
    // (validated above and by validateCxosRoomRuntimeUnsafe), but the three
    // legacy DOM bindings are gone — .ambientSweep now carries the one
    // literal structural token it actually runs, and .roomBreath/
    // .facilityPulse (both retired/killed in Living mode, see
    // agency-command.module.css's unconditional kill list) claim no channel.
    /className=\{styles\.ambientSweep\}\s*\n\s*data-cxos-motion-channel="continuous:facility-sweep"/.test(
      stage,
    ) &&
    (stage.match(/runtime\.motionChannels\[/g) ?? []).length === 0 &&
    /"--cxos-arrival-duration": `\$\{runtime\.arrivalDurationMs\}ms`/.test(
      stageCode,
    ) &&
    /agencyArrivalClock var\(--cxos-arrival-duration, 1500ms\)/.test(css) &&
    /animation-duration: var\(--cxos-arrival-duration, 700ms\)/.test(css),
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
  "continuous Kai staging carries the explicit active-chamber context",
  /const stageKaiSuggestion = \([\s\S]{0,120}sourceDistrict: AgencyDistrictId/.test(
    stageCode,
  ) &&
    /sourceDistrict !== "kai-suite"[\s\S]{0,100}setKaiContextDistrict\(sourceDistrict\)/.test(
      stageCode,
    ) &&
    /onStage\(activeDistrict\.suggestions\[0\], activeDistrict\.id\)/.test(
      stageCode,
    ) &&
    /stageKaiSuggestion\(suggestion, kaiContextDistrict\)/.test(stageCode),
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
check(
  "Kai remains continuously contextual but actionable only in operating fixtures",
  /const kaiWorkflowAvailable =\s*fixtureState === "populated" \|\| fixtureState === "capacity"/.test(
    stage,
  ) &&
    /<KaiContextSpine[\s\S]{0,220}available=\{kaiWorkflowAvailable\}/.test(
      stage,
    ) &&
    /KAI · CONTINUOUS EXECUTIVE CHANNEL/.test(stage) &&
    /\{activeDistrict\.id === "kai-suite" \? \([\s\S]{0,260}Kai command chamber active[\s\S]{0,400}available \? \([\s\S]{0,320}Stage \{activeDistrict\.shortName\} with Kai[\s\S]{0,360}Kai held · fixture boundary/.test(
      stage,
    ) &&
    /\.kaiContext \.kaiBoundary\s*\{/.test(css),
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
check(
  "pagehide and BFCache restoration delegate to the complete route-local reset",
  /onRouteReset: clearKaiSession/.test(stageCode) &&
    /routeResetRef\.current\?\.\(\)/.test(runtimeAdapterCode) &&
    /if \(!event\.persisted\) return;[\s\S]{0,120}reset\(\)/.test(
      runtimeAdapterCode,
    ) &&
    /addEventListener\("pagehide", resetHiddenPage\)/.test(runtimeAdapterCode) &&
    /addEventListener\("pageshow", resetRestoredPage\)/.test(runtimeAdapterCode) &&
    /removeEventListener\("pagehide", resetHiddenPage\)/.test(
      runtimeAdapterCode,
    ) &&
    /removeEventListener\("pageshow", resetRestoredPage\)/.test(
      runtimeAdapterCode,
    ),
);
check(
  "pending chamber focus is latest-intent, lifecycle-cancelable, and district-bound",
  /const cancelPendingChamberFocus = useCallback/.test(stageCode) &&
    /pendingChamberFocusSequenceRef\.current \+= 1/.test(stageCode) &&
    /window\.cancelAnimationFrame\(pendingChamberFocusFrameRef\.current\)/.test(
      stageCode,
    ) &&
    /window\.cancelAnimationFrame\(pendingChamberFocusSettleFrameRef\.current\)/.test(
      stageCode,
    ) &&
    /focusSequence === pendingChamberFocusSequenceRef\.current/.test(stageCode) &&
    /dataset\.activeDistrict === pending\.districtId/.test(stageCode) &&
    /pendingChamberFocusRef\.current = pendingFocus\s*\?/.test(stageCode) &&
    /addEventListener\("pagehide", cancelForPageHide\)/.test(stageCode),
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
      exitSource.indexOf("beginDeparture(event)"),
);
check(
  "fixture and operating-model route resets also clear the Kai session",
  /const applyOperatingModel[\s\S]{0,220}clearKaiSession\(\)/.test(stageCode) &&
    /const applyFixtureState[\s\S]{0,260}clearKaiSession\(\)/.test(stageCode) &&
    /const restorePopulatedFixture[\s\S]{0,240}clearKaiSession\(\)/.test(stageCode),
);

// -- 9 · deterministic chamber navigation; no scroll hijack -----------------
const observerSource = sourceBetween(
  runtimeAdapterCode,
  "const visibility = new Map<DistrictId, number>()",
  "useEffect(() => {\n    if (!(definition.kaiContextHoldDistricts",
);
check(
  "flow mode retains one passive observer while Agency chamber mode installs none",
  (runtimeAdapterCode.match(/new IntersectionObserver\(/g) ?? []).length === 1 &&
    /if \(districtMode === "chamber" \|\| !environment\.scrollActivation\) return/.test(
      runtimeAdapterCode,
    ) &&
    /querySelectorAll<HTMLElement>\("\[data-cxos-district\]"\)/.test(
      observerSource,
    ) &&
    /entry\.intersectionRatio/.test(observerSource) &&
    /selectCxosActiveDistrict\(definition\.districts/.test(observerSource) &&
    /observer\.observe\(section\)/.test(observerSource) &&
    /observer\.disconnect\(\)/.test(observerSource) &&
    /districtMode:\s*"chamber"/.test(stageCode) &&
    /data-cxos-district=\{district\.id\}/.test(stage),
);
check(
  "facility navigation exposes a full map plus compact previous/current/next controls",
  /function FacilityDirectory/.test(stageCode) &&
    /<nav className=\{styles\.facilityDirectory\} aria-label="Agency Command facility map">/.test(
      stage,
    ) &&
    /<ol className=\{styles\.facilitySpine\}>\{renderLinks\(\)\}<\/ol>/.test(
      stage,
    ) &&
    /className=\{styles\.mobileFacilityCurrent\}/.test(stage) &&
    /<span>PREVIOUS<\/span>/.test(stage) &&
    /<span>CURRENT CHAMBER<\/span>/.test(stage) &&
    /<span>NEXT<\/span>/.test(stage) &&
    /<details[\s\S]{0,160}className=\{styles\.mobileFacilityMap\}[\s\S]{0,120}data-agency-inspection[\s\S]{0,80}data-cxos-inspection/.test(
      stage,
    ) &&
    /Choose one of seven chambers/.test(stage),
);
check(
  "facility links preserve modified native anchors and intercept only plain primary navigation",
  /href=\{`#\$\{district\.id\}`\}/.test(stage) &&
    /event\.button !== 0 \|\|[\s\S]{0,180}event\.metaKey[\s\S]{0,120}event\.ctrlKey[\s\S]{0,120}event\.shiftKey[\s\S]{0,120}event\.altKey[\s\S]{0,120}return;[\s\S]{0,100}event\.preventDefault\(\);[\s\S]{0,100}onNavigate\(district\.id\)/.test(
      stageCode,
    ),
);
check(
  "bounded passage is sequence-keyed and consumes only validated runtime timing",
  /districtTransitionMs:\s*\{ A: 620, B: 460 \}/.test(stageCode) &&
    /"--cxos-district-transition-duration": `\$\{districtTransitionDurationMs\}ms`/.test(
      stageCode,
    ) &&
    /key=\{chamberTransition\.sequence\}/.test(stage) &&
    /sequence=\{chamberTransition\.sequence\}/.test(stage) &&
    /data-cxos-transition-sequence=\{sequence\}/.test(stage) &&
    /onAnimationEnd=\{completeDistrictTransition\}/.test(stage) &&
    /timing\.A < 450[\s\S]{0,120}timing\.A > 900[\s\S]{0,120}timing\.B < 450[\s\S]{0,120}timing\.B > timing\.A/.test(
      runtimePolicyCode,
    ),
);
const hashParserSource = sourceBetween(
  stageCode,
  "function agencyDistrictFromHash",
  "function stateLabel",
);
check(
  "hash parsing and Back/Forward restoration are deterministic and invalid hashes fail to Central Command",
  /try\s*\{[\s\S]{0,240}decodeURIComponent/.test(hashParserSource) &&
    /catch\s*\{[\s\S]{0,120}return null/.test(hashParserSource) &&
    /AGENCY_DISTRICTS\.some\(\(district\) => district\.id === candidate\)/.test(
      hashParserSource,
    ) &&
    /const destination = fromHash \?\? "central-command"/.test(stageCode) &&
    /window\.location\.hash && !fromHash[\s\S]{0,180}window\.history\.replaceState\(null, "", "#central-command"\)/.test(
      stageCode,
    ) &&
    /window\.history\.pushState\(null, "", `#\$\{activeDistrict\}`\)/.test(
      stageCode,
    ) &&
    /addEventListener\("popstate", restoreHistoryDistrict\)/.test(stageCode) &&
    /addEventListener\("hashchange", restoreHistoryDistrict\)/.test(stageCode) &&
    /removeEventListener\("popstate", restoreHistoryDistrict\)/.test(stageCode) &&
    /removeEventListener\("hashchange", restoreHistoryDistrict\)/.test(
      stageCode,
    ) &&
    !/history\.(?:pushState|replaceState)|location\.hash|hashchange|popstate/.test(
      runtimeAdapterCode,
    ),
);
check(
  "hashchange reasserts committed chamber focus after native fragment restoration",
  /const fromHash = agencyDistrictFromHash\(window\.location\.hash\);[\s\S]{0,100}const destination = fromHash \?\? "central-command";[\s\S]{0,260}handledHistoryHrefRef\.current === window\.location\.href[\s\S]{0,260}event\?\.type === "hashchange"[\s\S]{0,140}moveToDistrict\(destination, \{ immediate: true \}\)/.test(
    stageCode,
  ) &&
    !/event\?\.type === "hashchange"[\s\S]{0,180}setTimeout/.test(stageCode),
);
check(
  "same-district history reassertion focuses synchronously without a paint-frame gap",
  /if \(districtId === sourceDistrict\)[\s\S]{0,760}phase: "settled"[\s\S]{0,760}document\.hidden[\s\S]{0,180}visibilityFocusPendingRef\.current = true[\s\S]{0,120}else \{[\s\S]{0,100}focusDistrict\(sourceDistrict\)/.test(
    runtimeAdapterCode,
  ) &&
    !/if \(districtId === sourceDistrict\)[\s\S]{0,900}scheduleDistrictFocus\(sourceDistrict\)/.test(
      runtimeAdapterCode,
    ),
);
check(
  "history initialization does not refocus an already rendered replay chamber",
  /const renderedDistrict = roomRootRef\.current\?\.dataset\.activeDistrict;[\s\S]{0,120}if \(event \|\| renderedDistrict !== destination\)[\s\S]{0,100}moveToDistrict\(destination, \{ immediate: true \}\)/.test(
    stageCode,
  ),
);
check(
  "destination commit precedes paint-time heading or requested-control focus",
  /queueDistrictCommitFocus\(destination, pending\.sequence\);[\s\S]{0,260}startTransition\(\(\) => \{[\s\S]{0,100}setActiveDistrict\(destination\);[\s\S]{0,120}setChamberTransition\(settled\)/.test(
    runtimeAdapterCode,
  ) &&
    /useLayoutEffect\(\(\) => \{[\s\S]{0,420}pending\.districtId !== activeDistrict[\s\S]{0,180}pending\.sequence !== chamberTransition\.sequence[\s\S]{0,500}focusDistrict\(pending\.districtId\)/.test(
      runtimeAdapterCode,
    ) &&
    /findCxosElementById\(root, `\$\{districtId\}-heading`\)/.test(
      runtimeAdapterCode,
    ) &&
    /if \(pending\.inspectionId\)[\s\S]{0,320}inspection\.open = true[\s\S]{0,760}target\.focus\(\{ preventScroll: true \}\)/.test(
      stageCode,
    ),
);
check(
  "focus framing preserves the CSS offset and focuses after a settled layout frame",
  /function scrollCxosElementImmediately[\s\S]{0,420}scrollMarginTop[\s\S]{0,260}scrollCxosWindowImmediately/.test(
    runtimeAdapterCode,
  ) &&
    /const scheduleDistrictScroll = useCallback\([\s\S]{0,260}const focusOrigin = document\.activeElement[\s\S]{0,220}requestAnimationFrame\(\(\) => \{[\s\S]{0,220}requestAnimationFrame\(\(\) => \{[\s\S]{0,600}if \(operatorMovedFocus\) return[\s\S]{0,580}scrollCxosElementImmediately\(district\);[\s\S]{0,100}heading\?\.focus\(\{ preventScroll: true \}\)/.test(
      runtimeAdapterCode,
    ) &&
    /const focusDistrict = useCallback\([\s\S]{0,120}scheduleDistrictScroll\(districtId\)/.test(
      runtimeAdapterCode,
    ) &&
    /scrollCxosWindowImmediately\(0\)[\s\S]{0,160}const update/.test(
      runtimeAdapterCode,
    ),
);
check(
  "chamber state is explicit and never driven by scroll; the runtime's scroll/wheel listeners only re-arm idle, and touchmove is still never installed",
  /data-active-district=\{activeDistrict\}/.test(stage) &&
    /data-chamber-ready=\{chamberManaged \? "true" : "false"\}/.test(stage) &&
    /data-chamber-phase=\{chamberTransition\.phase\}/.test(stage) &&
    !/addEventListener\(\s*["'](?:scroll|wheel)["']/.test(stageCode) &&
    !/addEventListener\(\s*["']touchmove["']/.test(
      `${stageCode}\n${runtimeAdapterCode}`,
    ) &&
    !/\bonScroll\s*=/.test(`${stageCode}\n${runtimeAdapterCode}`) &&
    /root\.addEventListener\("scroll", registerScrollActivity, \{ passive: true \}\)/.test(
      runtimeAdapterCode,
    ) &&
    /root\.addEventListener\("wheel", registerScrollActivity, \{ passive: true \}\)/.test(
      runtimeAdapterCode,
    ) &&
    !/setActiveDistrict|moveToDistrict/.test(
      sourceBetween(
        runtimeAdapterCode,
        "const registerScrollActivity",
        "root.addEventListener(\"pointerdown\"",
      ),
    ),
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
  "the room owns no timer and the runtime owns bounded idle, passage, return, scroll-release, and scroll-activity-throttle fallbacks",
  (presentationCode.match(/\bsetTimeout\b/g) ?? []).length === 0 &&
    // 5 pre-existing (release race, idle settling, idle settled, district
    // transition fallback, departure fallback) + 1 new: the trailing-
    // throttled scroll/wheel activity re-arm added in RC2 WP4.
    (runtimeAdapterCode.match(/\bsetTimeout\b/g) ?? []).length === 6 &&
    /scrollActivityThrottle = window\.setTimeout\([\s\S]{0,120}registerActivity\(\)/.test(
      runtimeAdapterCode,
    ) &&
    /idleTimerRef\.current = window\.setTimeout\([\s\S]{0,180}setIdleState\("settling"\)[\s\S]{0,180}setIdleState\("settled"\)/.test(
      runtimeAdapterCode,
    ) &&
    /const expectedSequence = chamberTransition\.sequence[\s\S]{0,180}districtTransitionFallbackRef\.current = window\.setTimeout\([\s\S]{0,300}districtTransitionDurationMs/.test(
      runtimeAdapterCode,
    ) &&
    /window\.setTimeout\([\s\S]{0,120}definition\.departure\.fallbackMs/.test(
      runtimeAdapterCode,
    ) &&
    /window\.clearTimeout\(districtTransitionFallbackRef\.current\)/.test(
      runtimeAdapterCode,
    ) &&
    /window\.requestAnimationFrame\(release\);[\s\S]{0,80}window\.setTimeout\(release, 0\)/.test(
      runtimeAdapterCode,
    ) &&
    /fallbackMs:\s*800/.test(stageCode) &&
    !/\b(?:setInterval|requestIdleCallback)\b/.test(
      `${presentationCode}\n${runtimeAdapterCode}`,
    ),
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
check(
  "History API owns only chamber metadata and the runtime owns the sole route departure",
  !/\brouter\.(?:push|replace)\b|\blocation\.(?:assign|replace)\s*\(/.test(
    stageCode,
  ) &&
    (stageCode.match(/window\.history\.pushState\(/g) ?? []).length === 1 &&
    (stageCode.match(/window\.history\.replaceState\(/g) ?? []).length === 1 &&
    !/window\.location\.(?:hash|href)\s*=/.test(stageCode) &&
    /href:\s*"\/review\/mission-control"/.test(stageCode) &&
    (runtimeAdapterCode.match(/window\.location\.assign\(definition\.departure\.href\)/g) ?? [])
      .length === 1 &&
    /SAFE_LOCAL_ROUTE/.test(runtimePolicyCode),
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
  "agencyClientFloorSweep",
  "agencyTeamRecognition",
  "agencyObservatoryScan",
  "agencyEvidenceRecognition",
  "agencyKaiRecognition",
  "agencyCapacityScan",
  // RC2 WP2 — deliberate, budget-gated Living Environment continuous
  // channels (facility sweep, per-chamber breath, blocked-lane pulse).
  "agencyLivingHeartbeat",
  "agencyLivingBreath",
  "agencyLivingBlockedPulse",
]);
const requiredContinuousAnimations = [
  "agencySweep",
  "agencyBreath",
  "agencyFlowEntering",
  "agencyFlowAdvancing",
  "agencyFlowWaiting",
  "agencyFlowBlocked",
  "agencyFlowResolving",
  "agencyFacilityChannel",
];
check(
  "ambient, flow, and rail motion is finite; only the budget-gated RC2 Living Environment channels are deliberately perpetual",
  // RC1 shipped zero infinite animations. RC2 WP2 deliberately introduces
  // three (facility sweep, per-chamber breath, blocked-lane pulse), each
  // counted against the published continuous-animation budget instead of
  // being iteration-count-limited — see allowedContinuousAnimations. Any
  // `infinite` usage outside that reviewed allowlist still fails this check.
  continuousAnimations.every((name) => allowedContinuousAnimations.has(name)) &&
    [...allowedContinuousAnimations].every((name) => css.includes(name)) &&
    requiredContinuousAnimations.every((name) => css.includes(name)),
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
check(
  "the labelled Kai continuity container exposes a permitted landmark role",
  /className=\{styles\.kaiConversation\}[\s\S]{0,120}role="region"[\s\S]{0,120}aria-label="Route-local Kai preview continuity"/.test(
    stage,
  ),
);
const inspectionPlaneSource = sourceBetween(
  stageCode,
  "function InspectionPlane",
  "function AgencyDistrictShell",
);
const districtShellSource = sourceBetween(
  stageCode,
  "function AgencyDistrictShell",
  "function ActivationRail",
);
check(
  "each chamber stages secondary evidence in a closed native inspection disclosure",
  (stage.match(/<InspectionPlane\b/g) ?? []).length === 7 &&
    /<details[\s\S]{0,160}data-agency-inspection/.test(inspectionPlaneSource) &&
    !/<details[^>]*\sopen(?:\s|=|>)/.test(inspectionPlaneSource) &&
    /<summary>[\s\S]{0,180}INSPECTION PLANE/.test(inspectionPlaneSource) &&
    /querySelectorAll<HTMLDetailsElement>[\s\S]{0,180}details\[data-agency-inspection\]\[open\]/.test(
      inspectionPlaneSource,
    ) &&
    /className=\{styles\.districtTruth\}[\s\S]{0,360}className=\{styles\.districtBody\}/.test(
      districtShellSource,
    ),
);
check(
  "Escape closes only the top local inspection and restores its trigger",
  /const closeLocalLayerOnEscape/.test(stageCode) &&
    /directorRef\.current\?\.open/.test(stageCode) &&
    /details\[data-agency-inspection\]\[open\]/.test(stageCode) &&
    /openInspection\.removeAttribute\("open"\)/.test(stageCode) &&
    /summary\?\.focus\(\{ preventScroll: true \}\)/.test(stageCode) &&
    /addEventListener\("keydown", closeLocalLayerOnEscape, true\)/.test(
      stageCode,
    ) &&
    /removeEventListener\("keydown", closeLocalLayerOnEscape, true\)/.test(
      stageCode,
    ),
);
check(
  "chamber capability fails downward and Tier C/D navigation is immediate",
  /const chamberManaged = capabilitiesReady && validation\.valid/.test(
    stage,
  ) &&
    /hidden=\{chamberManaged && !current\}/.test(stage) &&
    /districtMode === "chamber" \|\| !environment\.scrollActivation/.test(
      runtimeAdapterCode,
    ) &&
    /districtMode === "flow" && !capabilities\.intersectionObserver/.test(
      runtimePolicyCode,
    ) &&
    /definition\.districtMode !== "chamber"[\s\S]{0,120}tier === "C"[\s\S]{0,80}tier === "D"[\s\S]{0,100}return 0/.test(
      runtimePolicyCode,
    ) &&
    /resolution\.tier === "C" \|\|[\s\S]{0,80}resolution\.tier === "D" \|\|[\s\S]{0,120}documentHidden \|\|[\s\S]{0,80}document\.hidden/.test(
      runtimeAdapterCode,
    ) &&
    /if \(immediate\)[\s\S]{0,520}phase: "settled"[\s\S]{0,520}queueDistrictCommitFocus\(districtId, sequence\)[\s\S]{0,320}setActiveDistrict\(districtId\)/.test(
      runtimeAdapterCode,
    ),
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
  /if \(resolution\.tier !== "D"\) return;[\s\S]{0,100}return acquireCxosInstantScroll\(\)/.test(
    runtimeAdapterCode,
  ) &&
    /cxosInstantScrollOwners[\s\S]{0,900}setProperty\("scroll-behavior", "auto", "important"\)[\s\S]{0,900}removeProperty\("scroll-behavior"\)/.test(
      runtimeAdapterCode,
    ),
);
check(
  "Mission Control return delegates one acknowledged departure with native static fallback",
  /const beginMissionControlReturn\s*=/.test(stageCode) &&
    /beginDeparture\(event\)/.test(stageCode) &&
    /resolution\.tier === "C" \|\|[\s\S]{0,80}resolution\.tier === "D"/.test(
      runtimeAdapterCode,
    ) &&
    /onAnimationEnd=\{completeMissionControlReturn\}/.test(stage) &&
    /completeDeparture\(event\)/.test(stageCode) &&
    /window\.clearTimeout\(departureFallbackRef\.current\)/.test(
      runtimeAdapterCode,
    ) &&
    /data-departing=\{departing \? "true" : "false"\}/.test(stage) &&
    /Kai confirms the review-route handoff to Mission Control/.test(stage) &&
    /Kai confirms Mission Control handoff · route session clears/.test(stage) &&
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
  "Director closes to its summary and runtime replay preserves the scroll-zero reset",
  /directorSummaryRef\.current\?\.focus\(\{ preventScroll: true \}\)/.test(
    stageCode,
  ) &&
    /replayRuntimeArrival/.test(stageCode) &&
    /replayFocusPendingRef\.current = true/.test(runtimeAdapterCode) &&
    /scrollCxosWindowImmediately\(0\)/.test(runtimeAdapterCode) &&
    /event\.key !== "Escape" \|\| !director\?\.open/.test(stageCode),
);
check(
  "Director Escape is captured globally before the runtime arrival Escape handler",
  /window\.addEventListener\("keydown", closeDirectorOnEscape, true\)/.test(
    stageCode,
  ) &&
    /event\.key !== "Escape" \|\| !director\?\.open[\s\S]{0,220}event\.preventDefault\(\);[\s\S]{0,80}event\.stopImmediatePropagation\(\)/.test(
    stageCode,
  ) &&
    /window\.removeEventListener\("keydown", closeDirectorOnEscape, true\)/.test(
      stageCode,
    ),
);
const directorEscapeHandler = sourceBetween(
  stageCode,
  "const closeDirectorOnEscape",
  "window.addEventListener",
);
check(
  "Director Escape closes only Director and conditionally restores summary focus",
  /event\.preventDefault\(\)/.test(directorEscapeHandler) &&
    /event\.stopImmediatePropagation\(\)/.test(directorEscapeHandler) &&
    /removeAttribute\("open"\)/.test(directorEscapeHandler) &&
    /const focusWasInside = director\.contains\(document\.activeElement\)/.test(
      directorEscapeHandler,
    ) &&
    /directorSummaryRef\.current\?\.focus\(\{ preventScroll: true \}\)/.test(
      directorEscapeHandler,
    ) &&
    !/settleRuntimeArrival|replayRuntimeArrival|beginDeparture|completeDeparture|moveToDistrict|clearKaiSession|setKaiCommand|setKaiTurns|setFixtureState|setOperatingModel|setProjection/.test(
      directorEscapeHandler,
    ),
);
check(
    "cross-chamber queue and intake handoffs reveal their inspection before focusing controls",
    /const focusPendingChamberTarget/.test(stageCode) &&
    /inspection\.open = true/.test(stageCode) &&
    /target\.focus\(\{ preventScroll: true \}\)/.test(stageCode) &&
    /target\.scrollIntoView\(\{ block: "center", behavior: "auto" \}\)/.test(
      stageCode,
    ) &&
    /navigateToChamber\("client-operations", \{[\s\S]{0,180}elementId: "queue-inspect-response-014"[\s\S]{0,180}inspectionId: "client-operations-inspection"/.test(
      stageCode,
    ) &&
    /navigateToChamber\("client-operations", \{[\s\S]{0,180}elementId: "synthetic-intake-handoff-control"[\s\S]{0,180}inspectionId: "client-operations-inspection"/.test(
      stageCode,
    ) &&
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
    /Capability detection failed safely/.test(runtimePolicy),
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
    /env\(safe-area-inset-bottom\)/.test(css) &&
    !/width:\s*calc\(100vw/.test(css),
);
const baseDistrictRule =
  css.match(/(?:^|\n)\.district\s*\{([\s\S]*?)\}/)?.[1] ?? "";
const mobileCssAt = css.indexOf("@media (max-width: 767px)");
const mobileCss = mobileCssAt >= 0 ? css.slice(mobileCssAt) : "";
const extremeReflowCss = sourceBetween(
  css,
  "@media (max-width: 260px)",
  "@media (pointer: coarse)",
);
const passageEnvironmentSource = sourceBetween(
  runtimeAdapterCode,
  "const environment = useMemo",
  "const districtTransitionDurationMs",
);
check(
  "one logical environmental gutter separates every measurable district rail from content",
  /--agency-district-rail-gutter:\s*1\.25rem/.test(baseDistrictRule) &&
    /padding-inline:\s*[\s\S]{0,100}var\(--agency-district-rail-gutter\)/.test(
      baseDistrictRule,
    ) &&
    /\.districtRail\s*\{[\s\S]{0,180}inset-inline-start:\s*0[\s\S]{0,100}width:\s*2px/.test(
      css,
    ) &&
    /\.district\s*\{[\s\S]{0,180}padding-inline:\s*var\(--agency-district-rail-gutter\) 0\.75rem/.test(
      mobileCss,
    ) &&
    !/\.districtHeader h2\s*\{[\s\S]{0,120}(?:margin-left|padding-left|translateX)/.test(
      mobileCss,
    ),
);
check(
  "threshold state changes reserve fixed geometry and cannot introduce CLS",
  /\.districtThreshold strong\s*\{[\s\S]{0,180}inline-size:\s*10ch[\s\S]{0,120}min-inline-size:\s*10ch[\s\S]{0,180}text-align:\s*right/.test(
    css,
  ) &&
    /\.districtThreshold strong span\s*\{[\s\S]{0,100}position:\s*absolute[\s\S]{0,100}inset:\s*0/.test(
      css,
    ) &&
    ["static", "queued", "operating", "cleared"].every(
      (state) =>
        stage.includes(`data-threshold-state="${state}"`) &&
        css.includes(`[data-threshold-state="${state}"]`),
    ) &&
    !/<strong>\{journeyState\}<\/strong>/.test(stage),
);
check(
  "contextual Kai suggestions reserve their measured mobile and reflow footprints",
  /\.room \.kaiSuggestions button\s*\{[\s\S]{0,80}min-block-size:\s*3\.3rem/.test(
    mobileCss,
  ) &&
    /\.room \.kaiSuggestions button\s*\{[\s\S]{0,80}min-block-size:\s*4\.3rem/.test(
      extremeReflowCss,
    ),
);
check(
  "the route-level skip control preserves a 44px-plus focused touch target",
  /:global\(body\):has\(\.room\)\s*>\s*:global\(\.skip-link\)\s*\{[\s\S]{0,140}min-height:\s*3rem/.test(
    css,
  ) &&
    /:global\(body\):has\(\.room\)\s*>\s*:global\(\.skip-link\):focus-visible\s*\{[\s\S]{0,100}transform:\s*translateY\(0\)/.test(
      css,
    ),
);
check(
  "journey motion never transforms the observed district box or pins mobile semantics",
  !/\btransform\s*:/.test(baseDistrictRule) &&
    !/\.district\[data-current="true"\]\s*\{[\s\S]{0,120}\btransform\s*:/.test(
      css,
    ) &&
    !/\.(?:districtHeader|districtTruth|districtBody|districtHandoff|kaiContext)\s*\{[^}]*position:\s*sticky/.test(
      mobileCss,
    ) &&
    !/scroll-snap-type|scroll-snap-align/.test(css),
);
check(
  "facility passage is viewport-local, safe-area aware, pointer-inert, bounded by the runtime variable, and never creates a blank stage",
  /\.facilityPassage\s*\{[\s\S]{0,420}pointer-events:\s*none[\s\S]{0,120}position:\s*fixed/.test(css) &&
    /\.facilityPassage\s*\{[\s\S]{0,520}safe-area-inset-top[\s\S]{0,120}safe-area-inset-right[\s\S]{0,120}safe-area-inset-bottom[\s\S]{0,120}safe-area-inset-left/.test(
      css,
    ) &&
    /\.facilityPassage\[data-active="true"\]\s*\{[\s\S]{0,260}animation:[^;]*var\(--cxos-district-transition-duration/.test(
      css,
    ) &&
    !/\.chamberStage \.district\[data-current="true"\]\s*\{[\s\S]{0,160}animation:/.test(
      css,
    ) &&
    !/@keyframes agencyChamberAcquire/.test(css) &&
    /\.district\[hidden\]\s*\{[\s\S]{0,80}display:\s*none/.test(css) &&
    /chamberTransition\.phase === "passage"/.test(stageCode) &&
    /source=\{activeDistrictRecord\}/.test(stage) &&
    /target=\{passageTargetRecord\}/.test(stage) &&
    /"data-cxos-motion": environment\.motion/.test(runtimeAdapterCode) &&
    /chamberTransition\.phase !== "passage"/.test(passageEnvironmentSource) &&
    /motion:[\s\S]{0,120}"paused"/.test(passageEnvironmentSource) &&
    /heartbeat:[\s\S]{0,140}"paused"/.test(passageEnvironmentSource) &&
    /atmosphere:[\s\S]{0,140}"paused"/.test(passageEnvironmentSource) &&
    /scrollActivation:\s*false/.test(passageEnvironmentSource),
);
check(
  "inactive, paused, hidden, departing, and static projections stop district heartbeat work",
  /\.district:not\(\[data-current="true"\]\) \.flowTrack b\s*\{[\s\S]{0,80}animation-play-state:\s*paused/.test(
    css,
  ) &&
    /\.room:not\(\[data-cxos-motion="active"\]\) \.districtRail i/.test(css) &&
    /\.room\[data-cxos-heartbeat="active"\] \.district\[data-current="true"\] \.districtRail i/.test(
      css,
    ) &&
    /\.room\[data-fixture="loading"\] \.districtRail i/.test(css) &&
    /\.room\[data-fixture="empty"\] \.districtRail i/.test(css) &&
    /\.room\[data-hidden="true"\] \.districtRail i/.test(css) &&
    /\.room\[data-departing="true"\] \.districtRail i/.test(css) &&
    /animation-play-state:\s*paused !important/.test(css) &&
    /\.room\[data-tier="C"\] \.districtEnvironment[\s\S]{0,120}\.room\[data-tier="D"\] \.districtEnvironment/.test(
      css,
    ),
);
const districtRhythmDurations = AGENCY_DISTRICTS.map((district) =>
  css.match(
    new RegExp(
      `\\.district\\[data-agency-district="${district.id}"\\]\\s*\\{[^}]*?--agency-district-rail-duration:\\s*([0-9.]+s)`,
    ),
  )?.[1],
);
check(
  "all seven districts project a distinct purpose-paced rail rhythm from one bounded channel",
  districtRhythmDurations.every(Boolean) &&
    new Set(districtRhythmDurations).size === AGENCY_DISTRICTS.length &&
    /animation:\s*agencyFacilityChannel var\(--agency-district-rail-duration\)[\s\S]{0,100}var\(--agency-district-rail-easing\) 1 both/.test(
      css,
    ),
);
check(
  "the seven chambers expose distinct spatial protagonists instead of one repeated document template",
  [
    "centralVista",
    "clientFlowMoment",
    "teamCoverageMoment",
    "observatoryGrid",
    "archiveLedger",
    "kaiDesk",
    "capacityHorizonBlock",
  ].every(
    (hook) =>
      stage.includes(`styles.${hook}`) &&
      new RegExp(`\\.${hook}\\s*\\{`).test(css),
  ) &&
    AGENCY_DISTRICTS.every((district) =>
      css.includes(`.district[data-agency-district="${district.id}"]`),
    ) &&
    /\.facilityShell\s*\{/.test(css) &&
    /\.chamberStage\s*\{/.test(css) &&
    /\.inspectionPlane\s*\{/.test(css) &&
    !/\.district\s*\{[^}]*grid-template-areas:[^}]*"threshold"[^}]*"header"[^}]*"truth"[^}]*"body"[^}]*"handoff"[^}]*\}/.test(
      css,
    ),
);
check(
  "extreme reflow collapses decorative threshold metadata and permits heading wrap",
  /\.districtThreshold i,[\s\S]{0,100}display:\s*none/.test(extremeReflowCss) &&
    /\.districtHeader h2,[\s\S]{0,220}overflow-wrap:\s*anywhere/.test(
      extremeReflowCss,
    ) &&
    /\.arrivalThreshold \.activationRail\s*\{[\s\S]{0,80}grid-template-columns:\s*1fr/.test(
      extremeReflowCss,
    ) &&
    /\.footer \.returnThreshold\s*\{[\s\S]{0,60}min-width:\s*0/.test(
      extremeReflowCss,
    ),
);
check(
  "district h2 headings own the spatial hierarchy and nested instruments use h3",
  /<h2 id=\{`\$\{district\.id\}-heading`\}/.test(stage) &&
    /function InstrumentHeader[\s\S]{0,420}<h3 id=\{id\}>\{title\}<\/h3>/.test(
      stage,
    ) &&
    /id="heartbeat-heading">The agency is breathing<\/h3>/.test(stage) &&
    !/<h2 id="(?:heartbeat|loading|empty|queue|portfolio)-heading"/.test(stage),
);
const baseDirectorRule =
  css.match(/(?:^|\n)\.director\s*\{([\s\S]*?)\}/)?.[1] ?? "";
const directorMarkupAt = stage.indexOf("<details");
const stateBandMarkupAt = stage.indexOf("className={styles.stateBand}");
const directoryMarkupAt = stage.indexOf("<FacilityDirectory");
const firstDistrictMarkupAt = stage.indexOf("<AgencyDistrictShell");
check(
  "Director is in normal flow after projection state and before navigation or canonical districts",
  stateBandMarkupAt >= 0 &&
    directorMarkupAt > stateBandMarkupAt &&
    directoryMarkupAt > directorMarkupAt &&
    firstDistrictMarkupAt > directoryMarkupAt &&
    /position:\s*relative/.test(baseDirectorRule) &&
    /inset:\s*auto/.test(baseDirectorRule) &&
    /width:\s*min\(27rem,\s*100%\)/.test(baseDirectorRule) &&
    !/position:\s*(?:fixed|sticky)|(?:top|right|bottom|left):/.test(
      baseDirectorRule,
    ),
);
check(
  "mobile Director is compact until explicit expansion and remains bounded in its safe-area-aware flow container",
  /\.director:not\(\[open\]\) summary strong\s*\{[\s\S]{0,220}clip-path:\s*inset\(50%\)/.test(
    css,
  ) &&
    /\.director\[open\]\s*\{[\s\S]{0,80}width:\s*100%/.test(css) &&
    /\.directorPanel\s*\{[\s\S]{0,160}max-height:\s*min\(70dvh,\s*42rem\)/.test(css) &&
    /<details[\s\S]{0,200}className=\{styles\.director\}[\s\S]{0,400}<summary/.test(
      stage,
    ) &&
    /onToggle=\{\(event\) => \{[\s\S]{0,100}event\.currentTarget\.open[\s\S]{0,120}scrollCxosElementImmediately\(event\.currentTarget\)/.test(
      stage,
    ) &&
    !/<details[^>]*\sopen(?:\s|=|>)/.test(stage),
);
check(
  "Director clearance remains CSS-first without scroll or resize measurement",
  !/\b(?:ResizeObserver|MutationObserver)\b|getBoundingClientRect|getComputedStyle|visualViewport/.test(
    stageCode,
  ) &&
    !/addEventListener\(\s*["'](?:scroll|resize|orientationchange|wheel|touchmove)["']/.test(
      stageCode,
    ) &&
    !/\bon(?:Scroll|Resize|Wheel|TouchMove)\s*=/.test(stage),
);
check(
  "mobile facility navigation reserves the largest measured RC4 row without clipping intrinsic reflow",
  /@media \(max-width:\s*860px\)[\s\S]{0,1200}\.mobileFacilityCurrent\s*\{[\s\S]{0,120}min-block-size:\s*3\.9rem[\s\S]{0,120}grid-auto-rows:\s*minmax\(3\.9rem, auto\)/.test(
    css,
  ) &&
    /\.mobileFacilityCurrent > a,[\s\S]{0,180}\.mobileFacilityCurrent > \.facilityEdge\s*\{[\s\S]{0,100}min-block-size:\s*3\.9rem/.test(
      css,
    ) &&
    !/\.mobileFacilityCurrent(?:\s*>[^,{]+)?\s*\{[^}]*(?:^|;)\s*(?:height|block-size):/.test(
      css,
    ),
);
check(
  "narrow projections reserve the measured Kai context footprint without fixing or clipping reflow",
  /@media \(max-width:\s*430px\)[\s\S]{0,700}\.chamberStage > \.kaiContext\s*\{[\s\S]{0,120}box-sizing:\s*border-box[\s\S]{0,120}min-block-size:\s*202px/.test(
    css,
  ) &&
    /@media \(max-width:\s*260px\)[\s\S]{0,220}\.chamberStage > \.kaiContext\s*\{[\s\S]{0,100}min-block-size:\s*310px/.test(
      css,
    ) &&
    !/\.chamberStage > \.kaiContext\s*\{[^}]*(?:^|;)\s*(?:height|block-size):/.test(
      css,
    ) &&
    !/\.chamberStage > \.kaiContext\s*\{[^}]*overflow:\s*hidden/.test(css),
);
check(
  "chamber, disclosure, Kai, arrival, and Founder-navigation targets retain the 44px floor",
  /\.arrivalActions button,[\s\S]{0,420}\.facilityDirectory a,[\s\S]{0,220}\.districtHandoff a\s*\{[\s\S]{0,100}min-height:\s*2\.75rem/.test(
    css,
  ) &&
    /\.inspectionPlane summary,[\s\S]{0,80}\.mobileFacilityMap summary\s*\{[\s\S]{0,100}min-height:\s*3\.25rem/.test(
      css,
    ) &&
    /@media \(pointer: coarse\)[\s\S]{0,180}\.mobileFacilityCurrent > a,[\s\S]{0,180}\.mobileFacilityMap summary,[\s\S]{0,180}\.mobileFacilityMap a,[\s\S]{0,180}\.inspectionPlane summary\s*\{[\s\S]{0,100}min-height:\s*3rem/.test(
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
  "language governs future Core Runtime adoption without claiming other rooms changed",
  /Mission Control and future operating rooms are governed[\s\S]{0,240}separately scoped, reviewed, and implemented/.test(
    languageMarkdown,
  ) &&
    /Phase 6\.2 changes no Mission Control or future-room runtime/.test(
      languageMarkdown,
    ) &&
    /Phase 6\.2 changes no other room’s runtime/.test(languageHtml) &&
    /Agency Headquarters is the only (?:consumer migrated|reference consumer migrated) in this phase/.test(
      languageHtml,
    ),
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
  .replace(/\bnot [^.]{0,180}\blegal deadlines?\b/gi, "")
  .replace(/\bno [^.\n]{0,180}\blegal deadlines?\b/gi, "")
  .replace(/\bwithout [^.\n]{0,180}\blegal deadlines?\b/gi, "");
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
