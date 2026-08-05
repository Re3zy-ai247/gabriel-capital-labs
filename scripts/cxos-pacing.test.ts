// Run: npx tsx scripts/cxos-pacing.test.ts
//
// SOURCE + SYNC guard for lib/cxos/pacing.ts — the Phase 1A-CX2 (B) pacing
// module (Founder Decision 2026-08-04: "room transitions are too fast").
//
// WHAT THIS HOLDS
//  1. pacing.ts's four owned tokens have the exact retuned values this pass
//     landed on (TRANSFER_TRAVEL_MS, ARRIVAL_SETTLE_MS, DEPARTURE_DWELL_MS,
//     DEPARTURE_FALLBACK_MS), and re-exports (never duplicates) the one
//     marketing-surface constant it cross-references.
//  2. The sync guard: the two CSS-only tokens (ARRIVAL_SETTLE_MS,
//     DEPARTURE_DWELL_MS) match their mirrored :root custom properties in
//     app/globals.css byte-for-byte in value. A CSS keyframe/transition
//     duration cannot read a TS import, so this manual-sync pair is
//     load-bearing — this check is what keeps it honest without build
//     machinery.
//  3. TRANSFER_TRAVEL_MS and DEPARTURE_FALLBACK_MS satisfy the REAL
//     architectural bounds lib/cxos/runtime.ts's own validator enforces
//     (imported and executed here, not re-implemented) — a pacing retune
//     that accidentally invalidates the room contract fails this file, not
//     a live room at runtime.
//  4. No raw magic-number duration is left at the call sites this pass
//     re-pointed (agency-command/stage.tsx's arrivalDurationMs/fallbackMs) —
//     pacing.ts is the only TS source of those tokens.
//  5. Nothing this pass lengthened became non-interruptible: the arrival
//     gate's existing Skip/Escape affordance and the departure ceremony's
//     new Escape-skip (added by this same pass, guarded in depth by
//     scripts/cxos-agency-command.test.ts) are both still present.
//  6. Reduced motion still leaks nothing: tier C/D and the reduced-motion-
//     without-override CSS overrides for every surface this pass touched
//     are unchanged and still force `transition: none` / `animation: none`.
//
// Passage's own default-projection and label-truth guards (Phase 1A-CX2 B's
// two inherited fixes) live in scripts/cxos-passage.test.ts, next to every
// other Passage guard — not duplicated here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateCxosRoomRuntime, type CxosRoomRuntimeDefinition } from "../lib/cxos/runtime";
import {
  ARRIVAL_SETTLE_MS,
  DEPARTURE_DWELL_MS,
  DEPARTURE_FALLBACK_MS,
  MARKETING_TRANSITION_FAILOPEN_MS,
  TRANSFER_TRAVEL_MS,
} from "../lib/cxos/pacing";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const pacing = read("lib/cxos/pacing.ts");
const pacingCode = codeOf(pacing);
const globals = read("app/globals.css");
const stage = read("app/review/agency-command/stage.tsx");
const stageCode = codeOf(stage);
const stageCss = read("app/review/agency-command/agency-command.module.css");
const registry = read("lib/cxos/transitions/registry.ts");

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

