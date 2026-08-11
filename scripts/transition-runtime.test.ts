// Run: npx tsx scripts/transition-runtime.test.ts
//
// DETERMINISTIC GUARD for the T1 Cinematic Transition Runtime foundation
// (lib/transition-runtime/*). Behavioural coverage drives the pure machine
// ONLY through its public API (createJourneyMachine) with an injected manual
// clock — no real timers, fully deterministic, matches T1-SPEC.md §6.
//
// WHAT THIS HOLDS (T1-SPEC.md §6, numbered 1-16 to match the spec exactly)
//   1. Happy path (full event order, commit-once).
//   2. Immediate mode (tier C/D): synchronous, zero timers, zero veil.
//   3. Double navigation pre-commit: supersede kills the stale timer.
//   4. Double navigation post-commit: ignored, in-flight journey untouched.
//   5. ready(): before-traveling no-op, stale-sequence no-op, duplicate idempotent.
//   6. Ready timeout forces arrival, then settles via arrivingMs.
//   7. Hard cap force-settles from three different stuck phases.
//   8. Cancel (intent/departing) -> recovering -> settled(origin); no commit.
//   9. Cancel post-commit is a total no-op.
//  10. fail() mid-traveling -> recovering -> settled(origin) + failure event.
//  11. destroy() mid-journey clears every timer; nothing fires after.
//  12. Sequence numbers are strictly monotonic, never reused.
//  13. Unsubscribed listeners stop receiving notifications.
//  14. Tier B pacing is genuinely shorter and precisely honoured.
//  15. Commit-exactly-once, swept across every scenario above.
//  16. Event-order pinning for the happy path.
// Plus static structural guards: machine/pacing/types purity (no
// react/next/DOM), pacing.ts numeric sync to spec §3, and the isolation gate
// (git diff + git status vs a72a47c touches only the T1 file allowlist).
//
// T1.2 REGRESSION CASES (Opus adversarial gate fix pass — additions beyond
// the spec's original 16, numbered 17-19, never a renumbering of the above):
//  17. Fix 6 (machine seeding): a seeded `initial` destination is the first
//      journey's origin; cancel/recovery returns to the seed, not null.
//  18. Fix 5 (pinned inequality): departingMs + readyTimeoutMs + arrivingMs
//      < hardCapMs, tiers A and B — the hard cap can never truncate a
//      genuine fail-open arrival already in flight.
//  19. Fix 3 (machine-testable slice): ready() is only valid once BOTH
//      "traveling" AND `destination.id` identify the calling room — the
//      exact predicate RoomReady.tsx's subscription checks. (Self-nav
//      rejection is adapter-level, `window.location`-based, and out of
//      scope for this pure-machine suite.)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createJourneyMachine } from "../lib/transition-runtime/machine";
import { JOURNEY_PACING } from "../lib/transition-runtime/pacing";

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

// ── manual clock: an ordered timer queue, no real timers anywhere ──────────
function createManualClock() {
  let now = 0;
  let nextId = 1;
  let queue: { id: number; fireAt: number; cb: () => void }[] = [];

  // `any` is deliberate here: the real JourneyClock's timer-handle type
  // belongs to lib/transition-runtime/types.ts (Implementer's file) and is
  // intentionally not imported into this suite, so the manual clock only
  // needs to be a structurally-compatible {setTimeout,clearTimeout} pair,
  // whatever concrete handle type the shipped interface settles on.
  function setTimeoutImpl(cb: () => void, ms?: number): any {
    const id = nextId++;
    queue.push({ id, fireAt: now + Math.max(0, ms ?? 0), cb });
    return id;
  }
  function clearTimeoutImpl(id?: any): void {
    if (id === undefined || id === null) return;
    queue = queue.filter((t) => t.id !== id);
  }
  function advance(ms: number): void {
    const target = now + Math.max(0, ms);
    // Process every timer due at or before `target`, strictly in fireAt
    // order (ties broken by scheduling order). Never skip ahead of an
    // earlier-due timer — a stale/superseded timer that a bug left armed
    // gets every chance to (wrongly) fire before we'd notice it didn't.
    for (;;) {
      queue.sort((a, b) => a.fireAt - b.fireAt || a.id - b.id);
      const next = queue[0];
      if (!next || next.fireAt > target) break;
      now = next.fireAt;
      queue.shift();
      next.cb();
    }
    now = target;
  }

  return {
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
    advance,
    get pendingCount(): number {
      return queue.length;
    },
    get nowMs(): number {
      return now;
    },
  };
}

// ── harness ──────────────────────────────────────────────────────────────
type Harness = {
  label: string;
  clock: ReturnType<typeof createManualClock>;
  machine: ReturnType<typeof createJourneyMachine>;
  effects: any[];
  events: any[];
  states: any[];
};

// Every harness self-registers here so §15 (commit-exactly-once) can sweep
// ALL scenarios, per spec: "across every scenario above."
const allHarnesses: Harness[] = [];

function harness(label: string, opts?: { pacing?: any; initial?: any }): Harness {
  const clock = createManualClock();
  const effects: any[] = [];
  const events: any[] = [];
  const states: any[] = [];
  // Callback params are explicitly `any` (not left to contextual inference)
  // so this file's typecheck stays clean and single-cause even at a moment
  // when lib/transition-runtime/machine.ts hasn't landed yet: a missing
  // module already fails the import below with TS2307, and contextual
  // inference from a failed import degrades to implicit `any` — an explicit
  // annotation here prevents that from cascading into separate noImplicitAny
  // errors that would look like bugs in this file rather than a landing-
  // order artifact. Once the real module exists, `any` is still structurally
  // assignable to whatever its actual parameter types are.
  const machine = createJourneyMachine({
    clock,
    pacing: opts?.pacing,
    // T1.2 fix 6 (machine seeding): `opts?.initial` — used by the seeding
    // regression cases below; `undefined` preserves every pre-T1.2 harness's
    // original unseeded behaviour exactly.
    initial: opts?.initial,
    onEffect: (effect: any) => {
      effects.push(effect);
    },
    onEvent: (event: any) => {
      events.push(event);
    },
  });
  machine.subscribe((s: any) => {
    states.push(s);
  });
  const h: Harness = { label, clock, machine, effects, events, states };
  allHarnesses.push(h);
  return h;
}

