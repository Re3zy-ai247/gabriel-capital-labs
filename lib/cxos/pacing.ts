// CXOS Phase 1A-CX2 (B) — the pacing law.
//
// Founder Decision (2026-08-04): "Room transitions are too fast. The
// Founder cannot comfortably read or experience the transition content
// before the next room appears." The law this file enforces: CALM ·
// PREMIUM · DELIBERATE · READABLE · NOT TEDIOUS. Enough time for room-title
// recognition, transition-copy recognition, spatial orientation, and
// emotional pacing — never a sluggish or blocking wait, and never
// non-interruptible (every surface a token here paces keeps its existing
// skip/advance affordance; "input accelerates" is the house pattern).
//
// ONE PLACE TO TUNE: every room-to-room / facility-transfer pacing number
// this pass touched is named and commented HERE. Re-tune by editing a
// value below, not by hunting through components or CSS.
//
// DELIBERATELY NOT HERE — these are pre-existing, already-centralized,
// already test-pinned sources of truth; duplicating their numbers here
// would create the exact "scattered magic numbers" problem this file
// exists to prevent, so they are cross-referenced instead of copied:
//   - lib/cxos/passageTimeline.ts — THE PASSAGE (Mission Control -> Arena).
//     JOURNEY_END_MS is already 11.8s; the Founder decision explicitly
//     says do NOT lengthen it. That file is already its own single source
//     of truth (own header, own safety-ordering law, own guard script
//     scripts/cxos-passage.test.ts) and stays exactly as it is.
//   - components/cxos/Threshold.tsx's `DUR = 10` — already deliberate,
//     already guard-pinned indirectly via scripts/cxos-threshold.test.ts's
//     watchdog check; unchanged by this pass.
//   - components/cxos/mission/MissionEntry.tsx (7300ms first-entry /
//     1100ms returning) and components/cxos/arena/ArenaEntry.tsx (8600ms
//     first-entry / 1100ms returning) — both already land inside the
//     ratified 7-12s first-entry law (see each file's own header comment)
//     with individual beats of 1.3-1.8s, comfortably above every
//     readability floor this pass would otherwise set. MissionEntry's
//     exact values are further exact-value guard-pinned
//     (scripts/cxos-mission.test.ts: `arm(() => finish(), 7300)` /
//     `arm(() => finish(), 1100)`). Retuning either would be pure
//     regression risk on a surface that measurement shows is NOT the
//     source of the Founder's complaint. Left untouched by design.
//
// CSS-ONLY VALUES: a CSS keyframe/transition duration cannot read a TS
// import, so the two durations below that are consumed purely in CSS are
// mirrored as :root custom properties in app/globals.css (search "CXOS
// PACING" there). Keep both sides equal by hand when retuning either one;
// scripts/cxos-pacing.test.ts greps both files and fails the sweep if they
// diverge.

/**
 * Agency Command's facility-transfer arrival gate: how long the incoming
 * room's own arrival gate dwells — its cascading identity / activation-rail
 * / Kai-greeting reveal — before the real chamber is allowed to settle in
 * underneath it. Consumed via the `--cxos-arrival-duration` custom property
 * (set inline per resolved tier by useCxosRoomRuntime) that
 * agency-command.module.css's `.arrivalClock` reads, both the tier-A rule
 * and its tier-B override.
 *
 * Was `{ A: 1500, B: 700 }`. At tier A the gate's own last-revealed element
 * (the Kai brief, `agencyKaiArrive 620ms` delayed `760ms`) only finished
 * appearing at 1380ms — 120ms before the 1500ms clock fired and the gate
 * began dissolving. At tier B the last beat (`arrivalActions`, delayed
 * `500ms` + `180ms`) finished at 680ms against a 700ms budget — 20ms of
 * margin. Neither tier gave the Founder time to actually read the fully
 * revealed gate before it moved on. Bounds enforced by
 * lib/cxos/runtime.ts's validateCxosRoomRuntime (A: 100-2500ms, B <= A).
 */
export const TRANSFER_TRAVEL_MS = { A: 2200, B: 1000 } as const;

