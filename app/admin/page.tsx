"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2 } from "lucide-react";

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
  conversionRate: number;
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

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="/ Admin">
      <AdminTabs />
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading metrics…
        </div>
      ) : !data ? (
        <p className="text-sm text-rose-400">Could not load metrics.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="MRR" value={money(data.mrr)} sub={`${money(data.arr)} ARR`} accent="text-brand-400" />
            <Stat label="Paid Subscriptions" value={`${data.premiumUsers + data.agencyUsers}`}
              sub={`${data.premiumUsers} premium · ${data.agencyUsers} agency`} accent="text-emerald-400" />
            <Stat label="Active in Stripe" value={`${data.activeSubs}`} sub="active / trialing / past-due" />
            <Stat label="Conversion" value={`${data.conversionRate}%`} sub="paid / total accounts" accent="text-gold-400" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total Accounts" value={data.totalUsers.toLocaleString()} sub={`+${data.signups30d} in 30 days`} />
            <Stat label="Managed Clients" value={data.managedClients.toLocaleString()} sub="across all agencies" />
            <Stat label="Letters Generated" value={data.totalLetters.toLocaleString()} />
            <Stat label="Reports Analyzed" value={data.totalReports.toLocaleString()} />
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            MRR is based on active plan entitlements ($99 Premium, $399 Agency), including comped accounts.
          </p>
        </>
      )}
    </AppShell>
  );
}
