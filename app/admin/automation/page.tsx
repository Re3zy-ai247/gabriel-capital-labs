"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2 } from "lucide-react";

interface AiUsageSurface {
  surface: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  failures: number;
  avgMs: number;
}

interface Automation {
  aiOutputs: { reportsAnalyzed: number; lettersGenerated: number; briefArticlesPublished: number; total: number };
  briefAutomation: { autoDraftsQueued: number; published: number };
  aiUsage: { windowDays: number; surfaces: AiUsageSurface[] } | null;
  aiosTracked: string[];
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

export default function AdminAutomationPage() {
  const [data, setData] = useState<Automation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/automation")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="/ Admin · Automation">
      <AdminTabs />
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Pulling automation activity and measured AI spend…
        </div>
      ) : !data ? (
        <p className="text-sm text-rose-400">The metrics did not load this time. Refresh to retry — nothing is lost.</p>
      ) : (
        <>
          <SectionTitle>AI-assisted output (lifetime)</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="AI tasks completed" value={data.aiOutputs.total.toLocaleString()}
              sub="parses + letters + summaries" accent="text-brand-400" />
            <Stat label="Reports analyzed" value={data.aiOutputs.reportsAnalyzed.toLocaleString()} sub="AI parse" />
            <Stat label="Letters drafted" value={data.aiOutputs.lettersGenerated.toLocaleString()} sub="AI-assisted" />
            <Stat label="Brief articles" value={data.aiOutputs.briefArticlesPublished.toLocaleString()} sub="AI-summarized" />
          </div>

          <SectionTitle>News automation (Brief ingest)</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Auto-drafts queued" value={data.briefAutomation.autoDraftsQueued.toLocaleString()}
              sub="daily RSS → AI draft → review"
              accent={data.briefAutomation.autoDraftsQueued > 0 ? "text-gold-400" : undefined} />
            <Stat label="Published from automation" value={data.briefAutomation.published.toLocaleString()} />
          </div>

          <SectionTitle>AI cost (measured) — last {data.aiUsage?.windowDays ?? 30} days</SectionTitle>
          {!data.aiUsage || data.aiUsage.surfaces.length === 0 ? (
            <div className="card border-dashed border-ink-600 p-4">
              <p className="text-[12px] text-slate-400">
                Metering is live; first calls will appear here. Every AI call is logged per surface
                with tokens, cost, latency, and outcome — the next parse, letter, or Brief draft fills this table.
              </p>
            </div>
          ) : (
            <div className="card overflow-x-auto p-4">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-4 font-medium">Surface</th>
                    <th className="pb-2 pr-4 font-medium">Calls</th>
                    <th className="pb-2 pr-4 font-medium">Tokens in / out</th>
                    <th className="pb-2 pr-4 font-medium">Est. cost</th>
                    <th className="pb-2 pr-4 font-medium">Failure rate</th>
                    <th className="pb-2 font-medium">Avg ms</th>
                  </tr>
                </thead>
                <tbody>
                  {data.aiUsage.surfaces.map((s) => (
                    <tr key={s.surface} className="border-t border-ink-700 text-slate-300">
                      <td className="py-2 pr-4 font-medium">{s.surface}</td>
                      <td className="py-2 pr-4">{s.calls.toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        {s.inputTokens.toLocaleString()} / {s.outputTokens.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-brand-400">
                        ${s.costUsd.toFixed(s.costUsd >= 1 ? 2 : 4)}
                      </td>
                      <td className={`py-2 pr-4 ${s.failures > 0 ? "text-rose-400" : "text-slate-500"}`}>
                        {s.calls > 0 ? `${((s.failures / s.calls) * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2 text-slate-500">{s.avgMs.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-slate-500">
                Est. cost is a list-price estimate computed from measured tokens — the provider console is billing truth.
              </p>
            </div>
          )}

          <SectionTitle>Operating-layer metrics — tracked in the AIOS</SectionTitle>
          <div className="card border-dashed border-ink-600 p-4">
            <p className="text-[12px] text-slate-400">
              These are operating-system metrics, not product-DB metrics — they live in the AIOS
              (<code className="text-slate-300">/gcl</code> backlog + the <code className="text-slate-300">/gcl-automation</code> agent + the weekly retro), not this admin panel:
            </p>
            <ul className="mt-2 space-y-1 text-[12px] text-slate-500">
              {data.aiosTracked.map((m) => (
                <li key={m} className="flex gap-2"><span className="text-slate-600">○</span>{m}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </AppShell>
  );
}
