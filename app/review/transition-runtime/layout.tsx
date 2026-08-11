"use client";

// Cinematic Transition Runtime — Wave T1 (app/review/transition-runtime/layout.tsx)
//
// T1.1 spec amendment (T1-SPEC.md §5): the demo's segment layout. App Router
// preserves a layout across navigations between its child routes, so THIS is
// what lets one JourneyMachine and one TravelLayer survive the real
// router.push() between rooms — the origin page unmounts mid-journey, but
// the provider hosting the machine does not. Without it (the original
// per-page mounting), the commit's own navigation destroyed the machine
// mid-travel and the traveling→ready→arriving handoff could never span a
// real route swap. This file is the persistent-shell principle in miniature,
// scoped to the demo segment only — the product-wide version is T2.
//
// A "use client" layout is deliberate: the provider needs browser APIs, and
// the [room]/page.tsx children remain server components passed through the
// children slot untouched. The production 404 hard-off stays where it is —
// app/review/layout.tsx above this one; no second gate here (spec §5).
//
// T1.2 (fix 6, "machine seeding"): the machine used to always start knowing
// no room at all, even though the very first render already sits on a real
// room (whichever [room] segment loaded first) — so the first EVER journey
// out of that room had a `null` origin, and a cancel/fail before any
// journey had ever completed had nowhere real to recover to. `useParams()`
// reads this segment's own dynamic `[room]` param and resolves it against
// the SAME `DEMO_ROOMS` registry DemoRoom.tsx renders from, then seeds the
// provider with it as `initialRoom`.
import { useState } from "react";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  TransitionRuntimeProvider,
  type MotionPreviewMode,
} from "@/components/transition-runtime/TransitionRuntimeProvider";
import { TravelLayer } from "@/components/transition-runtime/TravelLayer";
import { DEMO_ROOMS } from "./[room]/roomsShared";
import { MotionPreviewControl } from "./MotionPreviewControl";

export default function TransitionRuntimeDemoLayout({
  children,
}: {
  children: ReactNode;
}) {
  // The index route (`/review/transition-runtime`) redirects before any
  // `[room]` segment resolves — `params.room` is `undefined` there, so
  // `currentRoom` is `undefined` and the provider below receives no
  // `initialRoom` (which seeds `null` at the machine — see
  // TransitionRuntimeProvider.tsx), preserving T1's original unseeded
  // behaviour for that case.
  const params = useParams<{ room?: string }>();
  const currentRoom = params?.room
    ? DEMO_ROOMS.find((candidate) => candidate.id === params.room)
    : undefined;

  // T1.3 — Founder motion preview. State lives HERE (the segment layout that
  // persists across room navigations) so the chosen mode survives every
  // journey within the demo, and dies with the segment: leaving
  // /review/transition-runtime discards it. Default "system" = production
  // behavior, fresh on every entry — the override is never persisted
  // anywhere (no storage, no URL param), so it cannot leak or linger.
  const [motionPreview, setMotionPreview] = useState<MotionPreviewMode>("system");

  return (
    <TransitionRuntimeProvider initialRoom={currentRoom} motionPreview={motionPreview}>
      {children}
      <MotionPreviewControl value={motionPreview} onChange={setMotionPreview} />
      <TravelLayer />
    </TransitionRuntimeProvider>
  );
}
