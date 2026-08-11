// Cinematic Transition Runtime — Wave T2 (lib/transition-runtime/roomRegistry.ts)
//
// The persistent shell's room table (T2-SPEC.md §3). Single source for
// three consumers: RoomsShell's <h1> title, the JourneyMachine's
// `initialRoom` seed, and RoomsShell's own delegated journey-interception
// check (T2.1 — a single onClickCapture handler on the shell root, NOT a
// Sidebar-level check; see components/shell/RoomsShell.tsx's onShellClick)
// — all three read the SAME `label` string (the existing per-page
// `<AppShell title="…">`
// value, byte-verified against every current app/(rooms) page.tsx/loading.tsx
// before this table was written) so there is exactly one place that can go
// stale.
//
// `journey: true` only for dashboard/agency/arena (T2-SPEC.md §2's flagship
// set) — every other room keeps plain App Router navigation in T2 (§7,
// deferred).
//
// Pure module: no "use client", no React — a server page.tsx (this route
// group's layout.tsx) and client components (RoomsShell, Sidebar) both
// import it directly, mirroring the T1 demo's roomsShared.ts precedent
// (house pattern per CLAUDE.md gotcha 2: shared constants in a non-client
// module so neither side receives the other's proxy).
export interface Room {
  id: string;
  href: string;
  label: string;
  journey: boolean;
}

// Reconciling "26 product rooms" (T2-SPEC.md §3) against this 23-row table:
// the 21 top-level `git mv` dirs remaining under app/(rooms)/ (§1, minus
// onboarding — see below) each own one row. Two of those dirs hold TWO
// AppShell-wrapped pages apiece that share their parent's exact title —
// community/page.tsx + community/[id]/page.tsx (both "/ Operator Network"),
// and gxl/page.tsx + gxl/[room]/page.tsx (both "/ GXL Gallery") — so one row
// correctly resolves both via longest-prefix matching; a second
// identically-labeled row would be redundant, never reachable differently.
// mail/ instead holds two SUB-pages whose titles DIFFER from "/ Mail Center"
// (mail/download → "/ Download package", mail/send → "/ Mail a dispute"), so
// those two get their own longer-prefix rows precisely so matchRoom()
// resolves them correctly instead of inheriting the parent's title. 21
// top-level rows + 2 mail sub-rows = 23 rows, covering 25 of the 26 pages:
// 21 + 2 (community/gxl duplicates, covered by their parent row) + 2 (mail
// sub-pages, covered by their own row) = 25. The 26th page — onboarding — is
// the third chrome-free escape below and deliberately has no row at all.
//
// EXCLUDED BY DESIGN (repository evidence, not an oversight): THREE
// deliberately chrome-free pages live OUTSIDE the (rooms) group — route
// groups don't affect URLs, so each serves from its plain pre-T2 path with
// no layout beyond the root, byte-identical to its pre-T2 self:
//   - app/billing/cancel/page.tsx: "no AppShell, no navigation...
//     deliberately standalone" (the one surface a suspended account can
//     still reach) — resolved in the T2.1 coordinator pass.
//   - app/letters/print/[id]/page.tsx (+ PrintActions.tsx): a clean print
//     sheet, no chrome by design — likewise resolved in T2.1.
//   - app/onboarding/page.tsx (+ OnboardingSteps.tsx): T2.2 FIX 8 — this dir
//     was ORIGINALLY `git mv`'d into app/(rooms)/ with the other 22 (§1) and
//     unwrapped from AppShell like every other room page, but its signed-in
//     branch was never actually AppShell-wrapped to begin with (recon,
//     T2.2): it renders its own full-bleed standalone first-run surface
//     with no header/Sidebar/main chrome at all, structurally the same
//     "deliberately chrome-free" escape class as billing/cancel and
//     letters/print above — just not caught in the original T2.1 pass. It
//     is restored to its pre-T2 path, byte-identical to its pre-T2 self
//     (`git diff 1698e2b -- app/onboarding` is empty), and removed from the
//     table below.
// None of the three gets a registry row; none is wrapped by RoomsShell.
export const ROOMS: readonly Room[] = [
  { id: "academy", href: "/academy", label: "/ Academy", journey: false },
  { id: "agency", href: "/agency", label: "/ Agency", journey: true },
  { id: "arena", href: "/arena", label: "/ Arena", journey: true },
  { id: "billing", href: "/billing", label: "/ Billing", journey: false },
  { id: "builder", href: "/builder", label: "/ Credit Builder", journey: false },
  { id: "campaigns", href: "/campaigns", label: "/ Campaigns", journey: false },
  { id: "community", href: "/community", label: "/ Operator Network", journey: false },
  { id: "dashboard", href: "/dashboard", label: "/ Mission Control", journey: true },
  { id: "gxl", href: "/gxl", label: "/ GXL Gallery", journey: false },
  { id: "identity", href: "/identity", label: "/ Identity Check", journey: false },
  { id: "journey", href: "/journey", label: "/ Timeline", journey: false },
  { id: "letters", href: "/letters", label: "/ Dispute Letters", journey: false },
  // mail's two sub-rooms MUST precede-or-follow "mail" itself in no
  // particular order — matchRoom() below picks the longest matching href,
  // not array position, so "/mail/download/…" resolves to this row over
  // the shorter "/mail" row regardless of declaration order.
  { id: "mail", href: "/mail", label: "/ Mail Center", journey: false },
  { id: "mail-download", href: "/mail/download", label: "/ Download package", journey: false },
  { id: "mail-send", href: "/mail/send", label: "/ Mail a dispute", journey: false },
  // No static listing page exists at /modules today (only the dynamic
  // [slug] route) — this row's label is the fallback shown only before
  // modules/[slug]/page.tsx's own <RoomTitleOverride title={`/ Modules / ${mod.name}`}>
  // effect commits (RoomsShell.tsx), matching T2-SPEC.md §1's title rule.
  { id: "modules", href: "/modules", label: "/ Modules", journey: false },
  { id: "network", href: "/network", label: "/ Operator Network", journey: false },
  // "onboarding" deliberately has NO row (T2.2 FIX 8) — it is the third
  // chrome-free escape, restored outside app/(rooms)/ to app/onboarding/,
  // never wrapped by RoomsShell. See this file's header comment.
  { id: "scores", href: "/scores", label: "/ Score Tracker", journey: false },
  { id: "settings", href: "/settings", label: "/ Settings", journey: false },
  { id: "strategist", href: "/strategist", label: "/ Strategy Desk", journey: false },
  { id: "support", href: "/support", label: "/ Support", journey: false },
  { id: "tradelines", href: "/tradelines", label: "/ Tradelines", journey: false },
  { id: "upload", href: "/upload", label: "/ Upload Report", journey: false },
] as const;