function isCommit(e: any): boolean {
  return !!e && e.type === "commit";
}
/** JourneyEvent is a discriminated-union OBJECT (types.ts), not a bare
 * string — every event-name check goes through this to read `.type`. */
function eventTypes(h: Harness): string[] {
  return h.events.map((e: any) => e?.type);
}
function makeDestination(id: string) {
  return {
    id,
    href: `/review/transition-runtime/${id}`,
    label: id.charAt(0).toUpperCase() + id.slice(1),
  };
}
function cinematic(tier: "A" | "B") {
  return { mode: "cinematic" as const, tier };
}
function immediate(tier: "C" | "D") {
  return { mode: "immediate" as const, tier };
}
/** Drive a harness to a fully-settled room via the ordinary happy path, so a
 * later journey's "origin" is an unambiguous, previously-settled room rather
 * than the degenerate never-navigated-yet (null) case. traveling->arriving
 * is gated on BOTH the travelMinMs floor AND readiness (whichever settles
 * last wins) — so travelMinMs must elapse before/at the ready() call, or the
 * journey sticks in "traveling" waiting on the floor. */
function primeToRoom(h: Harness, dest: ReturnType<typeof makeDestination>, tier: "A" | "B" = "A") {
  h.machine.request(dest, cinematic(tier));
  h.clock.advance(JOURNEY_PACING.departingMs[tier]);
  h.clock.advance(JOURNEY_PACING.travelMinMs[tier]);
  h.machine.ready(h.machine.state().sequence);
  h.clock.advance(JOURNEY_PACING.arrivingMs[tier]);
}

// ── 1 · happy path ───────────────────────────────────────────────────────
{
  const h = harness("1-happy-path");
  const dest = makeDestination("operations");
  const seqBefore = h.machine.state().sequence;

  const accepted = h.machine.request(dest, cinematic("A"));
  check("1a: request() is accepted (returns true)", accepted === true);
  const afterRequest = h.machine.state();
  check("1b: sequence increments on accepted request", afterRequest.sequence > seqBefore);
  check(
    "1c: synchronously past intent into departing (intent has no independent duration)",
    afterRequest.phase === "departing",
  );
  check("1d: destination is recorded immediately", afterRequest.destination?.id === dest.id);
  check("1e: no commit effect yet (pre-commit)", h.effects.filter(isCommit).length === 0);

  h.clock.advance(JOURNEY_PACING.departingMs.A);
  const afterDeparting = h.machine.state();
  check("1f: departingMs elapsed -> traveling", afterDeparting.phase === "traveling");
  check(
    "1g: exactly one commit effect fired at the departing->traveling boundary",
    h.effects.filter(isCommit).length === 1,
  );
  const commitEffect = h.effects.find(isCommit);
  check(
    "1h: the commit effect names the destination and current sequence",
    commitEffect?.destination?.id === dest.id && commitEffect?.sequence === afterDeparting.sequence,
  );

  // Signal ready only after travelMinMs.A has elapsed, so this step is valid
  // whether or not the implementation defers an early ready() until the
  // minimum travel hold — that nuance isn't pinned by any of the 16 cases.
  h.clock.advance(JOURNEY_PACING.travelMinMs.A);
  h.machine.ready(afterDeparting.sequence);
  const afterReady = h.machine.state();
  check("1i: ready() (post travel-min-hold) -> arriving", afterReady.phase === "arriving");
  check("1j: still exactly one commit effect (ready never re-commits)", h.effects.filter(isCommit).length === 1);

  h.clock.advance(JOURNEY_PACING.arrivingMs.A);
  const afterArriving = h.machine.state();
  check(
    "1k: arrivingMs elapsed -> settled(destination)",
    afterArriving.phase === "settled" && afterArriving.destination?.id === dest.id,
  );
  check("1l: still exactly one commit effect at the end of the happy path", h.effects.filter(isCommit).length === 1);
  check("1m: no timers remain armed once settled", h.clock.pendingCount === 0);
}

// ── 2 · immediate mode ───────────────────────────────────────────────────
{
  const h = harness("2-immediate-mode-tier-c");
  const dest = makeDestination("archive");
  const accepted = h.machine.request(dest, immediate("C"));
  check("2a: immediate request accepted", accepted === true);
  const s = h.machine.state();
  check("2b: settles synchronously — no clock advance needed", s.phase === "settled");
  check("2c: destination recorded", s.destination?.id === dest.id);
  check("2d: exactly one commit effect fired", h.effects.filter(isCommit).length === 1);
  check("2e: no timers were ever armed (no departing/traveling/arriving phase, no veil)", h.clock.pendingCount === 0);
  check(
    "2f: none of the cinematic-only phase events fired",
    !eventTypes(h).includes("departed") &&
      !eventTypes(h).includes("travel") &&
      !eventTypes(h).includes("ready") &&
      !eventTypes(h).includes("arrived"),
  );

  const h2 = harness("2-immediate-mode-tier-d");
  const dest2 = makeDestination("atrium");
  h2.machine.request(dest2, immediate("D"));
  check(
    "2g: tier D immediate also settles synchronously with zero timers",
    h2.machine.state().phase === "settled" && h2.clock.pendingCount === 0,
  );
}

