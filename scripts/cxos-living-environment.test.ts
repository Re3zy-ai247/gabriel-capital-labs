// Run: node --import tsx scripts/cxos-living-environment.test.ts
//
// DB-free policy and source guard for the CXOS Core Runtime 1.1 Living
// Environment extension. It holds presentation-only ownership, closed chamber
// profiles, deterministic fail-down, bounded idle, and native interaction.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AGENCY_LIVING_ENVIRONMENT } from "../app/review/agency-command/environment";
import {
  AGENCY_DISTRICTS,
  type AgencyDistrictId,
} from "../app/review/agency-command/fixtures";
import {
  CXOS_CAMERA_PRESETS,
  CXOS_DEPTH_PRESETS,
  CXOS_EMOTIONAL_MODES,
  CXOS_FOCUS_PRESETS,
  CXOS_IDLE_PRESETS,
  CXOS_KAI_RESPONSE_PRESETS,
  CXOS_LIGHTING_PRESETS,
  CXOS_MOTION_SIGNATURES,
  resolveCxosLivingEnvironmentProjection,
  validateCxosRoomRuntime,
  type CxosRoomRuntimeDefinition,
} from "../lib/cxos/runtime";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const policy = read("lib/cxos/runtime.ts");
const adapter = read("components/cxos/runtime/useCxosRoomRuntime.ts");
const environmentSource = read("app/review/agency-command/environment.ts");
const stage = read("app/review/agency-command/stage.tsx");
const css = read("app/review/agency-command/agency-command.module.css");
const browserHarness = read("scripts/cxos-living-environment/browser.mjs");

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) pass += 1;
  else {
    fail += 1;
    console.error(`FAIL: ${label}`);
  }
}

const districtIds = AGENCY_DISTRICTS.map((district) => district.id);
const definition = {
  roomId: "agency-command",
  districts: districtIds,
  initialDistrict: "central-command",
  districtMode: "chamber",
  districtTransitionMs: { A: 620, B: 460 },
  arrivalBeats: ["identity", "systems", "settlement"],
  arrivalDurationMs: { A: 1500, B: 700 },
  motionChannels: ["room-breath", "operational-sweep", "client-flow"],
  livingEnvironment: AGENCY_LIVING_ENVIRONMENT,
  departure: { href: "/review/mission-control", fallbackMs: 800 },
} satisfies CxosRoomRuntimeDefinition<AgencyDistrictId>;

check(
  "Agency defines exactly one ordered presentation profile per chamber",
  AGENCY_LIVING_ENVIRONMENT.chambers.length === 7 &&
    JSON.stringify(
      AGENCY_LIVING_ENVIRONMENT.chambers.map((chamber) => chamber.id),
    ) === JSON.stringify(districtIds),
);
check(
  "the Agency Living Environment contract validates",
  validateCxosRoomRuntime(definition).valid,
);
check(
  "every directing dimension is unique across the seven reference chambers",
  [
    "emotion",
    "camera",
    "lighting",
    "depth",
    "motion",
    "focus",
    "idle",
    "kai",
  ].every(
    (field) =>
      new Set(
        AGENCY_LIVING_ENVIRONMENT.chambers.map(
          (chamber) => chamber[field as keyof typeof chamber],
        ),
      ).size === 7,
  ),
);
check(
  "all profile values come from closed Core Runtime registries",
  AGENCY_LIVING_ENVIRONMENT.chambers.every(
    (chamber) =>
      CXOS_EMOTIONAL_MODES.includes(chamber.emotion) &&
      CXOS_CAMERA_PRESETS.includes(chamber.camera) &&
      CXOS_LIGHTING_PRESETS.includes(chamber.lighting) &&
      CXOS_DEPTH_PRESETS.includes(chamber.depth) &&
      CXOS_MOTION_SIGNATURES.includes(chamber.motion) &&
      CXOS_FOCUS_PRESETS.includes(chamber.focus) &&
      CXOS_IDLE_PRESETS.includes(chamber.idle) &&
      CXOS_KAI_RESPONSE_PRESETS.includes(chamber.kai),
  ),
);

const invalidDefinitions: Array<
  [string, CxosRoomRuntimeDefinition<AgencyDistrictId>]
