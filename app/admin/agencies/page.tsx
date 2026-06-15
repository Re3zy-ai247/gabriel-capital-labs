"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2, Building2 } from "lucide-react";

interface Agency {
  id: string;
  email: string;
  name: string | null;
  agencyName: string | null;
  plan: string;
  subscriptionStatus: string | null;
  createdAt: string;
  mrr: number;
  _count: { managedClients: number };
}

export default function AdminAgenciesPage() {
  const [data, setData] = useState<{ agencies: Agency[]; totalAgencies: number; totalManagedClients: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/agencies")
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
        <p className="text-sm text-rose-400">Could not load agencies.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <div className="card px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Agencies</div>
              <div className="text-2xl font-bold text-indigo-300">{data.totalAgencies}</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Managed clients</div>
              <div className="text-2xl font-bold text-brand-400">{data.totalManagedClients}</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Agency MRR</div>
              <div className="text-2xl font-bold text-emerald-400">
                ${(data.totalAgencies * 399).toLocaleString()}
              </div>
            </div>
          </div>

          {data.agencies.length === 0 ? (
            <div className="card p-6 text-sm text-slate-400">No agencies yet.</div>
          ) : (
            <div className="space-y-2">
              {data.agencies.map((a) => (
                <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Building2 className="h-4 w-4 text-indigo-300" />
                      {a.agencyName || a.name || a.email}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {a.email} · {a._count.managedClients} client{a._count.managedClients === 1 ? "" : "s"} ·{" "}
                      {a.subscriptionStatus || "no Stripe sub"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-400">${a.mrr}/mo</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