// ── 3 · double navigation pre-commit: supersede kills the stale timer ────
{
  const h = harness("3-double-nav-pre-commit");
  const destA = makeDestination("operations");
  const destB = makeDestination("archive");
  h.machine.request(destA, cinematic("A"));
  const seqA = h.machine.state().sequence;

  h.clock.advance(50); // deliberate gap so stale-timer detection is unambiguous
  const acceptedB = h.machine.request(destB, cinematic("A"));
  check("3a: the superseding request is accepted (true), not ignored", acceptedB === true);
  const afterSupersede = h.machine.state();
  check("3b: sequence bumps on supersede", afterSupersede.sequence > seqA);
  check("3c: destination is the NEW target", afterSupersede.destination?.id === destB.id);
  check("3d: restarted into departing for the new sequence", afterSupersede.phase === "departing");

  // A's original departingMs.A timer would have fired at absolute t=280 had
  // it survived the supersede. Advance to exactly that moment and prove
  // nothing fired for the superseded (stale) sequence.
  h.clock.advance(JOURNEY_PACING.departingMs.A - 50);
  check(
    "3e: at A's original scheduled fire time, still no commit (A's stale timer is dead)",
    h.effects.filter(isCommit).length === 0,
  );
  check(
    "3f: still departing under B's sequence (B's own timer isn't due yet)",
    h.machine.state().phase === "departing" && h.machine.state().destination?.id === destB.id,
  );

  // Now let B's own departingMs.A timer (armed at t=50) elapse.
  h.clock.advance(50);
  const afterBCommits = h.machine.state();
  check("3g: B's own departing timer fires -> traveling", afterBCommits.phase === "traveling");
  check(
    "3h: exactly one commit ever fired, and it is for B / the current sequence",
    h.effects.filter(isCommit).length === 1 && h.effects.find(isCommit)?.destination?.id === destB.id,
  );
}

// ── 4 · double navigation post-commit: ignored, in-flight journey untouched
{
  const h = harness("4-double-nav-post-commit");
  const destA = makeDestination("operations");
  const destB = makeDestination("archive");
  h.machine.request(destA, cinematic("A"));
  h.clock.advance(JOURNEY_PACING.departingMs.A);
  const beforeSecond = h.machine.state();
  check("4a: precondition — journey is post-commit (traveling)", beforeSecond.phase === "traveling");
  const commitsBefore = h.effects.filter(isCommit).length;

  const acceptedB = h.machine.request(destB, cinematic("A"));
  check("4b: post-commit request() returns false", acceptedB === false);
  check("4c: an 'ignored' event is recorded for instrumentation", eventTypes(h).includes("ignored"));
  const afterSecond = h.machine.state();
  check(
    "4d: the in-flight journey is unaffected (same phase/destination/sequence)",
    afterSecond.phase === beforeSecond.phase &&
      afterSecond.destination?.id === beforeSecond.destination?.id &&
      afterSecond.sequence === beforeSecond.sequence,
  );
  check("4e: no new commit effect fired for the ignored request", h.effects.filter(isCommit).length === commitsBefore);
}

// ── 5 · ready(): before-traveling no-op, stale-sequence no-op, duplicate idempotent
{
  const h1 = harness("5-1-ready-before-traveling");
  const dest = makeDestination("operations");
  h1.machine.request(dest, cinematic("A"));
  const seq = h1.machine.state().sequence;
  check("5-1a: precondition — still departing (pre-commit)", h1.machine.state().phase === "departing");
  h1.machine.ready(seq);
  check("5-1b: ready() while departing does not advance phase", h1.machine.state().phase === "departing");
  check("5-1c: ready() while departing fires no commit", h1.effects.filter(isCommit).length === 0);

  const h2 = harness("5-2-stale-sequence-and-duplicate-ready");
  const destA = makeDestination("operations");
  const destB = makeDestination("archive");
  h2.machine.request(destA, cinematic("A"));
  h2.clock.advance(JOURNEY_PACING.departingMs.A);
  const seqOld = h2.machine.state().sequence;
  check("5-2a: journey A committed", h2.machine.state().phase === "traveling");
  h2.clock.advance(JOURNEY_PACING.travelMinMs.A); // satisfy the min-hold floor before ready()
  h2.machine.ready(seqOld);
  h2.clock.advance(JOURNEY_PACING.arrivingMs.A);
  check(
    "5-2b: journey A settled at its destination",
    h2.machine.state().phase === "settled" && h2.machine.state().destination?.id === destA.id,
  );

  const acceptedB = h2.machine.request(destB, cinematic("A"));
  h2.clock.advance(JOURNEY_PACING.departingMs.A);
  const seqNew = h2.machine.state().sequence;
  check(
    "5-2c: journey B is now traveling with a NEWER sequence",
    acceptedB === true && h2.machine.state().phase === "traveling" && seqNew > seqOld,
  );

  const commitsBeforeStaleReady = h2.effects.filter(isCommit).length;
  h2.machine.ready(seqOld); // the stale, already-settled sequence
  check("5-2d: ready(oldSequence) is a no-op — B's phase is unaffected", h2.machine.state().phase === "traveling");
  check(
    "5-2e: ready(oldSequence) fires no new commit",
    h2.effects.filter(isCommit).length === commitsBeforeStaleReady,
  );

  h2.clock.advance(JOURNEY_PACING.travelMinMs.A); // satisfy the min-hold floor before THIS ready()
  h2.machine.ready(seqNew);
  check("5-2f: ready(currentSequence) DOES advance the current journey", h2.machine.state().phase === "arriving");

  const commitsBeforeDuplicate = h2.effects.filter(isCommit).length;
  h2.machine.ready(seqNew);
  check("5-3a: a duplicate ready() for the same sequence does not change phase", h2.machine.state().phase === "arriving");
  check(
    "5-3b: a duplicate ready() fires no additional commit",
    h2.effects.filter(isCommit).length === commitsBeforeDuplicate,
  );
}

