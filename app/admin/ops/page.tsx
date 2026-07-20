import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { getOpsSummary } from "@/lib/engOps";
import { Activity, ShieldAlert, CheckCircle2, GitBranch, Workflow, Database } from "lucide-react";

export const dynamic = "force-dynamic";

// Engineering Operations Center (Sprint 6, Wave 8). Admin-only — the /admin layout
// gates the whole area fail-closed, so a non-admin never reaches this render. It
// composes ONLY real committed data (the quality ledger, the work ledger, the
// runtime release SHA). No fabricated metric, no customer data, no privacy surface.
// The single operational surface for whoever is running the platform.

const SEV_STYLE: Record<string, string> = {
  critical: "text-rose-300 bg-rose-950/40",
  high: "text-amber-300 bg-amber-950/30",
  medium: "text-slate-300 bg-ink-700/50",
  low: "text-slate-400 bg-ink-700/40",
};

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tnum ${tone ?? "text-slate-100"}`}>{value}</div>
    </div>
  );
}

export default function OpsPage() {
  const s = getOpsSummary();
  const open = (s.quality.byStatus["owner-action"] ?? 0) + (s.quality.byStatus["blocked"] ?? 0);

  return (
    <AppShell title="/ Engineering Operations">
      <AdminTabs />
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Engineering Operations Center</h1>
          <p className="mt-1 text-sm text-slate-400">
            Live operational state, composed from committed evidence only. Admin-only, fail-closed.
          </p>
        </div>

        {/* Top line — the numbers that answer "is the platform healthy and what needs me". */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Deployed release" value={s.release.known ? s.release.sha! : "local"} />
          <Stat label="Tracked defects" value={s.quality.total} />
          <Stat label="Fixed" value={s.quality.byStatus["fixed"] ?? 0} tone="text-emerald-300" />
          <Stat label="Needs a human" value={open} tone={open > 0 ? "text-amber-300" : "text-slate-100"} />
        </div>

        {/* Needs a human — owner-action + blocked, most severe first. The work queue. */}
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-200">Requires a decision or an owner action</h2>
          </div>
          {s.quality.needsHuman.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing outstanding. Every tracked defect is fixed.</p>
          ) : (
            <ul className="space-y-2">
              {s.quality.needsHuman.map((d) => (
                <li key={d.fingerprint} className="rounded-lg border border-ink-700/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEV_STYLE[d.severity]}`}>
                      {d.severity}
                    </span>
                    <span className="font-mono text-xs text-slate-300">{d.fingerprint}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-500">{d.owner}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{d.evidence}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Active work packages — concurrent-session ownership, so two sessions never
            collide on one subsystem. */}
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-brand-300" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-200">Active work packages</h2>
          </div>
          {s.work.active.length === 0 ? (
            <p className="text-sm text-slate-400">No active claims. {s.work.complete} completed.</p>
          ) : (
            <ul className="space-y-2">
              {s.work.active.map((p) => (
                <li key={p.package} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-ink-700/60 p-3 text-xs">
                  <span className="font-mono font-semibold text-slate-200">{p.package}</span>
                  <span className="text-slate-400">{p.subsystem}</span>
                  {p.wave != null && <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-300">Wave {p.wave}</span>}
                  <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-500">{p.owner}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-slate-500">{s.work.complete} package{s.work.complete === 1 ? "" : "s"} completed this era.</p>
        </section>

        {/* Automation + governance — the standing operational facts. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Workflow className="h-4 w-4 text-brand-300" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-200">Quality automation</h2>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {s.automation.workflows.map((w) => (
                <li key={w} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                  <span className="font-mono text-slate-300">{w}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-brand-300" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-200">Schema governance</h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">{s.governance.decision}</p>
            <p className="mt-2 text-[11px] text-slate-500">
              Migrations directory: <span className="font-mono">{s.governance.migrationsDir ? "present" : "not yet — staged transition pending"}</span>
            </p>
          </section>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Activity className="h-3.5 w-3.5" aria-hidden />
          Every value on this page derives from a committed artifact. Nothing here is simulated.
        </div>
      </div>
    </AppShell>
  );
}
