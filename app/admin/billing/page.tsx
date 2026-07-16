"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2, CreditCard, RefreshCcw, PackagePlus } from "lucide-react";

interface Charge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  refunded: boolean;
  amountRefunded: number;
  email: string | null;
  createdAt: string;
}
interface Sub {
  id: string;
  status: string;
  email: string | null;
  amount: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

export default function AdminBillingPage() {
  const [data, setData] = useState<{ charges: Charge[]; subscriptions: Sub[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/billing");
    if (r.ok) setData(await r.json());
    else setErr((await r.json()).error || "Could not load billing.");
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function refund(c: Charge) {
    if (!confirm(`Refund $${c.amount.toFixed(2)} to ${c.email || "this customer"}?`)) return;
    setBusy(c.id);
    setErr(null);
    const r = await fetch("/api/admin/billing/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chargeId: c.id }),
    });
    if (!r.ok) setErr((await r.json()).error || "Refund failed.");
    await load();
    setBusy(null);
  }

  async function cancel(s: Sub) {
    if (!confirm(`Cancel ${s.email || "this"} subscription at period end?`)) return;
    setBusy(s.id);
    setErr(null);
    const r = await fetch("/api/admin/billing/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: s.id }),
    });
    if (!r.ok) setErr((await r.json()).error || "Cancellation failed.");
    await load();
    setBusy(null);
  }

  async function provision() {
    setBusy("provision");
    setErr(null);
    const r = await fetch("/api/admin/billing/provision", { method: "POST" });
    const d = await r.json();
    setErr(r.ok ? `✓ Synced ${d.count} prices to Stripe (Professional, Agency, Agency Pro — monthly + annual — and the letter pack).` : d.error || "Sync failed.");
    setBusy(null);
  }

  return (
    <AppShell title="/ Admin">
      <AdminTabs />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700/70 bg-ink-900/40 px-4 py-3">
        <div className="text-xs text-slate-400">
          Products appear in Stripe when first purchased. Sync to create them all now (also use this on your live account before launch).
        </div>
        <button onClick={provision} disabled={busy === "provision"} className="btn-ghost !py-1.5 text-xs">
          {busy === "provision" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackagePlus className="h-3.5 w-3.5" />}
          Sync products to Stripe
        </button>
      </div>
      {err && <p className="mb-3 text-sm text-slate-300">{err}</p>}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !data ? (
        <p className="text-sm text-slate-400">No billing data.</p>
      ) : (
        <div className="space-y-6">
          {/* Subscriptions */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4 text-brand-400" /> Subscriptions
              <span className="text-slate-500">({data.subscriptions.length})</span>
            </div>
            {data.subscriptions.length === 0 ? (
              <div className="card p-5 text-sm text-slate-400">No subscriptions yet.</div>
            ) : (
              <div className="space-y-2">
                {data.subscriptions.map((s) => (
                  <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="text-sm font-medium">{s.email || s.id}</div>
                      <div className="text-[11px] text-slate-500">
                        ${s.amount}/mo · {s.status}
                        {s.cancelAtPeriodEnd ? " · cancels at period end" : ""}
                        {s.currentPeriodEnd ? ` · renews ${new Date(s.currentPeriodEnd).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    {["active", "trialing", "past_due"].includes(s.status) && !s.cancelAtPeriodEnd && (
                      <button onClick={() => cancel(s)} disabled={busy === s.id} className="btn-ghost !py-1.5 text-xs">
                        {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent charges */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <RefreshCcw className="h-4 w-4 text-brand-400" /> Recent payments
              <span className="text-slate-500">({data.charges.length})</span>
            </div>
            {data.charges.length === 0 ? (
              <div className="card p-5 text-sm text-slate-400">No payments yet.</div>
            ) : (
              <div className="space-y-2">
                {data.charges.map((c) => (
                  <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="text-sm font-medium">
                        ${c.amount.toFixed(2)} <span className="uppercase text-[11px] text-slate-500">{c.currency}</span>
                        {c.refunded && <span className="ml-2 text-[11px] text-rose-400">refunded</span>}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {c.email || "—"} · {c.status} · {new Date(c.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {c.status === "succeeded" && !c.refunded && (
                      <button onClick={() => refund(c)} disabled={busy === c.id} className="btn-ghost !py-1.5 text-xs">
                        {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Refund
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
