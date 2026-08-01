import type {
  CxosChamberEnvironmentProfile,
  CxosLivingEnvironmentDefinition,
} from "@/lib/cxos/runtime";

import { AGENCY_DISTRICTS, type AgencyDistrictId } from "./fixtures";

// Presentation direction only. These profiles describe how the existing
// semantic chambers are framed; they contain no facts, copy, destinations,
// effects, persistence, or authority.
const AGENCY_CHAMBER_ENVIRONMENTS = [
  {
    id: AGENCY_DISTRICTS[0].id,
    emotion: "command-authority",
    camera: "command-wide",
    lighting: "command-aperture",
    depth: "long",
    motion: "center-out",
    focus: "priority-instrument",
    idle: "command-hold",
    kai: "executive-context",
  },
  {
    id: AGENCY_DISTRICTS[1].id,
    emotion: "operational-flow",
    camera: "operational-oblique",
    lighting: "directional-rail",
    depth: "diagonal",
    motion: "lane-travel",
    focus: "operating-floor",
    idle: "parked",
    kai: "operational-context",
  },
  {
    id: AGENCY_DISTRICTS[2].id,
    emotion: "human-coordination",
    camera: "relational-eye-level",
    lighting: "relational-pool",
    depth: "medium",
    motion: "relational-acquire",
    focus: "operator-core",
    idle: "solo-steady",
    kai: "human-context",
  },
  {
    id: AGENCY_DISTRICTS[3].id,
    emotion: "diagnostic-awareness",
    camera: "diagnostic-elevated",
    lighting: "analytical-overhead",
    depth: "compressed",
    motion: "diagnostic-draw",
    focus: "missing-inputs",
    idle: "diagnostic-hold",
    kai: "diagnostic-context",
  },
  {
    id: AGENCY_DISTRICTS[4].id,
    emotion: "evidentiary-trust",
    camera: "archive-perspective",
    lighting: "provenance-slot",
    depth: "longitudinal",
    motion: "tray-align",
    focus: "evidence-ledger",
    idle: "archive-aligned",
    kai: "evidence-context",
  },
  {
    id: AGENCY_DISTRICTS[5].id,
    emotion: "calm-intelligence",
    camera: "executive-portrait",
    lighting: "executive-key",
    depth: "shallow",
    motion: "inward-converge",
    focus: "executive-response",
    idle: "executive-still",
    kai: "focused-channel",
  },
  {
    id: AGENCY_DISTRICTS[6].id,
    emotion: "strategic-expansion",
    camera: "capacity-horizon",
    lighting: "horizon-wedge",
    depth: "maximum",
    motion: "horizon-expand",
    focus: "capacity-boundary",
    idle: "reserve-dark",
    kai: "strategy-context",
  },
] as const satisfies readonly CxosChamberEnvironmentProfile<AgencyDistrictId>[];

export const AGENCY_LIVING_ENVIRONMENT = {
  profileId: "agency-headquarters-living-environment",
  idleAfterMs: {
    A: 6000,
    B: 4500,
  },
  chambers: AGENCY_CHAMBER_ENVIRONMENTS,
} as const satisfies CxosLivingEnvironmentDefinition<AgencyDistrictId>;
