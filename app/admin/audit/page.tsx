"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2, ScrollText } from "lucide-react";

interface Entry {
  id: string;
  actorEmail: string;
  action: string;
  summary: string;
  targetType: string | null;
  createdAt: string;
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEntries(d?.entries || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="/ Admin">
      <AdminTabs />
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ScrollText className="h-4 w-4 text-brand-400" /> Admin activity
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="card p-6 text-sm text-slate-400">No admin actions recorded yet.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-700/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900/60 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Admin</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-ink-700/50">
                  <td className="whitespace-nowrap px-4 py-2 text-[11px] text-slate-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{e.actorEmail}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-ink-700 px-2 py-0.5 font-mono text-[11px] text-slate-300">{e.action}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-300">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
