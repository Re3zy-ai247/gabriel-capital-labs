import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { ProbabilityBadge } from "@/components/ui/Badge";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { estimatedPointImpact } from "@/lib/scoring";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StrategistPage() {
  const user = await currentUserOrDemo();
  const tradelines = user ? await prisma.tradeline.findMany({ where: { userId: user.id }, orderBy: { score: "desc" } }) : [];
  const counts = {
    HIGH: tradelines.filter((t) => t.probability === "HIGH").length,
    MEDIUM: tradelines.filter((t) => t.probability === "MEDIUM").length,
    LOW: tradelines.filter((t) => t.probability === "LOW").length,
    NR: tradelines.filter((t) => t.probability === "NOT_RECOMMENDED").length,
  };
  const queue = tradelines.filter((t) => t.probability !== "NOT_RECOMMENDED");
  const excluded = tradelines.filter((t) => t.probability === "NOT_RECOMMENDED");

  return (
    <AppShell title="/ AI Strategist">
      <EduBanner />
      <h2 className="mb-1 text-xl font-semibold">AI Dispute Strategist</h2>
      <p className="mb-4 text-sm text-slate-400">Attack priority ranked by account type, age, debt-buyer status, and verifiable inconsistencies.</p>

      <div className="mb-5 grid grid-cols-4 gap-3">
        <div className="card p-4 text-center"><div className="text-xl font-bold text-brand-400">{counts.HIGH}</div><div className="text-[11px] uppercase text-slate-400">High</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-gold-400">{counts.MEDIUM}</div><div className="text-[11px] uppercase text-slate-400">Medium</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-slate-300">{counts.LOW}</div><div className="text-[11px] uppercase text-slate-400">Low</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-rose-300">{counts.NR}</div><div className="text-[11px] uppercase text-slate-400">Excluded</div></div>
      </div>

      <div className="space-y-2">
        {queue.map((t, i) => (
          <div key={t.id} className="card flex items-center gap-4 p-4">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-ink-600 text-xs font-semibold text-slate-300">#{i + 1}</div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-700 text-xs font-bold text-brand-300">{t.score}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 truncate font-medium">{t.creditorName} <ProbabilityBadge p={t.probability} /></div>
              <div className="truncate text-xs text-slate-500">{t.reasons[0] || "—"} · {formatCents(t.balance)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-brand-400">+{estimatedPointImpact(t.accountType, t.probability)} pts</div>
              <div className="text-[10px] text-slate-500">est. impact</div>
            </div>
          </div>
        ))}
      </div>

      {excluded.length > 0 && (
        <div className="card mt-5 p-4">
          <div className="mb-2 text-sm font-semibold text-rose-300">Excluded from dispute queue</div>
          <p className="mb-3 text-xs text-slate-400">These are government/statutory debts that generally cannot be disputed off a report. Pursuing them is ineffective and can hurt credibility.</p>
          {excluded.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-t border-ink-700/50 py-2 text-sm first:border-0">
              <span>{t.creditorName}</span><span className="text-xs text-slate-500">{formatCents(t.balance)}</span>
            </div>
          ))}
        </div>
      )}
      <Disclaimer />
    </AppShell>
  );
}
