"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { useAdminContext } from "@/components/admin/useAdminContext";
import { Loader2, Flag, Newspaper } from "lucide-react";

interface Overview {
  totalUsers: number;
  signups30d: number;
  premiumUsers: number;
  agencyUsers: number;
  managedClients: number;
  activeSubs: number;
  totalLetters: number;
  totalReports: number;
  mrr: number;
  arr: number;
  mrrSource?: "stripe" | "estimated";
  conversionRate: number;
  churnedSubs: number;
  pastDueSubs: number;
  churnRate: number;
}

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const ctx = useAdminContext();
  const openReports = ctx?.openReports ?? 0;
  const pendingBrief = ctx?.pendingBrief ?? 0;

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="/ Admin">
      <AdminTabs />
      {openReports > 0 && (
        <Link
          href="/admin/reports"
          className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/15"
        >
          <Flag className="h-4 w-4" />
          {openReports} community {openReports === 1 ? "report" : "reports"} awaiting review
          <span className="ml-auto text-rose-300">Review →</span>
        </Link>
      )}
      {pendingBrief > 0 && (
        <Link
          href="/admin/brief"
          className="mb-4 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm font-medium text-brand-200 transition hover:bg-brand-500/15"
        >
          <Newspaper className="h-4 w-4" />
          {pendingBrief} Brief {pendingBrief === 1 ? "draft" : "drafts"} awaiting approval
          <span className="ml-auto text-brand-300">Review →</span>
        </Link>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading metrics…
        </div>
      ) : !data ? (
        <p className="text-sm text-rose-400">Could not load metrics.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label={data.mrrSource === "stripe" ? "MRR (Stripe)" : "MRR (estimated)"}
              value={money(data.mrr)}
              sub={`${money(data.arr)} ARR`}
              accent="text-brand-400"
            />
            <Stat label="Paid Subscriptions" value={`${data.premiumUsers + data.agencyUsers}`}
              sub={`${data.premiumUsers} premium · ${data.agencyUsers} agency`} accent="text-success-400" />
            <Stat label="Active in Stripe" value={`${data.activeSubs}`} sub="active / trialing / past-due" />
            <Stat label="Conversion" value={`${data.conversionRate}%`} sub="paid / total accounts" accent="text-gold-400" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total Accounts" value={data.totalUsers.toLocaleString()} sub={`+${data.signups30d} in 30 days`} />
            <Stat label="Managed Clients" value={data.managedClients.toLocaleString()} sub="across all agencies" />
            <Stat label="Letters Generated" value={data.totalLetters.toLocaleString()} />
            <Stat label="Reports Analyzed" value={data.totalReports.toLocaleString()} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Churn" value={`${data.churnRate}%`} sub={`${data.churnedSubs} canceled / unpaid`}
              accent={data.churnRate > 0 ? "text-rose-400" : undefined} />
            <Stat label="Past due (at risk)" value={`${data.pastDueSubs}`} sub="payment failing"
              accent={data.pastDueSubs > 0 ? "text-gold-400" : undefined} />
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            {data.mrrSource === "stripe"
              ? "MRR is summed from live Stripe subscriptions (active + past-due, normalized monthly; trials and comped accounts excluded)."
              : "MRR is an ESTIMATE from plan entitlements ($99 Premium, $399 Agency) — Stripe was unreachable; comped accounts inflate it."}{" "}
            Churn is a lifetime proxy (canceled ÷ canceled+active) until time-series billing is wired.
          </p>
        </>
      )}
    </AppShell>
  );
}