// ── 6 · ready timeout forces arrival, then settles via arrivingMs ────────
{
  // Hard cap neutralised so this isolates the readyTimeout mechanism alone
  // (with the shipped constants, the never-ready pessimal path always makes
  // the hard cap the true cause of settlement — see §7-1's sanity check —
  // so testing readyTimeout -> arrivingMs -> settled cleanly needs it out
  // of the way).
  const h = harness("6-ready-timeout", { pacing: { hardCapMs: 999_999 } });
  const dest = makeDestination("operations");
  h.machine.request(dest, cinematic("A"));
  h.clock.advance(JOURNEY_PACING.departingMs.A);
  check("6a: committed, now traveling", h.machine.state().phase === "traveling");
  const commitsAfterDeparting = h.effects.filter(isCommit).length;

  h.clock.advance(JOURNEY_PACING.readyTimeoutMs); // never call ready()
  const afterTimeout = h.machine.state();
  check("6b: no ready signal -> readyTimeoutMs forces arriving", afterTimeout.phase === "arriving");
  // types.ts's JourneyReadyEvent is explicit: "never fires for a
  // readyTimeoutMs force-advance" — a genuine ready() call is required.
  check(
    "6c: a forced (readyTimeoutMs) advance does NOT emit a genuine 'ready' event",
    !eventTypes(h).includes("ready"),
  );
  check("6d: forcing arrival does not itself commit again", h.effects.filter(isCommit).length === commitsAfterDeparting);

  h.clock.advance(JOURNEY_PACING.arrivingMs.A);
  const afterArriving = h.machine.state();
  check(
    "6e: arrivingMs elapses naturally -> settled(destination)",
    afterArriving.phase === "settled" && afterArriving.destination?.id === dest.id,
  );
  check("6f: still exactly one commit total across the whole fallback path", h.effects.filter(isCommit).length === 1);
  check("6g: no timers remain armed once settled", h.clock.pendingCount === 0);
}

// ── 7 · hard cap force-settles from any non-settled phase ────────────────
{
  // T1.2 fix 5 retuned readyTimeoutMs to 1000ms specifically so the SHIPPED
  // never-ready fallback chain (280 + 1000 + 360 = 1640ms) stays UNDER
  // hardCapMs (1800ms) — see the pinned inequality guard (§18 below): the
  // hard cap must never be reachable while a genuine fail-open fallback is
  // still naturally in flight. That means this sub-case's ORIGINAL premise
  // (the default, unmodified chain exceeding hardCapMs) is now false by
  // design — proving it true would mean fix 5 regressed. This harness
  // instead overrides readyTimeoutMs to an artificially huge value so it
  // still exercises "hard cap force-settles a journey that is genuinely
  // stuck", without contradicting the production inequality it's pinned
  // against.
  const h1 = harness("7-1-hardcap-over-fallback-chain", {
    pacing: { readyTimeoutMs: 50_000 },
  });
  const dest = makeDestination("operations");
  h1.machine.request(dest, cinematic("A"));
  h1.clock.advance(JOURNEY_PACING.departingMs.A);
  check("7-1a: committed", h1.effects.filter(isCommit).length === 1);
  check(
    "7-1 (pacing sanity): with this harness's outsized readyTimeoutMs override, the fallback chain would exceed hardCapMs",
    JOURNEY_PACING.departingMs.A + 50_000 + JOURNEY_PACING.arrivingMs.A > JOURNEY_PACING.hardCapMs,
  );
  check(
    "7-1 (pacing sanity, production values): the SHIPPED readyTimeoutMs keeps the real fallback chain strictly under hardCapMs — see §18's pinned guard",
    JOURNEY_PACING.departingMs.A + JOURNEY_PACING.readyTimeoutMs + JOURNEY_PACING.arrivingMs.A <
      JOURNEY_PACING.hardCapMs,
  );
  const remaining = JOURNEY_PACING.hardCapMs - JOURNEY_PACING.departingMs.A;
  h1.clock.advance(remaining); // cumulative elapsed == hardCapMs
  const afterHardCap = h1.machine.state();
  check(
    "7-1b: hard cap force-settles at the destination",
    afterHardCap.phase === "settled" && afterHardCap.destination?.id === dest.id,
  );
  check("7-1c: commit is still exactly once (no double commit from the hard cap)", h1.effects.filter(isCommit).length === 1);
  check("7-1d: no timers remain armed", h1.clock.pendingCount === 0);

  const h2 = harness("7-2-hardcap-from-departing", {
    pacing: { departingMs: { A: 50_000, B: 50_000 }, hardCapMs: 500 },
  });
  const dest2 = makeDestination("archive");
  h2.machine.request(dest2, cinematic("A"));
  check(
    "7-2a: precondition — stuck pre-commit in departing",
    h2.machine.state().phase === "departing" && h2.effects.filter(isCommit).length === 0,
  );
  h2.clock.advance(500);
  const afterHardCap2 = h2.machine.state();
  check(
    "7-2b: hard cap force-settles at the destination even though departing never naturally elapsed",
    afterHardCap2.phase === "settled" && afterHardCap2.destination?.id === dest2.id,
  );
  check(
    "7-2c: hard cap forces the (only) commit effect itself when firing pre-commit",
    h2.effects.filter(isCommit).length === 1,
  );
  check("7-2d: no timers remain armed", h2.clock.pendingCount === 0);

  const h3 = harness("7-3-hardcap-from-traveling", {
    pacing: { readyTimeoutMs: 50_000, hardCapMs: 600, departingMs: { A: 100, B: 100 } },
  });
  const dest3 = makeDestination("atrium");
  h3.machine.request(dest3, cinematic("A"));
  h3.clock.advance(100);
  check(
    "7-3a: precondition — committed, now stuck traveling (readyTimeout neutralised)",
    h3.machine.state().phase === "traveling" && h3.effects.filter(isCommit).length === 1,
  );
  h3.clock.advance(500); // total 600 == hardCapMs
  const afterHardCap3 = h3.machine.state();
  check(
    "7-3b: hard cap force-settles at the destination from traveling",
    afterHardCap3.phase === "settled" && afterHardCap3.destination?.id === dest3.id,
  );
  check("7-3c: still exactly one commit (already committed at traveling entry)", h3.effects.filter(isCommit).length === 1);
  check("7-3d: no timers remain armed", h3.clock.pendingCount === 0);
}

