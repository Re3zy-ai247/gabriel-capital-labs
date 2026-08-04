// Run: npx --no-install tsx scripts/cxos-core-runtime.test.ts
//
// DB-free executable + source guard for CXOS Core Runtime 1.1. The runtime is
// presentation infrastructure only: deterministic state in, data attributes
// and lifecycle callbacks out. It may never acquire canonical facts or effect
// authority.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES,
  CXOS_CORE_RUNTIME_CAPABILITIES,
  CXOS_CORE_RUNTIME_VERSION,
  DEFAULT_CXOS_DISTRICT_TRANSITION_MS,
  deriveCxosRuntimeEnvironment,
  resolveCxosDistrictTransitionDirection,
  resolveCxosDistrictTransitionDuration,
  resolveCxosRuntimeProjection,
  selectCxosActiveDistrict,
  validateCxosRoomRuntime,
  type CxosRoomRuntimeDefinition,
} from "../lib/cxos/runtime";

const root = join(__dirname, "..");
const policy = readFileSync(join(root, "lib/cxos/runtime.ts"), "utf8");
const adapter = readFileSync(
  join(root, "components/cxos/runtime/useCxosRoomRuntime.ts"),
  "utf8",
);
const source = `${policy}\n${adapter}`;

function codeOf(value: string) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const policyCode = codeOf(policy);
const adapterCode = codeOf(adapter);

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

const definition = {
  roomId: "reference-room",
  districts: ["central", "operations", "kai-suite"],
  initialDistrict: "central",
  arrivalBeats: ["identity", "systems", "settlement"],
  arrivalDurationMs: { A: 1500, B: 700 },
  motionChannels: ["room-breath", "work-flow", "kai-presence"],
  kaiContextHoldDistricts: ["kai-suite"],
  departure: { href: "/review/origin", fallbackMs: 800 },
} satisfies CxosRoomRuntimeDefinition<"central" | "operations" | "kai-suite">;

check("runtime version is explicit", CXOS_CORE_RUNTIME_VERSION === "1.1.0");
check(
  "runtime exposes the exact twenty Founder-authorized capabilities",
  JSON.stringify(CXOS_CORE_RUNTIME_CAPABILITIES) ===
    JSON.stringify([
      "arrival",
      "departure",
      "environmental-heartbeat",
      "spatial-transition",
      "district",
      "scroll-activation",
      "environmental-lighting",
      "atmospheric",
      "kai-presence",
      "shared-motion",
      "shared-accessibility",
      "cinematic-framing",
      "depth-projection",
      "focus-attention",
      "idle-settlement",
      "computation-presence",
      "progressive-disclosure",
      "chamber-motion-signature",
      "capability-projection",
      "deterministic-replay",
    ]),
);
check("a bounded reference definition validates", validateCxosRoomRuntime(definition).valid);

const chamberDefinition = {
  ...definition,
  districtMode: "chamber",
  districtTransitionMs: { A: 620, B: 460 },
} satisfies CxosRoomRuntimeDefinition<"central" | "operations" | "kai-suite">;

check(
  "a bounded chamber definition validates",
  validateCxosRoomRuntime(chamberDefinition).valid,
);

