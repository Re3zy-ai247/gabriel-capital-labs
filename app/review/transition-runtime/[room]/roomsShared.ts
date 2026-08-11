// Cinematic Transition Runtime — Wave T1
// (app/review/transition-runtime/[room]/roomsShared.ts)
//
// The three-room registry, in a module with NO "use client" directive so both
// sides can consume it: the server page.tsx resolves params.room against it
// (importing a client module there would hand the server a client-reference
// proxy whose .find() throws at request time — found live, not by tsc or
// next build, since the dynamic route only renders on request), and the
// client DemoRoom.tsx maps it into portals. House pattern per CLAUDE.md
// gotcha 2: shared constants live in a *Shared.ts module.

export interface DemoRoomDef {
  id: "atrium" | "operations" | "archive";
  href: string;
  label: string;
  heading: string;
  description: string;
}

export const DEMO_ROOMS: readonly DemoRoomDef[] = [
  {
    id: "atrium",
    href: "/review/transition-runtime/atrium",
    label: "Atrium",
    heading: "The Atrium",
    description:
      "The demo's entry hall. Static content only — no Prisma, no auth, no product data. Every portal below drives the real Next.js router through the transition runtime's machine, not a simulation of it.",
  },
  {
    id: "operations",
    href: "/review/transition-runtime/operations",
    label: "Operations",
    heading: "Operations",
    description:
      "A second static room, reachable only through a real journey. Nothing here reacts to anything you did in the Atrium — each room is independent content; only the runtime carrying you between them is shared.",
  },
  {
    id: "archive",
    href: "/review/transition-runtime/archive",
    label: "The Archive",
    heading: "The Archive",
    description:
      "The third room. From here, every portal — including the one back to the Atrium — runs through the same machine, the same laws, the same fail-open guarantees.",
  },
];
