"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2 } from "lucide-react";

interface ProductHealth {
  support: { open: number; responded: number; closed: number };
  moderation: { communityReportsOpen: number; flaggedComments: number; removedComments: number };
  reports: { total: number; analyzed: number; stalePending: number; analyzeRate: number };
  letters: {
    total: number; mailed: number; responded: number; resolved: number;
    outcomeDeleted: number; outcomeUpdated: number; outcomeVerified: number; favorableRate: number;
  };
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-300">{children}</h2>;
}

export default function AdminProductHealthPage() {
  const [data, setData] = useState<ProductHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/product-health")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="/ Admin · Product Health">
      <AdminTabs />
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading product health…
        </div>
      ) : !data ? (
        <p className="text-sm text-rose-400">Could not load product health.</p>
      ) : (
        <>
          <SectionTitle>Support queue</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Open tickets" value={`${data.support.open}`} sub="awaiting first staff reply"
              accent={data.support.open > 0 ? "text-gold-400" : undefined} />
            <Stat label="Responded" value={`${data.support.responded}`} sub="awaiting user" />
            <Stat label="Closed" value={`${data.support.closed}`} />
          </div>

          <SectionTitle>Moderation</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Open community reports" value={`${data.moderation.communityReportsOpen}`}
              accent={data.moderation.communityReportsOpen > 0 ? "text-rose-400" : undefined} />
            <Stat label="Flagged comments" value={`${data.moderation.flaggedComments}`}
              accent={data.moderation.flaggedComments > 0 ? "text-rose-400" : undefined} />
            <Stat label="Removed comments" value={`${data.moderation.removedComments}`} sub="lifetime" />
          </div>

          <SectionTitle>Report processing</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Reports uploaded" value={data.reports.total.toLocaleString()} />
            <Stat label="Analyzed" value={data.reports.analyzed.toLocaleString()} />
            <Stat label="Analyze rate" value={`${data.reports.analyzeRate}%`} accent="text-brand-400" />
            <Stat label="Stale / unparsed" value={`${data.reports.stalePending}`}
              sub="uploaded >1h ago, never analyzed"
              accent={data.reports.stalePending > 0 ? "text-rose-400" : undefined} />
          </div>

          <SectionTitle>Dispute funnel &amp; outcomes</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Letters generated" value={data.letters.total.toLocaleString()} />
            <Stat label="Mailed" value={data.letters.mailed.toLocaleString()} />
            <Stat label="Responses logged" value={data.letters.responded.toLocaleString()} />
            <Stat label="Resolved" value={data.letters.resolved.toLocaleString()} accent="text-emerald-400" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Outcome: deleted" value={`${data.letters.outcomeDeleted}`} accent="text-emerald-400" />
            <Stat label="Outcome: updated" value={`${data.letters.outcomeUpdated}`} />
            <Stat label="Outcome: verified" value={`${data.letters.outcomeVerified}`} sub="unchanged by bureau" />
            <Stat label="Favorable rate" value={`${data.letters.favorableRate}%`}
              sub="deleted+updated / responses" accent="text-brand-400" />
          </div>

          <p className="mt-6 text-[11px] text-slate-500">
            Every figure is a live database count — nothing is estimated. Product-quality signals
            like AI-parse accuracy, upload-error rate, and user-satisfaction/NPS are not yet
            instrumented; wiring them is a tracked backlog item.
          </p>
        </>
      )}
    </AppShell>
  );
}