// -- 1 · pacing.ts owns the exact retuned values -----------------------------
check(
  "TRANSFER_TRAVEL_MS is the retuned facility-transfer travel dwell",
  TRANSFER_TRAVEL_MS.A === 2200 && TRANSFER_TRAVEL_MS.B === 1000,
);
check(
  "ARRIVAL_SETTLE_MS is the retuned gate -> room crossfade",
  ARRIVAL_SETTLE_MS === 760,
);
check(
  "DEPARTURE_DWELL_MS is the retuned return-ceremony dwell",
  DEPARTURE_DWELL_MS === 900,
);
check(
  "DEPARTURE_FALLBACK_MS is the retuned safety ceiling, and stays a real margin above the dwell it backstops",
  DEPARTURE_FALLBACK_MS === 1400 && DEPARTURE_FALLBACK_MS > DEPARTURE_DWELL_MS,
);
check(
  "the marketing-surface fail-open ceiling is re-exported, not duplicated (registry.ts stays the one numeric source)",
  MARKETING_TRANSITION_FAILOPEN_MS === 1800 &&
    /export \{ TRANSITION_TIMEOUT_MS as MARKETING_TRANSITION_FAILOPEN_MS \} from ["']\.\/transitions\/registry["'];/.test(
      pacingCode,
    ) &&
    !/MARKETING_TRANSITION_FAILOPEN_MS\s*=\s*1800/.test(pacingCode) &&
    /export const TRANSITION_TIMEOUT_MS = 1800;/.test(registry),
);

