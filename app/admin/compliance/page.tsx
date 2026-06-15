"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2, ShieldCheck, ShieldAlert, ChevronDown } from "lucide-react";

interface Letter {
  id: string;
  userEmail: string;
  strategy: string;
  recipientType: string;
  recipientName: string;
  status: string;
  round: number;
  createdAt: string;
  rescanFlags: string[];
  flagged: boolean;
  body: string;
}

export default function AdminCompliancePage() {
  const [data, setData] = useState<{ letters: Letter[]; flaggedCount: number; rules: string[]; disclaimer: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/compliance")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="/ Admin">
      <AdminTabs />
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !data ? (
        <p className="text-sm text-rose-400">Could not load compliance data.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              {data.flaggedCount > 0 ? (
                <ShieldAlert className="h-4 w-4 text-rose-400" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              )}
              Recent letters
              <span className="text-slate-500">({data.letters.length})</span>
              {data.flaggedCount > 0 ? (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                  {data.flaggedCount} flagged
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                  all clean
                </span>
              )}
            </div>
            <div className="space-y-2">
              {data.letters.map((l) => (
                <div key={l.id} className={`card p-4 ${l.flagged ? "border-rose-500/40" : ""}`}>
                  <button
                    onClick={() => setOpen(open === l.id ? null : l.id)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {l.flagged ? (
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        )}
                        <span className="truncate">{l.recipientName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {l.userEmail} · {l.strategy} · R{l.round} · {l.recipientType} ·{" "}
                        {new Date(l.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${open === l.id ? "rotate-180" : ""}`} />
                  </button>
                  {l.flagged && (
                    <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-2 text-[11px] text-rose-300">
                      {l.rescanFlags.length} rule{l.rescanFlags.length === 1 ? "" : "s"} tripped on the stored body.
                    </div>
                  )}
                  {open === l.id && (
                    <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-ink-700/70 bg-ink-900/60 p-3 text-[11px] leading-relaxed text-slate-300">
                      {l.body}
                    </pre>
                  )}
                </div>
              ))}
              {data.letters.length === 0 && (
                <div className="card p-6 text-sm text-slate-400">No letters generated yet.</div>
              )}
            </div>
          </div>

          {/* Reference */}
          <div className="space-y-4">
            <div className="card p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Prohibited-phrase rules ({data.rules.length})
              </div>
              <ul className="space-y-1 text-[11px] text-slate-400">
                {data.rules.map((r, i) => (
                  <li key={i} className="font-mono break-all">• {r}</li>
                ))}
              </ul>
            </div>
            <div className="card p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Active disclaimer</div>
              <p className="text-[11px] leading-relaxed text-slate-400">{data.disclaimer}</p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
