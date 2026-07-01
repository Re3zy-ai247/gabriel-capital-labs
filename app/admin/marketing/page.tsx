"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2 } from "lucide-react";

interface Marketing {
  audience: { newsletterSubscribers: number; pushSubscribers: number };
  brief: { published: number; drafts: number; totalViews: number; totalLikes: number; comments: number };
  notInstrumented: string[];
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

export default function AdminMarketingPage() {
  const [data, setData] = useState<Marketing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/marketing")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="/ Admin · Marketing">
      <AdminTabs />
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading marketing…
        </div>
      ) : !data ? (
        <p className="text-sm text-rose-400">Could not load marketing metrics.</p>
      ) : (
        <>
          <SectionTitle>Audience</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Newsletter subscribers" value={data.audience.newsletterSubscribers.toLocaleString()}
              sub="opted into the Brief digest" accent="text-brand-400" />
            <Stat label="Push subscribers" value={data.audience.pushSubscribers.toLocaleString()} sub="phone alerts enabled" />
          </div>

          <SectionTitle>Brief / blog performance</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Published articles" value={data.brief.published.toLocaleString()} accent="text-emerald-400" />
            <Stat label="Drafts in queue" value={data.brief.drafts.toLocaleString()} sub="awaiting approval" />
            <Stat label="Total views" value={data.brief.totalViews.toLocaleString()} />
            <Stat label="Engagement" value={`${data.brief.totalLikes} ♥`} sub={`${data.brief.comments} comments`} accent="text-brand-400" />
          </div>

          <SectionTitle>Not yet instrumented</SectionTitle>
          <div className="card border-dashed border-ink-600 p-4">
            <p className="text-[12px] text-slate-400">
              These need an external integration before they can show real numbers — no estimates shown:
            </p>
            <ul className="mt-2 space-y-1 text-[12px] text-slate-500">
              {data.notInstrumented.map((m) => (
                <li key={m} className="flex gap-2"><span className="text-slate-600">○</span>{m}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </AppShell>
  );
}