// ── 8 · cancel (intent/departing) -> recovering -> settled(origin) ───────
{
  const h1 = harness("8-1-cancel-immediately");
  const atrium = makeDestination("atrium");
  const ops = makeDestination("operations");
  primeToRoom(h1, atrium); // priming itself commits once — snapshot below, don't assume zero
  check(
    "8-1 precondition: primed to atrium",
    h1.machine.state().phase === "settled" && h1.machine.state().destination?.id === atrium.id,
  );
  const commitsBefore1 = h1.effects.filter(isCommit).length;
  h1.machine.request(ops, cinematic("A"));
  h1.machine.cancel("test-immediate");
  const s1 = h1.machine.state();
  check(
    "8-1a: cancel immediately after request settles back at the ORIGIN room, not the cancelled destination",
    s1.phase === "settled" && s1.destination?.id === atrium.id && s1.origin?.id === atrium.id,
  );
  check("8-1b: no commit fired for the cancelled journey", h1.effects.filter(isCommit).length === commitsBefore1);
  check("8-1c: a 'cancelled' event is emitted", eventTypes(h1).includes("cancelled"));
  check("8-1d: no timers remain armed", h1.clock.pendingCount === 0);

  const h2 = harness("8-2-cancel-mid-departing");
  const atrium2 = makeDestination("atrium");
  const archive = makeDestination("archive");
  primeToRoom(h2, atrium2); // priming itself commits once — snapshot below, don't assume zero
  const commitsBefore2 = h2.effects.filter(isCommit).length;
  h2.machine.request(archive, cinematic("A"));
  h2.clock.advance(Math.floor(JOURNEY_PACING.departingMs.A / 2));
  check(
    "8-2a: precondition — still departing, not yet committed for this journey",
    h2.machine.state().phase === "departing" && h2.effects.filter(isCommit).length === commitsBefore2,
  );
  h2.machine.cancel("test-mid-departing");
  const s2 = h2.machine.state();
  check(
    "8-2b: cancel mid-departing settles back at the origin room",
    s2.phase === "settled" && s2.destination?.id === atrium2.id,
  );
  check("8-2c: no commit fired for the cancelled journey", h2.effects.filter(isCommit).length === commitsBefore2);
  check("8-2d: a 'cancelled' event is emitted", eventTypes(h2).includes("cancelled"));
  check("8-2e: departing's own timer is torn down (queue empty, no stale fire possible)", h2.clock.pendingCount === 0);

  h2.clock.advance(JOURNEY_PACING.departingMs.A * 10);
  check(
    "8-2f: advancing far past the original departing schedule fires nothing new",
    h2.effects.filter(isCommit).length === commitsBefore2 && h2.machine.state().phase === "settled",
  );
}

// ── 9 · cancel post-commit is a total no-op ───────────────────────────────
{
  const h = harness("9-cancel-post-commit-noop");
  const atrium = makeDestination("atrium");
  const ops = makeDestination("operations");
  primeToRoom(h, atrium);
  h.machine.request(ops, cinematic("A"));
  h.clock.advance(JOURNEY_PACING.departingMs.A);
  const before = h.machine.state();
  check("9 precondition: post-commit (traveling)", before.phase === "traveling");
  const eventsBefore = h.events.length;
  const effectsBefore = h.effects.length;

  h.machine.cancel("too-late");
  const after = h.machine.state();
  check(
    "9a: post-commit cancel() is a no-op — phase/destination/sequence unchanged",
    after.phase === before.phase &&
      after.destination?.id === before.destination?.id &&
      after.sequence === before.sequence,
  );
  check("9b: no new event was emitted by the no-op cancel", h.events.length === eventsBefore);
  check("9c: no new effect was emitted by the no-op cancel", h.effects.length === effectsBefore);
}

// ── 10 · fail() mid-traveling -> recovering -> settled(origin) + failure event
{
  const h = harness("10-fail-mid-traveling");
  const atrium = makeDestination("atrium");
  const ops = makeDestination("operations");
  primeToRoom(h, atrium); // priming itself commits once — snapshot below, don't assume absolute counts
  const commitsBeforeThisJourney = h.effects.filter(isCommit).length;
  h.machine.request(ops, cinematic("A"));
  h.clock.advance(JOURNEY_PACING.departingMs.A);
  check(
    "10 precondition: post-commit (traveling), exactly one NEW commit for this journey",
    h.machine.state().phase === "traveling" && h.effects.filter(isCommit).length === commitsBeforeThisJourney + 1,
  );

  h.machine.fail("route-change");
  const after = h.machine.state();
  check(
    "10a: fail() mid-traveling settles back at the origin room",
    after.phase === "settled" && after.destination?.id === atrium.id && after.origin?.id === atrium.id,
  );
  check("10b: a failure event is recorded", eventTypes(h).includes("failed"));
  check(
    "10c: commit is not undone/re-fired — still exactly one, from before the failure",
    h.effects.filter(isCommit).length === commitsBeforeThisJourney + 1,
  );
  check("10d: no timers remain armed", h.clock.pendingCount === 0);
}