const invalidDefinitions: Array<[string, CxosRoomRuntimeDefinition<string>]> = [
  ["room id", { ...definition, roomId: "Bad room" }],
  [
    "district mode",
    {
      ...definition,
      districtMode: "carousel" as "flow",
    },
  ],
  ["empty districts", { ...definition, districts: [] }],
  ["duplicate districts", { ...definition, districts: ["central", "central"] }],
  ["unknown initial district", { ...definition, initialDistrict: "unknown" }],
  [
    "short chamber transition",
    {
      ...chamberDefinition,
      districtTransitionMs: { A: 449, B: 449 },
    },
  ],
  [
    "inverted chamber transition",
    {
      ...chamberDefinition,
      districtTransitionMs: { A: 600, B: 601 },
    },
  ],
  [
    "long chamber transition",
    {
      ...chamberDefinition,
      districtTransitionMs: { A: 901, B: 460 },
    },
  ],
  ["unknown Kai hold district", { ...definition, kaiContextHoldDistricts: ["unknown"] }],
  ["empty arrival", { ...definition, arrivalBeats: [] }],
  ["duplicate arrival", { ...definition, arrivalBeats: ["identity", "identity"] }],
  ["short arrival", { ...definition, arrivalDurationMs: { A: 99, B: 99 } }],
  ["inverted arrival", { ...definition, arrivalDurationMs: { A: 700, B: 701 } }],
  [
    "motion budget",
    { ...definition, motionChannels: ["one", "two", "three", "four"] },
  ],
  ["external departure", { ...definition, departure: { href: "https://example.com", fallbackMs: 800 } }],
  ["protocol-relative departure", { ...definition, departure: { href: "//example.com", fallbackMs: 800 } }],
  ["short fallback", { ...definition, departure: { href: "/review/origin", fallbackMs: 99 } }],
  ["long fallback", { ...definition, departure: { href: "/review/origin", fallbackMs: 1801 } }],
];
for (const [label, candidate] of invalidDefinitions) {
  const result = validateCxosRoomRuntime(candidate);
  check(`${label} fails closed without throwing`, !result.valid && result.reasons.length > 0);
}

check(
  "flow mode ignores chamber-only transition timing",
  validateCxosRoomRuntime({
    ...definition,
    districtTransitionMs: { A: 1, B: 9999 },
  }).valid,
);

const desktop = {
  ...CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES,
  intersectionObserver: true,
  detectionFailed: false,
};
const mobile = { ...desktop, mobile: true };
const coarse = { ...desktop, coarsePointer: true };
const reduced = { ...desktop, browserReduced: true };
const saveData = { ...desktop, saveData: true };
const lowMemory = { ...desktop, lowMemory: true };
const missingDistrictObservation = { ...desktop, intersectionObserver: false };

check(
  "desktop Auto resolves Tier A",
  resolveCxosRuntimeProjection("auto", desktop, false).tier === "A",
);
check(
  "mobile and coarse pointer resolve Tier B",
  resolveCxosRuntimeProjection("auto", mobile, false).tier === "B" &&
    resolveCxosRuntimeProjection("auto", coarse, false).tier === "B",
);
check(
  "Data Saver, low memory, missing district observation, and detection failure resolve Tier C",
  resolveCxosRuntimeProjection("auto", saveData, false).tier === "C" &&
    resolveCxosRuntimeProjection("auto", lowMemory, false).tier === "C" &&
    resolveCxosRuntimeProjection("auto", missingDistrictObservation, false)
      .tier === "C" &&
    resolveCxosRuntimeProjection(
      "auto",
      CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES,
      false,
    ).tier === "C",
);
check(
  "chamber mode does not require IntersectionObserver",
  resolveCxosRuntimeProjection(
    "auto",
    missingDistrictObservation,
    false,
    true,
    "chamber",
  ).tier === "A",
);
check(
  "reduced motion and explicit Static resolve Tier D",
  resolveCxosRuntimeProjection("auto", reduced, false).tier === "D" &&
    resolveCxosRuntimeProjection("static", desktop, false).tier === "D",
);
check(
  "review-only consent can project cinema without changing browser preference",
  resolveCxosRuntimeProjection("cinematic", reduced, true).tier === "A" &&
    reduced.browserReduced,
);
check(
  "an invalid contract is always complete static Tier D",
  resolveCxosRuntimeProjection("cinematic", desktop, true, false).tier === "D" &&
    !resolveCxosRuntimeProjection("cinematic", desktop, true, false)
      .cinematicAvailable,
);

