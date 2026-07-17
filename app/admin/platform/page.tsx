"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2, Check, X, Clock } from "lucide-react";

// Executive Platform Dashboard (Platform Phase B, Sprint 1). ADMIN-only.
// One screen for the health of the whole GIOS platform. Every card states its
// basis: MEASURED (env/code/DB at request time) or ASSESSMENT (dated judgment).

interface Health {
  release: { sha: string; env: string };
  flags: Array<{ name: string; on: boolean; scope: string }>;
  capabilities: { tiers: number; capabilities: number; gatedOff: number; engineState: string };
  modules: Array<{ slug: string; name: string; status: string; gate: string; completion: number; shellEnabled: boolean }>;
  readiness: Array<{ label: string; value: string; detail?: string; ok?: boolean }>;
  debt: Array<{ item: string; severity: string }>;
  architecture: { score: string; checks: Array<{ label: string; ok: boolean }>; formula: string };
}
interface Payload {
  health: Health;
  customers: { totalUsers: number; agencies: number; managedClients: number; letters: number; reports: number } | null;
  analytics: { windowDays: number; totals: Array<{ name: string; count: number }>; alphaFunnel: Array<{ name: string; users: number }>; instrumented: boolean; available: boolean };
  kai: {
    reasoningSelfTest: { pass: boolean; findings: number; recommendations: number; errors: string[] };
    explainability: { citedFindings: number; totalFindings: number; score: string; note: string };
    proactiveSignals: { generated: number; allCarryReceipts: boolean };
    memory: { mode: string; persistentStore: string };
    letterOutcomes: { responded: number; favorable: number } | null;
  };
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent ?? ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Basis({ kind }: { kind: "measured" | "assessment" }) {
  return (
    <span className={`ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${kind === "measured" ? "bg-brand-500/15 text-brand-300" : "bg-gold-500/15 text-gold-300"}`}>
      {kind}
    </span>
  );
}

export default function PlatformDashboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/platform")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <AppShell title="/ Admin / Platform">
      <AdminTabs />
      <h1 className="mb-1 text-xl font-semibold">GIOS Platform — Executive Dashboard</h1>
      <p className="mb-6 text-sm text-slate-400">
        One screen for platform health. Every card is <span className="text-brand-300">measured</span> from env/code/DB
        or an explicit <span className="text-gold-300">assessment</span> — nothing is a fake metric.
      </p>

      {err && <p className="text-sm text-rose-400">Failed to load: {err}</p>}
      {!data && !err && (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Deriving platform state…</p>
      )}

