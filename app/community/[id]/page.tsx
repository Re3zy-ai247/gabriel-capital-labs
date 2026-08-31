"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { KaiBadge } from "@/components/community/KaiAvatar";
import { categoryLabel } from "@/lib/communityShared";
import { AttachmentPicker, AttachmentList, imagesFromClipboard } from "@/components/Attachments";
import type { AttachmentMeta } from "@/lib/attachmentsShared";
import {
  ArrowLeft, Loader2, Pin, Lock, Unlock, Trash2, Sparkles, Send, MessageCircle, Flag,
} from "lucide-react";

interface Reply {
  id: string;
  authorName: string;
  body: string;
  isKai: boolean;
  createdAt: string;
  canDelete: boolean;
  canReport: boolean;
  attachments?: AttachmentMeta[];
}
interface ThreadData {
  id: string;
  title: string;
  body: string;
  category: string;
  authorName: string;
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  createdAt: string;
  attachments?: AttachmentMeta[];
  replies: Reply[];
}
interface Viewer { isAdmin: boolean; isAuthor: boolean; canModerate: boolean; canPin: boolean; canReportThread: boolean; }

function when(iso: string): string {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default function ThreadPage() {
  const router = useRouter();
  const { id: threadId } = useParams<{ id: string }>();
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [kaiBusy, setKaiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    fetch(`/api/community/threads/${threadId}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (d) { setThread(d.thread); setViewer(d.viewer); }
      })
      .finally(() => setLoading(false));
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  async function postReply() {
    if (reply.trim().length < 2 && replyFiles.length === 0) { setError("Write a response or attach a file."); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.set("body", reply);
      replyFiles.forEach((f) => form.append("files", f));
      const res = await fetch(`/api/community/threads/${threadId}/replies`, { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not post the response."); return; }
      setReply("");
      setReplyFiles([]);
      load();
    } catch { setError("The connection dropped mid-request. Try again — nothing was lost."); } finally { setBusy(false); }
  }

  async function summonKai() {
    setKaiBusy(true); setError(null);
    try {
      const res = await fetch(`/api/community/threads/${threadId}/ask-kai`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Kai is unavailable right now."); return; }
      load();
    } catch { setError("The connection dropped mid-request. Try again — nothing was lost."); } finally { setKaiBusy(false); }
  }

  async function moderate(patch: { pinned?: boolean; locked?: boolean }) {
    await fetch(`/api/community/threads/${threadId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    load();
  }

  async function deleteThread() {
    if (!confirm("Delete this brief and all responses?")) return;
    const res = await fetch(`/api/community/threads/${threadId}`, { method: "DELETE" });
    if (res.ok) router.push("/community");
  }

  async function deleteReply(id: string) {
    const res = await fetch(`/api/community/replies/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function report(targetType: "thread" | "reply", targetId: string) {
    const reason = prompt(
      "Report this to the moderators? Optionally add why (e.g., promises guaranteed deletion, off-topic, spam):"
    );
    if (reason === null) return; // user cancelled
    try {
      const res = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason }),
      });
      if (res.ok) setReported((s) => new Set(s).add(targetId));
    } catch { /* non-critical */ }
  }

  if (loading) {
    return <AppShell title="/ Operator Network"><div className="grid h-64 place-items-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  }
  if (notFound || !thread || !viewer) {
    return (
      <AppShell title="/ Operator Network">
        <div className="card mx-auto mt-6 max-w-md p-8 text-center text-sm text-slate-400">
          I couldn&apos;t find this brief — it may have been removed, or the Operator Network may be unavailable right now. Everything
          current is on the Operator Network index.
          <div className="mt-4"><Link href="/community" className="btn-ghost text-sm"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the Operator Network</Link></div>
        </div>
      </AppShell>
    );
  }

  const locked = thread.locked && !viewer.isAdmin;

  return (
    <AppShell title="/ Operator Network">
      <Link href="/community" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-3.5 w-3.5" /> Operator Network
      </Link>

      {/* Original post */}
      <div className="card p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {thread.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300"><Pin className="h-3 w-3" /> Pinned</span>}
          {thread.locked && <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-300"><Lock className="h-3 w-3" /> Locked</span>}
          <span className="rounded bg-ink-700/70 px-1.5 py-0.5 text-[11px] text-slate-300">{categoryLabel(thread.category)}</span>
        </div>
        <h1 className="text-xl font-semibold">{thread.title}</h1>
        <div className="mt-1 text-xs text-slate-500">{thread.authorName} · {when(thread.createdAt)}</div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{thread.body}</p>
        <AttachmentList items={thread.attachments} />

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700/60 pt-3">
          <button onClick={summonKai} disabled={kaiBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-60">
            {kaiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            {kaiBusy ? "Kai is reading the brief…" : "Ask Kai"}
          </button>
          {viewer.canPin && (
            <>
              <button onClick={() => moderate({ pinned: !thread.pinned })} className="btn-ghost text-xs"><Pin className="h-3.5 w-3.5" /> {thread.pinned ? "Unpin" : "Pin"}</button>
              <button onClick={() => moderate({ locked: !thread.locked })} className="btn-ghost text-xs">{thread.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} {thread.locked ? "Unlock" : "Lock"}</button>
            </>
          )}
          {viewer.canModerate && (
            <button onClick={deleteThread} className="btn-ghost text-xs text-slate-400 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          )}
          {viewer.canReportThread && (
            reported.has(thread.id)
              ? <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Flag className="h-3.5 w-3.5" /> Reported</span>
              : <button onClick={() => report("thread", thread.id)} className="btn-ghost text-xs text-slate-400 hover:text-amber-300"><Flag className="h-3.5 w-3.5" /> Report</button>
          )}
        </div>
      </div>

      {/* Replies */}
      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <MessageCircle className="h-4 w-4" /> {thread.replyCount} {thread.replyCount === 1 ? "response" : "responses"}
      </div>
      <div className="mt-2 space-y-2">
        {thread.replies.map((r) => (
          <div key={r.id} className={`card p-4 ${r.isKai ? "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.07] to-transparent" : ""}`}>
            <div className="flex items-start gap-3">
              {r.isKai ? <KaiBadge className="h-9 w-9" /> : (
                <span className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-700 text-[11px] font-semibold text-slate-300">{initials(r.authorName)}</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${r.isKai ? "text-amber-300" : ""}`}>{r.authorName}</span>
                  {r.isKai && <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>}
                  <span className="text-[11px] text-slate-500">{when(r.createdAt)}</span>
                </div>
                {r.body && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{r.body}</p>}
                <AttachmentList items={r.attachments} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.canReport && (
                  reported.has(r.id)
                    ? <span className="text-[10px] text-slate-500">Reported</span>
                    : <button onClick={() => report("reply", r.id)} className="text-slate-500 hover:text-amber-300" title="Report response" aria-label="Report response"><Flag className="h-3.5 w-3.5" aria-hidden="true" /></button>
                )}
                {r.canDelete && (
                  <button onClick={() => deleteReply(r.id)} className="text-slate-500 hover:text-rose-400" title="Delete response" aria-label="Delete response"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply composer */}
      <div className="card mt-4 p-4">
        {locked ? (
          <p className="text-center text-sm text-slate-500"><Lock className="mr-1 inline h-3.5 w-3.5" /> This brief is closed.</p>
        ) : (
          <>
            <textarea
              className="input resize-y"
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onPaste={(e) => { const imgs = imagesFromClipboard(e); if (imgs.length) setReplyFiles((f) => [...f, ...imgs]); }}
              placeholder="Add your response…"
              maxLength={6000}
            />
            <div className="mt-2">
              <AttachmentPicker files={replyFiles} onChange={setReplyFiles} disabled={busy} />
            </div>
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button onClick={postReply} disabled={busy} className="btn-primary text-sm">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Reply
              </button>
              <span className="text-[11px] text-slate-500">or <button onClick={summonKai} disabled={kaiBusy} className="text-amber-300 underline hover:text-amber-200">ask Kai</button></span>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
