"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAdminContext } from "./useAdminContext";
import { BarChart3, Activity, TrendingUp, Zap, Ticket, Users, Building2, ScrollText, CreditCard, ShieldCheck, Megaphone, Flag, Newspaper } from "lucide-react";

const TABS = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/product", label: "Product", icon: Activity },
  { href: "/admin/marketing", label: "Marketing", icon: TrendingUp },
  { href: "/admin/automation", label: "Automation", icon: Zap },
  { href: "/admin/discounts", label: "Discount Codes", icon: Ticket },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/agencies", label: "Agencies", icon: Building2 },
  { href: "/admin/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/brief", label: "Brief", icon: Newspaper },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

export function AdminTabs() {
  const path = usePathname();
  const ctx = useAdminContext();
  const openReports = ctx?.openReports ?? 0;
  // Brief tab signals all Brief work needing attention: drafts to approve +
  // comments reported for moderation (the Brief page routes to each).
  const briefAttention = (ctx?.pendingBrief ?? 0) + (ctx?.flaggedComments ?? 0);
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-ink-700/70 pb-2">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" : path?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              active ? "bg-brand-500/15 text-brand-300" : "text-slate-400 hover:bg-ink-700/60 hover:text-white"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.href === "/admin/reports" && openReports > 0 && (
              <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-300">{openReports}</span>
            )}
            {t.href === "/admin/brief" && briefAttention > 0 && (
              <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-300">{briefAttention}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
