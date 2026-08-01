import type { CxTier } from "./capability";

// CXOS Core Runtime 1.0 — pure room contracts and policy.
//
// This module owns presentation state only. It never owns room data, canonical
// values, navigation authority, Kai intent, persistence, or effects. A room
// supplies a small immutable definition; the client adapter projects that
// definition onto the room's existing semantic document and CSS.

export const CXOS_CORE_RUNTIME_VERSION = "1.0.0" as const;

export const CXOS_CORE_RUNTIME_CAPABILITIES = [
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
] as const;

export type CxosCoreRuntimeCapability =
  (typeof CXOS_CORE_RUNTIME_CAPABILITIES)[number];

export type CxosExperienceProjection = "auto" | "cinematic" | "static";
export type CxosDistrictMode = "flow" | "chamber";
export type CxosDistrictTransitionDirection =
  | "forward"
  | "backward"
  | "same";

export const DEFAULT_CXOS_DISTRICT_TRANSITION_MS = {
  A: 620,
  B: 460,
} as const;

export interface CxosRuntimeCapabilities {
  browserReduced: boolean;
  saveData: boolean;
  lowMemory: boolean;
  mobile: boolean;
  coarsePointer: boolean;
  intersectionObserver: boolean;
  detectionFailed: boolean;
}

export const CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES: CxosRuntimeCapabilities = {
  browserReduced: false,
  saveData: false,
  lowMemory: false,
  mobile: false,
  coarsePointer: false,
  intersectionObserver: false,
  detectionFailed: true,
};

export interface CxosProjectionResolution {
  tier: CxTier;
  reason: string;
  cinematicAvailable: boolean;
  static: boolean;
}

export interface CxosRoomRuntimeDefinition<DistrictId extends string> {
  roomId: string;
  districts: readonly DistrictId[];
  initialDistrict: DistrictId;
  districtMode?: CxosDistrictMode;
  districtTransitionMs?: {
    A: number;
    B: number;
  };
  arrivalBeats: readonly string[];
  arrivalDurationMs: {
    A: number;
    B: number;
  };
  motionChannels: readonly string[];
  kaiContextHoldDistricts?: readonly DistrictId[];
  departure: {
    href: string;
    fallbackMs: number;
  };
}

export interface CxosRuntimeValidation {
  valid: boolean;
  reasons: readonly string[];
}

export type CxosRoomPhase = "arriving" | "operating" | "departing";
export type CxosMotionState = "active" | "paused" | "static";
export type CxosHeartbeatState = "active" | "paused" | "static";
export type CxosLightingState =
  | "arrival"
  | "operating"
  | "departure"
  | "static";
export type CxosAtmosphereState = "active" | "paused" | "static";
export type CxosKaiPresenceState =
  | "acquiring"
  | "available"
  | "paused"
  | "suspended"
  | "static"
  | "unavailable";

export interface CxosRuntimeEnvironment {
  contract: "ready" | "fail-closed";
  phase: CxosRoomPhase;
  motion: CxosMotionState;
  heartbeat: CxosHeartbeatState;
  lighting: CxosLightingState;
  atmosphere: CxosAtmosphereState;
  kaiPresence: CxosKaiPresenceState;
  scrollActivation: boolean;
}