/**
 * Agency Command: the crossfade from the arrival gate to the real,
 * interactive chamber once the transfer settles — the "settle" half of
 * transfer pacing (TRANSFER_TRAVEL_MS is the "travel" half). Mirrored as
 * `--cxos-arrival-settle-ms` in app/globals.css; consumed by
 * agency-command.module.css's `.arrivalGate` and `.facilityFrame` opacity
 * transitions. Was 220ms — an abrupt cut straight from the gate's finished
 * frame into the room.
 */
export const ARRIVAL_SETTLE_MS = 760;

/**
 * Agency Command -> Mission Control departure ceremony (facility transfer,
 * return direction): how long "OPERATING STATE ACKNOWLEDGED / KAI HANDOFF ·
 * MISSION CONTROL ACQUIRED" holds before the page navigates away. Mirrored
 * as `--cxos-departure-dwell-ms` in app/globals.css; consumed by
 * agency-command.module.css's five `.departureHandoff`-family animations
 * (agencyReturnHandoff / agencyReturnLabel / agencyReturnAxis /
 * agencyExitArchitecture / agencyExitThreshold — all fire together, `both`
 * fill mode). Was 460ms — not enough to read two acknowledgement lines
 * before the navigation fired. Escape still skips straight to the
 * navigation (stage.tsx wires it directly to the same commitDeparture the
 * animation's own onAnimationEnd calls) — lengthening this never makes the
 * exit non-interruptible.
 */
export const DEPARTURE_DWELL_MS = 900;

/**
 * Safety-net ceiling for the departure ceremony: if the CSS animation's
 * `animationend` never fires (a backgrounded tab, a dropped frame), force
 * the navigation this long after the click regardless. Always comfortably
 * above DEPARTURE_DWELL_MS so the natural animation end — not this fallback
 * — is what a healthy departure actually resolves on. Bounds enforced by
 * lib/cxos/runtime.ts's validateCxosRoomRuntime (100-1800ms). Was 800ms;
 * raised to stay a safety margin above the new 900ms dwell rather than
 * beneath it.
 */
export const DEPARTURE_FALLBACK_MS = 1400;

/**
 * Marketing-surface route transitions (TransitionShell / the pricing-resolve
 * entry in lib/cxos/transitions/registry.ts): the fail-open ceiling from
 * click to guaranteed arrival if the destination never paints. Re-exported
 * (not duplicated) from that registry, which stays the canonical, guard-
 * pinned home for it (scripts/cxos-journey.test.ts checks the literal
 * `TRANSITION_TIMEOUT_MS = 1800` in registry.ts's own source) and for the
 * rest of that registry's timing (coverMs/openMs remain governed by the
 * separate, already-ratified Level 3 duration law — a marketing-surface
 * concern, not a cxos room, and out of this pass's scope). Unit: ms.
 * Unchanged by this pass: it is a safety margin, not a perceived-pacing
 * number, and the actual transition it bounds (max ~940ms tier A) was not
 * part of the Founder's "rooms" complaint.
 */
export { TRANSITION_TIMEOUT_MS as MARKETING_TRANSITION_FAILOPEN_MS } from "./transitions/registry";

/**
 * Phase 1A-CX2 (C) — the Founder Walkthrough's OWN step-to-step hand-off:
 * the crossfade the orchestrator shell (app/review/cxos/stage.tsx) plays
 * between two composed rooms whenever it advances/rewinds/replays a step.
 * Genuinely missing before this pass — no existing token covers "the
 * orchestrator's own hop," as distinct from a room's own entry ceremony
 * (Threshold, MissionEntry, ArenaEntry, Agency Command's arrival gate, The
 * Passage's own call/clearance/passage sequence all keep playing exactly as
 * they already do; this number only covers the hand-off around them, never
 * a substitute for one). Deliberately the SAME number lib/cxos/capability.ts
 * already documents as tier C's own "minimal crossfade" floor (see CxTier's
 * doc comment) — this borrows that already-ratified value rather than
 * inventing a new one. Applies only outside tier D (reduced motion / the
 * cinematic-off toggle) — the walkthrough shell adds no inline style at all
 * under tier D, so nothing new ever animates under PRM.
 */
export const WALKTHROUGH_STEP_CROSSFADE_MS = 280;
