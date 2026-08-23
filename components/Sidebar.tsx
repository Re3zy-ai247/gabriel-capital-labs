"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { loginPathFor } from "@/lib/callbackUrl";
import { useAdminContext } from "./admin/useAdminContext";
import { useCommunityAccess } from "./community/useCommunityAccess";
import { useOnboardingStatus, clearOnboardingStatusCache } from "./onboarding/useOnboardingStatus";
import { BrandLogo } from "./BrandLogo";
import { clearKaiPresenceCache } from "./kai/KaiPresence";
import {
  LayoutDashboard, Upload, ListTree, Mails, Target, CalendarRange, Settings, CreditCard, ScanSearch, LineChart, Building2, LogOut, LogIn, Menu, X, ShieldCheck, MessagesSquare, LifeBuoy, HelpCircle, Newspaper, Send, Layers, Sprout, GraduationCap, ListChecks,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Mission Control", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Report", icon: Upload },
  { href: "/tradelines", label: "Tradelines", icon: ListTree },
  { href: "/identity", label: "Identity Check", icon: ScanSearch },
  { href: "/letters", label: "Dispute Letters", icon: Mails },
  { href: "/campaigns", label: "Campaigns", icon: Layers },
  { href: "/mail", label: "Mail Center", icon: Send },
  { href: "/strategist", label: "Strategy Desk", icon: Target },
  { href: "/scores", label: "Score Tracker", icon: LineChart },
  { href: "/builder", label: "Credit Builder", icon: Sprout },
  { href: "/academy", label: "Academy", icon: GraduationCap },
  { href: "/journey", label: "Timeline", icon: CalendarRange },
  { href: "/brief", label: "Brief", icon: Newspaper },
];

// A1-09: /help was a public orphan — served, indexed, and linked from nowhere a
// human navigates. The only two references in the whole codebase were inside the
// Credit Builder engine. It belongs beside Support in the account section.
const ACCOUNT_NAV = [
  { href: "/agency", label: "Agency", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

// Admin link is prepended to the account section only for ADMIN users.
const ADMIN_LINK = { href: "/admin", label: "Admin", icon: ShieldCheck };

// Operator Network link appears in the main nav for every paid member (+ owner);
// visibility follows the server's /api/community/access probe (canAccessCommunity).
const COMMUNITY_LINK = { href: "/community", label: "Operator Network", icon: MessagesSquare };

// Getting Started appears only while onboarding is genuinely incomplete
// (Phase 1A, Agent E — ROOM-RECOMMENDATIONS row 7); visibility follows the
// server's /api/onboarding/status probe. Dismissible by completion only — no
// manual dismiss control exists, it simply stops rendering once every real
// signal is there. Inserted right after Mission Control so it stays visible
// without displacing it.
const ONBOARDING_LINK = { href: "/onboarding", label: "Getting Started", icon: ListChecks };
function withOnboarding(nav: typeof NAV, incomplete: boolean | undefined): typeof NAV {
  return incomplete ? [nav[0], ONBOARDING_LINK, ...nav.slice(1)] : nav;
}

// Primary destinations pinned to the mobile bottom bar; everything else (incl.
// Agency, Settings, Billing) lives behind "More".
const MOBILE_PRIMARY = ["/dashboard", "/upload", "/tradelines", "/letters"];

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <BrandLogo className="h-9 w-9" />
      <span className="text-sm font-semibold leading-tight">
        {BRAND.product}
        <span className="text-brand-400">™</span>
        <br />
        <span className="text-[10px] font-normal text-slate-500">{BRAND.byline}</span>
      </span>
    </div>
  );
}

// P0-5 (correction G) / A1-08: both of these controls used to be a button
// labelled "Log out" that called signOut({ callbackUrl: "/login" }). For a
// signed-in consumer that is correct. For a consumer whose session had expired —
// the exact person who needed it — it was the ONLY route back into the product,
// wearing the label of the one thing they did not want to do. The control now
// says what it does.
//
// While NextAuth is still resolving (`status === "loading"`) this stays on the
// signed-in spelling: that is the overwhelmingly common case, and the label
// settles to the truth the moment the session resolves. Only a RESOLVED
// "unauthenticated" flips it — including for the pre-RC1 uid-only JWTs that
// lib/auth.ts now declines to honour, which is precisely the population that
// must be offered a way in rather than a way out.
//
// Only the DECISION is shared. The two controls themselves stay written out at
// both call sites: scripts/kai-experience.test.ts:50-52 counts the sign-out
// handlers in this file and asserts each one clears the Kai presence cache
// first, because a different account may sign in on the same tab. Collapsing
// them into one shared control would make that guard see one handler where two
// exist — and a guard that can no longer see both sites is not a guard.
function useSignedOut(): boolean {
  const { status } = useSession();
  return status === "unauthenticated";
}