> = [
  [
    "missing chamber",
    {
      ...definition,
      livingEnvironment: {
        ...AGENCY_LIVING_ENVIRONMENT,
        chambers: AGENCY_LIVING_ENVIRONMENT.chambers.slice(0, 6),
      },
    },
  ],
  [
    "reordered chamber",
    {
      ...definition,
      livingEnvironment: {
        ...AGENCY_LIVING_ENVIRONMENT,
        chambers: [
          AGENCY_LIVING_ENVIRONMENT.chambers[1],
          AGENCY_LIVING_ENVIRONMENT.chambers[0],
          ...AGENCY_LIVING_ENVIRONMENT.chambers.slice(2),
        ],
      },
    },
  ],
  [
    "invalid idle duration",
    {
      ...definition,
      livingEnvironment: {
        ...AGENCY_LIVING_ENVIRONMENT,
        idleAfterMs: { A: 999, B: 999 },
      },
    },
  ],
  [
    "invalid closed token",
    {
      ...definition,
      livingEnvironment: {
        ...AGENCY_LIVING_ENVIRONMENT,
        chambers: [
          {
            ...AGENCY_LIVING_ENVIRONMENT.chambers[0],
            camera: "cursor-parallax" as never,
          },
          ...AGENCY_LIVING_ENVIRONMENT.chambers.slice(1),
        ],
      },
    },
  ],
];
for (const [label, candidate] of invalidDefinitions) {
  const result = validateCxosRoomRuntime(candidate);
  check(`${label} fails the complete enhanced contract`, !result.valid);
}

const resolve = (
  overrides: Partial<
    Parameters<typeof resolveCxosLivingEnvironmentProjection<AgencyDistrictId>>[2]
  > = {},
) =>
  resolveCxosLivingEnvironmentProjection(definition, "central-command", {
    contractValid: true,
    tier: "A",
    phase: "operating",
    documentHidden: false,
    passage: false,
    attention: "ambient",
    kai: "quiet",
    idle: "engaged",
    ...overrides,
  });

check(
  "Tier A ambient operation owns at most two continuous channels",
  resolve()?.motion === "active" &&
    resolve()?.continuousAnimationBudget === 2,
);
check(
  "Tier B ambient operation owns at most one continuous channel",
  resolve({ tier: "B" })?.continuousAnimationBudget === 1,
);
check(
  "reading, inspection, focused Kai, and idle immediately quiet the room",
  [
    resolve({ attention: "reading" }),
    resolve({ attention: "inspecting" }),
    resolve({ kai: "staged" }),
    resolve({ kai: "preparing" }),
    resolve({ kai: "resolved" }),
    resolve({ idle: "settled" }),
  ].every(
    (projection) =>
      projection?.motion === "quiet" &&
      projection.idle === "settled" &&
      projection.continuousAnimationBudget === 0,
  ),
);
check(
  "hidden, passage, arrival, and departure lifecycle states are quiet",
  [
    resolve({ documentHidden: true }),
    resolve({ passage: true }),
    resolve({ phase: "arriving" }),
    resolve({ phase: "departing" }),
  ].every(
    (projection) =>
      projection?.motion === "quiet" &&
      projection.continuousAnimationBudget === 0,
  ),
);
check(
  "Tier C and D projections are static with no continuous channel",
  [resolve({ tier: "C" }), resolve({ tier: "D" })].every(
    (projection) =>
      projection?.static &&
      projection.motion === "static" &&
      projection.continuousAnimationBudget === 0,
  ),
);
check(
  "invalid contracts project no enhanced profile",
  resolve({ contractValid: false }) === null,
);
check(
  "structurally incomplete contracts fail closed without throwing",
  validateCxosRoomRuntime({} as CxosRoomRuntimeDefinition<string>).valid === false &&
    validateCxosRoomRuntime({} as CxosRoomRuntimeDefinition<string>).reasons.includes(
      "runtime-shape",
    ),
);

