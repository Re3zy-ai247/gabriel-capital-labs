"use client";

// Cinematic Transition Runtime — Wave T1
// (app/review/transition-runtime/[room]/DemoRoom.tsx)
//
// The one co-located client component this route needs (spec §5's file
// table: "+ ONE co-located client component file DemoRoom.tsx if needed").
// The three-room registry lives in roomsShared.ts (no "use client"): the
// server page.tsx must also consume it, and a client module's exports reach
// a server component only as client-reference proxies (page-export rules
// keep it out of page.tsx itself).
//
// Renders a single room's static content plus everything spec §5 asks every
// demo room to carry: a distinct h1, a <RoomReady /> beacon, three portal
// links driven by useJourney().navigate(), and a live
// phase/sequence/mode/tier readout strip (instrumentation made visible).
//
// Portals stay real links underneath (TransitionShell law, spec §5): each
// is a genuine next/link <Link href> — right-click "copy link", middle-
// click, and every modifier-click keep native browser behavior untouched;
// only a plain primary click is intercepted, preventDefault()ed, and hands
// off to navigate(). If the runtime never resolves the click for any reason
// (this component crashing, JS failing to load), the underlying <a href>
// is still a real link to a real route — navigation is never hostage to
// the runtime being present at all, let alone healthy.
import Link from "next/link";
import type { MouseEvent as ReactMouseEvent } from "react";
import { RoomReady } from "@/components/transition-runtime/RoomReady";
import { useJourney } from "@/components/transition-runtime/TransitionRuntimeProvider";
import { DEMO_ROOMS, type DemoRoomDef } from "./roomsShared";

function isPlainPrimaryClick(event: ReactMouseEvent<HTMLAnchorElement>): boolean {
  // House pattern (TransitionShell.tsx, useCxosRoomRuntime.ts): only a
  // plain, unmodified left-click is ever intercepted.
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function DemoRoom({ room }: { room: DemoRoomDef }) {
  const { state, navigate } = useJourney();

  return (
    <main id="main" tabIndex={-1} className="min-h-screen bg-ink-950 px-6 py-14 text-white">
      <RoomReady roomId={room.id} />
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-300">
          Cinematic Transition Runtime · Wave T1 demo
        </p>
        <h1 className="h-display mt-2 text-3xl md:text-4xl">{room.heading}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          {room.description}
        </p>

        <nav aria-label="Rooms" className="mt-8 grid gap-3 sm:grid-cols-3">
          {DEMO_ROOMS.map((target) => {
            const isCurrent = target.id === room.id;
            return (
              <Link
                key={target.id}
                href={target.href}
                aria-current={isCurrent ? "page" : undefined}
                onClick={(event) => {
                  if (!isPlainPrimaryClick(event)) return;
                  // Fix 3 (self-nav guard): a click on the room you're
                  // already in must never start a journey — return without
                  // preventDefault and without calling navigate() at all.
                  if (isCurrent) return;
                  const accepted = navigate({ id: target.id, href: target.href, label: target.label });
                  // Fix 4: only an ACCEPTED request owns this click. A
                  // rejected/ignored request (false) falls through to the
                  // real <Link> navigation underneath — fail-open,
                  // TransitionShell law: a runtime that declines to handle
                  // a click must never strand it.
                  if (accepted) event.preventDefault();
                }}
                className="card block p-4 text-left"
              >
                <span
                  className={`block text-sm font-semibold ${isCurrent ? "text-brand-300" : "text-slate-100"}`}
                >
                  {target.label}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  {isCurrent ? "You are here" : `Travel to ${target.label}`}
                </span>
              </Link>
            );
          })}
        </nav>

        <dl
          aria-label="Journey state"
          className="mt-8 grid grid-cols-2 gap-3 rounded-xl2 border border-ink-700/50 bg-ink-900/60 p-4 text-xs sm:grid-cols-4"
        >
          <div>
            <dt className="text-slate-400">phase</dt>
            <dd className="tnum font-mono text-slate-100">{state.phase}</dd>
          </div>
          <div>
            <dt className="text-slate-400">sequence</dt>
            <dd className="tnum font-mono text-slate-100">{state.sequence}</dd>
          </div>
          <div>
            <dt className="text-slate-400">mode</dt>
            <dd className="tnum font-mono text-slate-100">{state.mode ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">tier</dt>
            <dd className="tnum font-mono text-slate-100">{state.tier ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
