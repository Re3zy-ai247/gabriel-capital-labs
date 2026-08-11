"use client";

// Cinematic Transition Runtime — Wave T2 (components/shell/RoomsShell.tsx)
//
// The persistent shell (T2-SPEC.md §1). Reproduces components/AppShell.tsx's
// DOM EXACTLY (evidence: AppShell.tsx:10-32) — same outer/inner element
// order, same classNames, same `id="main"` skip-link target, same z-index/
// offset couplings (MobileNav z-30/z-40, KaiPresence `bottom-20`, main
// `pb-24`) — but mounted ONCE by app/(rooms)/layout.tsx instead of remounted
// by every page.tsx, so it (and the journey machine it now also hosts)
// survives a real client-side navigation between rooms.
//
// AppShell.tsx itself is untouched and NOT deleted — app/admin/* still
// mounts it directly, unchanged, per T2-SPEC.md §1 ("app/admin/* stays
// where it is … own layout gate — the in-repo precedent").
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AgencyBar } from "@/components/AgencyBar";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { HeaderLogout } from "@/components/HeaderLogout";
import { KaiPresence } from "@/components/kai/KaiPresence";
import {
  TransitionRuntimeProvider,
  useJourney,
  type MotionPreviewMode,
} from "@/components/transition-runtime/TransitionRuntimeProvider";
import { TravelLayer } from "@/components/transition-runtime/TravelLayer";
import {
  journeyLabel,
  matchJourneyRoom,
  matchRoom,
  roomTitle,
} from "@/lib/transition-runtime/roomRegistry";
import type { JourneyDestination } from "@/lib/transition-runtime/types";
import { isDirectorActive } from "@/lib/cxos/reviewMode";
// T1 review-harness file (app/review/transition-runtime/*, spec §0: "…and
// app/review/transition-runtime/* are unmodified in T2"). IMPORT ONLY — this
// file is read-only reuse, never edited, exactly like RoomsShell's other
// cross-cutting imports above. Confirmed with the coordinator's directive:
// "check that import path is allowed: it IS a T1 review file; do NOT modify
// it, import only."
//
// T2.2 FIX 5: loaded via next/dynamic (`ssr: false`) instead of a static
// import. This component (and everything it pulls in) is REVIEW-ONLY —
// rendered only when `reviewInstrumentsAllowed && directorActive` (both
// false in production, the first by server truth from reviewBuildAllowed()).
// A static import bundles its module into RoomsShell's own chunk regardless
// of whether the gate ever opens, so every production visitor's bundle would
// carry review-instrument bytes it can never execute. Dynamic import code-
// splits it into its own chunk that the browser only ever fetches at the
// moment the gated JSX below actually tries to render it — impossible in
// production, so production never requests this chunk at all.
const MotionPreviewControl = dynamic(
  () => import("@/app/review/transition-runtime/MotionPreviewControl").then((m) => m.MotionPreviewControl),
  { ssr: false },
);

/**
 * The dynamic-title escape hatch (T2-SPEC.md §1: "Dynamic-title rooms use
 * `<RoomTitleOverride title>` … sole consumer today: modules/[slug] with
 * `/ Modules / ${mod.name}`; restore-on-unmount"). `null` context (RoomsShell
 * not mounted — should never happen for anything rendered inside `children`,
 * but this hook is a page-authored component, so it fails soft rather than
 * throwing) makes the setter a no-op.
 */
const RoomTitleOverrideContext = createContext<((title: string | null) => void) | null>(null);

export function RoomTitleOverride({ title }: { title: string }) {
  const setOverride = useContext(RoomTitleOverrideContext);
  useEffect(() => {
    if (!setOverride) return;
    setOverride(title);
    // Restore-on-unmount (spec §1): leaving the overriding page must not
    // leave a stale title behind for whatever room mounts next.
    return () => setOverride(null);
  }, [setOverride, title]);
  return null;
}

/**
 * The AppShell DOM reproduction (byte-faithful — see this file's header).
 * A separate component, nested INSIDE `<TransitionRuntimeProvider>`, purely
 * so it — and only it — can call `useJourney()` to read the live phase for
 * `data-journey-phase` on the outer div (spec §1: "from `useJourney()` in a
 * tiny inner component to keep the provider above it"). Everything the
 * journey machine needs to exist BEFORE this reproduction starts (seeding
 * `initialRoom`, the review-only motion-preview toggle) lives one level up,
 * in RoomsShell itself, where the provider is constructed.
 */
