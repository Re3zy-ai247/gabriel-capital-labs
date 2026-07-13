"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2, Search, Shield, Eye, KeyRound, Ban, CircleCheck } from "lucide-react";

interface Row {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  role: "USER" | "ADMIN";
  plan: string;
  isAgency: boolean;
  disabled: boolean;
  subscriptionStatus: string | null;
  createdAt: string;
  _count: { letters: number; reports: number; managedClients: number };
}

function planBadge(r: Row) {
  const label = r.isAgency ? "agency" : r.plan;
  const color =
    label === "agency" ? "bg-indigo-500/15 text-indigo-300"
    : label === "premium" ? "bg-emerald-500/15 text-emerald-300"
    : "bg-slate-600/30 text-slate-300";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${color}`}>{label}</span>;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    const r = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    if (r.ok) setRows((await r.json()).users || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  async function patch(id: string, body: Record<string, unknown>, note: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error || "Update failed.");
        return;
      }
      setMsg(note);
      await load(q);
      // Refresh the selected row from the new list.
      setSel((prev) => (prev ? { ...prev, ...(d.user || {}) } : prev));
    } finally {
      setBusy(false);
    }
  }

  async function resetPw(id: string) {
    setBusy(true);
    setTempPw(null);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/users/${id}/password`, { method: "POST" });
      const d = await r.json();
      if (r.ok) setTempPw(d.tempPassword);
      else setMsg(d.error || "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  async function impersonate(id: string) {
    setBusy(true);
    const r = await fetch(`/api/admin/users/${id}/impersonate`, { method: "POST" }).catch(() => null);
    if (r?.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setMsg("Could not start impersonation.");
      setBusy(false);
    }
  }

  return (
    <AppShell title="/ Admin">
      <AdminTabs />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* User list */}
        <div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-8"
              placeholder="Search by email, name, or username…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setSel(u); setMsg(null); setTempPw(null); }}
                  className={`card flex w-full items-center justify-between gap-3 p-3 text-left ${
                    sel?.id === u.id ? "border-brand-500/50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{u.name || u.email}</span>
                      {u.role === "ADMIN" && <Shield className="h-3.5 w-3.5 text-gold-400" />}
                      {u.disabled && <Ban className="h-3.5 w-3.5 text-rose-400" />}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">{u.email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {planBadge(u)}
                  </div>
                </button>
              ))}
              {rows.length === 0 && <div className="card p-6 text-sm text-slate-400">No users match.</div>}
            </div>
          )}
        </div>

        {/* Detail / actions */}
        <div className="lg:sticky lg:top-20 h-fit">
          {!sel ? (
            <div className="card p-6 text-sm text-slate-400">Select a user to manage their account.</div>
          ) : (
            <div className="card p-5">
              <div className="mb-1 text-base font-semibold">{sel.name || sel.email}</div>
              <div className="mb-3 text-[11px] text-slate-500">
                {sel.email}
                {sel.username ? ` · @${sel.username}` : ""} · joined {new Date(sel.createdAt).toLocaleDateString()}
              </div>
              <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
                <span>{sel._count.letters} letters</span>·
                <span>{sel._count.reports} reports</span>
                {sel.isAgency ? <span>· {sel._count.managedClients} clients</span> : null}
              </div>

              <div className="mb-1 label">Plan (comp / grant)</div>
              <div className="mb-4 flex gap-2">
                {["free", "premium", "agency"].map((p) => {
                  const current = sel.isAgency ? "agency" : sel.plan;
                  return (
                    <button
                      key={p}
                      disabled={busy || current === p}
                      onClick={() => patch(sel.id, { plan: p }, `Plan set to ${p}.`)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize transition ${
                        current === p ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-ink-600 text-slate-300 hover:bg-ink-700"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={busy}
                  onClick={() => patch(sel.id, { role: sel.role === "ADMIN" ? "USER" : "ADMIN" }, "Role updated.")}
                  className="btn-ghost !py-2 text-xs"
                >
                  <Shield className="h-3.5 w-3.5" /> {sel.role === "ADMIN" ? "Revoke admin" : "Make admin"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => patch(sel.id, { disabled: !sel.disabled }, sel.disabled ? "Account enabled." : "Account disabled.")}
                  className="btn-ghost !py-2 text-xs"
                >
                  {sel.disabled ? <CircleCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                  {sel.disabled ? "Enable" : "Disable"}
                </button>
                <button disabled={busy} onClick={() => resetPw(sel.id)} className="btn-ghost !py-2 text-xs">
                  <KeyRound className="h-3.5 w-3.5" /> Reset password
                </button>
                <button disabled={busy} onClick={() => impersonate(sel.id)} className="btn-ghost !py-2 text-xs">
                  <Eye className="h-3.5 w-3.5" /> View as
                </button>
              </div>

              {tempPw && (
                <div className="mt-4 rounded-lg border border-gold-500/40 bg-gold-500/10 p-3 text-xs text-gold-200">
                  Temporary password (shown once — share securely):
                  <div className="mt-1 select-all font-mono text-sm font-semibold text-white">{tempPw}</div>
                </div>
              )}
              {msg && <p className="mt-3 text-xs text-slate-300">{msg}</p>}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
