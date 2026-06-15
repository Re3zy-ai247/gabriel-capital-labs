"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2, Ticket, Plus } from "lucide-react";

interface Code {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  amountOff: number | null;
  duration: string;
  durationInMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  expiresAt: string | null;
  createdAt: string;
}

const empty = {
  code: "",
  kind: "percent" as "percent" | "amount",
  value: "",
  duration: "once" as "once" | "repeating" | "forever",
  durationInMonths: "",
  maxRedemptions: "",
  expiresAt: "",
};

export default function AdminDiscountsPage() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  async function load() {
    const r = await fetch("/api/admin/discounts");
    if (r.ok) setCodes((await r.json()).codes || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          kind: form.kind,
          value: Number(form.value),
          duration: form.duration,
          durationInMonths: form.durationInMonths ? Number(form.durationInMonths) : undefined,
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
          expiresAt: form.expiresAt || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Could not create the code.");
        return;
      }
      setForm(empty);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: Code) {
    await fetch(`/api/admin/discounts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    load();
  }

  function discountLabel(c: Code) {
    const off = c.percentOff != null ? `${c.percentOff}% off` : `$${c.amountOff} off`;
    const dur = c.duration === "repeating" ? `${c.durationInMonths} mo` : c.duration;
    return `${off} · ${dur}`;
  }

  return (
    <AppShell title="/ Admin">
      <AdminTabs />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Codes list */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Ticket className="h-4 w-4 text-brand-400" /> Discount codes
            <span className="text-slate-500">({codes.length})</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : codes.length === 0 ? (
            <div className="card p-6 text-sm text-slate-400">No codes yet. Create your first one →</div>
          ) : (
            <div className="space-y-2">
              {codes.map((c) => (
                <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-ink-700 px-2 py-0.5 font-mono text-sm font-semibold">{c.code}</span>
                      {!c.active && (
                        <span className="rounded-full bg-slate-600/40 px-2 py-0.5 text-[10px] uppercase text-slate-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {discountLabel(c)} · used {c.timesRedeemed}
                      {c.maxRedemptions ? `/${c.maxRedemptions}` : ""}
                      {c.expiresAt ? ` · expires ${new Date(c.expiresAt).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(c)}
                    className={c.active ? "btn-ghost !py-1.5 text-xs" : "btn-primary !py-1.5 text-xs"}
                  >
                    {c.active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create form */}
        <form onSubmit={create} className="card h-fit p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4 text-brand-400" /> New discount code
          </div>
          <label className="label">Code</label>
          <input
            className="input mb-3 font-mono uppercase"
            placeholder="LAUNCH20"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <label className="label">Discount</label>
          <div className="mb-3 flex gap-2">
            <select
              className="input w-28"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as "percent" | "amount" })}
            >
              <option value="percent">% off</option>
              <option value="amount">$ off</option>
            </select>
            <input
              className="input"
              type="number"
              placeholder={form.kind === "percent" ? "20" : "10"}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <label className="label">Applies for</label>
          <select
            className="input mb-3"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value as typeof form.duration })}
          >
            <option value="once">First payment only</option>
            <option value="repeating">A number of months</option>
            <option value="forever">Forever</option>
          </select>
          {form.duration === "repeating" && (
            <>
              <label className="label">Months</label>
              <input
                className="input mb-3"
                type="number"
                placeholder="3"
                value={form.durationInMonths}
                onChange={(e) => setForm({ ...form, durationInMonths: e.target.value })}
              />
            </>
          )}
          <label className="label">Max redemptions (optional)</label>
          <input
            className="input mb-3"
            type="number"
            placeholder="Unlimited"
            value={form.maxRedemptions}
            onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
          />
          <label className="label">Expires (optional)</label>
          <input
            className="input mb-4"
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
          />
          {error && <p className="mb-3 text-xs text-rose-400">{error}</p>}
          <button type="submit" disabled={busy || !form.code || !form.value} className="btn-primary w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create code
          </button>
          <p className="mt-2 text-[11px] text-slate-500">
            Codes work at checkout immediately — customers enter them in Stripe&apos;s &quot;Add promotion code&quot; box.
          </p>
        </form>
      </div>
    </AppShell>
  );
}
