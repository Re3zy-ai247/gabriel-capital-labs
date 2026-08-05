"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  findTransition,
  TRANSITION_TIMEOUT_MS,
  type CxTransitionDef,
} from "@/lib/cxos/transitions/registry";
import { detectTier } from "@/lib/cxos/capability";
import { isDirectorActive, reviewBuildAllowed } from "@/lib/cxos/reviewMode";

// CXOS Phase 3 — the cinematic route-transition shell.
//
// Mounted ONCE in the root layout (it persists across App Router navigations)
// and renders null until a registered marketing navigation happens. The whole
// mechanism is fail-open:
//
//   • Links stay real links. Interception is event delegation over real
//     <a href> clicks — and ONLY a plain left-click (no modifiers, no
//     target=_blank, no download, same-origin) is ever considered. Middle
//     click, ctrl-click, open-in-new-tab, copy-link: untouched.
//   • Navigation is never delayed more than the cover-in: router.push fires
//     at cover-in end (≤450 ms after click), the destination paints BENEATH
//     the veil, and the open-out reveals it.
//   • The fail-open clock: if the destination has not arrived within
//     TRANSITION_TIMEOUT_MS of the click, location.assign() forces it.
//   • Escape skips straight to the open-out.
//   • Back/forward never replay anything — popstate is never touched.
//   • Reduced motion / the footer toggle (tier D) → the shell does nothing.
//   • After the first full play in a session, repeats run at the short
//     tier-C durations (returning users get a quicker world).
//
// The overlay is pure CSS in the sync bundle — there is no lazy chunk whose
// failure could strand a navigation.
const NAV_COUNT_KEY = "cx-nav-n";

type Phase = "idle" | "cover" | "open";

export function TransitionShell() {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [durs, setDurs] = useState<{ cover: number; open: number }>({ cover: 0, open: 0 });
  const defRef = useRef<CxTransitionDef | null>(null);
  const targetRef = useRef<string | null>(null); // destination PATHNAME (usePathname compares pathnames only)
  const hrefRef = useRef<string | null>(null); // full destination href for pushes
  const navigatedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };
  const arm = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  // Phase-change driver: when the destination pathname arrives during cover,
  // play the open-out over the freshly painted route, then hand focus to the
  // destination's h1 so keyboard and reader flow land where the eye did.
  useEffect(() => {
    if (phase !== "cover" || !targetRef.current) return;
    if (pathname === targetRef.current) {
      setPhase("open");
      arm(() => {
        setPhase("idle");
        defRef.current = null;
        targetRef.current = null;
        hrefRef.current = null;
        clearTimers();
        const h1 = document.querySelector<HTMLElement>("main h1");
        if (h1) {
          h1.setAttribute("tabindex", "-1");
          h1.focus({ preventScroll: true });
        }
      }, durs.open);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, phase, durs.open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (phase !== "idle") return; // rapid repeat clicks: one journey at a time
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      const rawHref = a.getAttribute("href");
      if (!rawHref || a.hasAttribute("download")) return;
      const target = a.getAttribute("target");
      if (target && target !== "_self") return;
      let url: URL;
      try {
        url = new URL(rawHref, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // in-page anchors

      const def = findTransition(window.location.pathname, url.pathname);
      if (!def) return;

      const tier = detectTier();
      if (tier === "D") return; // reduced motion / user toggle: instant, native

      // Returning users inside this session get the short projection. Director
      // review runs never consume the visitor's counters.
      const director = isDirectorActive();
      let replayed = false;
      try {
        replayed = Number(sessionStorage.getItem(NAV_COUNT_KEY) || "0") >= 1;
        if (!director) sessionStorage.setItem(NAV_COUNT_KEY, "1");
      } catch {
        /* storage unavailable → treat as first play */
      }
      const grade: "A" | "B" | "C" = replayed && !director ? "C" : tier === "A" ? "A" : tier === "B" ? "B" : "C";
      const cover = def.coverMs[grade];
      const open = def.openMs[grade];

      // From here the shell owns THIS navigation (and only this one).
      e.preventDefault();
      e.stopPropagation();
      const href = url.pathname + url.search + url.hash;
      defRef.current = def;
      targetRef.current = url.pathname;
      hrefRef.current = href;
      navigatedRef.current = false;
      setDurs({ cover, open });
      setPhase("cover");

      // Review-build simulation (?cxsim=timeout): suppress the navigation so
      // the Founder can watch the fail-open clock win on its own. Inert on
      // production builds by reviewBuildAllowed().
      const simTimeout =
        reviewBuildAllowed() && /[?&]cxsim=timeout(&|$)/.test(window.location.search);
      if (!simTimeout) {
        arm(() => {
          navigatedRef.current = true;
          router.push(href);
        }, cover);
      }
      // The fail-open clock — measured from the CLICK, unconditional.
      arm(() => {
        window.location.assign(href);
      }, TRANSITION_TIMEOUT_MS);
    };

    // Capture phase: next/link's own click handler would preventDefault before
    // a bubble listener ever saw the event. Everything non-matching returns
    // untouched before any preventDefault, so ordinary links are unaffected.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, router]);

  // Escape: skip the veil. If navigation hasn't fired yet, fire it now; the
  // open-out plays immediately over whatever is there.
  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      clearTimers();
      if (!navigatedRef.current && hrefRef.current) {
        navigatedRef.current = true;
        router.push(hrefRef.current);
      }
      setPhase("open");
      arm(() => {
        setPhase("idle");
        defRef.current = null;
        targetRef.current = null;
        hrefRef.current = null;
        clearTimers();
      }, 160);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, router]);

  if (phase === "idle") return null;
  return (
    <div
      aria-hidden
      className={`cx-nav-veil ${phase === "cover" ? "cx-nav-cover" : "cx-nav-open"}`}
      style={
        {
          "--cx-cover-ms": `${durs.cover}ms`,
          "--cx-open-ms": `${durs.open}ms`,
        } as React.CSSProperties
      }
    >
      <span className="cx-nav-rail cx-nav-rail-l" />
      <span className="cx-nav-rail cx-nav-rail-r" />
    </div>
  );
}