// ── 11 · destroy() mid-journey clears every timer ─────────────────────────
{
  const h = harness("11-destroy-mid-journey");
  const dest = makeDestination("operations");
  h.machine.request(dest, cinematic("A"));
  h.clock.advance(JOURNEY_PACING.departingMs.A); // traveling: hard-cap + ready-timeout both pending
  check(
    "11 precondition: traveling with multiple concurrent timers pending",
    h.machine.state().phase === "traveling" && h.clock.pendingCount >= 2,
  );
  const eventsBefore = h.events.length;
  const effectsBefore = h.effects.length;

  h.machine.destroy();
  check("11a: destroy() clears every pending timer (manual clock queue empty)", h.clock.pendingCount === 0);

  h.clock.advance(10_000_000); // far past every pacing constant
  check("11b: no further effects fire after destroy(), even across a huge time advance", h.effects.length === effectsBefore);
  check("11c: no further events fire after destroy(), even across a huge time advance", h.events.length === eventsBefore);
}

// ── 12 · sequence numbers are strictly monotonic, never reused ───────────
{
  const h = harness("12-sequence-monotonicity");
  const seqs: number[] = [];

  h.machine.request(makeDestination("atrium"), cinematic("A"));
  seqs.push(h.machine.state().sequence);

  h.machine.request(makeDestination("operations"), cinematic("A")); // pre-commit supersede
  seqs.push(h.machine.state().sequence);

  h.machine.cancel("cycle");
  h.machine.request(makeDestination("archive"), cinematic("A"));
  seqs.push(h.machine.state().sequence);

  h.clock.advance(JOURNEY_PACING.departingMs.A);
  h.machine.fail("cycle");
  h.machine.request(makeDestination("atrium"), cinematic("B"));
  seqs.push(h.machine.state().sequence);

  check("12a: four accepted requests produced four sequence readings", seqs.length === 4);
  check(
    "12b: sequence numbers are strictly increasing (never reused)",
    seqs.every((n, i) => i === 0 || n > seqs[i - 1]),
  );
  check("12c: sequence numbers are pairwise unique", new Set(seqs).size === seqs.length);
}

// ── 13 · unsubscribed listeners stop receiving notifications ─────────────
{
  const h = harness("13-listener-leak");
  let countA = 0;
  let countB = 0;
  const unsubA = h.machine.subscribe(() => {
    countA++;
  });
  const unsubB = h.machine.subscribe(() => {
    countB++;
  });

  h.machine.request(makeDestination("operations"), cinematic("A"));
  const afterFirstRequestA = countA;
  const afterFirstRequestB = countB;
  check(
    "13a: both listeners observe the same number of notifications while subscribed",
    afterFirstRequestA === afterFirstRequestB && afterFirstRequestA > 0,
  );

  unsubA();
  h.clock.advance(JOURNEY_PACING.departingMs.A); // -> traveling, another notification fires
  check("13b: the unsubscribed listener receives no further notifications", countA === afterFirstRequestA);
  check("13c: the still-subscribed listener keeps receiving notifications", countB > afterFirstRequestB);

  unsubB();
}

// ── 14 · tier B pacing is genuinely shorter and precisely honoured ───────
{
  const h1 = harness("14-tier-b-boundaries");
  const dest = makeDestination("operations");
  h1.machine.request(dest, cinematic("B"));
  check("14-1 precondition: departing entered", h1.machine.state().phase === "departing");

  h1.clock.advance(JOURNEY_PACING.departingMs.B - 1);
  check(
    "14-1a: one ms before departingMs.B, still departing (tier A's longer budget was NOT used)",
    h1.machine.state().phase === "departing",
  );
  h1.clock.advance(1);
  check("14-1b: at exactly departingMs.B, committed to traveling", h1.machine.state().phase === "traveling");

  h1.clock.advance(JOURNEY_PACING.travelMinMs.B); // satisfy the min-hold floor before ready()
  h1.machine.ready(h1.machine.state().sequence);
  check("14-1c precondition: arriving entered", h1.machine.state().phase === "arriving");
  h1.clock.advance(JOURNEY_PACING.arrivingMs.B - 1);
  check("14-1d: one ms before arrivingMs.B, still arriving", h1.machine.state().phase === "arriving");
  h1.clock.advance(1);
  const finalState = h1.machine.state();
  check(
    "14-1e: at exactly arrivingMs.B, settled(destination) — tier B's shorter budgets governed the whole journey",
    finalState.phase === "settled" && finalState.destination?.id === dest.id,
  );

  check("14-2: tier B's departing budget is strictly shorter than tier A's", JOURNEY_PACING.departingMs.B < JOURNEY_PACING.departingMs.A);
  check("14-3: tier B's arriving budget is strictly shorter than tier A's", JOURNEY_PACING.arrivingMs.B < JOURNEY_PACING.arrivingMs.A);
}

// ── 15 · commit-exactly-once, swept across every scenario above ──────────
{
  check("15 precondition: at least one harness was recorded for the aggregate sweep", allHarnesses.length > 0);
  for (const h of allHarnesses) {
    const counts = new Map<number, number>();
    for (const e of h.effects) {
      if (!isCommit(e)) continue;
      counts.set(e.sequence, (counts.get(e.sequence) ?? 0) + 1);
    }
    const overCommitted = [...counts.entries()].filter(([, n]) => n > 1);
    check(`15: [${h.label}] no sequence committed more than once`, overCommitted.length === 0);
  }
}

