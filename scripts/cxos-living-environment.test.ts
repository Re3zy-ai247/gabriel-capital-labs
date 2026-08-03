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
  // RC2 WP-FIX2 (F12): extended to the three scroll/wheel listeners and the
  // trailing-throttle timer added alongside them — previously only the
  // discrete-activity listeners (pointerdown/click/keydown/focusin/toggle)
  // were pinned for symmetric cleanup, leaving the scroll-activity path
  // unchecked even though the "has" check above already required it to
  // exist.
  "all adapter listeners, lifecycle resets, and the idle timer have symmetric cleanup",
  /removeEventListener\("pointerdown"/.test(adapter) &&
    /removeEventListener\("click"/.test(adapter) &&
    /removeEventListener\("keydown"/.test(adapter) &&
    /removeEventListener\("focusin"/.test(adapter) &&
    /removeEventListener\("toggle"/.test(adapter) &&
    /root\.removeEventListener\("scroll", registerScrollActivity\)/.test(adapter) &&
    /root\.removeEventListener\("wheel", registerScrollActivity\)/.test(adapter) &&
    /window\.removeEventListener\("scroll", registerScrollActivity\)/.test(adapter) &&
    /window\.clearTimeout\(scrollActivityThrottle\)/.test(adapter) &&
    /scrollActivityThrottle = null/.test(adapter) &&
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
  // RC2 WP7 taxonomy migration: the facility sweep carries the one literal
  // structural token it actually runs (no more runtime.motionChannels[]
  // indirection), and the per-chamber breath/acquire/scroll trio keeps its
  // declared ownership marker.
  "the facility sweep and per-chamber breath channels have declared ownership markers",
  /className=\{styles\.ambientSweep\}\s*\n\s*data-cxos-motion-channel="continuous:facility-sweep"/.test(
    stage,
  ) &&
    /className=\{styles\.districtEnvironment\}[\s\S]{0,160}data-cxos-motion-channel="continuous:chamber-breath transient:chamber-acquire scroll:depth-parallax"/.test(
      stage,
    ) &&
    /data-cxos-animation-budget="2"/.test(css) &&
    /data-cxos-animation-budget="1"/.test(css),
);
check(
  "stage.tsx contains zero legacy runtime.motionChannels[ DOM bindings (the taxonomy migration is complete)",
  (stage.match(/runtime\.motionChannels\[/g) ?? []).length === 0,
);
// RC2 WP-FIX2 (F1/F9): the facility sweep already restated the 13-way
// quiet-state negation on its own selector; the two chamber-breath rules and
// the blocked-lane pulse now restate the IDENTICAL block verbatim on theirs
// too (the scroll opt-in also carries it, but at @supports-nested
// indentation, so it is a separate string and not counted by this exact
// top-level-indentation match) -- Bible §11.2's "every RC2 continuous
// opt-in restates the negation on its own selector" is only literally true
// once all four of these match.
const rc2QuietStateNegationBlock = `:not(:is(
    [data-cxos-idle="settling"],
    [data-cxos-idle="settled"],
    [data-cxos-attention="reading"],
    [data-cxos-attention="inspecting"],
    [data-cxos-kai="staged"],
    [data-cxos-kai="preparing"],
    [data-cxos-kai="resolved"],
    [data-cxos-environment-motion="quiet"],
    [data-cxos-environment-motion="static"],
    [data-tier="C"],
    [data-tier="D"],
    [data-cxos-tier="C"],
    [data-cxos-tier="D"]
  ))`;
const rc2QuietStateNegationCount = css.split(rc2QuietStateNegationBlock).length - 1;
check(
  "F1/F9 — the facility sweep and both new chamber-breath opt-ins and the blocked-lane pulse all restate the identical 13-way quiet-state negation on their own selector",
  rc2QuietStateNegationCount === 4,
);
check(
  "F1 — the RC2 quiet kill list's element :is() also stops .districtEnvironment itself and .flowTrack b, not only .ambientSweep and .districtEnvironment's descendants",
  /:is\(\.ambientSweep, \.districtEnvironment, \.districtEnvironment \*, \.flowTrack b\)/.test(
    css,
  ),
);
check(
  // RC2 WP-FIX2 (F5): static pin for the per-animation-name, per-OWN-target
  // computed-style gate that replaced the owner-string "contains
  // continuous:" check -- the adversarial-confirmed fix for over-reach onto
  // a sibling transient:chamber-acquire/scroll:depth-parallax animation
  // that merely shared a multi-token owner with continuous:chamber-breath.
  "F5 — the WAAPI safety net gates cancellation per animation name on that animation's own target, never on the shared owner's raw channel string alone",
  /if \(!animationName\) continue;/.test(adapter) &&
    /if \(!isDeclaredContinuous\) continue;/.test(adapter) &&
    /const computedNames = getComputedStyle\(target, pseudoElement\)/.test(
      adapter,
    ) &&
    /if \(!computedNames\.includes\(animationName\)\) {\s*\n\s*animation\.cancel\(\);/.test(
      adapter,
    ),
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
  // RC2 WP7 rewrite: the legacy keyframe-name list is retained ONLY as a
  // defense-in-depth safety net feeding the unclassified-environment-
  // animation fail (an animation with no ancestor-or-self channel
  // attribute at all); it is no longer consulted to decide an animation's
  // class or ownership, and runningEnvironmentAnimationCount is now a
  // backward-compatible alias for the structural continuous-token count.
  "browser evidence retains the legacy-keyframe safety net for the unclassified-animation backstop only, and still waits for the settled shot",
  /ObservatoryScan\|EvidenceRecognition\|KaiRecognition/.test(browserHarness) &&
    /LEGACY_ENVIRONMENT_KEYFRAME_SAFETY_NET/.test(browserHarness) &&
    /runningEnvironmentAnimationCount/.test(browserHarness) &&
    /async function waitForSettledShot/.test(browserHarness) &&
    /style\.visibility === "hidden"/.test(browserHarness),
);
check(
  // RC2 WP7: NO keyframe-name-regex classification remains. The retained
  // safety-net regex above feeds only the unclassified-environment-
  // animation fail; the actual class decision (continuous/transient/
  // scroll) and ownership are 100% structural — resolveMotionToken reads
  // only the token's own prefix, disambiguating a multi-token owner by the
  // animation's own timeline type / iteration count, never its keyframe
  // name. The old declared-channel-list ternary (motionOwnership /
  // "declared" / "unowned-living-animation" / "unknown-marker" /
  // declaredMotionChannels) is gone entirely.
  "NO keyframe-name-regex classification remains: continuous/transient/scroll membership is decided purely by data-cxos-motion-channel token prefix",
  /const resolveMotionToken = /.test(browserHarness) &&
    /resolvedMotionClass === "continuous"/.test(browserHarness) &&
    /resolvedMotionClass === "transient"/.test(browserHarness) &&
    /resolvedMotionClass === "scroll"/.test(browserHarness) &&
    !/motionOwnership/.test(browserHarness) &&
    !/"unowned-living-animation"/.test(browserHarness) &&
    !/"unknown-marker"/.test(browserHarness) &&
    !/declaredMotionChannels/.test(browserHarness),
);
check(
  // RC2 WP-FIX2 (F10): the ceiling is now measured delay-inclusive
  // (effectiveEndMs = getComputedTiming().endTime = delay + duration for a
  // single-iteration beat), not duration alone -- a staggered beat does not
  // finish until its delay has also elapsed.
  "the structural classifier enforces a single iteration and a delay-inclusive <=1500ms ceiling for every running transient:* animation instance",
  /animation\.iterations !== 1/.test(browserHarness) &&
    /animation\.effectiveEndMs > 1500/.test(browserHarness) &&
    /effectiveEndMs: typeof timing\.endTime === "number" \? timing\.endTime : null/.test(
      browserHarness,
    ) &&
    /transientTimingViolations/.test(browserHarness),
);
check(
  "the unclassified-environment-animation fail code exists and closes the budget-bypass hole",
  /"unclassified-environment-animation"/.test(browserHarness) &&
    /unclassifiedEnvironmentAnimation/.test(browserHarness),
);
check(
  "A-tier scroll choreography preserves its ViewTimeline and is behavior-gated across all four scroll-linked travel chambers",
  /animation-duration:\s*auto\s*!important/.test(css) &&
    /animation-timeline:\s*view\(\)\s*!important/.test(css) &&
    /animation-range:\s*cover 8% cover 92%\s*!important/.test(css) &&
    /\.districtEnvironment\s*\{[\s\S]{0,160}overflow:\s*clip/.test(css) &&
    /async function measureScrollLinkedChoreography\(page, districtId\)/.test(browserHarness) &&
    /genuineViewTimeline/.test(browserHarness) &&
    /timelineSubjectMatches/.test(browserHarness) &&
    /timelineSourceIsDocumentScroller/.test(browserHarness) &&
    /endpointResponsive/.test(browserHarness) &&
    /renderedTransformResponsive/.test(browserHarness) &&
    /coverage:scroll-linked-choreography/.test(browserHarness),
);
// The full set of quiet/settled/reading/inspecting/kai-turn/static-tier
// conditions the settle/reading/quiet kill list negates on. Every restored
// WP2 continuous/scroll opt-in that can collide with the kill list for the
// same element must carry this exact negation directly on its own selector
// (not merely rely on data-cxos-animation-budget having already flipped to
// 0) so the two !important rules are structurally mutually exclusive rather
// than competing on specificity/order -- see the .ambientSweep and
// @supports (animation-timeline: view()) rules for the full rationale.
const QUIET_STATE_NEGATION_CONDITIONS = [
  '[data-cxos-idle="settling"]',
  '[data-cxos-idle="settled"]',
  '[data-cxos-attention="reading"]',
  '[data-cxos-attention="inspecting"]',
  '[data-cxos-kai="staged"]',
  '[data-cxos-kai="preparing"]',
  '[data-cxos-kai="resolved"]',
  '[data-cxos-environment-motion="quiet"]',
  '[data-cxos-environment-motion="static"]',
  '[data-tier="C"]',
  '[data-tier="D"]',
  '[data-cxos-tier="C"]',
  '[data-cxos-tier="D"]',
];
function hasQuietStateNegation(selectorOrBlock: string): boolean {
  const notIsStart = selectorOrBlock.indexOf(":not(:is(");
  if (notIsStart === -1) return false;
  const negationBlock = selectorOrBlock.slice(
    notIsStart,
    selectorOrBlock.indexOf("))", notIsStart) + 2,
  );
  return QUIET_STATE_NEGATION_CONDITIONS.every((condition) =>
    negationBlock.includes(condition),
  );
}
check(
  // Regression pin for the two motion-budget quiet-state escapes: the
  // continuous facility-sweep (.ambientSweep) was observed still running at
  // idle/attention/kai/hidden quiet states (idle:quiescence and others)
  // even though the kill list's specificity wins on paper. Scoping the
  // opt-in with the same negation the kill list uses makes the two rules
  // mutually exclusive by construction instead of trusting a cascade race.
  "the .ambientSweep facility-sweep opt-in carries the full quiet-state negation, positioned between the budget=2 gate and the .ambientSweep target",
  (() => {
    const optInStart = css.indexOf(
      '.room[data-cxos-environment][data-cxos-animation-budget="2"]:not(:is(',
    );
    if (optInStart === -1) return false;
    const optInSelector = css.slice(optInStart, css.indexOf("{", optInStart));
    return (
      hasQuietStateNegation(optInSelector) &&
      /\)\)\s*\.ambientSweep\s*\{/.test(
        css.slice(optInStart, css.indexOf("{", optInStart) + 1),
      ) &&
      /animation:\s*agencyLivingHeartbeat var\(--cxos-dur-drift\) linear infinite !important/.test(
        css.slice(optInStart, optInStart + 2000),
      )
    );
  })(),
);
(() => {
  // The harness's traversal list must match the CSS's own opt-in list —
  // parse both independently and compare as sets so the two cannot drift.
  // The data-cxos-profile list lives in the SELECTOR (the :not(:is(quiet
  // list)):is(profile list) before the opening brace), not the rule body,
  // so this slices from the selector's start up to (not past) the brace —
  // extractRuleBody would return the wrong half (the animation-name/...
  // declarations). Scoped to start searching from the "A-only progressive
  // parallax" comment (unique in the file) rather than a bare
  // css.indexOf on the selector prefix: that prefix
  // (.room[data-cxos-environment][data-cxos-animation-budget="2"]:not(:is()
  // is now shared verbatim with the earlier .ambientSweep opt-in's own
  // quiet-state negation, so an unscoped search would find THAT rule first.
  const scrollBlockAnchor = css.indexOf(
    "A-only progressive parallax replaces",
  );
  const cssSelectorStart =
    scrollBlockAnchor === -1
      ? -1
      : css.indexOf(
          '.room[data-cxos-environment][data-cxos-animation-budget="2"]:not(:is(',
          scrollBlockAnchor,
        );
  const cssSelectorText =
    cssSelectorStart >= 0
      ? css.slice(cssSelectorStart, css.indexOf("{", cssSelectorStart))
      : "";
  const cssScrollLinkedDistricts = [
    ...cssSelectorText.matchAll(/data-cxos-profile="([a-z-]+)"/g),
  ].map((match) => match[1]);
  const harnessScrollLinkedDistrictsSource =
    browserHarness.match(
      /const SCROLL_LINKED_DISTRICTS = Object\.freeze\(\[([\s\S]*?)\]\);/,
    )?.[1] ?? "";
  const harnessScrollLinkedDistricts = [
    ...harnessScrollLinkedDistrictsSource.matchAll(/"([a-z-]+)"/g),
  ].map((match) => match[1]);
  check(
    "the four-district scroll-proof list in browser.mjs matches the CSS @supports (animation-timeline: view()) opt-in list, compared as sets",
    cssScrollLinkedDistricts.length === 4 &&
      harnessScrollLinkedDistricts.length === 4 &&
      new Set([...cssScrollLinkedDistricts, ...harnessScrollLinkedDistricts]).size === 4,
  );
  check(
    // Regression pin: scroll:depth-parallax was observed still running (as
    // agencyLivingScroll) at quiet states alongside the facility sweep. This
    // rule sets animation-name (and friends) as longhands at the SAME
    // selector specificity as the kill list -- an exact five-component tie
    // resolved only by source order -- which is exactly the kind of
    // fragile-but-technically-correct-on-paper layering the sweep case also
    // exhibited. The same quiet-state negation removes the tie by
    // construction: this rule and the kill list can no longer both match
    // the same element at once.
    "the @supports (animation-timeline: view()) scroll opt-in carries the full quiet-state negation ahead of its four-district :is(...) profile gate",
    cssSelectorStart !== -1 && hasQuietStateNegation(cssSelectorText),
  );
})();
check(
  "axe runOnly covers wcag22a and wcag22aa alongside the existing WCAG 2.0/2.1 tags, shared by the full-page and per-chamber audits",
  /AXE_RUNONLY_TAGS/.test(browserHarness) &&
    /"wcag22a"/.test(browserHarness) &&
    /"wcag22aa"/.test(browserHarness) &&
    /async function runAxeAudit/.test(browserHarness),
);
check(
  "axe passing rule ids are persisted as an array via .map(), never as a bare .length count",
  /passes:\s*axe\.passes\.map\(/.test(browserHarness) &&
    !/passes:\s*axe\.passes\.length/.test(browserHarness) &&
    !/passes:\s*0,/.test(browserHarness),
);
check(
  "per-chamber Axe audits run on desktop-large and mobile, keyed by district id, and fail (not skip) on error",
  /perDistrictAxe\[district\]/.test(browserHarness) &&
    /coverage:per-chamber-axe/.test(browserHarness) &&
    /axe-blocking-district/.test(browserHarness),
);
check(
  "the target-size coverage gate predicate requires a real obstructionMeasured > 0 sample, not just an integer obstructionFailures field",
  /state\.targetSize\.obstructionMeasured > 0/.test(browserHarness) &&
    /coverage:target-size/.test(browserHarness) &&
    !/Number\.isInteger\(state\.targetSize\.obstructionFailures\)/.test(browserHarness),
);
check(
  "the post-CLS obstruction probe restores the exact prior scroll position and records a skip reason (zero-size, covered-by-definition, or detached) instead of silently omitting an unsampleable target",
  /async function sampleOffViewportObstruction/.test(browserHarness) &&
    /scrollIntoView\(\{ block: "center" \}\)/.test(browserHarness) &&
    /"zero-size"/.test(browserHarness) &&
    /"covered-by-definition"/.test(browserHarness) &&
    /"detached"/.test(browserHarness) &&
    /obstructionSampling/.test(browserHarness),
);
(() => {
  const mobileSpecBlock = browserHarness.slice(
    browserHarness.indexOf('id: "mobile",'),
    browserHarness.indexOf("},", browserHarness.indexOf('id: "mobile",')),
  );
  check(
    "the mobile spec declares departure: true (BFCache breadth: a second traversal, a second viewport)",
    mobileSpecBlock.length > 0 && /departure: true/.test(mobileSpecBlock),
  );
})();
check(
  "the trusted-BFCache coverage gate requires proof on both the desktop and mobile viewports, not just the first traversal found",
  /trustedBfcacheStates\.length >= 2/.test(browserHarness),
);
(() => {
  const landscapeSpecBlock = browserHarness.slice(
    browserHarness.indexOf('id: "landscape",'),
    browserHarness.indexOf("},", browserHarness.indexOf('id: "landscape",')),
  );
  check(
    "the landscape spec declares measuredCycles: 3, reusing the desktop warmup+cycles mechanism for n>=3 samples",
    landscapeSpecBlock.length > 0 && /measuredCycles: 3/.test(landscapeSpecBlock),
  );
})();
check(
  "median + max blocking duration are reported additively across a case's measured chamber cycles",
  /function summarizeBlockingDurations/.test(browserHarness) &&
    /cycleBlocking = \{/.test(browserHarness) &&
    /median/.test(browserHarness) &&
    /\bmax\b/.test(browserHarness),
);
check(
  "a directory:open step (with its directory:close counterpart) opens the <=860px mobile facility map, measuring target-size and obstruction there before closing it",
  /"directory:open"/.test(browserHarness) &&
    /"directory:close"/.test(browserHarness) &&
    /spec\.width <= 860/.test(browserHarness) &&
    /mobileFacilityMap/.test(browserHarness) &&
    /coverage:mobile-facility-directory/.test(browserHarness),
);
check(
  "the long-task-api-unattributable taxonomy term exists: a post-processing LoAF<->Long Task join, additive only, never mutating the raw capture",
  /"long-task-api-unattributable"/.test(browserHarness) &&
    /function resolveLongTaskAttribution/.test(browserHarness) &&
    /attributionResolved/.test(browserHarness) &&
    /long-animation-frame-join/.test(browserHarness),
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
  // RC2 WP-FIX2 (F1/F9): now also restates the quiet-state negation
  // (rc2QuietStateNegationBlock, defined above) directly between the
  // budget/profile attributes and .flowList, exactly like the two
  // chamber-breath rules.
  "the blocked-lane pulse is scoped to client operations Tier A, restates the quiet-state negation, and targets only the fixed blocked fixture lane",
  css.includes(
    `[data-cxos-animation-budget="2"][data-cxos-profile="client-operations"]${rc2QuietStateNegationBlock}\n  .flowList\n  > li[data-motion="blocked"]\n  .flowTrack\n  b {\n  animation: agencyLivingBlockedPulse`,
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
  // RC2 WP7: the taxonomy migration removed every runtime.motionChannels[]
  // DOM binding (verified as its own zero-count check above), so this
  // filter is now a no-op by construction — kept so this check still holds
  // if a future change ever reintroduces a dynamic binding.
  .filter((attr) => !/runtime\.motionChannels\[/.test(attr));
check(
  // 13 pre-existing structural bindings + the migrated .ambientSweep
  // literal ("continuous:facility-sweep") = 14. .roomBreath and
  // .facilityPulse lost their attribute entirely (retired/killed in Living
  // mode) rather than gaining a literal, so they add zero.
  "every newly classified data-cxos-motion-channel attribute in stage.tsx carries a conforming class:name token",
  classifiedMotionChannelAttrs.length === 14 &&
    classifiedMotionChannelAttrs.every((attr) =>
      [...attr.matchAll(/"([^"]+)"/g)].some((match) =>
        match[1].split(" ").every((token) => CHANNEL_TOKEN.test(token)),
      ),
    ),
);
check(
  // Belt-and-suspenders enforcement, not a second policy: the CSS kill list
  // and each WP2 opt-in's own quiet-state negation (checked above) already
  // gate every continuous:* channel to zero the instant
  // continuousAnimationBudget drops to 0. This was empirically observed to
  // not always be enough for one specific long-running (18s, linear
  // infinite) continuous animation across a long real interaction session
  // -- the cascade's cancellation was not reliably picked up for that
  // element. useCxosRoomRuntime explicitly cancels any still-running
  // continuous:* animation via the Web Animations API, using the same
  // data-cxos-motion-channel token grammar as the CSS and the acceptance
  // harness, the moment livingEnvironment.motion stops being "active".
  // useLayoutEffect (not useEffect) so it runs before the next paint.
  "the runtime hook explicitly cancels any still-running continuous:* animation via WAAPI when motion is not active, as a cascade-timing safety net",
  /useLayoutEffect\(\(\) => \{\s*\n\s*const root = roomRootRef\.current;\s*\n\s*if \(!root \|\| !livingEnvironment \|\| livingEnvironment\.motion === "active"\)/.test(
    adapter,
  ) &&
    /root\.getAnimations\(\{ subtree: true \}\)/.test(adapter) &&
    /token\.startsWith\("continuous:"\)/.test(adapter) &&
    /animation\.cancel\(\)/.test(adapter),
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
check(
  // Regression pin: --cxos-dur-heartbeat is consumed by exactly one thing --
  // the transient agencyLivingAcquireB beat (`animation: agencyLivingAcquireB
  // var(--cxos-dur-heartbeat) ...`) -- and despite its name is NOT a
  // continuous cadence, so it is bound by the structural transient budget in
  // browser.mjs (iteration 1, delay-inclusive <=1500ms; see
  // "animation.effectiveEndMs > 1500" above). The Tier B override used to be
  // 3200ms (root default 2400ms),
  // both over the ceiling, which the harness caught as a
  // transientTimingViolation on every Tier B chamber-acquire. Every declared
  // value must stay <=1500ms and there must be exactly the two expected
  // declarations (the .room default and the Tier B override) -- a third
  // declaration slipping in unchecked would be exactly this bug again.
  "every --cxos-dur-heartbeat declaration (the agencyLivingAcquireB transient duration) is <=1500ms",
  (() => {
    const declarations = [
      ...css.matchAll(/--cxos-dur-heartbeat:\s*(\d+)ms/g),
    ].map((match) => Number(match[1]));
    return (
      declarations.length === 2 &&
      declarations.every((value) => value > 0 && value <= 1500)
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

// -- RC2 WP5: destination-aware passage and arrival compression -------------
const passageBlocks = new Map(
  districtIds.map((id) => [
    id,
    extractRuleBody(css, `.facilityPassage[data-cxos-passage-target="${id}"] {`),
  ]),
);
check(
  "all seven chambers declare an explicit, distinct --cxos-passage-signal on their destination passage block",
  [...passageBlocks.values()].every((block) => block.length > 0) &&
    districtIds.every(
      (id) =>
        readCustomProp(passageBlocks.get(id) ?? "", "--cxos-passage-signal") !==
        null,
    ) &&
    new Set(
      districtIds.map((id) =>
        readCustomProp(passageBlocks.get(id) ?? "", "--cxos-passage-signal"),
      ),
    ).size === districtIds.length,
);
check(
  "all seven chambers declare a --cxos-passage-origin, consumed by the passage axis line's transform-origin",
  districtIds.every(
    (id) =>
      readCustomProp(passageBlocks.get(id) ?? "", "--cxos-passage-origin") !==
      null,
  ) &&
    /\.facilityPassage\[data-cxos-passage-target\] \.passageAxis i\s*\{[\s\S]{0,220}transform-origin:\s*var\(--cxos-passage-origin\)/.test(
      css,
    ),
);

const facilityPassageKeyframeBody = css.slice(
  css.indexOf("@keyframes agencyFacilityPassage {"),
  css.indexOf("@keyframes agencyPassageAxis {"),
);
const passageHoldMatch = facilityPassageKeyframeBody.match(
  /([\d.]+)%,\s*([\d.]+)%\s*\{\s*opacity:\s*1;/,
);
const passageHoldStart = passageHoldMatch ? Number(passageHoldMatch[1]) : null;
const passageHoldEnd = passageHoldMatch ? Number(passageHoldMatch[2]) : null;
check(
  "the facility passage fades in from 0% and its opaque hold is <=40% of the transition, bracketing the true (100%-of-duration) district swap instead of an early window",
  facilityPassageKeyframeBody.length > 0 &&
    /0%\s*\{\s*opacity:\s*0;/.test(facilityPassageKeyframeBody) &&
    passageHoldStart !== null &&
    passageHoldEnd === 100 &&
    passageHoldEnd - (passageHoldStart as number) > 0 &&
    passageHoldEnd - (passageHoldStart as number) <= 40,
);
check(
  "the district swap fires only from the passage element's own animationend (not a mid-passage timeout), and the passage fallback timer is armed for the same full duration",
  /completeDistrictTransition = useCallback\(/.test(adapter) &&
    /if \(event && event\.currentTarget !== event\.target\) return;/.test(
      adapter,
    ) &&
    /onAnimationEnd=\{completeDistrictTransition\}/.test(stage) &&
    /districtTransitionFallbackRef\.current = window\.setTimeout\(\(\) => \{[\s\S]{0,160}\}, districtTransitionDurationMs\);/.test(
      adapter,
    ),
);

const settledMastheadIdentityBlock = extractRuleBody(
  css,
  '.room[data-arrival-settled="true"] .facilityIdentity .identity {',
);
const passageMastheadIdentityBlock = extractRuleBody(
  css,
  '.room[data-arrival-settled="true"][data-chamber-phase="passage"] .facilityIdentity .identity {',
);
check(
  "the settled masthead declares a bounded, transitioning max-height/opacity as its static rest-state layout (unrelated to the opacity-only passage compression below), and the compression never targets the disclosure",
  settledMastheadIdentityBlock.length > 0 &&
    /overflow:\s*hidden/.test(settledMastheadIdentityBlock) &&
    /max-height:\s*20rem/.test(settledMastheadIdentityBlock) &&
    /transition:[\s\S]{0,40}max-height var\(--cxos-dur-settle\)[\s\S]{0,80}opacity var\(--cxos-dur-settle\)/.test(
      settledMastheadIdentityBlock,
    ) &&
    !/\[data-chamber-phase="passage"\][^{]*\.disclosure/.test(css) &&
    !/\.disclosure[^{]*\[data-chamber-phase="passage"\]/.test(css),
);
check(
  // Regression pin for the phase-CLS fix: the passage-phase masthead
  // compression must be opacity-only. max-height (and its former
  // align-items partner, needed only to steer which edge a max-height clip
  // exposed) are real layout properties, and the settled-state rule above
  // already transitions max-height -- re-declaring it here at a different
  // value animated real layout on every chamber passage (a collapse, then a
  // re-expand back to settled), accumulating nonzero phase/cumulative CLS.
  // Opacity alone is compositor-only and cannot shift layout.
  "the chamber-phase=passage masthead compression is opacity-only (no max-height/align-items/height/overflow layout changes)",
  passageMastheadIdentityBlock.length > 0 &&
    /opacity:\s*0\.4\b/.test(passageMastheadIdentityBlock) &&
    !/max-height/.test(passageMastheadIdentityBlock) &&
    !/align-items/.test(passageMastheadIdentityBlock) &&
    !/(?<!max-)height\s*:/.test(passageMastheadIdentityBlock) &&
    !/overflow\s*:/.test(passageMastheadIdentityBlock),
);
check(
  // Regression pin for the second phase-CLS contributor: kaiContextDistrict
  // used to sync to activeDistrict via a useEffect, which runs after
  // commit/paint -- so on EVERY district change (not just entry into a
  // kaiContextHoldDistricts chamber) there was one already-painted render
  // where kaiContextDistrict still lagged activeDistrict, making
  // KaiContextSpine's carriedContext read true and paint an extra "CARRIED
  // CONTEXT · [previous chamber]" line on .kaiContext before reverting --
  // a real, if small, per-navigation layout shift once the larger
  // passage/masthead max-height shift (fixed separately, see above)
  // stopped dominating every phase's CLS budget on its own. Adjusting
  // kaiContextDistrict during rendering (not in an effect) means React
  // redoes the render with the correct value before anything commits, so
  // the incorrect intermediate state is never painted.
  "kaiContextDistrict is adjusted during rendering (not via a useEffect) to avoid a one-frame carriedContext flash on every district change",
  /const lastActiveDistrictForKaiContextRef = useRef\(definition\.initialDistrict\);/.test(
    adapter,
  ) &&
    /if \(\s*\n\s*lastActiveDistrictForKaiContextRef\.current !== activeDistrict &&\s*\n\s*!\(definition\.kaiContextHoldDistricts \?\? \[\]\)\.includes\(activeDistrict\)\s*\n\s*\)\s*\{\s*\n\s*lastActiveDistrictForKaiContextRef\.current = activeDistrict;\s*\n\s*setKaiContextDistrict\(activeDistrict\);\s*\n\s*\}/.test(
      adapter,
    ) &&
    !/useEffect\(\(\) => \{\s*\n\s*if \(!\(definition\.kaiContextHoldDistricts/.test(
      adapter,
    ),
);
check(
  "the FIXTURE STATE band and DIRECTOR pill share one flex row, both preserved as their own elements with their touch targets intact",
  /\.facilityControlRow\s*\{[\s\S]{0,120}display:\s*flex[\s\S]{0,160}flex-wrap:\s*wrap/.test(
    css,
  ) &&
    /\.facilityControlRow \.stateBand\s*\{/.test(css) &&
    /\.facilityControlRow \.director\s*\{/.test(css) &&
    /<div className=\{styles\.facilityControlRow\}>[\s\S]{0,80}<section className=\{styles\.stateBand\}/.test(
      stage,
    ) &&
    /<\/section>[\s\S]{0,40}<details[\s\S]{0,4000}<\/details>\s*<\/div>/.test(
      stage,
    ) &&
    /\.director summary\s*\{[\s\S]{0,120}min-height:\s*3rem/.test(css),
);
check(
  "chamber noun unification: the district header and facility rail render CHAMBER/CHAMBERS, not DISTRICT/DISTRICTS, in rendered copy",
  /CHAMBER \{district\.index\} \/ 07/.test(stage) &&
    !/>DISTRICT \{district\.index\}/.test(stage) &&
    /7 CHAMBERS/.test(stage) &&
    !/7 DISTRICTS/.test(stage) &&
    /Seven chambers available/.test(stage) &&
    !/Seven districts available/.test(stage) &&
    /className=\{styles\.districtHeader\}/.test(stage) &&
    /className=\{styles\.district\}/.test(stage),
);

// -- RC2 WP6: accessibility and state-legibility hardening ------------------
// `.chamberStage .district` at (0,2,0) specificity is the ONLY selector that
// matches the live district markup at every viewport (districts are always
// rendered as `.chamberStage`'s children), so it is the rule that must carry
// scroll-margin-top for it to have any effect; the (0,1,0) `.district`
// media rules (base 6.75rem, 1023px 9rem, 767px 0.75rem) are all structurally
// defeated regardless of source order. Isolate the second
// `@media (max-width: 860px)` block specifically (the first, ~3320, is an
// unrelated environment-filter block) so this guard fails if the fix ever
// lands outside the mobile facility-bar breakpoint it targets.
const secondMobile860At = css.indexOf(
  "@media (max-width: 860px)",
  css.indexOf("@media (max-width: 860px)") + 1,
);
const mobile860Block =
  secondMobile860At >= 0
    ? css.slice(
        secondMobile860At,
        css.indexOf("@media (max-width: 430px)", secondMobile860At),
      )
    : "";
check(
  "under the <=860px mobile facility bar, .chamberStage .district wins the scroll-margin-top specificity defeat, and Tab-reached links/buttons/summaries inside a district carry the same clearance",
  mobile860Block.length > 0 &&
    /\.chamberStage \.district \{[\s\S]{0,650}scroll-margin-top:\s*9rem/.test(
      mobile860Block,
    ) &&
    /\.chamberStage \.district :is\(a, button, summary\)\s*\{\s*\n\s*scroll-margin-top:\s*9rem/.test(
      mobile860Block,
    ),
);
check(
  "the Evidence Archive's five states each get a distinct border-inline-start weight/style so absence is a shape, not just a swatch hue",
  /\.archiveEvidenceList li\[data-evidence-state="complete"\]\s*\{\s*\n\s*border-inline-start:\s*2px solid var\(--agency-chamber-edge\)/.test(
    css,
  ) &&
    /\.archiveEvidenceList li\[data-evidence-state="verify"\]\s*\{\s*\n\s*border-inline-start:\s*2px solid rgba\(244, 199, 109,/.test(
      css,
    ) &&
    /\.archiveEvidenceList li\[data-evidence-state="partial"\]\s*\{\s*\n\s*border-inline-start:\s*2px dashed rgba\(244, 199, 109,/.test(
      css,
    ) &&
    /\.archiveEvidenceList li\[data-evidence-state="gap"\]\s*\{\s*\n\s*border-inline-start:\s*3px dashed rgba\(244, 199, 109,/.test(
      css,
    ) &&
    /\.archiveEvidenceList li\[data-evidence-state="unavailable"\]\s*\{\s*\n\s*border-inline-start:\s*2px dotted var\(--agency-dim\)/.test(
      css,
    ) &&
    new Set(
      [
        ...css.matchAll(
          /\.archiveEvidenceList li\[data-evidence-state="[^"]+"\]\s*\{\s*\n\s*border-inline-start:\s*([^;]+);/g,
        ),
      ].map((match) => match[1]),
    ).size === 5,
);
check(
  "occupied and reserve capacity cells get a static (no animation) two-token opacity step so the 12/15 boundary reads as a light step, and the capacity-state amber border is untouched",
  /\.capacityHorizon i\[data-occupied="true"\]\s*\{\s*\n\s*opacity:\s*calc\(0\.86 \+ var\(--cxos-light-active\)\)/.test(
    css,
  ) &&
    /\.capacityHorizon i\[data-occupied="false"\]\s*\{\s*\n\s*opacity:\s*calc\(0\.86 - var\(--cxos-light-rest\)\)/.test(
      css,
    ) &&
    !/@keyframes[\s\S]{0,80}capacityHorizon i\[data-occupied/.test(css) &&
    /\.capacityHorizon\[data-capacity-state="capacity"\] i\[data-occupied="true"\]\s*\{[\s\S]{0,80}border-color:\s*rgba\(244, 199, 109/.test(
      css,
    ),
);
check(
  "the blocked lane row carries amber border-inline-start emphasis, and client-operations' signal em is re-enabled with amber (no longer display:none)",
  /\.flowList > li\[data-motion="blocked"\]\s*\{\s*\n\s*border-inline-start:\s*3px dashed var\(--agency-watch\)/.test(
    css,
  ) &&
    !/\.room\[data-cxos-profile="client-operations"\] \[data-plane="signal"\] em\s*\{\s*\n\s*display:\s*none/.test(
      css,
    ) &&
    /\.room\[data-cxos-profile="client-operations"\] \[data-plane="signal"\] em\s*\{\s*\n\s*background:\s*linear-gradient\(90deg, transparent, var\(--agency-watch\), transparent\)/.test(
      css,
    ) &&
    /\.room\[data-cxos-profile="client-operations"\] \[data-plane="signal"\] :is\(i, b, em\)/.test(
      css,
    ),
);

console.log(`\ncxos-living-environment.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
