import { notFound } from "next/navigation";
import { DemoRoom } from "./DemoRoom";
import { DEMO_ROOMS } from "./roomsShared";

// Cinematic Transition Runtime — Wave T1 (app/review/transition-runtime/[room]/page.tsx)
//
// Three real routes over the SAME machine contract the whole cinematic
// program will build on (spec §5): static content only — no Prisma, no auth
// semantics, no product data. Server component: only the notFound() gate
// lives here — everything interactive is DemoRoom.tsx, and the room
// registry is roomsShared.ts (a client module's exports reach a server
// component only as client-reference proxies, and the page-export validator
// keeps shared data out of page.tsx). No second reviewBuildAllowed() gate —
// app/review/layout.tsx already 404s this entire subtree in production;
// duplicating that check would be a second, redundant gate spec §5
// explicitly asks this route NOT to add.
//
// The provider and TravelLayer live one level up, in this segment's
// layout.tsx (T1.1 amendment) — the layout persists across navigations
// between these rooms, so one machine and one veil genuinely span the
// router.push() from origin to destination, and this page contributes only
// the destination's content (whose <RoomReady /> completes the handoff).
export default function TransitionRuntimeRoomPage({
  params,
}: {
  params: { room: string };
}) {
  const room = DEMO_ROOMS.find((candidate) => candidate.id === params.room);
  if (!room) notFound();

  return <DemoRoom room={room} />;
}
