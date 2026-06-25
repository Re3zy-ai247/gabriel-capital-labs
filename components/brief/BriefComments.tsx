"use client";
import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Loader2, Flag, Trash2, Check, Info } from "lucide-react";
import {
  BRIEF_COMMENT_LIMITS,
  BRIEF_COMMENT_DISCLAIMER,
  type BriefCommentData,
} from "@/lib/briefShared";

// Reader comments on a Brief article. Open to any signed-in account; anonymous
// readers see the thread + a sign-in prompt. Bodies are plain text (React escapes
// them — no markdown/HTML), CROA-screened server-side, and post-moderated.
export function BriefComments({ slug, isAuthed, initial }: { slug: string; isAuthed: boolean; initial: BriefCommentData[] }) {
  const [comments, setComments] = useState<BriefCommentData[]>(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

  async function submit() {
    const text = body.trim();
    if (text.length < BRIEF_COMMENT_LIMITS.min || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/brief/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, body: text }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || "Could not post your comment.");
        return;
      }
      setComments((c) => [j.comment, ...c]);
      setBody("");
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function report(id: string) {
    if (reported.has(id)) return;
    setReported((s) => new Set(s).add(id));
    try {
      await fetch(`/api/brief/comments/${id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } catch {
      /* best-effort */
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this comment?")) return;
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/brief/comments/${id}`, { method: "DELETE" });
      if (!res.ok) setComments(prev);
    } catch {
      setComments(prev);
    }
  }

  const over = body.length > BRIEF_COMMENT_LIMITS.body;

  return (
    <section className="mt-12 border-t border-ink-700/60 pt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
        <MessageSquare className="h-5 w-5 text-brand-400" />
        Discussion {comments.length > 0 && <span className="text-sm font-normal text-slate-500">({comments.length})</span>}
      </h2>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-3 text-xs text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>{BRIEF_COMMENT_DISCLAIMER}</p>
      </div>

      {isAuthed ? (
        <div className="mt-5">
          <textarea
            className="input resize-y"
            rows={3}
            value={body}
            maxLength={BRIEF_COMMENT_LIMITS.body + 200}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts or a question — keep it respectful and on-topic."
            aria-label="Write a comment"
          />
          {err && <p className="mt-2 text-xs text-rose-400">{err}</p>}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className={`text-[11px] ${over ? "text-rose-400" : "text-slate-500"}`}>
              {body.length}/{BRIEF_COMMENT_LIMITS.body}
            </span>
            <button onClick={submit} disabled={busy || over || body.trim().length < BRIEF_COMMENT_LIMITS.min} className="btn-primary text-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />} Post comment
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-ink-700/70 bg-ink-800/40 px-4 py-4 text-sm text-slate-300">
          <Link href="/login" className="font-medium text-brand-300 hover:text-brand-200">Sign in</Link> to join the conversation.
        </div>
      )}

      <div className="mt-6 space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500">No comments yet. Be the first to share your thoughts.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-ink-700/60 bg-ink-800/40 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-medium text-slate-300">{c.authorName}</span>
                <span>·</span>
                <span>{relTime(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{c.body}</p>
              <div className="mt-2.5 flex items-center gap-3 text-[11px]">
                {isAuthed && (
                  reported.has(c.id) ? (
                    <span className="inline-flex items-center gap-1 text-slate-500"><Check className="h-3 w-3" /> Reported</span>
                  ) : (
                    <button onClick={() => report(c.id)} className="inline-flex items-center gap-1 text-slate-500 transition hover:text-amber-300">
                      <Flag className="h-3 w-3" /> Report
                    </button>
                  )
                )}
                {c.canDelete && (
                  <button onClick={() => remove(c.id)} className="inline-flex items-center gap-1 text-slate-500 transition hover:text-rose-400">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