check(
  "chamber timing is bounded by tier with complete static fallback",
  DEFAULT_CXOS_DISTRICT_TRANSITION_MS.A === 620 &&
    DEFAULT_CXOS_DISTRICT_TRANSITION_MS.B === 460 &&
    resolveCxosDistrictTransitionDuration(chamberDefinition, "A") === 620 &&
    resolveCxosDistrictTransitionDuration(chamberDefinition, "B") === 460 &&
    resolveCxosDistrictTransitionDuration(chamberDefinition, "C") === 0 &&
    resolveCxosDistrictTransitionDuration(chamberDefinition, "D") === 0 &&
    resolveCxosDistrictTransitionDuration(chamberDefinition, "A", false) === 0 &&
    resolveCxosDistrictTransitionDuration(definition, "A") === 0,
);
check(
  "district direction is canonical, deterministic, and safe for unknown input",
  resolveCxosDistrictTransitionDirection(
    definition.districts,
    "central",
    "operations",
  ) === "forward" &&
    resolveCxosDistrictTransitionDirection(
      definition.districts,
      "kai-suite",
      "operations",
    ) === "backward" &&
    resolveCxosDistrictTransitionDirection(
      definition.districts,
      "central",
      "central",
    ) === "same" &&
    resolveCxosDistrictTransitionDirection(
      definition.districts,
      "central",
      "unknown" as "central",
    ) === "same",
);

const arriving = deriveCxosRuntimeEnvironment({
  contractValid: true,
  tier: "A",
  arrivalSettled: false,
  departing: false,
  documentHidden: false,
});
const operating = deriveCxosRuntimeEnvironment({
  contractValid: true,
  tier: "A",
  arrivalSettled: true,
  departing: false,
  documentHidden: false,
});
const hidden = deriveCxosRuntimeEnvironment({
  contractValid: true,
  tier: "A",
  arrivalSettled: true,
  departing: false,
  documentHidden: true,
});
const departing = deriveCxosRuntimeEnvironment({
  contractValid: true,
  tier: "A",
  arrivalSettled: true,
  departing: true,
  documentHidden: false,
});
const staticEnvironment = deriveCxosRuntimeEnvironment({
  contractValid: true,
  tier: "D",
  arrivalSettled: false,
  departing: false,
  documentHidden: false,
});
const invalidEnvironment = deriveCxosRuntimeEnvironment({
  contractValid: false,
  tier: "A",
  arrivalSettled: false,
  departing: false,
  documentHidden: false,
});

check(
  "arrival pauses heartbeat and acquires Kai without hiding the document",
  arriving.phase === "arriving" &&
    arriving.heartbeat === "paused" &&
    arriving.lighting === "arrival" &&
    arriving.kaiPresence === "acquiring" &&
    !arriving.scrollActivation,
);
check(
  "settled operation activates bounded environment and Kai presence",
  operating.phase === "operating" &&
    operating.motion === "active" &&
    operating.heartbeat === "active" &&
    operating.lighting === "operating" &&
    operating.atmosphere === "active" &&
    operating.kaiPresence === "available" &&
    operating.scrollActivation,
);
check(
  "document-hidden pauses every nonessential channel",
  hidden.motion === "paused" &&
    hidden.heartbeat === "paused" &&
    hidden.atmosphere === "paused" &&
    hidden.kaiPresence === "paused" &&
    !hidden.scrollActivation,
);
check(
  "departure suspends heartbeat, atmosphere, scroll activation, and Kai",
  departing.phase === "departing" &&
    departing.heartbeat === "paused" &&
    departing.lighting === "departure" &&
    departing.atmosphere === "paused" &&
    departing.kaiPresence === "suspended" &&
    !departing.scrollActivation,
);
check(
  "Tier D has complete static environmental equivalence",
  staticEnvironment.phase === "operating" &&
    staticEnvironment.motion === "static" &&
    staticEnvironment.heartbeat === "static" &&
    staticEnvironment.lighting === "static" &&
    staticEnvironment.atmosphere === "static" &&
    staticEnvironment.kaiPresence === "static" &&
    !staticEnvironment.scrollActivation,
);
check(
  "invalid runtime has no motion or false Kai availability",
  invalidEnvironment.contract === "fail-closed" &&
    invalidEnvironment.motion === "static" &&
    invalidEnvironment.heartbeat === "static" &&
    invalidEnvironment.kaiPresence === "unavailable" &&
    !invalidEnvironment.scrollActivation,
);