const RUNTIME_ID = /^[a-z][a-z0-9-]*$/;
const SAFE_LOCAL_ROUTE = /^\/(?!\/)[^\s\\]*$/;

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateCxosRoomRuntime<DistrictId extends string>(
  definition: CxosRoomRuntimeDefinition<DistrictId>,
): CxosRuntimeValidation {
  const reasons: string[] = [];
  const districts = definition.districts as readonly string[];
  const heldDistricts = (definition.kaiContextHoldDistricts ?? []) as readonly string[];

  if (!RUNTIME_ID.test(definition.roomId)) {
    reasons.push("room-id");
  }
  if (
    districts.length === 0 ||
    !unique(districts) ||
    districts.some((district) => !RUNTIME_ID.test(district))
  ) {
    reasons.push("district-registry");
  }
  if (!districts.includes(definition.initialDistrict)) {
    reasons.push("initial-district");
  }
  const districtMode = definition.districtMode ?? "flow";
  if (districtMode !== "flow" && districtMode !== "chamber") {
    reasons.push("district-mode");
  }
  if (districtMode === "chamber" && definition.districtTransitionMs) {
    const timing = definition.districtTransitionMs;
    if (
      !Number.isInteger(timing.A) ||
      !Number.isInteger(timing.B) ||
      timing.A < 450 ||
      timing.A > 900 ||
      timing.B < 450 ||
      timing.B > timing.A
    ) {
      reasons.push("district-transition-duration");
    }
  }
  if (
    heldDistricts.some(
      (district) => !districts.includes(district) || !RUNTIME_ID.test(district),
    )
  ) {
    reasons.push("kai-context-boundary");
  }
  if (
    definition.arrivalBeats.length === 0 ||
    definition.arrivalBeats.length > 12 ||
    !unique(definition.arrivalBeats) ||
    definition.arrivalBeats.some((beat) => !RUNTIME_ID.test(beat))
  ) {
    reasons.push("arrival-sequence");
  }
  if (
    !Number.isInteger(definition.arrivalDurationMs.A) ||
    !Number.isInteger(definition.arrivalDurationMs.B) ||
    definition.arrivalDurationMs.A < 100 ||
    definition.arrivalDurationMs.A > 2500 ||
    definition.arrivalDurationMs.B < 100 ||
    definition.arrivalDurationMs.B > definition.arrivalDurationMs.A
  ) {
    reasons.push("arrival-duration");
  }
  if (
    definition.motionChannels.length === 0 ||
    definition.motionChannels.length > 3 ||
    !unique(definition.motionChannels) ||
    definition.motionChannels.some((channel) => !RUNTIME_ID.test(channel))
  ) {
    reasons.push("motion-budget");
  }
  if (!SAFE_LOCAL_ROUTE.test(definition.departure.href)) {
    reasons.push("departure-route");
  }
  if (
    !Number.isInteger(definition.departure.fallbackMs) ||
    definition.departure.fallbackMs < 100 ||
    definition.departure.fallbackMs > 1800
  ) {
    reasons.push("departure-fallback");
  }

  return { valid: reasons.length === 0, reasons };
}

export function resolveCxosRuntimeProjection(
  projection: CxosExperienceProjection,
  capabilities: CxosRuntimeCapabilities,
  reducedMotionOverride: boolean,
  contractValid = true,
  districtMode: CxosDistrictMode = "flow",
): CxosProjectionResolution {
  const constrained =
    capabilities.detectionFailed ||
    capabilities.saveData ||
    capabilities.lowMemory ||
    (districtMode === "flow" && !capabilities.intersectionObserver);

  if (!contractValid) {
    return {
      tier: "D",
      reason: "Runtime contract failed closed",
      cinematicAvailable: false,
      static: true,
    };
  }

  if (projection === "static") {
    return {
      tier: "D",
      reason: "Complete static review document",
      cinematicAvailable: !constrained,
      static: true,
    };
  }

  if (constrained) {
    return {
      tier: "C",
      reason: capabilities.detectionFailed
        ? "Capability detection failed safely"
        : capabilities.saveData
          ? "Data Saver keeps the review conservative"
          : capabilities.lowMemory
            ? "Low-memory safety keeps the review conservative"
            : "District observation is unavailable; the room remains static",
      cinematicAvailable: false,
      static: true,
    };
  }

  if (
    capabilities.browserReduced &&
    !(projection === "cinematic" && reducedMotionOverride)
  ) {
    return {
      tier: "D",
      reason: "Browser requests reduced motion",
      cinematicAvailable: true,
      static: true,
    };
  }

  if (capabilities.mobile || capabilities.coarsePointer) {
    return {
      tier: "B",
      reason:
        projection === "cinematic"
          ? "Explicit single-plane review cinema"
          : "Single-plane mobile or coarse-pointer projection",
      cinematicAvailable: true,
      static: false,
    };
  }

  return {
    tier: "A",
    reason:
      projection === "cinematic"
        ? "Explicit full review cinema"
        : "Full desktop or tablet projection",
    cinematicAvailable: true,
    static: false,
  };
}

