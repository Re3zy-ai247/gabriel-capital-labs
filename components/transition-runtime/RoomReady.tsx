"use client";

// Cinematic Transition Runtime — Wave T1 (components/transition-runtime/RoomReady.tsx)
//
// Destination-readiness beacon (spec §4). `<RoomReady roomId={room.id} />`
// is meant to be rendered by a room's own content: whenever the machine's
// phase is `traveling` AND its destination is genuinely THIS room, it
// signals `machine.ready(sequence)`. Outside a matching journey (initial
// load, immediate mode, or simply not being the destination of whatever
// journey is active) the call never happens at all — machine.ts's
// edge-triggered `ready()` guard (spec law 8) is a second line of defense,
// not the only one.
//
// T1.2 (fix 3 — "readiness decoupled from mount + self-nav"): T1 originally
// signalled ready() once, on mount only. That is provably wrong the moment
// a room can mount for reasons OTHER than being this journey's destination
// (e.g. the T1.2 seeding fix landing a room on first paint via
// `initialRoom`, or any future persistent-shell room that stays mounted
// across journeys) — a mount-only beacon would either signal ready() for a
// journey it was never actually part of, or never fire again for a REAL
// journey landing on an already-mounted room. Subscribing to every machine
// transition (plus one immediate check on mount, for the ordinary case
// where "traveling" was already entered before this effect runs) is the
// only way to correctly react to "this room becomes the live destination
// of an in-flight journey" as an ONGOING condition, not a one-time event.
//
// StrictMode-idempotent: `signaledRef` is keyed by sequence, so a
// double-invoked mount effect (or two notifications for the same sequence)
// calls `ready()` at most once per sequence — redundant with (not a
// substitute for) machine.ts's own idempotent-duplicate-ready guard (spec
// law 8): belt and suspenders, this component is honest about being
// StrictMode-safe on its own terms, not merely inheriting it from the
// callee's contract.
import { useEffect, useRef } from "react";
import type { JourneyState } from "@/lib/transition-runtime/types";
import { useJourneyMachine } from "./TransitionRuntimeProvider";

export function RoomReady({ roomId }: { roomId: string }) {
  const machine = useJourneyMachine();
  const signaledRef = useRef<number | null>(null);

  useEffect(() => {
    const trySignal = (state: JourneyState) => {
      if (state.phase !== "traveling") return;
      if (state.destination?.id !== roomId) return;
      if (signaledRef.current === state.sequence) return;
      signaledRef.current = state.sequence;
      machine.ready(state.sequence);
    };

    // Immediate check on mount: covers the ordinary case where the
    // destination room mounts WHILE already traveling (the router.push
    // already committed before this component's content could render).
    trySignal(machine.state());

    // Ongoing check: covers a room that was already mounted BEFORE this
    // journey's traveling phase began (e.g. seeded via `initialRoom`, or a
    // future persistent-shell room) — the mount-only version could never
    // observe that case at all.
    const unsubscribe = machine.subscribe(trySignal);
    return unsubscribe;
  }, [machine, roomId]);

  return null;
}
