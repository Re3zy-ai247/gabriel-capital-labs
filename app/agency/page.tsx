"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Disclaimer } from "@/components/Disclaimer";
import { Building2, Loader2, UserPlus, FolderOpen, Trash2, Mails, AlertTriangle } from "lucide-react";

interface Client {
  id: string;
  name: string;
  location: string;
  negativeItems: number;
  letters: number;
}
interface Ctx {
  isAgency: boolean;
  isAdmin: boolean;
  agencyName?: string | null;
}

export default function AgencyPage() {
  const router = useRouter();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Add-client form
  const [form, setForm] = useState({ fullName: "", addressLine1: "", city: "", state: "", zip: "" });

  async function loadClients() {
    const res = await fetch("/api/agency/clients");
    if (res.ok) {
      const d = await res.json();
      setClients(d.clients || []);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/agency/context");
        const c = await res.json();
        setCtx(c);
        if (c.isAgency) await loadClients();
      } catch {
        setError("Could not load agency workspace.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function enableAgency() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agency/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Could not enable agency mode.");
        return;
      }
      setCtx((p) => (p ? { ...p, isAgency: true } : p));
      await loadClients();
    } finally {
      setBusy(false);
    }
  }

  async function addClient(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agency/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Could not add client.");
        return;
      }
      setForm({ fullName: "", addressLine1: "", city: "", state: "", zip: "" });
      await loadClients();
    } finally {
      setBusy(false);
    }
  }

  async function openClient(id: string) {
    setBusy(true);
    await fetch("/api/agency/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id }),
    });
    router.push("/dashboard");
    router.refresh();
  }

  async function removeClient(id: string, name: string) {
    if (!confirm(`Delete ${name} and all their reports, tradelines, and letters? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/agency/clients/${id}`, { method: "DELETE" });
      if (res.ok) setClients((p) => p.filter((c) => c.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="/ Agency">
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-brand-400" />
        <h2 className="text-xl font-semibold">{ctx?.agencyName || "Agency Workspace"}</h2>
      </div>

      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !ctx?.isAgency ? (
        // Not an agency yet — show the gate.
        <div className="card max-w-2xl p-6">
          <div className="text-base font-semibold">Run your own credit-repair business on our platform</div>
          <p className="mt-2 text-sm text-slate-400">
            The Agency tier lets you manage unlimited clients in their own workspaces, run the full analysis and
            letter engine for each, and generate disputes at scale — for <span className="font-semibold text-slate-200">$399/mo</span>.
          </p>
          {ctx?.isAdmin ? (
            <button onClick={enableAgency} disabled={busy} className="btn-primary mt-4">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              Enable agency mode (preview)
            </button>
          ) : (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-3 text-xs text-gold-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Billing for the $399/mo Agency plan is being finalized. This tier will unlock here once it&apos;s live.
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Client roster */}
          <div>
            <div className="mb-2 text-sm font-semibold">
              Clients <span className="text-slate-500">({clients.length})</span>
            </div>
            {clients.length === 0 ? (
              <div className="card p-6 text-sm text-slate-400">No clients yet. Add your first client on the right →</div>
            ) : (
              <div className="space-y-2">
                {clients.map((c) => (
                  <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {c.location || "No address on file"} · {c.negativeItems} item{c.negativeItems === 1 ? "" : "s"} ·{" "}
                        <span className="inline-flex items-center gap-1">
                          <Mails className="h-3 w-3" /> {c.letters} letter{c.letters === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openClient(c.id)} disabled={busy} className="btn-primary !py-1.5 text-xs">
                        <FolderOpen className="h-3.5 w-3.5" /> Open workspace
                      </button>
                      <button
                        onClick={() => removeClient(c.id, c.name)}
                        disabled={busy}
                        className="text-slate-500 transition hover:text-rose-400"
                        title="Delete client"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add client */}
          <form onSubmit={addClient} className="card h-fit p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <UserPlus className="h-4 w-4 text-brand-400" /> Add a client
            </div>
            <div className="space-y-2">
              <input
                className="input w-full"
                placeholder="Full legal name *"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              <input
                className="input w-full"
                placeholder="Address line 1"
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  className="input w-full"
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
                <input
                  className="input w-20"
                  placeholder="ST"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
                <input
                  className="input w-24"
                  placeholder="ZIP"
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" disabled={busy || !form.fullName.trim()} className="btn-primary mt-3 w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add client
            </button>
            <p className="mt-2 text-[11px] text-slate-500">
              Clients don&apos;t log in — you manage everything in their workspace. Their name &amp; address are used to
              fill their dispute letters.
            </p>
          </form>
        </div>
      )}

      <Disclaimer />
    </AppShell>
  );
}
