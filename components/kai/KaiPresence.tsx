"use client";

// Floating Kai (Product Sprint 1 P2). NOT a chatbot: a quiet, context-aware
// presence rendering the same passive intelligence as Kai Home. Anti-overwhelm
// laws (KAI-PRODUCT-DESIGN §7): never auto-opens, one recommendation only,
// dismissible for the whole session, silent when there is nothing real to say.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

type KaiContext = {
  recommendation: { title: string; cta: string; href: string; basis: string } | null;
  deadline: { recipient: string; daysLeft: number } | null;
  overnightCount: number;
};

const CACHE_KEY = "kai-presence-ctx-v1";
const DISMISS_KEY = "kai-presence-dismissed";
const CACHE_TTL_MS = 5 * 60 * 1000;

// Kai Home (/dashboard) and the Kai-narrated Timeline (/journey) ARE Kai — a
// floating presence there would be a second, redundant Kai.
const EXCLUDED_PATHS = new Set(["/dashboard", "/journey"]);

// Phase 1A cache fix (SIM-REVIEW finding 4 — live defect): sessionStorage has
// no user/workspace scope of its own. [T2 update — the persistent shell,
// components/shell/RoomsShell.tsx: KaiPresence used to be mounted by
// AppShell, which every page.tsx called directly (not the persistent root
// layout), so it remounted on each navigation; that premise is now FALSE for
// every room under app/(rooms)/ — RoomsShell mounts this component ONCE and
// keeps it mounted across client-side navigations between rooms (admin still
// mounts it per-page via the untouched AppShell.tsx, where the original
// remount premise still holds).] The cache exists purely to skip a redundant
// fetch within CACHE_TTL_MS, not to hold state across a remount or a
// pathname change. That window is exactly where it bled: an agency operator
// opening or exiting a client workspace, or signing out, changes WHO the
// next fetch is for without unmounting anything, so a still-mounted (or
// freshly mounted) instance could still read the previous subject's cached
// recommendation. The workspace cookie is httpOnly (by design, unreadable
// here), so this component cannot itself detect "the subject changed" —
// every place that CHANGES it calls this instead, so the next fetch (mount
// OR pathname-change re-run) fetches fresh rather than trusting a stale
// entry. Exported so those switch paths (app/agency/page.tsx openClient,
// components/AgencyBar.tsx exit, components/Sidebar.tsx sign-out) never
// hardcode the key name.
//
// T2.2 FIX 7: persistence (above) removed the free reset a fresh mount used
// to give this component for free — `useState(null)`'s own initializer. A
// STILL-MOUNTED instance whose cache was just cleared (a workspace switch)
// used to be a contradiction (clearing the cache always came bundled with an
// unmount); now it's the normal case. Without an explicit clear, this
// component would keep rendering the PREVIOUS subject's `ctx` for the full
// ~400ms fetch delay below — a real stale-subject flash, not a theoretical
// one. The mount effect now clears `ctx` (and closes any open panel)
// synchronously the moment it determines the fetch path will actually run
// (cache absent or expired), before the delayed fetch is even scheduled.
export function clearKaiPresenceCache(): void {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* cache is best-effort */
  }
}