const ratios = new Map<"central" | "operations" | "kai-suite", number>([
  ["central", 0.2],
  ["operations", 0.6],
  ["kai-suite", 0.4],
]);
check(
  "district selection chooses the greatest visible canonical ratio",
  selectCxosActiveDistrict(definition.districts, ratios, "central") ===
    "operations",
);
check(
  "district ties preserve canonical order",
  selectCxosActiveDistrict(
    definition.districts,
    new Map([
      ["central", 0.5],
      ["operations", 0.5],
      ["kai-suite", 0],
    ]),
    "kai-suite",
  ) === "central",
);
check(
  "empty visibility preserves the current district",
  selectCxosActiveDistrict(definition.districts, new Map(), "operations") ===
    "operations",
);

check(
  "pure policy has no React, DOM, browser, or room-specific dependency",
  !/from ["']react["']|\bwindow\.|\bdocument\.|\bnavigator\.|IntersectionObserver/.test(
    policyCode,
  ) &&
    !/Agency Command|Mission Control|Arena|Passage|Marketplace|Community|Growth Network/.test(
      policy,
    ),
);
check(
  "headless adapter imports only React and the pure runtime policy",
  /from "react"/.test(adapter) &&
    /from "@\/lib\/cxos\/runtime"/.test(adapter) &&
    (adapter.match(/^import\b/gm) ?? []).length === 2,
);
check(
  "adapter renders no room, district, atmosphere, or Kai UI",
  !/<main\b|<section\b|<div\b|className=|style=/.test(adapterCode) &&
    !/Agency Command|Mission Control|Arena|Passage|Marketplace|Community|Growth Network/.test(
      adapter,
    ),
);
check(
  "flow mode owns one passive observer while chamber mode installs none",
  (adapter.match(/new IntersectionObserver\(/g) ?? []).length === 1 &&
    /districtMode === "chamber" \|\| !environment\.scrollActivation/.test(
      adapter,
    ) &&
    /root\.querySelectorAll<HTMLElement>\("\[data-cxos-district\]"\)/.test(adapter) &&
    /entry\.intersectionRatio/.test(adapter) &&
    /observer\.observe\(section\)/.test(adapter) &&
    /observer\.disconnect\(\)/.test(adapter),
);
check(
  "native scroll is never animated continuously; scroll/wheel only passively re-arm the idle timer, and touch is never captured",
  !/addEventListener\(\s*["']touchmove["']/.test(adapter) &&
    !/\bonScroll\s*=|\bonWheel\s*=|setInterval|requestIdleCallback/.test(adapter) &&
    /root\.addEventListener\("scroll", registerScrollActivity, \{ passive: true \}\)/.test(
      adapter,
    ) &&
    /root\.addEventListener\("wheel", registerScrollActivity, \{ passive: true \}\)/.test(
      adapter,
    ) &&
    /window\.addEventListener\("scroll", registerScrollActivity, \{ passive: true \}\)/.test(
      adapter,
    ) &&
    (adapter.match(/requestAnimationFrame\(/g) ?? []).length <= 5,
);
check(
  "chamber transitions are explicit, latest-intent-wins, and keep source active until settlement",
  /phase: "settled" \| "passage"/.test(adapter) &&
    /sourceDistrict: DistrictId/.test(adapter) &&
    /targetDistrict: DistrictId \| null/.test(adapter) &&
    /sequence: number/.test(adapter) &&
    /clearDistrictTransitionFallback\(\);[\s\S]{0,220}const sourceDistrict = activeDistrictRef\.current/.test(
      adapterCode,
    ) &&
    /const passage:[\s\S]{0,180}phase: "passage"[\s\S]{0,240}startTransition\(\(\) => \{[\s\S]{0,100}setChamberTransition\(passage\)/.test(
      adapterCode,
    ) &&
    /startTransition\(\(\) => \{[\s\S]{0,100}setActiveDistrict\(destination\);[\s\S]{0,100}setChamberTransition\(settled\)/.test(
      adapterCode,
    ),
);
check(
  "same-district and static navigation settle without passage",
  /if \(districtId === sourceDistrict\)[\s\S]{0,760}phase: "settled"[\s\S]{0,760}focusDistrict\(sourceDistrict\)/.test(
    adapterCode,
  ) &&
    /options\?\.immediate === true[\s\S]{0,260}resolution\.tier === "C"[\s\S]{0,120}resolution\.tier === "D"[\s\S]{0,200}document\.hidden/.test(
      adapterCode,
    ) &&
    /if \(immediate\)[\s\S]{0,760}phase: "settled"[\s\S]{0,760}queueDistrictCommitFocus\(districtId, sequence\)/.test(
      adapterCode,
    ),
);
check(
  "changed chambers defer geometry and destination focus until after a settled frame",
  /useLayoutEffect/.test(adapter) &&
    /const districtCommitFocusRef = useRef<\{[\s\S]{0,120}districtId: DistrictId;[\s\S]{0,80}sequence: number;[\s\S]{0,80}\} \| null>\(null\)/.test(
      adapterCode,
    ) &&
    /queueDistrictCommitFocus\(destination, pending\.sequence\);[\s\S]{0,260}startTransition\(\(\) => \{[\s\S]{0,100}setActiveDistrict\(destination\);[\s\S]{0,100}setChamberTransition\(settled\)/.test(
      adapterCode,
    ) &&
    /queueDistrictCommitFocus\(districtId, sequence\);[\s\S]{0,260}setActiveDistrict\(districtId\);[\s\S]{0,100}setChamberTransition\(settled\)/.test(
      adapterCode,
    ) &&
    /useLayoutEffect\(\(\) => \{[\s\S]{0,260}pending\.districtId !== activeDistrict[\s\S]{0,120}pending\.sequence !== chamberTransition\.sequence[\s\S]{0,220}districtCommitFocusRef\.current = null;[\s\S]{0,180}document\.hidden[\s\S]{0,160}visibilityFocusPendingRef\.current = true[\s\S]{0,180}focusDistrict\(pending\.districtId\)/.test(
      adapterCode,
    ) &&
    /const scheduleDistrictScroll = useCallback\([\s\S]{0,260}const focusOrigin = document\.activeElement[\s\S]{0,220}requestAnimationFrame\(\(\) => \{[\s\S]{0,220}requestAnimationFrame\(\(\) => \{[\s\S]{0,360}activeDistrictRef\.current !== districtId[\s\S]{0,300}activeElement !== focusOrigin[\s\S]{0,260}if \(operatorMovedFocus\) return[\s\S]{0,220}district\?\.isConnected[\s\S]{0,180}findCxosElementById\(root, `\$\{districtId\}-heading`\)[\s\S]{0,100}scrollCxosElementImmediately\(district\);[\s\S]{0,100}heading\?\.focus\(\{ preventScroll: true \}\)/.test(
      adapterCode,
    ) &&
    /const focusDistrict = useCallback\([\s\S]{0,120}scheduleDistrictScroll\(districtId\)/.test(
      adapterCode,
    ) &&
    /const cancelDistrictFocus = useCallback\(\(\) => \{[\s\S]{0,100}districtCommitFocusRef\.current = null/.test(
      adapterCode,
    ) &&
    /const cancelDistrictFocus = useCallback\(\(\) => \{[\s\S]{0,140}cancelDistrictScroll\(\)/.test(
      adapterCode,
    ) &&
    /const reset = \(\) => \{[\s\S]{0,480}cancelDistrictFocus\(\)/.test(
      adapterCode,
    ) &&
    /const beginDeparture = useCallback[\s\S]{0,520}cancelDistrictFocus\(\)/.test(
      adapterCode,
    ) &&
    /useEffect\([\s\S]{0,120}\(\) => \(\) => \{[\s\S]{0,320}cancelDistrictFocus\(\)/.test(
      adapterCode,
    ),
);
check(
  "animated passage fallback begins only after the matching passage commit",
  /useLayoutEffect\(\(\) => \{[\s\S]{0,200}chamberTransition\.phase !== "passage"[\s\S]{0,160}!chamberTransition\.targetDistrict[\s\S]{0,220}const expectedSequence = chamberTransition\.sequence[\s\S]{0,160}window\.setTimeout\(\(\) => \{[\s\S]{0,180}chamberTransitionRef\.current\.sequence !== expectedSequence[\s\S]{0,120}settlePendingDistrictTransition\(true\)[\s\S]{0,120}districtTransitionDurationMs/.test(
    adapterCode,
  ) &&
    !/setChamberTransition\(passage\);[\s\S]{0,180}districtTransitionFallbackRef\.current = window\.setTimeout/.test(
      adapterCode,
    ),
);
check(
  "arrival completion focuses only after the matching visible facility commits",
  /const arrivalCommitFocusRef = useRef<\{[\s\S]{0,100}key: number;[\s\S]{0,180}kind: "district"; districtId: DistrictId[\s\S]{0,100}announcement: string;[\s\S]{0,80}\} \| null>\(null\)/.test(
    adapterCode,
  ) &&
    /arrivalCommitFocusRef\.current = \{ key: arrivalKey, \.\.\.options \}/.test(
      adapterCode,
    ) &&
    /useLayoutEffect\(\(\) => \{[\s\S]{0,180}!arrivalSettled[\s\S]{0,120}pending\.key !== arrivalKey[\s\S]{0,160}arrivalCommitFocusRef\.current = null[\s\S]{0,180}document\.hidden[\s\S]{0,700}pending\.focus\.kind === "room"[\s\S]{0,180}focusDistrict\(pending\.focus\.districtId\)[\s\S]{0,180}announceRef\.current\(pending\.announcement\)/.test(
      adapterCode,
    ) &&
    /const operatorMovedFocus =[\s\S]{0,260}activeElement === roomRootRef\.current[\s\S]{0,120}!roomRootRef\.current\?\.contains\(activeElement\)[\s\S]{0,140}if \(!operatorMovedFocus\)/.test(
      adapterCode,
    ) &&
    /queueArrivalCommitFocus\(\{[\s\S]{0,160}announcement: messages\.staticArrival[\s\S]{0,100}\}\);[\s\S]{0,80}setArrivalSettled\(true\)/.test(
      adapterCode,
    ) &&
    /queueArrivalCommitFocus\(\{[\s\S]{0,160}announcement: messages\.escapeArrival[\s\S]{0,100}\}\);[\s\S]{0,80}setArrivalSettled\(true\)/.test(
      adapterCode,
    ) &&
    /queueArrivalCommitFocus\(options\);[\s\S]{0,80}setArrivalSettled\(true\)/.test(
      adapterCode,
    ) &&
    /const replayArrival = useCallback[\s\S]{0,160}arrivalCommitFocusRef\.current = null/.test(
      adapterCode,
    ) &&
    /const reset = \(\) => \{[\s\S]{0,520}arrivalCommitFocusRef\.current = null/.test(
      adapterCode,
    ) &&
    /useEffect\([\s\S]{0,160}\(\) => \(\) => \{[\s\S]{0,320}arrivalCommitFocusRef\.current = null/.test(
      adapterCode,
    ) &&
    !/setArrivalSettled\(true\);[\s\S]{0,120}requestAnimationFrame/.test(
      adapterCode,
    ),
);
check(
  "hidden-tab chamber settlement restores destination focus when visibility returns",
  /const visibilityFocusPendingRef = useRef\(false\)/.test(adapterCode) &&
    /if \(documentHidden \|\| document\.hidden\)[\s\S]{0,180}visibilityFocusPendingRef\.current = true/.test(
      adapterCode,
    ) &&
    /if \(documentHidden\)[\s\S]{0,180}visibilityFocusPendingRef\.current = true[\s\S]{0,180}settlePendingDistrictTransition\(false\)/.test(
      adapterCode,
    ) &&
    /if \(!documentHidden && visibilityFocusPendingRef\.current\)[\s\S]{0,240}scheduleDistrictFocus\(activeDistrictRef\.current\)/.test(
      adapterCode,
    ) &&
    /const reset = \(\) => \{[\s\S]{0,520}visibilityFocusPendingRef\.current = false/.test(
      adapterCode,
    ),
);
check(
  "one bounded passage fallback and symmetric focus cleanup exist",
  (adapter.match(/districtTransitionFallbackRef\.current = window\.setTimeout\(/g) ?? [])
    .length === 1 &&
    /const expectedSequence = chamberTransition\.sequence[\s\S]{0,180}districtTransitionFallbackRef\.current = window\.setTimeout[\s\S]{0,260}districtTransitionDurationMs/.test(
      adapterCode,
    ) &&
    /chamberTransitionRef\.current\.sequence !== expectedSequence/.test(
      adapterCode,
    ) &&
    /window\.clearTimeout\(districtTransitionFallbackRef\.current\)/.test(
      adapter,
    ) &&
    /window\.cancelAnimationFrame\(districtFocusFrameRef\.current\)/.test(
      adapter,
    ) &&
    /clearDistrictTransitionFallback\(\);[\s\S]{0,80}cancelDistrictFocus\(\)/.test(
      adapterCode,
    ),
);
check(
  "stale passage completions cannot settle the latest operator intent",
  /expectedSequence !== undefined[\s\S]{0,120}expectedSequence !== pending\.sequence/.test(
    adapterCode,
  ) &&
    /dataset\.cxosTransitionSequence/.test(adapterCode) &&
    /renderedSequence !== String\(pending\.sequence\)/.test(adapterCode),
);
check(
  "passage pauses ambient channels without changing runtime authority",
  /chamberTransition\.phase !== "passage"/.test(adapter) &&
    /motion:[\s\S]{0,100}"paused"/.test(adapterCode) &&
    /heartbeat:[\s\S]{0,120}"paused"/.test(adapterCode) &&
    /atmosphere:[\s\S]{0,120}"paused"/.test(adapterCode) &&
    /scrollActivation: false/.test(adapterCode),
);
check(
  "runtime leaves route history and hashes to the room consumer",
  !/history\.(?:pushState|replaceState)|location\.hash|hashchange|popstate/.test(
    adapterCode,
  ),
);
check(
  "scroll helpers preserve CSS offset and restore inherited behavior",
  /scrollMarginTop/.test(adapter) &&
    /cxosInstantScrollOwners/.test(adapter) &&
    /stillOwned/.test(adapter) &&
    /setProperty\("scroll-behavior", "auto", "important"\)/.test(adapter) &&
    /removeProperty\("scroll-behavior"\)/.test(adapter),
);
check(
  "media, visibility, key, page, and observer lifecycles clean up symmetrically",
  /subscribeCxosMediaQuery/.test(adapter) &&
    /query\.addEventListener\("change", listener\)/.test(adapter) &&
    /query\.removeEventListener\("change", listener\)/.test(adapter) &&
    /query\.addListener\(listener\)/.test(adapter) &&
    /query\.removeListener\(listener\)/.test(adapter) &&
    /setCapabilities\(CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES\)/.test(adapter) &&
    /typeof window\.IntersectionObserver === "function"/.test(adapter) &&
    /intersectionObserver: false/.test(adapter) &&
    /addEventListener\("visibilitychange", update\)/.test(adapter) &&
    /removeEventListener\("visibilitychange", update\)/.test(adapter) &&
    /addEventListener\("keydown", skipOnEscape\)/.test(adapter) &&
    /removeEventListener\("keydown", skipOnEscape\)/.test(adapter) &&
    /addEventListener\("pagehide", resetHiddenPage\)/.test(adapter) &&
    /removeEventListener\("pagehide", resetHiddenPage\)/.test(adapter) &&
    /addEventListener\("pageshow", resetRestoredPage\)/.test(adapter) &&
    /removeEventListener\("pageshow", resetRestoredPage\)/.test(adapter),
);
check(
  "pagehide and BFCache restoration clear every route-local departure state",
  /const reset = \(\) => \{[\s\S]{0,180}departureCommittedRef\.current = false/.test(
    adapterCode,
  ) &&
    /const reset = \(\) => \{[\s\S]{0,400}window\.clearTimeout\(departureFallbackRef\.current\)/.test(
      adapterCode,
    ) &&
    /clearDistrictTransitionFallback\(\);[\s\S]{0,1400}setDeparting\(false\)/.test(
      adapterCode,
    ) &&
    /if \(!event\.persisted\) return;[\s\S]{0,120}reset\(\)/.test(adapterCode) &&
    /setDocumentHidden\(true\);[\s\S]{0,80}reset\(\)/.test(adapterCode),
);
check(
  "departure preserves modified/native clicks and intercepts only eligible cinema",
  /isPlainPrimaryAnchorClick/.test(adapter) &&
    /event\.button === 0/.test(adapter) &&
    /event\.metaKey/.test(adapter) &&
    /event\.currentTarget\.hasAttribute\("download"\)/.test(adapter) &&
    /resolution\.tier === "C"/.test(adapter) &&
    /resolution\.tier === "D"/.test(adapter) &&
    /event\.preventDefault\(\)/.test(adapter),
);
check(
  "departure is one-shot, bounded, cleaned, and fails open to a local route",
  /departureCommittedRef/.test(adapter) &&
    /window\.setTimeout\([\s\S]{0,120}definition\.departure\.fallbackMs/.test(
      adapter,
    ) &&
    /window\.clearTimeout\(departureFallbackRef\.current\)/.test(adapter) &&
    /window\.location\.assign\(definition\.departure\.href\)/.test(adapter),
);
check(
  "runtime exposes only bounded semantic projection attributes",
  [
    "data-cxos-runtime",
    "data-cxos-runtime-version",
    "data-cxos-room",
    "data-cxos-district-mode",
    "data-cxos-district-transition",
    "data-cxos-district-direction",
    "data-cxos-district-transition-ms",
    "data-cxos-arrival-beats",
    "data-cxos-arrival-duration-ms",
    "data-cxos-motion-channels",
    "data-cxos-phase",
    "data-cxos-motion",
    "data-cxos-heartbeat",
    "data-cxos-lighting",
    "data-cxos-atmosphere",
    "data-cxos-kai-presence",
  ].every((attribute) => adapter.includes(`"${attribute}"`)),
);
check(
  "validated room identity, arrival beats, timing, and motion channels drive adapter output",
  /CXOS_CORE_RUNTIME_VERSION/.test(adapter) &&
    /definition\.roomId/.test(adapter) &&
    /arrivalBeats: definition\.arrivalBeats/.test(adapter) &&
    /definition\.arrivalDurationMs\.A/.test(adapter) &&
    /definition\.arrivalDurationMs\.B/.test(adapter) &&
    /motionChannels: definition\.motionChannels/.test(adapter),
);
check(
  "district lookup and observation remain scoped to the owning room root",
  /roomRootRef: RefObject<HTMLElement>/.test(adapter) &&
    /const root = roomRootRef\.current/.test(adapter) &&
    !/document\.getElementById|document\.querySelectorAll/.test(adapterCode),
);

const forbidden: Array<[string, RegExp]> = [
  ["network client", /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/],
  ["storage or cookie", /\b(?:localStorage|sessionStorage|indexedDB)\b|document\.cookie/],
  ["server or API surface", /next\/headers|next\/navigation|next-auth|\/api\/|["']use server["']/],
  ["database", /\bprisma\b|@prisma\/client/i],
  ["billing or money authority", /\b(?:stripe|billing|checkout|payment)\b/i],
  ["model runtime", /@anthropic-ai|\bopenai\b|generative-ai|@\/lib\/kai/i],
  ["environment", /\bprocess\.env\b/],
  ["clock", /\bDate\b|performance\.(?:now|timeOrigin)/],
  ["randomness", /Math\.random|randomUUID|\bcrypto\b/],
  ["unsafe HTML", /dangerouslySetInnerHTML|\.innerHTML\b|\beval\s*\(|new Function/],
  ["animation dependency", /\b(?:gsap|three|lottie|rive|framer-motion)\b/i],
  ["canvas, WebGL, video, or audio", /<canvas\b|WebGL|<video\b|<audio\b/i],
];
for (const [label, pattern] of forbidden) {
  check(`runtime has no ${label}`, !pattern.test(source));
}

console.log(`\ncxos-core-runtime.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