// -- 2 · the sync guard: pacing.ts <-> app/globals.css -----------------------
function cssCustomProperty(css: string, name: string): number | null {
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)ms;`));
  return match ? Number(match[1]) : null;
}
const cssArrivalSettleMs = cssCustomProperty(globals, "cxos-arrival-settle-ms");
const cssDepartureDwellMs = cssCustomProperty(globals, "cxos-departure-dwell-ms");
check(
  "app/globals.css declares both CXOS PACING custom properties",
  cssArrivalSettleMs !== null && cssDepartureDwellMs !== null,
);
check(
  "--cxos-arrival-settle-ms matches lib/cxos/pacing.ts's ARRIVAL_SETTLE_MS (manual sync, no build machinery)",
  cssArrivalSettleMs === ARRIVAL_SETTLE_MS,
);
check(
  "--cxos-departure-dwell-ms matches lib/cxos/pacing.ts's DEPARTURE_DWELL_MS (manual sync, no build machinery)",
  cssDepartureDwellMs === DEPARTURE_DWELL_MS,
);
check(
  // The literal var(...) fallbacks in the consuming CSS must ALSO agree —
  // catches someone updating pacing.ts/globals.css but leaving a stale
  // fallback behind in the module CSS that consumes them.
  "agency-command.module.css's var(...) fallbacks agree with the same tokens",
  new RegExp(`--cxos-arrival-settle-ms, ${ARRIVAL_SETTLE_MS}ms\\)`).test(stageCss) &&
    new RegExp(`--cxos-departure-dwell-ms, ${DEPARTURE_DWELL_MS}ms\\)`).test(stageCss) &&
    (stageCss.match(new RegExp(`--cxos-departure-dwell-ms, ${DEPARTURE_DWELL_MS}ms\\)`, "g")) ?? [])
      .length === 5 &&
    new RegExp(`--cxos-arrival-duration, ${TRANSFER_TRAVEL_MS.A}ms\\)`).test(stageCss) &&
    new RegExp(`--cxos-arrival-duration, ${TRANSFER_TRAVEL_MS.B}ms\\)`).test(stageCss),
);

// -- 3 · TRANSFER_TRAVEL_MS and DEPARTURE_FALLBACK_MS satisfy the REAL ------
//        architectural bounds (executed, not re-implemented)
const referenceDefinition = {
  roomId: "pacing-reference-room",
  districts: ["only"],
  initialDistrict: "only",
  arrivalBeats: ["identity"],
  arrivalDurationMs: TRANSFER_TRAVEL_MS,
  motionChannels: ["room-breath"],
  departure: { href: "/review/origin", fallbackMs: DEPARTURE_FALLBACK_MS },
} satisfies CxosRoomRuntimeDefinition<"only">;
check(
  "TRANSFER_TRAVEL_MS and DEPARTURE_FALLBACK_MS both satisfy the real room-runtime validator's bounds",
  validateCxosRoomRuntime(referenceDefinition).valid,
);
check(
  "the fallback ceiling stays inside the validator's own 100-1800ms departure-fallback bound even at its new, larger value",
  DEPARTURE_FALLBACK_MS >= 100 && DEPARTURE_FALLBACK_MS <= 1800,
);

// -- 4 · no raw magic-number duration left at the re-pointed call sites -----
check(
  "agency-command/stage.tsx no longer inlines the arrival-duration or departure-fallback literals it used to own",
  !/arrivalDurationMs:\s*\{\s*A:\s*\d+,\s*B:\s*\d+\s*\}/.test(stageCode) &&
    !/fallbackMs:\s*\d+/.test(stageCode) &&
    /arrivalDurationMs: TRANSFER_TRAVEL_MS/.test(stageCode) &&
    /fallbackMs: DEPARTURE_FALLBACK_MS/.test(stageCode) &&
    /from ["']@\/lib\/cxos\/pacing["']/.test(stageCode),
);
check(
  "districtTransitionMs is untouched (intra-room, task's own micro-interaction carve-out) and still hard-capped at 900ms by the validator",
  /districtTransitionMs: \{ A: 620, B: 460 \}/.test(stageCode) &&
    /timing\.A < 450[\s\S]{0,120}timing\.A > 900/.test(codeOf(read("lib/cxos/runtime.ts"))),
);

// -- 5 · nothing lengthened became non-interruptible -------------------------
check(
  "the (lengthened) facility-transfer arrival gate keeps its Skip button and Escape affordance",
  /arrivalSkipRef/.test(stageCode) &&
    /ref=\{arrivalSkipRef\}[\s\S]{0,80}onClick=\{skipArrival\}/.test(stage) &&
    /Skip arrival/.test(stage) &&
    /const skipOnEscape = \(event: KeyboardEvent\) => \{\s*\n\s*if \(event\.key !== "Escape"\) return;/.test(
      codeOf(read("components/cxos/runtime/useCxosRoomRuntime.ts")),
    ),
);
check(
  "the (lengthened) departure ceremony gained its own Escape-skip in this same pass, race-free (departingRef set synchronously at click time, not via a departing-state-keyed effect)",
  /const departingRef = useRef\(false\);/.test(stageCode) &&
    /departingRef\.current = true;/.test(stageCode) &&
    /const skipDepartureOnEscape = \(event: KeyboardEvent\) => \{[\s\S]{0,140}!departingRef\.current\) return;/.test(
      stageCode,
    ) &&
    /commitDeparture\(\);/.test(stageCode),
);

// -- 6 · reduced motion still leaks nothing into tier D ----------------------
check(
  "tier C/D and reduced-motion-without-override still force the arrival gate / facility frame transitions off",
  /\.room\[data-tier="C"\] \.arrivalGate,\s*\n\.room\[data-tier="D"\] \.arrivalGate,\s*\n\.room\[data-tier="C"\] \.facilityFrame,\s*\n\.room\[data-tier="D"\] \.facilityFrame \{\s*\n\s*transition: none;/.test(
    stageCss,
  ) &&
    /@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.room:not\(\[data-motion-override="true"\]\) \.arrivalGate,\s*\n\s*\.room:not\(\[data-motion-override="true"\]\) \.facilityFrame \{\s*\n\s*transition: none;/.test(
      stageCss,
    ),
);
check(
  "tier C/D still forces every .room animation off, including the departure ceremony this pass lengthened",
  /\.room\[data-tier="C"\] \*[\s\S]{0,260}\.room\[data-tier="D"\] \*[\s\S]{0,220}animation:\s*none\s*!important/.test(
    stageCss,
  ),
);
check(
  "departure never even begins its ceremony for tier C/D (belt-and-suspenders: the ceremony code path itself is skipped, not just painted static)",
  /resolution\.tier === "C" \|\|\s*\n\s*resolution\.tier === "D"/.test(
    codeOf(read("components/cxos/runtime/useCxosRoomRuntime.ts")),
  ),
);

console.log(`\ncxos-pacing.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