export function resolveCxosDistrictTransitionDuration<
  DistrictId extends string,
>(
  definition: CxosRoomRuntimeDefinition<DistrictId>,
  tier: CxTier,
  contractValid = true,
): number {
  if (
    !contractValid ||
    definition.districtMode !== "chamber" ||
    tier === "C" ||
    tier === "D"
  ) {
    return 0;
  }

  const timing =
    definition.districtTransitionMs ?? DEFAULT_CXOS_DISTRICT_TRANSITION_MS;
  return tier === "A" ? timing.A : timing.B;
}

export function resolveCxosDistrictTransitionDirection<
  DistrictId extends string,
>(
  districtOrder: readonly DistrictId[],
  source: DistrictId,
  target: DistrictId,
): CxosDistrictTransitionDirection {
  if (source === target) return "same";
  const sourceIndex = districtOrder.indexOf(source);
  const targetIndex = districtOrder.indexOf(target);
  if (sourceIndex < 0 || targetIndex < 0) return "same";
  return targetIndex > sourceIndex ? "forward" : "backward";
}

export function deriveCxosRuntimeEnvironment(input: {
  contractValid: boolean;
  tier: CxTier;
  arrivalSettled: boolean;
  departing: boolean;
  documentHidden: boolean;
}): CxosRuntimeEnvironment {
  const phase: CxosRoomPhase = input.departing
    ? "departing"
    : input.arrivalSettled
      ? "operating"
      : "arriving";

  if (!input.contractValid) {
    return {
      contract: "fail-closed",
      phase: "operating",
      motion: "static",
      heartbeat: "static",
      lighting: "static",
      atmosphere: "static",
      kaiPresence: "unavailable",
      scrollActivation: false,
    };
  }

  if (input.tier === "C" || input.tier === "D") {
    return {
      contract: "ready",
      phase: "operating",
      motion: "static",
      heartbeat: "static",
      lighting: "static",
      atmosphere: "static",
      kaiPresence: "static",
      scrollActivation: false,
    };
  }

  if (input.documentHidden) {
    return {
      contract: "ready",
      phase,
      motion: "paused",
      heartbeat: "paused",
      lighting: phase === "departing" ? "departure" : phase === "arriving" ? "arrival" : "operating",
      atmosphere: "paused",
      kaiPresence: "paused",
      scrollActivation: false,
    };
  }

  if (phase === "arriving") {
    return {
      contract: "ready",
      phase,
      motion: "active",
      heartbeat: "paused",
      lighting: "arrival",
      atmosphere: "paused",
      kaiPresence: "acquiring",
      scrollActivation: false,
    };
  }

  if (phase === "departing") {
    return {
      contract: "ready",
      phase,
      motion: "active",
      heartbeat: "paused",
      lighting: "departure",
      atmosphere: "paused",
      kaiPresence: "suspended",
      scrollActivation: false,
    };
  }

  return {
    contract: "ready",
    phase,
    motion: "active",
    heartbeat: "active",
    lighting: "operating",
    atmosphere: "active",
    kaiPresence: "available",
    scrollActivation: true,
  };
}

export function selectCxosActiveDistrict<DistrictId extends string>(
  districtOrder: readonly DistrictId[],
  ratios: ReadonlyMap<DistrictId, number>,
  current: DistrictId,
): DistrictId {
  let next = current;
  let bestRatio = 0;

  for (const district of districtOrder) {
    const ratio = ratios.get(district) ?? 0;
    if (Number.isFinite(ratio) && ratio > bestRatio) {
      next = district;
      bestRatio = ratio;
    }
  }

  return next;
}