check(
  "the browser adapter owns one resettable idle timer and no interval loop",
  /const idleTimerRef = useRef<number \| null>\(null\)/.test(adapter) &&
    /window\.clearTimeout\(idleTimerRef\.current\)/.test(adapter) &&
    /setIdleState\("settling"\)/.test(adapter) &&
    /setIdleState\("settled"\)/.test(adapter) &&
    !/setInterval|requestIdleCallback/.test(adapter),
);
check(
  "invalid and legacy contracts omit optional Living Environment attributes",
  /"data-cxos-environment": livingEnvironment\?\.profileId/.test(adapter) &&
    /"data-cxos-profile": livingEnvironment\?\.chamber\.id/.test(adapter) &&
    !/livingEnvironment\?\.profileId \?\? "none"/.test(adapter) &&
    !/livingEnvironment\?\.chamber\.id \?\? "none"/.test(adapter),
);
check(
  "discrete activity is root-scoped, scroll/wheel re-arm idle passively and throttled, and touch is never captured",
  /root\.addEventListener\("pointerdown"/.test(adapter) &&
    /root\.addEventListener\("click"/.test(adapter) &&
    /root\.addEventListener\("keydown"/.test(adapter) &&
    /root\.addEventListener\("focusin"/.test(adapter) &&
    /root\.addEventListener\("toggle"/.test(adapter) &&
    /root\.addEventListener\("scroll", registerScrollActivity, \{ passive: true \}\)/.test(
      adapter,
    ) &&
    /root\.addEventListener\("wheel", registerScrollActivity, \{ passive: true \}\)/.test(
      adapter,
    ) &&
    /window\.addEventListener\("scroll", registerScrollActivity, \{ passive: true \}\)/.test(
      adapter,
    ) &&
    !/addEventListener\(\s*["']touchmove["']/.test(adapter),
);
check(
  "all adapter listeners, lifecycle resets, and the idle timer have symmetric cleanup",
  /removeEventListener\("pointerdown"/.test(adapter) &&
    /removeEventListener\("click"/.test(adapter) &&
    /removeEventListener\("keydown"/.test(adapter) &&
    /removeEventListener\("focusin"/.test(adapter) &&
    /removeEventListener\("toggle"/.test(adapter) &&
    /idleTimerRef\.current = null/.test(adapter) &&
    /setDocumentHidden\(true\)/.test(adapter) &&
    /setDetectedAttention\("ambient"\)/.test(adapter) &&
    /details\[data-cxos-inspection\]\[open\]/.test(adapter),
);
check(
  "reading is scoped to text-entry focus, not bare interactive focus (rail links/buttons/summary are ambient)",
  /const textEntryFocus =/.test(adapter) &&
    /focused !== root/.test(adapter) &&
    /input:not\(\[type="button" i\]\):not\(\[type="submit" i\]\), textarea, \[contenteditable\]/.test(
      adapter,
    ) &&
    !/focused\.closest\("\[data-cxos-focus-zone\]"\)/.test(adapter) &&
    !/'a\[href\], button,/.test(adapter) &&
    !/const interactiveFocus =/.test(adapter),
);
check(
  "Agency wires explicit inspection, focus, Kai, profile, and passage signals",
  /livingEnvironment: AGENCY_LIVING_ENVIRONMENT/.test(stage) &&
    /presentationSignals:/.test(stage) &&
    /kai: kaiPresentationState/.test(stage) &&
    /data-cxos-inspection/.test(stage) &&
    /data-cxos-focus-zone/.test(stage) &&
    /data-cxos-passage-target/.test(stage),
);
check(
  "the facility sweep and per-chamber breath channels have declared ownership markers",
  /data-cxos-motion-channel=\{runtime\.motionChannels\[1\]\}/.test(stage) &&
    /className=\{styles\.districtEnvironment\}[\s\S]{0,160}data-cxos-motion-channel="continuous:chamber-breath transient:chamber-acquire scroll:depth-parallax"/.test(
      stage,
    ) &&
    /data-cxos-animation-budget="2"/.test(css) &&
    /data-cxos-animation-budget="1"/.test(css),
);
check(
  "Agency route reset clears transient overlays, pending focus, and Kai state",
  /setExpandedQueueId\(null\)/.test(stage) &&
    /setIntakeOpen\(false\)/.test(stage) &&
    /setCinematicPromptOpen\(false\)/.test(stage) &&
    /pendingHistoryDistrictRef\.current = null/.test(stage) &&
    /pendingChamberFocusRef\.current = null/.test(stage) &&
    /kaiSubmitLockedRef\.current = false/.test(stage),
);
check(
  "pending chamber focus owns two cancelable frames and a latest-intent sequence",
  /pendingChamberFocusSequenceRef = useRef\(0\)/.test(stage) &&
    /pendingChamberFocusFrameRef = useRef<number \| null>\(null\)/.test(stage) &&
    /pendingChamberFocusSettleFrameRef = useRef<number \| null>\(null\)/.test(stage) &&
    /window\.cancelAnimationFrame\(pendingChamberFocusFrameRef\.current\)/.test(stage) &&
    /window\.cancelAnimationFrame\(pendingChamberFocusSettleFrameRef\.current\)/.test(stage) &&
    /focusSequence === pendingChamberFocusSequenceRef\.current/.test(stage) &&
    /dataset\.activeDistrict === pending\.districtId/.test(stage),
);
check(
  "navigation and hidden-page lifecycle invalidate stale chamber focus",
  /cancelPendingChamberFocus\(\);\s*roomRootRef\.current/.test(stage) &&
    /pendingChamberFocusRef\.current = pendingFocus\s*\?/.test(stage) &&
    /document\.addEventListener\("visibilitychange", cancelForHiddenLifecycle\)/.test(stage) &&
    /window\.addEventListener\("pagehide", cancelForPageHide\)/.test(stage) &&
    /window\.removeEventListener\("pagehide", cancelForPageHide\)/.test(stage),
);
check(
  "history listeners rebind when their move callback changes without replaying initial restore",
  /const shouldRestoreInitialHistory = !historyReadyRef\.current/.test(stage) &&
    /if \(shouldRestoreInitialHistory\) restoreHistoryDistrict\(\)/.test(stage) &&
    !/!chamberManaged \|\| historyReadyRef\.current/.test(stage),
);
check(
  "the directing profile owns presentation tokens only",
  !/fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|@\/lib\/prisma|next-auth|stripe|anthropic|Math\.random|Date\s*\(/i.test(
    environmentSource,
  ),
);
check(
  "CSS has explicit idle, inspection, static-tier, and reduced-motion hard stops",
  /data-cxos-idle=["']settled["']/.test(css) &&
    /data-cxos-attention=["']inspecting["']/.test(css) &&
    /data-cxos-tier=["']C["']/.test(css) &&
    /data-cxos-tier=["']D["']/.test(css) &&
    /prefers-reduced-motion:\s*reduce/.test(css) &&
    /animation:\s*none\s*!important/.test(css),
);
check(
  "all seven chamber ids have explicit room-owned presentation selectors",
  districtIds.every((id) => css.includes(`data-cxos-profile=\"${id}\"`)),
);
check(
  "scroll/wheel only re-arm idle: no touchmove anywhere, no scroll/wheel listener in stage.tsx, and stage.tsx still does no scroll-driven measurement",
  !/addEventListener\(\s*["']touchmove["']/.test(`${adapter}\n${stage}`) &&
    !/addEventListener\(\s*["'](?:scroll|wheel)["']/.test(stage) &&
    !/scrollY\s*[*/+-]|getBoundingClientRect\(\).*transform/.test(stage),
);
check(
  "Living mode hard-stops legacy pseudo-element signatures outside functional :is()",
    /\.room\[data-cxos-environment\] \.healthBank::after/.test(css) &&
    /\.room\[data-cxos-environment\] \.kaiDesk::before/.test(css) &&
    /\.room\[data-cxos-environment\] \.clientFlowMoment::after/.test(css) &&
    !/:is\([^)]*\.healthBank::after/.test(css),
);
check(
  "browser evidence counts known legacy signatures and waits for the settled shot",
  /ObservatoryScan\|EvidenceRecognition\|KaiRecognition/.test(browserHarness) &&
    /runningEnvironmentAnimationCount/.test(browserHarness) &&
    /async function waitForSettledShot/.test(browserHarness) &&
    /style\.visibility === "hidden"/.test(browserHarness),
);
check(
  "A-tier scroll choreography preserves its ViewTimeline and is behavior-gated",
  /animation-duration:\s*auto\s*!important/.test(css) &&
    /animation-timeline:\s*view\(\)\s*!important/.test(css) &&
    /animation-range:\s*cover 8% cover 92%\s*!important/.test(css) &&
    /\.districtEnvironment\s*\{[\s\S]{0,160}overflow:\s*clip/.test(css) &&
    /async function measureScrollLinkedChoreography/.test(browserHarness) &&
    /genuineViewTimeline/.test(browserHarness) &&
    /timelineSubjectMatches/.test(browserHarness) &&
    /timelineSourceIsDocumentScroller/.test(browserHarness) &&
    /endpointResponsive/.test(browserHarness) &&
    /renderedTransformResponsive/.test(browserHarness) &&
    /coverage:scroll-linked-choreography/.test(browserHarness),
);
check(
  "finite arrival threshold beats are not charged to the ambient environment budget",
  /agencyThresholdBeat/.test(css) &&
    !/DistrictOperatingMoment\|ThresholdBeat\|FacilityChannel/.test(browserHarness),
);
check(
  "Core policy remains pure and room-agnostic",
  !/\bwindow\.|\bdocument\.|\bnavigator\.|Agency Command|Central Command|Kai Executive Suite/.test(
    policy,
  ),
);

// -- RC2 WP2: restored state-bearing chamber motion -------------------------
const killListBlock = css.slice(
  css.indexOf("Living mode retires every legacy decorative lane"),
  css.indexOf("Budget 2 opts into ambient"),
);
check(
  "the unconditional Living-mode kill list still retires every legacy motion surface verbatim",
  killListBlock.length > 0 &&
    [
      ".ambientSweep",
      ".roomBreath",
      ".districtRail i",
      ".facilityPulse i",
      ".flowTrack b",
      ".districtEnvironment,",
      ".districtEnvironment *",
      ".districtBody > *",
      ".inspectionBody",
      ".preparedArtifact",
      ".teamOrbit li > span",
      ".archiveEvidenceList li > span",
      ".capacityHorizon b",
      ".districtTruth::after",
      ".clientFlowMoment::after",
      ".healthBank::after",
      ".kaiDesk::before",
    ].every((selector) => killListBlock.includes(selector)) &&
    (killListBlock.match(/animation:\s*none\s*!important/g) ?? []).length === 2,
);
check(
  "the facility sweep keyframe now travels instead of blinking in place",
  (() => {
    const heartbeatKeyframe = css.slice(
      css.indexOf("@keyframes agencyLivingHeartbeat"),
      css.indexOf("@keyframes agencyLivingBreath"),
    );
    return (
      heartbeatKeyframe.length > 0 &&
      /translate3d\(-8vw, 0, 0\)/.test(heartbeatKeyframe) &&
      /translate3d\(108vw, 0, 0\)/.test(heartbeatKeyframe) &&
      !/translate3d\(52vw/.test(heartbeatKeyframe) &&
      /animation:\s*agencyLivingHeartbeat var\(--cxos-dur-drift\) linear infinite !important/.test(
        css,
      )
    );
  })(),
);
check(
  "the per-chamber breath channel derives its amplitude from the light tokens and consumes a per-signature period",
  /--cxos-breath-lo:\s*calc\([^)]*--cxos-light-rest/.test(css) &&
    /--cxos-breath-hi:\s*calc\([^)]*--cxos-light-active/.test(css) &&
    /@keyframes agencyLivingBreath\s*\{[\s\S]{0,40}--cxos-breath-lo[\s\S]{0,80}--cxos-breath-hi/.test(
      css,
    ) &&
    (css.match(/--cxos-breath-period:\s*\d+ms/g) ?? []).length === 8 &&
    new Set(css.match(/--cxos-breath-period:\s*(\d+)ms/g)).size === 8,
);
check(
  "the blocked-lane pulse is scoped to client operations Tier A and targets only the fixed blocked fixture lane",
  /\[data-cxos-animation-budget="2"\]\[data-cxos-profile="client-operations"\]\s*\n\s*\.flowList\s*\n\s*> li\[data-motion="blocked"\]\s*\n\s*\.flowTrack\s*\n\s*b\s*\{\s*\n\s*animation:\s*agencyLivingBlockedPulse/.test(
    css,
  ),
);
check(
  "all six chamber recognitions restore their exact original keyframe, duration, and easing as budget-gated transients",
  [
    ["client-operations", ".clientFlowMoment::after", "agencyClientFloorSweep 960ms"],
    ["team-operations", ".teamOrbit li > span", "agencyTeamRecognition 860ms"],
    ["business-health", ".healthBank::after", "agencyObservatoryScan 1400ms"],
    ["evidence-archive", ".archiveEvidenceList li > span", "agencyEvidenceRecognition 900ms"],
    ["kai-suite", ".kaiDesk::before", "agencyKaiRecognition 1200ms"],
    ["growth-threshold", ".capacityHorizon b", "agencyCapacityScan 1100ms"],
  ].every(([districtId, selector, animation]) => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `data-cxos-animation-budget="1"\\], \\[data-cxos-animation-budget="2"\\]\\)\\s*\\n\\s*\\.district\\[data-current="true"\\]\\[data-agency-district="${districtId}"\\]\\s*\\n\\s*${escapedSelector}\\s*\\{\\s*\\n\\s*animation:\\s*${animation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    ).test(css);
  }),
);
check(
  "the Kai response reveal and both discovery beats have Living-mode opt-ins over the kill list",
  /\.kaiResponse\[data-prepared="true"\]\s*\{\s*\n\s*animation:\s*agencyArtifactReveal/.test(
    css,
  ) &&
    /\[data-cxos-attention="inspecting"\]:not\(\[data-cxos-environment-motion="static"\]\)\s*\n\s*\.inspectionBody\s*\{\s*\n\s*animation:\s*agencyInspectionAcquire/.test(
      css,
    ) &&
    /\[data-cxos-attention="inspecting"\]:not\(\[data-cxos-environment-motion="static"\]\)\s*\n\s*\.districtTruth::after\s*\{\s*\n\s*animation:\s*agencyDistrictTruthDraw/.test(
      css,
    ),
);
check(
  "the Kai response element mounts with a prepared marker computed from the existing resolution state",
  /const supported = turn\.resolution\.status === "supported";/.test(stage) &&
    /className=\{styles\.kaiResponse\}\s*\n\s*data-prepared=\{supported \? "true" : "false"\}/.test(
      stage,
    ),
);
const livingPolicySection = css.slice(
  css.indexOf(
    "CXOS Living Environment Engine RC1 — presentation-only motion policy",
  ),
);
check(
  "the five retired flow-lane loops are never re-opted into Living mode",
  livingPolicySection.length > 0 &&
    !/agencyFlowEntering|agencyFlowAdvancing|agencyFlowWaiting|agencyFlowBlocked|agencyFlowResolving/.test(
      livingPolicySection,
    ),
);
const CHANNEL_TOKEN = /^(?:continuous|transient|scroll):[a-z-]+$/;
const classifiedMotionChannelAttrs = [
  ...stage.matchAll(/data-cxos-motion-channel=(?:"[^"]*"|\{[^}]*\})/g),
]
  .map((match) => match[0])
  .filter((attr) => !/runtime\.motionChannels\[/.test(attr));
check(
  "every newly classified data-cxos-motion-channel attribute in stage.tsx carries a conforming class:name token",
  classifiedMotionChannelAttrs.length === 13 &&
    classifiedMotionChannelAttrs.every((attr) =>
      [...attr.matchAll(/"([^"]+)"/g)].some((match) =>
        match[1].split(" ").every((token) => CHANNEL_TOKEN.test(token)),
      ),
    ),
);

// -- RC2 WP3: deepened chamber signature identity ----------------------------
function extractRuleBody(source: string, selectorText: string): string {
  const start = source.indexOf(selectorText);
  if (start === -1) return "";
  const braceStart = source.indexOf("{", start);
  const braceEnd = source.indexOf("}", braceStart);
  if (braceStart === -1 || braceEnd === -1) return "";
  return source.slice(braceStart + 1, braceEnd);
}
function readCustomProp(block: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`${escaped}:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

const signatureBlocks = new Map(
  AGENCY_LIVING_ENVIRONMENT.chambers.map((chamber) => [
    chamber.id,
    extractRuleBody(css, `.room[data-cxos-signature="${chamber.motion}"] {`),
  ]),
);
const chamberEdgeBlocks = new Map(
  AGENCY_LIVING_ENVIRONMENT.chambers.map((chamber) => [
    chamber.id,
    extractRuleBody(
      css,
      `.room[data-cxos-profile="${chamber.id}"] [data-current="true"][data-agency-district="${chamber.id}"] {`,
    ),
  ]),
);
check(
  "every chamber's signature block and current-state block are locatable by their motion and profile tokens",
  [...signatureBlocks.values()].every((block) => block.length > 0) &&
    [...chamberEdgeBlocks.values()].every((block) => block.length > 0),
);

const entryTuples = districtIds.map((id) =>
  [
    readCustomProp(signatureBlocks.get(id) ?? "", "--cxos-entry-x") ?? "0",
    readCustomProp(signatureBlocks.get(id) ?? "", "--cxos-entry-y") ?? "0",
    readCustomProp(signatureBlocks.get(id) ?? "", "--cxos-entry-scale") ?? "1",
    readCustomProp(signatureBlocks.get(id) ?? "", "--cxos-entry-scale-x") ?? "1",
  ].join("|"),
);
check(
  "no two of the seven chamber signatures declare an identical entry-x/entry-y/entry-scale/entry-scale-x tuple",
  new Set(entryTuples).size === districtIds.length,
);

const SCROLL_CHAMBERS: AgencyDistrictId[] = [
  "client-operations",
  "evidence-archive",
  "growth-threshold",
  "business-health",
];
const STILL_CHAMBERS: AgencyDistrictId[] = [
  "central-command",
  "team-operations",
  "kai-suite",
];
check(
  "the four travel chambers each declare a complete scroll-x/scroll-y pair and the three still chambers declare neither",
  SCROLL_CHAMBERS.length + STILL_CHAMBERS.length === districtIds.length &&
    SCROLL_CHAMBERS.every((id) => {
      const block = signatureBlocks.get(id) ?? "";
      return (
        readCustomProp(block, "--cxos-scroll-x") !== null &&
        readCustomProp(block, "--cxos-scroll-y") !== null
      );
    }) &&
    STILL_CHAMBERS.every((id) => {
      const block = signatureBlocks.get(id) ?? "";
      return (
        readCustomProp(block, "--cxos-scroll-x") === null &&
        readCustomProp(block, "--cxos-scroll-y") === null
      );
    }),
);

check(
  "all seven chambers declare an explicit --agency-chamber-edge",
  districtIds.every(
    (id) =>
      readCustomProp(chamberEdgeBlocks.get(id) ?? "", "--agency-chamber-edge") !==
      null,
  ),
);

const tierBBaseBlock = extractRuleBody(
  css,
  '.room:is([data-tier="B"], [data-cxos-tier="B"]) {',
);
check(
  "Tier B no longer applies a blanket entry-vector reset shared by every profile",
  tierBBaseBlock.length > 0 &&
    readCustomProp(tierBBaseBlock, "--cxos-entry-x") === null &&
    readCustomProp(tierBBaseBlock, "--cxos-entry-y") === null &&
    readCustomProp(tierBBaseBlock, "--cxos-entry-scale") === null,
);
check(
  "Tier B instead declares a non-identity entry value scoped to each of the seven profiles",
  districtIds.every((id) => {
    const block = extractRuleBody(
      css,
      `.room:is([data-tier="B"], [data-cxos-tier="B"])[data-cxos-profile="${id}"] {`,
    );
    if (block.length === 0) return false;
    const x = readCustomProp(block, "--cxos-entry-x") ?? "0";
    const y = readCustomProp(block, "--cxos-entry-y") ?? "0";
    const scale = readCustomProp(block, "--cxos-entry-scale") ?? "1";
    const scaleX = readCustomProp(block, "--cxos-entry-scale-x") ?? "1";
    return x !== "0" || y !== "0" || scale !== "1" || scaleX !== "1";
  }),
);

check(
  "agencyLivingAcquire and agencyLivingAcquireB both consume --cxos-entry-scale-x with a default of 1",
  (() => {
    const acquireBlock = css.slice(
      css.indexOf("@keyframes agencyLivingAcquire {"),
      css.indexOf("@keyframes agencyLivingAcquireB {"),
    );
    const acquireBBlock = css.slice(
      css.indexOf("@keyframes agencyLivingAcquireB {"),
      css.indexOf("@keyframes agencyLivingHeartbeat {"),
    );
    const scaleXPattern = /scaleX\(var\(--cxos-entry-scale-x,\s*1\)\)/;
    return (
      acquireBlock.length > 0 &&
      acquireBBlock.length > 0 &&
      scaleXPattern.test(acquireBlock) &&
      scaleXPattern.test(acquireBBlock)
    );
  })(),
);

// -- RC2 WP4: phase-locked attention, idle, and Kai presence ------------------
check(
  "the idle-timing effect resolves the active chamber's idleAfterMs, falling back to the room default",
  /const activeChamber = livingEnvironment\.chambers\.find\(/.test(adapter) &&
    /const chamberIdleAfterMs =\s*activeChamber\?\.idleAfterMs \?\? livingEnvironment\.idleAfterMs/.test(
      adapter,
    ) &&
    /resolution\.tier === "A" \? chamberIdleAfterMs\.A : chamberIdleAfterMs\.B/.test(
      adapter,
    ),
);

const expectedChamberIdleAfterMs: ReadonlyArray<
  [AgencyDistrictId, number, number]
> = [
  ["kai-suite", 5000, 4000],
  ["evidence-archive", 5000, 4000],
  ["team-operations", 6000, 4500],
  ["business-health", 6000, 4500],
  ["central-command", 7000, 5000],
  ["client-operations", 8000, 6000],
  ["growth-threshold", 8000, 6000],
];
check(
  "every chamber declares a per-chamber idleAfterMs identity and the room keeps a top-level default",
  AGENCY_LIVING_ENVIRONMENT.idleAfterMs.A === 6000 &&
    AGENCY_LIVING_ENVIRONMENT.idleAfterMs.B === 4500 &&
    expectedChamberIdleAfterMs.length === districtIds.length &&
    expectedChamberIdleAfterMs.every(([id, a, b]) => {
      const chamber = AGENCY_LIVING_ENVIRONMENT.chambers.find(
        (candidate) => candidate.id === id,
      );
      return chamber?.idleAfterMs?.A === a && chamber?.idleAfterMs?.B === b;
    }),
);

const settledOverheadLightBlock = extractRuleBody(
  css,
  '.room[data-cxos-environment]:is([data-cxos-idle="settling"], [data-cxos-idle="settled"]) .overheadLight {',
);
const settlingDistrictEnvironmentBlock = extractRuleBody(
  css,
  '.room[data-cxos-environment][data-cxos-idle="settling"] .districtEnvironment {',
);
const settledDistrictEnvironmentBlock = extractRuleBody(
  css,
  '.room[data-cxos-environment][data-cxos-idle="settled"] .districtEnvironment {',
);
const settleOpacityValues = districtIds.map((id) =>
  readCustomProp(signatureBlocks.get(id) ?? "", "--cxos-settle-opacity"),
);
check(
  "settle preserves every chamber's overhead-light pose (opacity only, transform untouched) instead of flattening it",
  !/:is\(\.districtEnvironment,\s*\.overheadLight,\s*\.horizon\)/.test(css) &&
    settledOverheadLightBlock.length > 0 &&
    !/transform/.test(settledOverheadLightBlock) &&
    /opacity:\s*0\.46\s*!important/.test(settledOverheadLightBlock),
);
check(
  "settling eases to a distinct intermediate opacity before settled lands on a per-signature value, reusing the existing transition",
  settlingDistrictEnvironmentBlock.length > 0 &&
    /opacity:\s*0\.72\s*!important/.test(settlingDistrictEnvironmentBlock) &&
    settledDistrictEnvironmentBlock.length > 0 &&
    /opacity:\s*var\(--cxos-settle-opacity,\s*0\.46\)\s*!important/.test(
      settledDistrictEnvironmentBlock,
    ) &&
    !/@keyframes\s+agencySettle/.test(css) &&
    settleOpacityValues.every((value) => value !== null) &&
    new Set(settleOpacityValues).size === districtIds.length,
);

const readingDimBlock = extractRuleBody(
  css,
  '.room[data-cxos-environment]:is([data-cxos-attention="reading"], [data-cxos-attention="inspecting"]) .districtEnvironment {',
);
check(
  "the reading/inspecting dim is quiet, not dead (0.42, was 0.3)",
  readingDimBlock.length > 0 &&
    /opacity:\s*0\.42\s*!important/.test(readingDimBlock) &&
    !/opacity:\s*0\.3\s*!important/.test(readingDimBlock),
);

const kaiStagedNonSuiteBlock = extractRuleBody(
  css,
  '.room:not([data-cxos-profile="kai-suite"]):is([data-cxos-kai="staged"], [data-cxos-kai="preparing"], [data-cxos-kai="resolved"]) .overheadLight {',
);
const kaiSuiteNarrowBlock = extractRuleBody(
  css,
  '.room[data-cxos-profile="kai-suite"]:is([data-cxos-kai="staged"], [data-cxos-kai="preparing"]) .overheadLight {',
);
check(
  "Kai activity dims every other chamber's overhead light without a transform, while Kai Suite's own rule narrows its pose and excludes resolved",
  kaiStagedNonSuiteBlock.length > 0 &&
    !/transform:/.test(kaiStagedNonSuiteBlock) &&
    /opacity:\s*0\.72/.test(kaiStagedNonSuiteBlock) &&
    kaiSuiteNarrowBlock.length > 0 &&
    /transform:\s*translate3d\(0, 0, 0\) scaleX\(0\.58\)/.test(
      kaiSuiteNarrowBlock,
    ),
);
check(
  "preparing is a visible escalation over staged on .kaiContext using only the already-transitioned border-color/background pair",
  /\.room\[data-cxos-kai="staged"\] \.kaiContext \{/.test(css) &&
    /\.room\[data-cxos-kai="preparing"\] \.kaiContext \{/.test(css) &&
    (() => {
      const staged = extractRuleBody(css, '.room[data-cxos-kai="staged"] .kaiContext {');
      const preparing = extractRuleBody(
        css,
        '.room[data-cxos-kai="preparing"] .kaiContext {',
      );
      const stagedBorder = Number(readCustomProp(staged, "border-color")?.match(/[\d.]+(?=\))/)?.[0]);
      const preparingBorder = Number(
        readCustomProp(preparing, "border-color")?.match(/[\d.]+(?=\))/)?.[0],
      );
      return (
        staged.length > 0 &&
        preparing.length > 0 &&
        Number.isFinite(stagedBorder) &&
        Number.isFinite(preparingBorder) &&
        preparingBorder > stagedBorder
      );
    })(),
);
check(
  "data-cxos-kai-presence (Kai's channel lifecycle) gains a real CSS consumer distinct from data-cxos-kai's per-turn state",
  /data-cxos-kai-presence="suspended"/.test(css) &&
    /\.room\[data-cxos-kai-presence="suspended"\] \.kaiContext \{/.test(css),
);

check(
  "the Kai context spine labels carried context when the held source chamber differs from the active chamber",
  /const carriedContext = contextDistrict\.id !== activeDistrict\.id/.test(
    stage,
  ) &&
    /\{carriedContext \? \(/.test(stage) &&
    /CARRIED CONTEXT · \{contextDistrict\.name\.toUpperCase\(\)\}/.test(
      stage,
    ) &&
    /KAI · CONTINUOUS EXECUTIVE CHANNEL/.test(stage),
);

console.log(`\ncxos-living-environment.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
