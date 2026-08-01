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
  "activity is root-scoped and never captures native scroll, wheel, or touch",
  /root\.addEventListener\("pointerdown"/.test(adapter) &&
    /root\.addEventListener\("click"/.test(adapter) &&
    /root\.addEventListener\("keydown"/.test(adapter) &&
    /root\.addEventListener\("focusin"/.test(adapter) &&
    /root\.addEventListener\("toggle"/.test(adapter) &&
    !/addEventListener\(\s*["'](?:scroll|wheel|touchmove)["']/.test(adapter),
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
  "visible interactive focus quiets every room surface, not only district bodies",
  /const interactiveFocus =/.test(adapter) &&
    /focused !== root/.test(adapter) &&
    /focused\.closest\("\[data-cxos-focus-zone\]"\) \|\| interactiveFocus/.test(
      adapter,
    ),
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
  "both opt-in Living Environment channels have declared ownership markers",
  /data-cxos-motion-channel=\{runtime\.motionChannels\[1\]\}/.test(stage) &&
    /data-plane="depth"[\s\S]{0,120}data-cxos-motion-channel=\{AGENCY_MOTION_CHANNELS\[0\]\}/.test(
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
  "no script implements scroll-driven measurement or input hijacking",
  !/addEventListener\(\s*["'](?:scroll|wheel|touchmove)["']/.test(
    `${adapter}\n${stage}`,
  ) && !/scrollY\s*[*/+-]|getBoundingClientRect\(\).*transform/.test(stage),
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

console.log(`\ncxos-living-environment.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
