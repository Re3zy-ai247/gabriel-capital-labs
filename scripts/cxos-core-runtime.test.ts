// Run: npx --no-install tsx scripts/cxos-core-runtime.test.ts
//
// DB-free executable + source guard for CXOS Core Runtime 1.0. The runtime is
// presentation infrastructure only: deterministic state in, data attributes
// and lifecycle callbacks out. It may never acquire canonical facts or effect
// authority.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES,
  CXOS_CORE_RUNTIME_CAPABILITIES,
  CXOS_CORE_RUNTIME_VERSION,
  deriveCxosRuntimeEnvironment,
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

check("runtime version is explicit", CXOS_CORE_RUNTIME_VERSION === "1.0.0");
check(
  "runtime exposes the exact eleven Founder-authorized capabilities",
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
    ]),
);
check("a bounded reference definition validates", validateCxosRoomRuntime(definition).valid);

const invalidDefinitions: Array<[string, CxosRoomRuntimeDefinition<string>]> = [
  ["room id", { ...definition, roomId: "Bad room" }],
  ["empty districts", { ...definition, districts: [] }],
  ["duplicate districts", { ...definition, districts: ["central", "central"] }],
  ["unknown initial district", { ...definition, initialDistrict: "unknown" }],
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

const desktop = {
  ...CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES,
  detectionFailed: false,
};
const mobile = { ...desktop, mobile: true };
const coarse = { ...desktop, coarsePointer: true };
const reduced = { ...desktop, browserReduced: true };
const saveData = { ...desktop, saveData: true };
const lowMemory = { ...desktop, lowMemory: true };

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
  "Data Saver, low memory, and detection failure resolve Tier C",
  resolveCxosRuntimeProjection("auto", saveData, false).tier === "C" &&
    resolveCxosRuntimeProjection("auto", lowMemory, false).tier === "C" &&
    resolveCxosRuntimeProjection(
      "auto",
      CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES,
      false,
    ).tier === "C",
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
  "one passive IntersectionObserver owns district activation and cleans up",
  (adapter.match(/new IntersectionObserver\(/g) ?? []).length === 1 &&
    /root\.querySelectorAll<HTMLElement>\("\[data-cxos-district\]"\)/.test(adapter) &&
    /entry\.intersectionRatio/.test(adapter) &&
    /observer\.observe\(section\)/.test(adapter) &&
    /observer\.disconnect\(\)/.test(adapter),
);
check(
  "native scroll is never intercepted or animated continuously",
  !/addEventListener\(\s*["'](?:scroll|wheel|touchmove)["']/.test(adapter) &&
    !/\bonScroll\s*=|\bonWheel\s*=|setInterval|requestIdleCallback/.test(adapter) &&
    (adapter.match(/requestAnimationFrame\(/g) ?? []).length <= 4,
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
    /addEventListener\("visibilitychange", update\)/.test(adapter) &&
    /removeEventListener\("visibilitychange", update\)/.test(adapter) &&
    /addEventListener\("keydown", skipOnEscape\)/.test(adapter) &&
    /removeEventListener\("keydown", skipOnEscape\)/.test(adapter) &&
    /addEventListener\("pagehide", reset\)/.test(adapter) &&
    /removeEventListener\("pagehide", reset\)/.test(adapter) &&
    /addEventListener\("pageshow", resetRestoredPage\)/.test(adapter) &&
    /removeEventListener\("pageshow", resetRestoredPage\)/.test(adapter),
);
check(
  "pagehide and BFCache restoration clear every route-local departure state",
  /const reset = \(\) => \{[\s\S]{0,120}departureCommittedRef\.current = false/.test(
    adapterCode,
  ) &&
    /const reset = \(\) => \{[\s\S]{0,280}window\.clearTimeout\(departureFallbackRef\.current\)[\s\S]{0,160}setDeparting\(false\)/.test(
      adapterCode,
    ) &&
    /if \(event\.persisted\) reset\(\)/.test(adapterCode),
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
