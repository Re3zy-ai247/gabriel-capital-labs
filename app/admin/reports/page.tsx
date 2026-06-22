"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2, Flag, ExternalLink, Trash2, Check } from "lucide-react";

interface Report {
  id: string;
  targetType: "thread" | "reply";
  targetId: string;
  threadId: string;
  threadTitle: string;
  reporterName: string;
  reason: string | null;
  status: string;
  createdAt: string;
  targetExists: boolean;
  targetPreview: string;
  targetAuthor: string;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/community/reports?status=${statusFilter}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setReports(d?.reports || []);
        setOpenCount(d?.openCount || 0);
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: string, action: "dismiss" | "remove") {
    if (action === "remove" && !confirm("Remove this content? This deletes the reported post for everyone.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/community/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="/ Admin">
      <AdminTabs />
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Flag className="h-4 w-4 text-brand-400" /> Reported content
          {openCount > 0 && (
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">{openCount} open</span>
          )}
        </div>
        <div className="flex gap-1 text-xs">
          {(["open", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                statusFilter === s ? "bg-brand-500/15 text-brand-300" : "text-slate-400 hover:bg-ink-700/60 hover:text-white"
              }`}
            >
              {s === "open" ? "Open" : "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : reports.length === 0 ? (
        <div className="card p-6 text-sm text-slate-400">
          {statusFilter === "open" ? "No open reports — the community is clear." : "No reports recorded yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded bg-ink-700/70 px-1.5 py-0.5 font-medium text-slate-300">
                  {r.targetType === "thread" ? "Discussion" : "Reply"}
                </span>
                {r.status !== "open" && (
                  <span className="rounded bg-ink-700/70 px-1.5 py-0.5 font-medium text-slate-400">{r.status}</span>
                )}
                {!r.targetExists && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-300">content removed</span>
                )}
                <span>reported by {r.reporterName}</span>
                <span>· {new Date(r.createdAt).toLocaleString()}</span>
              </div>

              <div className="mt-2 text-sm font-medium text-slate-200">
                {r.threadTitle}
                {r.targetType === "reply" && r.targetAuthor ? ` — reply by ${r.targetAuthor}` : ""}
              </div>
              {r.targetPreview && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-400">{r.targetPreview}</p>}
              {r.reason && (
                <p className="mt-2 rounded-lg border border-ink-700/60 bg-ink-900/50 px-3 py-2 text-xs text-slate-300">
                  <span className="text-slate-500">Reason: </span>
                  {r.reason}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-700/60 pt-3">
                <Link href={`/community/${r.threadId}`} className="btn-ghost text-xs">
                  <ExternalLink className="h-3.5 w-3.5" /> View in context
                </Link>
                {r.status === "open" && (
                  <>
                    <button
                      onClick={() => resolve(r.id, "remove")}
                      disabled={busyId === r.id || !r.targetExists}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove content
                    </button>
                    <button onClick={() => resolve(r.id, "dismiss")} disabled={busyId === r.id} className="btn-ghost text-xs">
                      <Check className="h-3.5 w-3.5" /> Dismiss
                    </button>
                  </>
                )}
                {busyId === r.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