      {data && (
        <div className="space-y-8">
          {/* Deployment + capability engine */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Deployment & Capability Engine <Basis kind="measured" /></h2>
            <div className="grid gap-3 md:grid-cols-4">
              <Stat label="Release" value={data.health.release.sha} sub={`env: ${data.health.release.env}`} />
              <Stat label="Capability engine" value={data.health.capabilities.engineState.split(" (")[0]} sub={data.health.capabilities.engineState} accent="text-brand-300" />
              <Stat label="Tiers × capabilities" value={`${data.health.capabilities.tiers} × ${data.health.capabilities.capabilities}`} sub={`${data.health.capabilities.gatedOff} capabilities gated OFF`} />
              <Stat label="Architecture checks" value={data.health.architecture.score} sub={data.health.architecture.formula} />
            </div>
          </section>

          {/* Feature flags */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Feature Flags <Basis kind="measured" /></h2>
            <div className="card divide-y divide-ink-700/40 p-0">
              {data.health.flags.map((f) => (
                <div key={f.name} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <div className="min-w-0">
                    <code className="text-[13px] text-slate-200">{f.name}</code>
                    <p className="truncate text-[11px] text-slate-500">{f.scope}</p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${f.on ? "bg-gold-500/20 text-gold-300" : "bg-ink-700 text-slate-400"}`}>
                    {f.on ? "ON" : "OFF"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Modules */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Modules — the platform spine <Basis kind="assessment" /></h2>
            <div className="grid gap-3 md:grid-cols-2">
              {data.health.modules.map((m) => (
                <div key={m.slug} className="card flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium text-white">
                      {m.name}
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${m.status === "live" ? "bg-success-500/15 text-success-400" : m.status === "counsel_gated" ? "bg-rose-500/15 text-rose-300" : "bg-gold-500/15 text-gold-300"}`}>
                        {m.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">gate: {m.gate}</p>
                  </div>
                  <div className="w-24 shrink-0 text-right">
                    <div className="text-sm font-bold tnum text-slate-200">{m.completion}%</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-ink-700">
                      <div className="h-full bg-brand-500/70" style={{ width: `${m.completion}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Readiness */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Readiness <Basis kind="assessment" /></h2>
            <div className="grid gap-3 md:grid-cols-4">
              {data.health.readiness.map((r) => (
                <div key={r.label} className="card p-4">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                    {r.ok ? <Check className="h-3.5 w-3.5 text-success-400" /> : <Clock className="h-3.5 w-3.5 text-gold-400" />}
                    {r.label}
                  </div>
                  <div className="mt-1 text-sm font-bold text-white">{r.value}</div>
                  {r.detail && <p className="mt-1 text-[11px] leading-snug text-slate-500">{r.detail}</p>}
                </div>
              ))}
            </div>
          </section>

          {/* Customers + funnel */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Customers & Alpha Funnel <Basis kind="measured" /></h2>
            {data.customers ? (
              <div className="grid gap-3 md:grid-cols-5">
                <Stat label="Users" value={String(data.customers.totalUsers)} />
                <Stat label="Agencies" value={String(data.customers.agencies)} />
                <Stat label="Managed clients" value={String(data.customers.managedClients)} />
                <Stat label="Letters" value={String(data.customers.letters)} />
                <Stat label="Reports" value={String(data.customers.reports)} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Database unreachable from this environment — counts unavailable (not faked).</p>
            )}
            <div className="card mt-3 p-4">
              {data.analytics.instrumented ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {data.analytics.alphaFunnel.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2 text-sm">
                      {i > 0 && <span className="text-slate-600">→</span>}
                      <span className="text-slate-400">{s.name.replace(/_/g, " ")}</span>
                      <span className="font-bold tnum text-white">{s.users}</span>
                    </div>
                  ))}
                  <span className="text-[11px] text-slate-500">distinct users, last {data.analytics.windowDays}d</span>
                </div>
              ) : data.analytics.available === false && !data.analytics.instrumented ? (
                <p className="text-sm text-gold-400">Analytics unavailable — the events store could not be read (a real failure, not a zero-state).</p>
              ) : (
                <p className="text-sm text-slate-500">Funnel not yet instrumented in this environment — no events recorded (honest zero-state).</p>
              )}
            </div>
          </section>

          {/* Kai Intelligence (Phase C) */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Kai Intelligence <Basis kind="measured" /></h2>
            <div className="grid gap-3 md:grid-cols-5">
              <Stat label="Reasoning self-test" value={data.kai.reasoningSelfTest.pass ? "PASS" : "FAIL"} sub={`${data.kai.reasoningSelfTest.findings} findings · ${data.kai.reasoningSelfTest.recommendations} recs — fixed synthetic case, not customer volume`} accent={data.kai.reasoningSelfTest.pass ? "text-success-400" : "text-rose-400"} />
              <Stat label="Explainability" value={data.kai.explainability.score} sub={data.kai.explainability.note} />
              <Stat label="Proactive signals" value={String(data.kai.proactiveSignals.generated)} sub={`${data.kai.proactiveSignals.allCarryReceipts ? "all carry receipts" : "⚠ receipt missing"} — synthetic self-test case`} />
              <Stat label="Case memory" value={data.kai.memory.persistentStore} sub={data.kai.memory.mode} />
              <Stat label="Letter outcomes" value={data.kai.letterOutcomes ? `${data.kai.letterOutcomes.favorable}/${data.kai.letterOutcomes.responded}` : "n/a"} sub={data.kai.letterOutcomes ? "favorable / responded (all-time, measured)" : "DB unreachable — not faked"} />
            </div>
          </section>

          {/* Debt + architecture checks */}
          <section className="grid gap-3 md:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-slate-400">Known Technical Debt <Basis kind="assessment" /></h3>
              <ul className="space-y-1.5 text-[13px]">
                {data.health.debt.map((d) => (
                  <li key={d.item} className="flex items-start gap-2 text-slate-300">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${d.severity === "high" ? "bg-rose-400" : d.severity === "medium" ? "bg-gold-400" : "bg-slate-500"}`} />
                    {d.item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-4">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-slate-400">Architecture Checks <Basis kind="measured" /></h3>
              <ul className="space-y-1.5 text-[13px]">
                {data.health.architecture.checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-slate-300">
                    {c.ok ? <Check className="h-3.5 w-3.5 text-success-400" /> : <X className="h-3.5 w-3.5 text-rose-400" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