// ── 16 · event-order pinning for the happy path ───────────────────────────
{
  const h = harness("16-event-order-happy-path");
  const dest = makeDestination("operations");
  h.machine.request(dest, cinematic("A"));
  h.clock.advance(JOURNEY_PACING.departingMs.A);
  h.clock.advance(JOURNEY_PACING.travelMinMs.A);
  h.machine.ready(h.machine.state().sequence);
  h.clock.advance(JOURNEY_PACING.arrivingMs.A);
  check(
    "16 precondition: happy path reached settled(destination)",
    h.machine.state().phase === "settled" && h.machine.state().destination?.id === dest.id,
  );

  const order = ["acknowledged", "departed", "travel", "ready", "arrived", "settled"];
  const types = eventTypes(h);
  const indices = order.map((name) => types.indexOf(name));
  check("16a: every happy-path event name is present", indices.every((i) => i !== -1));
  check(
    "16b: acknowledged < departed < travel < ready < arrived < settled",
    indices.every((idx, i) => i === 0 || idx > indices[i - 1]),
  );
}

// ═══════════════════════════════════════════════════════════════════════
// T1.2 REGRESSION CASES (Opus adversarial gate fix pass, 2026-08-10/11)
// Cases 17-19 are ADDITIONS beyond T1-SPEC.md §6's original 16 — they are
// not a renumbering of the spec's own list, which stays pinned as-is above.
// ═══════════════════════════════════════════════════════════════════════

// ── 17 · fix 6 (machine seeding): initial destination seeds the first
//         journey's origin, and a cancel/recovery returns to it ─────────
{
  const seed = makeDestination("atrium");
  const h = harness("17-machine-seeding", { initial: seed });
  const preJourney = h.machine.state();
  check(
    "17a: a seeded machine's REST-STATE destination is the seed (before any journey)",
    preJourney.phase === "settled" && preJourney.destination?.id === seed.id,
  );
  check(
    "17b: origin stays null pre-journey — only `destination` is seeded, per types.ts",
    preJourney.origin === null,
  );

  const dest = makeDestination("operations");
  h.machine.request(dest, cinematic("A"));
  const afterRequest = h.machine.state();
  check(
    "17c: the FIRST journey out of a seeded machine departs from the seeded room (origin === seed)",
    afterRequest.origin?.id === seed.id,
  );

  // Pre-commit cancel: recovers to `origin`, which must be the SEEDED room,
  // not null/undefined — proving the seed flows all the way through a real
  // cancel/recovery cycle, not merely into the initial snapshot.
  h.machine.cancel("t1.2-seed-recovery");
  const afterCancel = h.machine.state();
  check(
    "17d: cancelling a seeded first journey recovers to settled(seed) — origin and destination both the seed",
    afterCancel.phase === "settled" &&
      afterCancel.destination?.id === seed.id &&
      afterCancel.origin?.id === seed.id,
  );
  check("17e: no commit fired for the cancelled seeded-first journey", h.effects.filter(isCommit).length === 0);

  // A SECOND journey (post-cancel) still departs from the seed — recovery
  // didn't lose or corrupt it.
  const dest2 = makeDestination("archive");
  h.machine.request(dest2, cinematic("A"));
  check(
    "17f: a journey requested AFTER a seeded-then-cancelled first journey still departs from the seed",
    h.machine.state().origin?.id === seed.id,
  );

  const unseeded = harness("17g-unseeded-control");
  check(
    "17g: control — an UNSEEDED machine's rest-state destination is null (T1's original behaviour, unchanged)",
    unseeded.machine.state().destination === null,
  );
}

// ── 18 · fix 5 (pinned inequality): the fallback chain never reaches
//         hardCapMs — a hard cap can never truncate a fail-open arrival ──
{
  check(
    "18: departingMs.A + readyTimeoutMs + arrivingMs.A < hardCapMs — production pacing values, no overrides",
    JOURNEY_PACING.departingMs.A + JOURNEY_PACING.readyTimeoutMs + JOURNEY_PACING.arrivingMs.A <
      JOURNEY_PACING.hardCapMs,
  );
  // The same inequality must hold for tier B (its budgets are shorter across
  // the board, so if it ever failed here it would only be from a future
  // edit that widened B without checking this guard).
  check(
    "18b: the same inequality holds for tier B's (shorter) budgets",
    JOURNEY_PACING.departingMs.B + JOURNEY_PACING.readyTimeoutMs + JOURNEY_PACING.arrivingMs.B <
      JOURNEY_PACING.hardCapMs,
  );
}

// ── 19 · fix 3 (machine-testable slice): ready() is only valid once BOTH
//         "traveling" AND the destination identify the calling room — the
//         exact predicate RoomReady.tsx's subscription checks before ever
//         calling machine.ready(sequence). (Self-nav rejection is
//         adapter-level — window.location/pathname — and out of scope for
//         this pure-machine suite; it belongs to
//         TransitionRuntimeProvider.tsx's `navigate()`, not machine.ts.) ──
{
  const h = harness("19-ready-via-traveling-destination-match");
  const dest = makeDestination("archive");
  h.machine.request(dest, cinematic("A"));
  h.clock.advance(JOURNEY_PACING.departingMs.A);
  const traveling = h.machine.state();
  check(
    "19a precondition: traveling, and `destination` identifies the actual target room",
    traveling.phase === "traveling" && traveling.destination?.id === dest.id,
  );

  // Mirrors RoomReady's own guard exactly: only call ready() when BOTH
  // conditions hold for the room in question (here, `dest.id`).
  const roomId = dest.id;
  const state = h.machine.state();
  if (state.phase === "traveling" && state.destination?.id === roomId) {
    h.machine.ready(state.sequence);
  }
  h.clock.advance(JOURNEY_PACING.travelMinMs.A);
  check(
    "19b: ready() called under that exact predicate advances the journey to arriving",
    h.machine.state().phase === "arriving",
  );

  // Negative control: a DIFFERENT room's id never satisfies the predicate,
  // so it would never call ready() at all — the machine-level guarantee
  // this depends on is already covered by §5's stale/duplicate-ready cases,
  // this just documents the predicate itself stays honest.
  const wrongRoomId = "operations";
  check(
    "19c: a non-matching room id would not have satisfied RoomReady's predicate for this journey",
    !(traveling.phase === "traveling" && traveling.destination?.id === wrongRoomId),
  );
}

