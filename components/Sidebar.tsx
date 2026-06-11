"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Upload, ListTree, Mails, Target, CalendarRange, Gauge, Settings, CreditCard, ScanSearch, LineChart,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Report", icon: Upload },
  { href: "/tradelines", label: "Tradelines", icon: ListTree },
  { href: "/identity", label: "Identity Check", icon: ScanSearch },
  { href: "/letters", label: "Dispute Letters", icon: Mails },
  { href: "/strategist", label: "AI Strategist", icon: Target },
  { href: "/scores", label: "Score Tracker", icon: LineChart },
  { href: "/journey", label: "90-Day Journey", icon: CalendarRange },
];

const ACCOUNT_NAV = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-700/70 bg-ink-900/60 p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-ink-950">
          <Gauge className="h-5 w-5" />
        </div>
        <span className="text-sm font-semibold leading-tight">
          Gabriel Capital<br />
          <span className="text-brand-400">Labs</span>
        </span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((n) => {
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
          {ACCOUNT_NAV.map((n) => {
            const active = path === n.href || path?.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} className={cn("nav-item", active && "nav-item-active")}>
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto px-2 pt-6 text-[10px] text-slate-500">
        v1.0 · Educational tool · Not legal advice
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-ink-700 bg-ink-900/95 py-2 backdrop-blur md:hidden">
      {NAV.slice(0, 5).map((n) => {
        const active = path === n.href;
        return (
          <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-0.5 px-2 text-[10px]", active ? "text-brand-400" : "text-slate-400")}>
            <n.icon className="h-5 w-5" />
            {n.label.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
  );
}
