import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { consentingUserIds } from "@/lib/outcomeConsent";
import { buildOutcomeCorpus } from "@/lib/outcomeCorpus";
import { aggregateOutcomes, reportablePatterns, K_ANON_MIN, type PatternCell } from "@/lib/outcomeStats";

export const dynamic = "force-dynamic";

// Engine 1 internal validation (Sprint X). Admin-only: the aggregate lands here
// FIRST (INTELLIGENCE-LAYER.md rollout) so k-anonymity + framing are validated
// before any consumer surface. Consumer display of these aggregates additionally
// requires a CCO sign-off. Nothing here shows an individual's data.
export default async function AdminIntelligencePage() {
  const admin = await requireAdmin();
  if (!admin) {
    return <AppShell title="/ Admin"><p className="text-slate-400">Admin access required.</p></AppShell>;
  }

  const [contributors, corpus] = await Promise.all([
    consentingUserIds(),
    buildOutcomeCorpus(prisma),
  ]);
  const stats = aggregateOutcomes(corpus);
  const patterns = reportablePatterns(stats);

  return (
    <AppShell title="/ Admin — Outcome Intelligence">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Engine 1 — Outcome Intelligence (internal validation)</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Deterministic aggregate of contributed, anonymized dispute outcomes. No AI, no individual data.
          Cells below the k-anonymity threshold (<span className="tnum">{K_ANON_MIN}</span> observations) are withheld and show no rate —
          this is the internal check before anything reaches a consumer (which also needs CCO sign-off).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Contributors" value={contributors.length} />
        <Stat label="Observations" value={stats.totalObservations} />
        <Stat label="Reportable cells" value={stats.reportableCells} />
        <Stat label="k-anon min" value={K_ANON_MIN} />
      </div>

      <div className="card mt-4 p-5">
        <div className="mb-2 text-sm font-semibold">Reportable historical patterns</div>
        {patterns.length ? (
          <ul className="space-y-1 text-sm text-slate-300">{patterns.map((p, i) => <li key={i}>• {p}</li>)}</ul>
        ) : (
          <p className="text-sm text-slate-400">
            Not enough contributed, completed disputes yet to report any pattern above the k-anonymity threshold.
            This is the honest early state — patterns appear automatically as the anonymized corpus grows.
          </p>
        )}
      </div>

      <CellTable title="By strategy" cells={stats.byStrategy} />
      <CellTable title="By bureau" cells={stats.byBureau} />
      <CellTable title="By round" cells={stats.byRound} />
      <CellTable title="By account type" cells={stats.byAccountType} />

      <p className="mt-4 text-xs text-slate-500">
        <Link href="/admin" className="text-brand-400 hover:underline">← Admin</Link> · Engine 1 (ADR-0010). Consumer surfacing is gated on consent + k-anonymity + CCO.
      </p>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="tnum mt-2 text-2xl font-bold text-brand-400">{value}</div>
    </div>
  );
}

function CellTable({ title, cells }: { title: string; cells: PatternCell[] }) {
  if (!cells.length) return null;
  return (
    <div className="card mt-3 p-5">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500">
            <tr><th className="py-1 pr-4">Key</th><th className="pr-4">Sample</th><th className="pr-4">Responded</th><th className="pr-4">Favorable rate</th><th className="pr-4">Median days</th></tr>
          </thead>
          <tbody className="text-slate-300">
            {cells.map((c) => (
              <tr key={c.key} className="border-t border-ink-700/50">
                <td className="py-1.5 pr-4">{c.key.split(":")[1]}</td>
                <td className="pr-4 tnum">{c.sample}</td>
                <td className="pr-4 tnum">{c.responded}</td>
                <td className="pr-4 tnum">{c.favorableRate != null ? `${Math.round(c.favorableRate * 100)}%` : <span className="text-slate-600">withheld (k-anon)</span>}</td>
                <td className="pr-4 tnum">{c.medianLatencyDays != null ? c.medianLatencyDays : <span className="text-slate-600">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