function ShellBody({ title, children }: { title: string; children: ReactNode }) {
  const { state, navigate } = useJourney();

  // T2.1 — ONE delegated journey-interception mechanism for the whole shell
  // (production precedent: TransitionShell.tsx's capture-phase delegation).
  // CAPTURE phase is load-bearing, proven live in the T2 battery: next/link's
  // own anchor-level handler calls preventDefault() during BUBBLE, so a
  // bubble-phase shell handler always finds defaultPrevented=true for every
  // <Link> (Sidebar, bottom tab bar) and only ever intercepted plain
  // anchors. In capture we run first; when navigate() is accepted our
  // preventDefault() makes Link's internal handler a no-op; when rejected we
  // touch nothing and Link proceeds normally (fail-open law). This replaces
  // per-component handlers: Sidebar/MobileNav links AND in-content portals
  // (ArenaDoor on the dashboard — a frozen cxos component with no
  // interception of its own — is exactly why delegation, not per-link
  // wiring, is the right seam). Only plain primary clicks on same-app
  // anchors resolving to a journey-enabled room are intercepted.
  const onShellClick = (event: React.MouseEvent) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as HTMLElement).closest?.("a");
    if (!anchor) return;
    if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("/")) return;
    // T2.2 FIX 10: same-origin guard, mirroring TransitionShell.tsx's own
    // exclusion (`url.origin !== window.location.origin`). `href.startsWith("/")`
    // above already rules out absolute cross-origin URLs in the common case,
    // but a relative href resolved against a `<base>` tag or an edge case in
    // `URL`'s own resolution could still land off-origin — resolve once and
    // check explicitly rather than trusting the string prefix alone.
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const room = matchJourneyRoom(url.pathname);
    if (!room) return;
    const accepted = navigate({ id: room.id, href, label: journeyLabel(room) });
    if (accepted) event.preventDefault();
  };

  return (
    // T2.2 FIX 1: `data-journey-inert-scope` marks this div — the WHOLE
    // chrome+main tree (Sidebar through MobileNav below) — as the scope
    // TravelLayer.tsx inerts while `traveling` (its `getInertScope()`
    // prefers this marker over the T1 top-level-`<main>` fallback). This
    // div is the ONLY thing inerted: TravelLayer's own veil overlay and its
    // always-mounted announcer are rendered as siblings of <ShellBody>
    // inside <TransitionRuntimeProvider> (see RoomsShell below), never
    // nested inside this div, so marking it can never inert the veil or the
    // announcer that must keep working throughout the very phase this
    // scope goes inert.
    <div
      className="flex min-h-screen"
      data-journey-phase={state.phase}
      data-journey-inert-scope=""
      onClickCapture={onShellClick}
    >
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-700/70 bg-ink-900/70 px-5 py-3 backdrop-blur">
          <h1 className="text-sm font-medium text-slate-300">{title}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <ThemeToggle />
            <Link href="/upload" className="btn-primary !py-1.5">+ New Dispute</Link>
            <HeaderLogout />
          </div>
        </header>
        <ImpersonationBanner />
        <AnnouncementBanner />
        <AgencyBar />
        <main id="main" className="flex-1 px-5 py-6 pb-24 md:pb-6">{children}</main>
        <KaiPresence />
        <MobileNav />
      </div>
    </div>
  );
}

export function RoomsShell({
  children,
  reviewInstrumentsAllowed,
}: {
  children: ReactNode;
  /** Server truth (`reviewBuildAllowed()`), computed once by app/(rooms)/layout.tsx — impossible to be `true` in production regardless of client-side query params. */
  reviewInstrumentsAllowed: boolean;
}) {
  const pathname = usePathname();

  // Title (spec §1): registry longest-prefix by default, overridden by
  // whatever the current page most recently rendered a <RoomTitleOverride>
  // for. `overrideTitle` is deliberately NOT reset on pathname change here —
  // <RoomTitleOverride>'s own unmount cleanup is what clears it (the
  // outgoing page unmounts before/as the incoming one mounts), so a page
  // that never overrides sees a clean `null` by the time its own render
  // matters, and one page's override can never leak onto a different route.
  const [overrideTitle, setOverrideTitle] = useState<string | null>(null);
  const title = overrideTitle ?? roomTitle(pathname);

  // T1.3 pattern, reused verbatim (spec §1: "motionPreview state lives in
  // RoomsShell exactly like the demo layout"). Default "system" = byte-for-
  // byte production resolution; never persisted.
  const [motionPreview, setMotionPreview] = useState<MotionPreviewMode>("system");

  // Founder-instrument gating (spec §1: "<MotionPreviewControl/> renders
  // ONLY when props.reviewInstrumentsAllowed && isDirectorActive()").
  // isDirectorActive() reads window.location.search, so it cannot be called
  // during the render that also runs on the server — that would make the
  // server's markup (always "not active") disagree with the very first
  // client render on a real ?director URL, a hydration mismatch. The
  // state+effect indirection is the SAME pattern this repo already uses for
  // exactly this call (components/cxos/journey/JourneyRuntime.tsx: `const
  // [director, setDirector] = useState(false); useEffect(() =>
  // setDirector(isDirectorActive()), [])`) — both renders start "false"
  // (server and first client paint agree), and the instrument appears one
  // effect-tick later on a real director URL. Net truth is identical to the
  // spec's boolean expression; only WHEN it's evaluated moves.
  const [directorActive, setDirectorActive] = useState(false);
  useEffect(() => {
    setDirectorActive(isDirectorActive());
  }, []);

  // Journey wiring (spec §1): seed the machine's `initialRoom` from the
  // registry match for wherever this shell first mounts. `initialRoom` is
  // read exactly once by TransitionRuntimeProvider (its own `initialRoom`
  // prop doc: "seeds THIS one machine construction … a later prop change is
  // never re-read") — recomputing it on every RoomsShell render is
  // harmless, only the value seen at construction time is ever used.
  const matchedRoom = matchRoom(pathname);
  const initialRoom: JourneyDestination | undefined = matchedRoom
    ? { id: matchedRoom.id, href: matchedRoom.href, label: journeyLabel(matchedRoom) }
    : undefined;

  return (
    <RoomTitleOverrideContext.Provider value={setOverrideTitle}>
      <TransitionRuntimeProvider initialRoom={initialRoom} motionPreview={motionPreview}>
        <ShellBody title={title}>{children}</ShellBody>
        {reviewInstrumentsAllowed && directorActive && (
          <MotionPreviewControl value={motionPreview} onChange={setMotionPreview} />
        )}
        {/* TravelLayer mounted inside the provider, after MobileNav (spec §1) — a sibling of the AppShell-reproduction tree above, not nested inside it, mirroring the T1 demo layout's own {children}/<MotionPreviewControl/>/<TravelLayer/> sibling order. */}
        <TravelLayer />
      </TransitionRuntimeProvider>
    </RoomTitleOverrideContext.Provider>
  );
}
