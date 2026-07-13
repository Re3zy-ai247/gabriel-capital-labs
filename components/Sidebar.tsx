"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { useAdminContext } from "./admin/useAdminContext";
import { useCommunityAccess } from "./community/useCommunityAccess";
import { BrandLogo } from "./BrandLogo";
import {
  LayoutDashboard, Upload, ListTree, Mails, Target, CalendarRange, Settings, CreditCard, ScanSearch, LineChart, Building2, LogOut, Menu, X, ShieldCheck, MessagesSquare, LifeBuoy, Newspaper,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Kai Home", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Report", icon: Upload },
  { href: "/tradelines", label: "Tradelines", icon: ListTree },
  { href: "/identity", label: "Identity Check", icon: ScanSearch },
  { href: "/letters", label: "Dispute Letters", icon: Mails },
  { href: "/strategist", label: "AI Strategist", icon: Target },
  { href: "/scores", label: "Score Tracker", icon: LineChart },
  { href: "/journey", label: "Timeline", icon: CalendarRange },
  { href: "/brief", label: "Brief", icon: Newspaper },
];

const ACCOUNT_NAV = [
  { href: "/agency", label: "Agency", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

// Admin link is prepended to the account section only for ADMIN users.
const ADMIN_LINK = { href: "/admin", label: "Admin", icon: ShieldCheck };

// Community link appears in the main nav only for agency members (+ owner).
const COMMUNITY_LINK = { href: "/community", label: "Community", icon: MessagesSquare };

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

export function Sidebar() {
  const path = usePathname();
  const ctx = useAdminContext();
  const community = useCommunityAccess();
  const mainNav = community?.canAccess ? [...NAV, COMMUNITY_LINK] : NAV;
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
            <Link key={n.href} href={n.href} className={cn("nav-item", active && "nav-item-active")}>
              <n.icon className="h-4 w-4" />
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
              <Link key={n.href} href={n.href} className={cn("nav-item", active && "nav-item-active")}>
                <n.icon className="h-4 w-4" />
                {n.label}
                {n.href === "/admin" && (ctx?.openReports ?? 0) + (ctx?.pendingBrief ?? 0) > 0 && (
                  <span className="ml-auto rounded-full bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-300">{(ctx?.openReports ?? 0) + (ctx?.pendingBrief ?? 0)}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="nav-item mt-4 w-full text-left text-slate-400 hover:text-rose-300"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
      <div className="mt-auto px-2 pt-6 text-[10px] text-slate-500">
        v1.0 · Educational tool · Not legal advice
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ctx = useAdminContext();
  const community = useCommunityAccess();
  const mainNav = community?.canAccess ? [...NAV, COMMUNITY_LINK] : NAV;
  const accountNav = ctx?.isAdmin ? [ADMIN_LINK, ...ACCOUNT_NAV] : ACCOUNT_NAV;
  const primary = MOBILE_PRIMARY.map((href) => NAV.find((n) => n.href === href)!).filter(Boolean);
  const isActive = (href: string) => path === href || path?.startsWith(href + "/");

  return (
    <>
      {/* Slide-up drawer with the full navigation (incl. Agency/Settings/Billing). */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-ink-700 bg-ink-900 p-5 pb-8 shadow-2xl animate-rise">
            <div className="mb-4 flex items-center justify-between">
              <BrandMark />
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-ink-700 hover:text-white" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-2">
              {mainNav.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                  className={cn("nav-item", isActive(n.href) && "nav-item-active")}>
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 border-t border-ink-700/70 pt-4">
              <div className="mb-1 px-1 text-[10px] uppercase tracking-wide text-slate-500">Account</div>
              <nav className="grid grid-cols-2 gap-2">
                {accountNav.map((n) => (
                  <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                    className={cn("nav-item", isActive(n.href) && "nav-item-active")}>
                    <n.icon className="h-4 w-4" /> {n.label}
                    {n.href === "/admin" && (ctx?.openReports ?? 0) + (ctx?.pendingBrief ?? 0) > 0 && (
                      <span className="ml-auto rounded-full bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-300">{(ctx?.openReports ?? 0) + (ctx?.pendingBrief ?? 0)}</span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>
            <button
              onClick={() => { setOpen(false); signOut({ callbackUrl: "/login" }); }}
              className="nav-item mt-4 w-full text-left text-slate-400 hover:text-rose-300"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      )}

      {/* Bottom tab bar: primary destinations + a "More" button for everything else. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-ink-700 bg-ink-900/95 py-2 backdrop-blur md:hidden">
        {primary.map((n) => (
          <Link key={n.href} href={n.href}
            className={cn("flex flex-col items-center gap-0.5 px-2 text-[10px]", isActive(n.href) ? "text-brand-400" : "text-slate-400")}>
            <n.icon className="h-5 w-5" />
            {n.label.split(" ")[0]}
          </Link>
        ))}
        <button
          onClick={() => setOpen(true)}
          className={cn("flex flex-col items-center gap-0.5 px-2 text-[10px]", open ? "text-brand-400" : "text-slate-400")}
          aria-label="More navigation"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>
    </>
  );
}
