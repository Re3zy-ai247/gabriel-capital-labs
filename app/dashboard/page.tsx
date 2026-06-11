import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { StatCard } from "@/components/ui/StatCard";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { BUREAU_LABEL } from "@/lib/bureaus";
import type { Bureau } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Dashboard"><p className="text-slate-400">Please sign in.</p></AppShell>;

  const [tradelines, letters, reports] = await Promise.all([
    prisma.tradeline.findMany({ where: { userId: user.id } }),
    prisma.letter.findMany({ where: { userId: user.id } }),
    prisma.report.findMany({ where: { userId: user.id } }),
  ]);

  // Single source of truth — every metric derives from these arrays so they reconcile.
  const negative = tradelines.length;
  const resolved = tradelines.filter((t) => t.resolved).length;
  const disputedIds = new Set(letters.map((l) => l.tradelineId).filter(Boolean));
  const disputed = disputedIds.size;
  const active = tradelines.filter((t) => disputedIds.has(t.id) && !t.resolved).length;
  const completion = negative ? Math.round((resolved / negative) * 100) : 0;

  const byBureau = (b: Bureau) => {
    const inB = tradelines.filter((t) => {
      const d = t.bureauData as Record<string, { presence?: string }>;
      return d?.[b]?.presence === "PRESENT";
    });
    const res = inB.filter((t) => t.resolved).length;
    return { total: inB.length, resolved: res };
  };

  return (
    <AppShell title="/ Dashboard">
      <EduBanner />
      <h2 className="mb-4 text-xl font-semibold">Your Credit Dashboard</h2>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Negative Items" value={negative} accent="rose" />
        <StatCard label="Items Disputed" value={disputed} accent="slate" />
        <StatCard label="Active Disputes" value={active} accent="gold" />
        <StatCard label="Letters Generated" value={letters.length} accent="brand" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400">Dispute Completion</div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-3xl font-bold text-brand-400">{completion}%</div>
            <div className="pb-1 text-xs text-slate-500">{resolved} of {negative} items resolved</div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full bg-brand-500" style={{ width: `${completion}%` }} />
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400">Est. Points Recovered</div>
          <div className="mt-2 text-3xl font-bold text-gold-400">~ estimate</div>
          <p className="mt-1 text-[11px] text-slate-500">
            Estimated impact only — actual results vary by profile, utilization, and scoring model. Not a prediction.
          </p>
        </div>
      </div>

      <div className="card mt-3 p-5">
        <div className="mb-3 text-sm font-semibold">Dispute Progress by Bureau</div>
        {(["EQUIFAX", "EXPERIAN", "TRANSUNION"] as Bureau[]).map((b) => {
          const s = byBureau(b);
          const pct = s.total ? Math.round((s.resolved / s.total) * 100) : 0;
          return (
            <div key={b} className="mb-3 last:mb-0">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{BUREAU_LABEL[b]}</span>
                <span>{s.resolved} of {s.total} resolved</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <StatCard label="Reports Uploaded" value={reports.length} />
        <StatCard label="Analyzed" value={reports.filter((r) => r.analyzedAt).length} />
        <StatCard label="Items Resolved" value={resolved} accent="brand" />
      </div>

      <Disclaimer />
    </AppShell>
  );
}
