"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Loader2, MessageSquare, Flag, Trash2, RotateCcw, Check, ExternalLink, ArrowLeft } from "lucide-react";

interface Comment {
  id: string;
  body: string;
  authorName: string;
  status: string;
  flagged: boolean;
  createdAt: string;
  reportCount: number;
  article: { slug: string; title: string } | null;
}

export default function AdminBriefCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [flagged, setFlagged] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/brief/comments")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) { setComments(d.comments || []); setFlagged(d.counts?.flagged || 0); }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/admin/brief/comments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load();
  }

  return (
    <AppShell title="/ Admin">
      <AdminTabs />

      <div className="mb-5 flex items-center justify-between">
        <Link href="/admin/brief" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Brief
        </Link>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <MessageSquare className="h-4 w-4 text-brand-400" /> Comment moderation
          {flagged > 0 && <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-300">{flagged} flagged</span>}
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : comments.length === 0 ? (
        <div className="card p-6 text-sm text-slate-400">No comments yet.</div>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className={`card p-4 ${c.flagged ? "border-rose-500/40" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {c.flagged && <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 font-semibold text-rose-300"><Flag className="h-3 w-3" /> Reported{c.reportCount > 1 ? ` ×${c.reportCount}` : ""}</span>}
                <span className={`rounded px-1.5 py-0.5 font-semibold capitalize ${c.status === "removed" ? "bg-amber-500/15 text-amber-300" : "bg-ink-700 text-slate-300"}`}>{c.status}</span>
                <span className="text-slate-500">{c.authorName}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">{new Date(c.createdAt).toLocaleString()}</span>
                {c.article && (
                  <Link href={`/brief/${c.article.slug}`} target="_blank" className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-300">
                    <ExternalLink className="h-3 w-3" /> {c.article.title.slice(0, 50)}
                  </Link>
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-200">{c.body}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-700/60 pt-3">
                {c.status === "visible" ? (
                  <button onClick={() => patch(c.id, { status: "removed" })} className="btn-ghost text-xs text-slate-400 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                ) : (
                  <button onClick={() => patch(c.id, { status: "visible" })} className="btn-ghost text-xs"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                )}
                {c.flagged && (
                  <button onClick={() => patch(c.id, { flagged: false })} className="btn-ghost text-xs"><Check className="h-3.5 w-3.5" /> Dismiss flag</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
