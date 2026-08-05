import {
  cinematicDisabled,
  detectTier,
  type CxTier,
} from "@/lib/cxos/capability";

export type PassageProjection = "auto" | "cinematic" | "static";

export interface PassageCapabilities {
  autoTier: CxTier;
  browserReduced: boolean;
  applicationEffectsOff: boolean;
  saveData: boolean;
  lowMemory: boolean;
  mobile: boolean;
  coarsePointer: boolean;
  detectionFailed: boolean;
}

export interface PassageProjectionResolution {
  tier: CxTier;
  reason: string;
  cinematicAvailable: boolean;
}

const CONSERVATIVE_CAPABILITIES: PassageCapabilities = {
  autoTier: "C",
  browserReduced: false,
  applicationEffectsOff: false,
  saveData: false,
  lowMemory: false,
  mobile: false,
  coarsePointer: false,
  detectionFailed: true,
};

/**
 * Read the existing capability policy once for this review route, then retain
 * the individual signals so the Director can explain the result truthfully.
 * A failed read never upgrades the projection.
 */
export function readPassageCapabilities(): PassageCapabilities {
  try {
    const browserReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const applicationEffectsOff = cinematicDisabled();
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    const saveData = nav.connection?.saveData === true;
    const lowMemory =
      typeof nav.deviceMemory === "number" && nav.deviceMemory < 4;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const coarseShort = window.matchMedia(
      "(max-height: 560px) and (pointer: coarse)"
    ).matches;
    const detected = detectTier();
    // detectTier intentionally catches and fails to C. When neither of C's
    // known constraint signals explains that result, keep it marked as a
    // failed read so an explicit projection can never upgrade it.
    const detectionFailed =
      detected === "C" && !saveData && !lowMemory;

    return {
      autoTier: detected === "A" && coarseShort ? "B" : detected,
      browserReduced,
      applicationEffectsOff,
      saveData,
      lowMemory,
      mobile,
      coarsePointer,
      detectionFailed,
    };
  } catch {
    return CONSERVATIVE_CAPABILITIES;
  }
}

/**
 * Projection policy for this synthetic review route only.
 *
 * Auto preserves the global capability policy. Cinematic may override only
 * motion preferences after explicit review intent; it never upgrades data
 * saver, low-memory, or failed detection. Static is the complete document at
 * rest. This function performs no storage, cookie, server, or browser-setting
 * mutation.
 */
export function resolvePassageProjection(
  projection: PassageProjection,
  capabilities: PassageCapabilities
): PassageProjectionResolution {
  const constrained =
    capabilities.detectionFailed ||
    capabilities.saveData ||
    capabilities.lowMemory;

  if (projection === "static") {
    return {
      tier: "D",
      reason: "Complete static review document",
      cinematicAvailable: !constrained,
    };
  }

  if (projection === "cinematic") {
    if (capabilities.detectionFailed) {
      return {
        tier: "C",
        reason: "Capability detection failed safely",
        cinematicAvailable: false,
      };
    }
    if (capabilities.saveData) {
      return {
        tier: "C",
        reason: "Data Saver keeps this review static",
        cinematicAvailable: false,
      };
    }
    if (capabilities.lowMemory) {
      return {
        tier: "C",
        reason: "Low-memory safety keeps this review static",
        cinematicAvailable: false,
      };
    }
    if (capabilities.mobile || capabilities.coarsePointer) {
      return {
        tier: "B",
        reason: "Single-plane mobile or coarse-pointer cinema",
        cinematicAvailable: true,
      };
    }
    return {
      tier: "A",
      reason: "Full desktop or tablet review cinema",
      cinematicAvailable: true,
    };
  }

  if (capabilities.detectionFailed) {
    return {
      tier: "C",
      reason: "Capability detection failed safely",
      cinematicAvailable: false,
    };
  }
  if (capabilities.browserReduced) {
    return {
      tier: capabilities.autoTier,
      reason: "Browser requests reduced motion",
      cinematicAvailable: !constrained,
    };
  }
  if (capabilities.applicationEffectsOff) {
    return {
      tier: capabilities.autoTier,
      reason: "Application effects are off",
      cinematicAvailable: !constrained,
    };
  }
  if (capabilities.saveData) {
    return {
      tier: capabilities.autoTier,
      reason: "Data Saver is active",
      cinematicAvailable: false,
    };
  }
  if (capabilities.lowMemory) {
    return {
      tier: capabilities.autoTier,
      reason: "Low-memory safety projection",
      cinematicAvailable: false,
    };
  }
  if (capabilities.autoTier === "B") {
    return {
      tier: "B",
      reason: "Single-plane mobile projection",
      cinematicAvailable: true,
    };
  }
  if (capabilities.autoTier === "A") {
    return {
      tier: "A",
      reason: "Full desktop or tablet projection",
      cinematicAvailable: true,
    };
  }
  return {
    tier: capabilities.autoTier,
    reason: "Conservative capability projection",
    cinematicAvailable: !constrained,
  };
}
