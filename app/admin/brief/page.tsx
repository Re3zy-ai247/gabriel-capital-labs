"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { BRIEF_CATEGORIES, briefCategoryLabel } from "@/lib/briefShared";
import { Loader2, Sparkles, Newspaper, Star, Trash2, ExternalLink, Check, X, Pencil } from "lucide-react";

interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  category: string;
  tags: string[];
  socialCaption: string | null;
  videoUrl: string | null;
  status: string;
  featured: boolean;
  views: number;
  publishedAt: string | null;
  createdAt: string;
}

const BLANK = { title: "", sourceUrl: "", sourceName: "", sourceText: "", summary: "", category: "consumer-rights", tags: "", socialCaption: "", videoUrl: "" };

export default function AdminBriefPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [counts, setCounts] = useState({ draft: 0, published: 0, rejected: 0 });
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [f, setF] = useState({ ...BLANK });
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/brief${filter ? `?status=${filter}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) { setArticles(d.articles || []); setCounts(d.counts || counts); }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function resetForm() { setEditingId(null); setF({ ...BLANK }); setErr(null); }

  function editArticle(a: Article) {
    setEditingId(a.id);
    setErr(null);
    setF({
      title: a.title, sourceUrl: a.sourceUrl, sourceName: a.sourceName, sourceText: "",
      summary: a.summary, category: a.category, tags: a.tags.join(", "), socialCaption: a.socialCaption || "",
      videoUrl: a.videoUrl || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function summarize() {
    if (!f.sourceText.trim()) { setErr("Paste the article text first, then summarize."); return; }
    setAiBusy(true); setErr(null);
    try {
      const res = await fetch("/api/admin/brief/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: f.title, sourceText: f.sourceText }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "Could not summarize."); return; }
      const s = j.suggestion;
      setF((p) => ({ ...p, summary: s.summary, category: s.category, tags: (s.tags || []).join(", "), socialCaption: s.socialCaption }));
    } catch { setErr("Network error."); } finally { setAiBusy(false); }
  }

  async function save() {
    setSaving(true); setErr(null);
    const body = {
      title: f.title, sourceUrl: f.sourceUrl, sourceName: f.sourceName, summary: f.summary,
      category: f.category, socialCaption: f.socialCaption, videoUrl: f.videoUrl,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      const res = await fetch(editingId ? `/api/admin/brief/${editingId}` : "/api/admin/brief", {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "Could not save."); return; }
      resetForm(); load();
    } catch { setErr("Network error."); } finally { setSaving(false); }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/admin/brief/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load();
  }
  // Publishing makes the article public — gate it behind an attribution/accuracy
  // confirmation (the human defamation-review control for legal-news summaries).
  async function publish(id: string) {
    if (!confirm(
      "Publish this article?\n\nConfirm the summary is accurate, uses attributed/hedged language " +
      "(\"alleged\", \"according to the complaint\", \"the agency stated\"), and is supported by the linked source.\n\n" +
      "If a video is attached: confirm it's from an official/credible channel and makes no guaranteed-deletion, " +
      "score-increase, or specific-outcome claims."
    )) return;
    patch(id, { status: "published" });
  }
  async function del(id: string) {
    if (!confirm("Delete this article permanently?")) return;
    await fetch(`/api/admin/brief/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    load();
  }

  return (
    <AppShell title="/ Admin">
      <AdminTabs />

      {/* Composer */}
      <div className="card mb-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Newspaper className="h-4 w-4 text-brand-400" /> {editingId ? "Edit article" : "New article"}
          </h2>
          {editingId && <button onClick={resetForm} className="text-xs text-slate-400 hover:text-white">Cancel edit</button>}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Title</label>
            <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Headline" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {BRIEF_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Source name</label>
            <input className="input" value={f.sourceName} onChange={(e) => setF({ ...f, sourceName: e.target.value })} placeholder="e.g. CFPB Newsroom" />
          </div>
          <div>
            <label className="label">Source URL</label>
            <input className="input" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} placeholder="https://…" />
          </div>
        </div>

        {!editingId && (
          <div className="mt-3">
            <label className="label">Paste article text (for AI summarize)</label>
            <textarea className="input resize-y" rows={4} value={f.sourceText} onChange={(e) => setF({ ...f, sourceText: e.target.value })} placeholder="Paste the source article's text here, then click AI summarize…" />
            <button onClick={summarize} disabled={aiBusy} className="btn-ghost mt-2 text-xs">
              {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} AI summarize
            </button>
          </div>
        )}

        <div className="mt-3">
          <label className="label">Summary (educational, attributed — auto compliance-scrubbed on save)</label>
          <textarea className="input resize-y font-mono text-xs" rows={8} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="Markdown summary…" />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Tags (comma-separated)</label>
            <input className="input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="fcra, lawsuit, equifax" />
          </div>
          <div>
            <label className="label">Social caption</label>
            <input className="input" value={f.socialCaption} onChange={(e) => setF({ ...f, socialCaption: e.target.value })} placeholder="Short, neutral share caption" />
          </div>
        </div>

        <div className="mt-3">
          <label className="label">YouTube video (optional)</label>
          <input className="input" value={f.videoUrl} onChange={(e) => setF({ ...f, videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=… — embeds the official player; leave blank for none" />
          <p className="mt-1 text-[11px] text-slate-500">Paste a youtube.com or youtu.be link from an official/source channel. We embed the official player — never re-host video. Blank removes it.</p>
        </div>

        {err && <p className="mt-3 text-xs text-rose-400">{err}</p>}
        <div className="mt-4 flex items-center gap-2">
          <button onClick={save} disabled={saving || !f.title || !f.summary} className="btn-primary text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {editingId ? "Save changes" : "Save draft"}
          </button>
          <span className="text-[11px] text-slate-500">Saved as a draft — nothing publishes until you click Publish.</span>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-1 text-xs">
        {[["", "All"], ["draft", `Drafts (${counts.draft})`], ["published", `Published (${counts.published})`], ["rejected", `Rejected (${counts.rejected})`]].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-lg px-3 py-1.5 font-medium transition ${filter === k ? "bg-brand-500/15 text-brand-300" : "text-slate-400 hover:bg-ink-700/60 hover:text-white"}`}>{label}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : articles.length === 0 ? (
        <div className="card p-6 text-sm text-slate-400">No articles in this view yet.</div>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <StatusBadge status={a.status} />
                <span className="rounded bg-ink-700/70 px-1.5 py-0.5 text-slate-300">{briefCategoryLabel(a.category)}</span>
                {a.featured && <span className="inline-flex items-center gap-1 rounded bg-gold-500/15 px-1.5 py-0.5 font-semibold text-gold-300"><Star className="h-3 w-3" /> Featured</span>}
                <span className="text-slate-500">{a.views} views</span>
              </div>
              <div className="mt-1.5 text-sm font-medium text-slate-100">{a.title}</div>
              <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-brand-300"><ExternalLink className="h-3 w-3" /> {a.sourceName}</a>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-700/60 pt-3">
                <button onClick={() => editArticle(a)} className="btn-ghost text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                {a.status !== "published" ? (
                  <button onClick={() => publish(a.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-success-500/40 bg-success-500/10 px-3 py-1.5 text-xs font-medium text-success-300 hover:bg-success-500/20"><Check className="h-3.5 w-3.5" /> Publish</button>
                ) : (
                  <>
                    <a href={`/brief/${a.slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs"><ExternalLink className="h-3.5 w-3.5" /> View</a>
                    <button onClick={() => patch(a.id, { status: "draft" })} className="btn-ghost text-xs">Unpublish</button>
                  </>
                )}
                <button onClick={() => patch(a.id, { featured: !a.featured })} className="btn-ghost text-xs"><Star className="h-3.5 w-3.5" /> {a.featured ? "Unfeature" : "Feature"}</button>
                {a.status !== "rejected" && <button onClick={() => patch(a.id, { status: "rejected" })} className="btn-ghost text-xs text-slate-400 hover:text-amber-300"><X className="h-3.5 w-3.5" /> Reject</button>}
                <button onClick={() => del(a.id)} className="btn-ghost text-xs text-slate-400 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-success-500/15 text-success-300",
    draft: "bg-ink-700 text-slate-300",
    rejected: "bg-amber-500/15 text-amber-300",
  };
  return <span className={`rounded px-1.5 py-0.5 font-semibold capitalize ${map[status] || "bg-ink-700 text-slate-300"}`}>{status}</span>;
}