export function KaiPresence() {
  const pathname = usePathname();
  const [ctx, setCtx] = useState<KaiContext | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Excluded routes neither fetch nor cache. This must run BEFORE the cache
    // read and the fetch below — the render-time guard further down isn't
    // enough on its own, because hooks always run regardless of what a later
    // return in the render body skips, so a guard placed only there still let
    // every visit here write a fresh (soon-to-be-stale-elsewhere) entry. That
    // was the exact mechanism finding 4 names: "openClient() lands on
    // /dashboard, so every ordinary [workspace] switch populates the
    // unscoped cache."
    if (EXCLUDED_PATHS.has(pathname)) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return; // stays dismissed all session

    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { at, data } = JSON.parse(cached) as { at: number; data: KaiContext };
        if (Date.now() - at < CACHE_TTL_MS) {
          setCtx(data);
          setHidden(false);
          return;
        }
      }
    } catch {
      /* cache is best-effort */
    }

    // Fix 7: cache absent/stale — the fetch below WILL run. Clear the
    // previous subject's context (and close any open panel showing it) now
    // rather than leaving it rendered for the ~400ms until the fetch
    // resolves; setOpen(false) also prevents an already-open panel from
    // reopening itself against stale content once the new ctx lands.
    setCtx(null);
    setOpen(false);

    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/kai/context");
        if (!res.ok) return; // signed out or error → Kai simply isn't there
        const data = (await res.json()) as KaiContext;
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        setCtx(data);
        setHidden(false);
      } catch {
        /* network hiccup → stay hidden; never an error state for a presence */
      }
    }, 400); // let the page render first — Kai is never the LCP
    return () => clearTimeout(t);
  }, [pathname]);

  // Close the panel on navigation WITHOUT the focus-return (the user is going
  // somewhere — yanking focus back to the pill on the destination page would
  // steal it from the new page's content).
  useEffect(() => {
    wasOpenRef.current = false;
    setOpen(false);
  }, [pathname]);

  // Lightweight focus handoff: the PANEL (not the dismiss button — Enter there
  // would hide Kai for the whole session) receives focus on open; the pill gets
  // it back on user-initiated close. Non-modal, no trap.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      panelRef.current?.focus();
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      pillRef.current?.focus();
    }
  }, [open]);

  // Escape closes the panel — but only when focus is within Kai's own UI, so
  // a user mid-typing in an unrelated input never has focus stolen.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const root = rootRef.current;
      if (root && document.activeElement && !root.contains(document.activeElement)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (hidden || !ctx) return null;
  // Belt-and-suspenders — the mount effect above already skips fetch/cache
  // here entirely, so ctx can only be non-null from a still-fresh cache
  // written on a still-included route before a client-side navigation.
  if (EXCLUDED_PATHS.has(pathname)) return null;

  const hasSomething = Boolean(ctx.recommendation || ctx.deadline || ctx.overnightCount > 0);
  const contextLine = ctx.deadline
    ? ctx.deadline.daysLeft <= 0
      ? `The ${ctx.deadline.recipient} response window has passed.`
      : `Watching the ${ctx.deadline.recipient} window — ${ctx.deadline.daysLeft}d left.`
    : ctx.overnightCount > 0
      ? `${ctx.overnightCount} update${ctx.overnightCount === 1 ? "" : "s"} since your last visit.`
      : "Your file is quiet. I'm watching it.";

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  }

  return (
    <div ref={rootRef} className="fixed bottom-20 right-4 z-30 md:bottom-6 md:right-6 print:hidden">
      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-label="Kai"
          className="mb-2 w-72 rounded-xl border border-ink-600/80 bg-ink-900/95 p-4 shadow-2xl shadow-black/40 backdrop-blur motion-safe:animate-rise"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
              <span className="text-[11px] text-slate-500">Credit Intelligence Officer</span>
            </div>
            <button onClick={dismiss} aria-label="Dismiss Kai for this session" className="-m-1.5 rounded-md p-1.5 text-slate-500 transition-colors hover:text-slate-300">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <p className="mt-2 text-sm text-slate-300">{contextLine}</p>

          {ctx.recommendation && (
            <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/[0.06] p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-300">Kai recommends</div>
              <div className="mt-1 text-xs font-medium text-slate-200">{ctx.recommendation.title}</div>
              <Link href={ctx.recommendation.href} onClick={() => setOpen(false)} className="btn-primary mt-2 inline-block !py-1 text-[11px]">
                {ctx.recommendation.cta} →
              </Link>
              <p className="mt-1.5 text-[10px] text-slate-500">{ctx.recommendation.basis}</p>
            </div>
          )}

          <Link href="/dashboard" onClick={() => setOpen(false)} className="mt-3 block text-[11px] font-semibold text-brand-400 hover:underline">
            Open Kai Home →
          </Link>
        </div>
      )}

      <button
        ref={pillRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close Kai" : `Open Kai${hasSomething ? " — updates available" : ""}`}
        className="flex items-center gap-2 rounded-full border border-ink-600/80 bg-ink-900/95 py-2 pl-3 pr-3.5 text-xs shadow-lg shadow-black/30 backdrop-blur transition-colors hover:border-brand-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className={`absolute inline-flex h-full w-full rounded-full ${hasSomething ? "bg-brand-400 motion-safe:animate-ping opacity-60" : ""}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${hasSomething ? "bg-brand-400" : "bg-slate-600"}`} />
        </span>
        <span className="font-bold tracking-widest text-brand-300">KAI</span>
      </button>
    </div>
  );
}