// ── static structural guards ──────────────────────────────────────────────
const repoRoot = join(__dirname, "..");
function tryReadRepoFile(relPath: string): string | null {
  const full = join(repoRoot, relPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, "utf8");
}
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function checkPurity(relPath: string) {
  const src = tryReadRepoFile(relPath);
  check(`${relPath} exists`, src !== null);
  if (src === null) return;
  const code = stripComments(src);
  const importsReactOrNext =
    /from\s+["']react(-dom)?["']|from\s+["']next\//.test(code) || /require\(\s*["'](react|react-dom|next\/)/.test(code);
  const referencesDomGlobals = /\b(window|document|navigator)\s*\./.test(code);
  check(`${relPath} imports no react/react-dom/next module`, !importsReactOrNext);
  check(`${relPath} references no window/document/navigator global`, !referencesDomGlobals);
}
checkPurity("lib/transition-runtime/machine.ts");
checkPurity("lib/transition-runtime/pacing.ts");
checkPurity("lib/transition-runtime/types.ts");

{
  const pacingSrc = tryReadRepoFile("lib/transition-runtime/pacing.ts");
  check("pacing.ts exists for the numeric spec-sync check", pacingSrc !== null);
  if (pacingSrc !== null) {
    check(
      "JOURNEY_PACING matches T1-SPEC.md §3 verbatim",
      JOURNEY_PACING.departingMs.A === 280 &&
        JOURNEY_PACING.departingMs.B === 200 &&
        JOURNEY_PACING.travelMinMs.A === 420 &&
        // T1.2 amendment (fix 5): readyTimeoutMs lowered 1400 -> 1000, see
        // T1-SPEC.md §3.
        JOURNEY_PACING.travelMinMs.B === 300 &&
        JOURNEY_PACING.arrivingMs.A === 360 &&
        JOURNEY_PACING.arrivingMs.B === 260 &&
        JOURNEY_PACING.readyTimeoutMs === 1000 &&
        JOURNEY_PACING.hardCapMs === 1800,
    );
  }
}

const ALLOWLIST_PREFIXES = [
  "lib/transition-runtime/",
  "components/transition-runtime/",
  "app/review/transition-runtime/",
  "docs/reviews/cinematic-transition-runtime/",
];
const ALLOWLIST_EXACT = new Set(["scripts/transition-runtime.test.ts"]);
function isAllowedPath(p: string): boolean {
  return ALLOWLIST_EXACT.has(p) || ALLOWLIST_PREFIXES.some((prefix) => p.startsWith(prefix));
}
function runGit(args: string): string | null {
  try {
    // --no-pager: never let a pager intercept output in an unusual environment.
    return execSync(`git --no-pager ${args}`, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return null;
  }
}
// T2 supersession (coordinator amendment): this suite's isolation gate is
// scoped to the T1 wave (baseline a72a47c, T1 file allowlist). On a T2+
// branch the wave-scoped gate lives in scripts/persistent-shell.test.ts
// (baseline 1698e2b, T2 allowlist) — running BOTH baselines here would flag
// every legitimate T2 file as a violation by construction. Detection is the
// presence of the successor guard file, not a flag.
const supersededByT2 = existsSync(join(repoRoot, "scripts/persistent-shell.test.ts"));
if (supersededByT2) {
  check("isolation gate: SUPERSEDED by scripts/persistent-shell.test.ts (T2 wave gate, baseline 1698e2b) — see that suite", true);
  check("isolation gate: successor guard present and non-empty", readFileSync(join(repoRoot, "scripts/persistent-shell.test.ts"), "utf8").length > 1000);
} else {
  const diffRaw = runGit("diff --name-only a72a47c");
  check("isolation gate: `git diff --name-only a72a47c` runs cleanly", diffRaw !== null);
  const diffFiles = (diffRaw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const statusRaw = runGit("status --porcelain --untracked-files=all");
  check("isolation gate: `git status --porcelain` runs cleanly", statusRaw !== null);
  const untrackedFiles = (statusRaw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("??"))
    .map((l) => l.slice(2).trim());

  check("isolation gate: git diff --name-only a72a47c touches only T1-allowlisted paths", diffFiles.every(isAllowedPath));
  check("isolation gate: untracked new files (git status --porcelain) are all T1-allowlisted", untrackedFiles.every(isAllowedPath));

  console.log("\n--- Isolation gate report (vs a72a47c) ---");
  const allTouched = Array.from(new Set([...diffFiles, ...untrackedFiles])).sort();
  if (allTouched.length === 0) console.log("  (no tracked diff or untracked files detected)");
  for (const f of allTouched) console.log(`  ${isAllowedPath(f) ? "OK  " : "VIOLATION"}  ${f}`);
}

const total = pass + fail;
console.log(`\ntransition-runtime.test.ts: ${pass} passed, ${fail} failed`);
console.log(`${fail === 0 ? "PASS" : "FAIL"} ${pass}/${total}`);
process.exit(fail ? 1 : 0);