const UNMATCHED_TITLE = "/ CreditVector";

/**
 * Longest-prefix match: `pathname` matches a room when it equals the room's
 * `href` exactly or continues past it with a `/` (so "/mail" never matches
 * "/mailroom", only "/mail" or "/mail/…"). Ties are impossible by
 * construction — no two rows in ROOMS share an href — so the comparator
 * only ever needs to prefer the LONGER of two genuinely differing matches
 * (e.g. "/mail/download" over "/mail" for "/mail/download/abc123").
 */
export function matchRoom(pathname: string): Room | undefined {
  let best: Room | undefined;
  for (const room of ROOMS) {
    if (pathname === room.href || pathname.startsWith(room.href + "/")) {
      if (!best || room.href.length > best.href.length) best = room;
    }
  }
  return best;
}

/** `roomTitle(pathname)` — the shell title for a path with no active `<RoomTitleOverride>`; RoomsShell.tsx layers the override on top of this. */
export function roomTitle(pathname: string): string {
  return matchRoom(pathname)?.label ?? UNMATCHED_TITLE;
}

/**
 * T2.1 — the spoken/announced name of a room. `label` is the header title
 * verbatim ("/ Mission Control"); reading that leading slash aloud in
 * TravelLayer's aria-live announcement ("Traveling to / Mission Control")
 * is wrong for humans, so journey destinations use this stripped form.
 */
export function journeyLabel(room: Room): string {
  return room.label.replace(/^\/\s*/, "");
}

/**
 * T2.1 — matchRoom restricted to journey-enabled rooms, for the shell's
 * delegated link interception: returns a room only when the pathname
 * belongs to a `journey: true` row.
 */
export function matchJourneyRoom(pathname: string): Room | undefined {
  const room = matchRoom(pathname);
  return room?.journey ? room : undefined;
}
