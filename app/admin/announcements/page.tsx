"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2, Megaphone, Plus, Trash2 } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  tone: string;
  active: boolean;
  createdAt: string;
}

const toneColor: Record<string, string> = {
  info: "text-brand-300",
  success: "text-emerald-300",
  warning: "text-gold-400",
};

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", tone: "info" });

  async function load() {
    const r = await fetch("/api/admin/announcements");
    if (r.ok) setItems((await r.json()).announcements || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      setForm({ title: "", body: "", tone: "info" });
      await load();
    }
    setBusy(false);
  }

  async function toggle(a: Announcement) {
    await fetch(`/api/admin/announcements/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !a.active }),
    });
    load();
  }

  async function remove(a: Announcement) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    await fetch(`/api/admin/announcements/${a.id}`, { method: "DELETE" });
    load();
  }

  return (
    <AppShell title="/ Admin">
      <AdminTabs />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="h-4 w-4 text-brand-400" /> Announcements
            <span className="text-slate-500">({items.length})</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="card p-6 text-sm text-slate-400">No announcements yet.</div>
          ) : (
            <div className="space-y-2">
              {items.map((a) => (
                <div key={a.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold ${toneColor[a.tone] ?? ""}`}>{a.title}</div>
                      <p className="mt-0.5 text-[12px] text-slate-400">{a.body}</p>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {a.active ? "Live" : "Hidden"} · {new Date(a.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => toggle(a)} className={a.active ? "btn-ghost !py-1 text-xs" : "btn-primary !py-1 text-xs"}>
                        {a.active ? "Hide" : "Show"}
                      </button>
                      <button onClick={() => remove(a)} className="text-slate-500 hover:text-rose-400" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={create} className="card h-fit p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4 text-brand-400" /> New announcement
          </div>
          <label className="label">Title</label>
          <input
            className="input mb-3"
            placeholder="New feature: Funding Hub"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label className="label">Message</label>
          <textarea
            className="input mb-3 min-h-[90px]"
            placeholder="Tell users what's new…"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <label className="label">Tone</label>
          <select className="input mb-4" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
            <option value="info">Info (brand)</option>
            <option value="success">Success (green)</option>
            <option value="warning">Warning (gold)</option>
          </select>
          <button type="submit" disabled={busy || !form.title || !form.body} className="btn-primary w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} Publish
          </button>
          <p className="mt-2 text-[11px] text-slate-500">
            Live announcements show as a banner to all signed-in users (dismissible per device).
          </p>
        </form>
      </div>
    </AppShell>
  );
}