export function Sidebar() {
  const path = usePathname();
  const signedOut = useSignedOut();
  const ctx = useAdminContext();
  const community = useCommunityAccess();
  const onboarding = useOnboardingStatus();
  const mainNav = withOnboarding(community?.canAccess ? [...NAV, COMMUNITY_LINK] : NAV, onboarding?.incomplete);
  const accountNav = ctx?.isAdmin ? [ADMIN_LINK, ...ACCOUNT_NAV] : ACCOUNT_NAV;
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-700/70 bg-ink-900/60 p-4 md:flex">
      <div className="mb-6 px-2">
        <BrandMark />
      </div>
      <nav className="flex flex-col gap-1">
        {mainNav.map((n) => {
          const active = path === n.href || path?.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("nav-item", active && "nav-item-active")}>
              <n.icon className="h-4 w-4" aria-hidden />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 border-t border-ink-700/70 pt-4">
        <div className="mb-1 px-3 text-[10px] uppercase tracking-wide text-slate-500">Account</div>
        <nav className="flex flex-col gap-1">
          {accountNav.map((n) => {
            const active = path === n.href || path?.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("nav-item", active && "nav-item-active")}>
                <n.icon className="h-4 w-4" aria-hidden />
                {n.label}
                {n.href === "/admin" && (ctx?.openReports ?? 0) + (ctx?.pendingBrief ?? 0) > 0 && (
                  <span className="ml-auto rounded-full bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-300">{(ctx?.openReports ?? 0) + (ctx?.pendingBrief ?? 0)}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      {signedOut ? (
        <Link href={loginPathFor(path ?? "/dashboard")} className="nav-item mt-4 w-full text-left text-slate-400 hover:text-brand-300">
          <LogIn className="h-4 w-4" aria-hidden />
          Sign in
        </Link>
      ) : (
        <button
          onClick={() => { clearKaiPresenceCache(); clearOnboardingStatusCache(); signOut({ callbackUrl: "/login" }); }}
          className="nav-item mt-4 w-full text-left text-slate-400 hover:text-rose-300"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Log out
        </button>
      )}
      <div className="mt-auto px-2 pt-6 text-[10px] text-slate-500">
        v1.0 · Educational tool · Not legal advice
      </div>
    </aside>
  );
}

// Everything inside the drawer that can hold focus. Used by the trap below.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNav() {
  const path = usePathname();
  const signedOut = useSignedOut();
  const [open, setOpen] = useState(false);
  const ctx = useAdminContext();
  const community = useCommunityAccess();
  const onboarding = useOnboardingStatus();
  const mainNav = withOnboarding(community?.canAccess ? [...NAV, COMMUNITY_LINK] : NAV, onboarding?.incomplete);
  const accountNav = ctx?.isAdmin ? [ADMIN_LINK, ...ACCOUNT_NAV] : ACCOUNT_NAV;
  const primary = MOBILE_PRIMARY.map((href) => NAV.find((n) => n.href === href)!).filter(Boolean);
  const isActive = (href: string) => path === href || path?.startsWith(href + "/");

  // A1-08. This drawer declared role="dialog" aria-modal="true" and then honoured
  // none of the contract: no Escape, no focus trap, no focus restore, no scroll
  // lock. A keyboard or screen-reader user tabbed straight out of a container
  // that claims to have hidden everything behind it — and this is the drawer a
  // signed-in consumer uses to reach Settings, Billing, Support and sign-out.
  const openerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  // Focus goes back to the "More" trigger when the drawer is DISMISSED, but not
  // when it closes because the user picked a destination — there, focus belongs
  // to the page they asked for, not to the control they left behind.
  const restoreFocusRef = useRef(true);

  const closeDrawer = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    // Captured here rather than read in the cleanup: by cleanup time React has
    // already unmounted the dialog, and the linter is right that a ref read then
    // is a different question from the one we mean. The "More" trigger is a
    // stable node for the drawer's whole lifetime, so the captured value IS the
    // element focus must return to.
    const opener = openerRef.current;
    // Land inside the dialog rather than leaving focus on the trigger behind it.
    const initialFocus = drawer?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    initialFocus?.focus({ preventScroll: true });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeDrawer(true);
        return;
      }
      if (e.key !== "Tab" || !drawer) return;
      const items = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Wrap at the ends, and pull focus back in if it ever escaped the dialog.
      if (!active || !drawer.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    // Capture phase: the handler must win before any inner control treats the
    // same key as its own.
    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (restoreFocusRef.current) opener?.focus({ preventScroll: true });
      restoreFocusRef.current = true;
    };
  }, [open, closeDrawer]);

  return (
    <>
      {/* Slide-up drawer with the full navigation (incl. Agency/Settings/Billing). */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden onClick={() => closeDrawer(true)} />
          <div ref={drawerRef} className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-ink-700 bg-ink-900 p-5 pb-8 shadow-2xl animate-rise">
            <div className="mb-4 flex items-center justify-between">
              <BrandMark />
              <button onClick={() => closeDrawer(true)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-ink-700 hover:text-white" aria-label="Close menu">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-2">
              {mainNav.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => closeDrawer(false)}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={cn("nav-item min-h-[44px]", isActive(n.href) && "nav-item-active")}>
                  <n.icon className="h-4 w-4" aria-hidden /> {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 border-t border-ink-700/70 pt-4">
              <div className="mb-1 px-1 text-[10px] uppercase tracking-wide text-slate-500">Account</div>
              <nav className="grid grid-cols-2 gap-2">
                {accountNav.map((n) => (
                  <Link key={n.href} href={n.href} onClick={() => closeDrawer(false)}
                    aria-current={isActive(n.href) ? "page" : undefined}
                    className={cn("nav-item min-h-[44px]", isActive(n.href) && "nav-item-active")}>
                    <n.icon className="h-4 w-4" aria-hidden /> {n.label}
                    {n.href === "/admin" && (ctx?.openReports ?? 0) + (ctx?.pendingBrief ?? 0) > 0 && (
                      <span className="ml-auto rounded-full bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-300">{(ctx?.openReports ?? 0) + (ctx?.pendingBrief ?? 0)}</span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>
            {signedOut ? (
              <Link href={loginPathFor(path ?? "/dashboard")} onClick={() => closeDrawer(false)} className="nav-item mt-4 min-h-[44px] w-full text-left text-slate-400 hover:text-brand-300">
                <LogIn className="h-4 w-4" aria-hidden /> Sign in
              </Link>
            ) : (
              <button
                onClick={() => { closeDrawer(false); clearKaiPresenceCache(); clearOnboardingStatusCache(); signOut({ callbackUrl: "/login" }); }}
                className="nav-item mt-4 min-h-[44px] w-full text-left text-slate-400 hover:text-rose-300"
              >
                <LogOut className="h-4 w-4" aria-hidden /> Log out
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom tab bar: primary destinations + a "More" button for everything else.
          Hidden from assistive technology while the drawer claims aria-modal, so the
          two navigations are never announced as one (the focus trap above enforces
          the same boundary for keyboard users). */}
      <nav aria-hidden={open || undefined} className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-ink-700 bg-ink-900/95 py-2 backdrop-blur md:hidden">
        {primary.map((n) => (
          <Link key={n.href} href={n.href}
            aria-current={isActive(n.href) ? "page" : undefined}
            className={cn("flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[10px] font-medium transition-colors", isActive(n.href) ? "text-brand-400" : "text-slate-400")}>
            <n.icon className="h-5 w-5" aria-hidden />
            {n.label.split(" ")[0]}
          </Link>
        ))}
        <button
          ref={openerRef}
          // Blur before opening: the trigger lives inside the bar this drawer
          // marks aria-hidden, and focus must never sit inside a hidden subtree.
          // The effect above then places it on the first control in the dialog.
          onClick={() => { openerRef.current?.blur(); setOpen(true); }}
          className={cn("flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[10px] font-medium transition-colors", open ? "text-brand-400" : "text-slate-400")}
          aria-label="More navigation"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Menu className="h-5 w-5" aria-hidden />
          More
        </button>
      </nav>
    </>
  );
}
