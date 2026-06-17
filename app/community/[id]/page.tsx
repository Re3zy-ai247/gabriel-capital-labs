"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { KaiBadge } from "@/components/community/KaiAvatar";
import { categoryLabel } from "@/lib/communityShared";
import { AttachmentPicker, AttachmentList, imagesFromClipboard } from "@/components/Attachments";
import type { AttachmentMeta } from "@/lib/attachmentsShared";
import {
  ArrowLeft, Loader2, Pin, Lock, Unlock, Trash2, Sparkles, Send, MessageCircle,
} from "lucide-react";

interface Reply {
  id: string;
  authorName: string;
  body: string;
  isKai: boolean;
  createdAt: string;
  canDelete: boolean;
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
interface Viewer { isAdmin: boolean; isAuthor: boolean; canModerate: boolean; canPin: boolean; }

function when(iso: string): string {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default function ThreadPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [kaiBusy, setKaiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/community/threads/${params.id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (d) { setThread(d.thread); setViewer(d.viewer); }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  async function postReply() {
    if (reply.trim().length < 2 && replyFiles.length === 0) { setError("Write a reply or attach a file."); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.set("body", reply);
      replyFiles.forEach((f) => form.append("files", f));
      const res = await fetch(`/api/community/threads/${params.id}/replies`, { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not reply."); return; }
      setReply("");
      setReplyFiles([]);
      load();
    } catch { setError("Network error."); } finally { setBusy(false); }
  }

  async function summonKai() {
    setKaiBusy(true); setError(null);
    try {
      const res = await fetch(`/api/community/threads/${params.id}/ask-kai`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Kai is unavailable right now."); return; }
      load();
    } catch { setError("Network error."); } finally { setKaiBusy(false); }
  }

  async function moderate(patch: { pinned?: boolean; locked?: boolean }) {
    await fetch(`/api/community/threads/${params.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    load();
  }

  async function deleteThread() {
    if (!confirm("Delete this discussion and all replies?")) return;
    const res = await fetch(`/api/community/threads/${params.id}`, { method: "DELETE" });
    if (res.ok) router.push("/community");
  }

  async function deleteReply(id: string) {
    const res = await fetch(`/api/community/replies/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  if (loading) {
    return <AppShell title="/ Community"><div className="grid h-64 place-items-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  }
  if (notFound || !thread || !viewer) {
    return (
      <AppShell title="/ Community">
        <div className="card mx-auto mt-6 max-w-md p-8 text-center text-sm text-slate-400">
          This discussion doesn&apos;t exist or you don&apos;t have access.
          <div className="mt-4"><Link href="/community" className="btn-ghost text-sm"><ArrowLeft className="h-4 w-4" /> Back to Community</Link></div>
        </div>
      </AppShell>
    );
  }

  const locked = thread.locked && !viewer.isAdmin;

  return (
    <AppShell title="/ Community">
      <Link href="/community" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-3.5 w-3.5" /> Community
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
            {kaiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {kaiBusy ? "Kai is thinking…" : "Ask Kai"}
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
        </div>
      </div>

      {/* Replies */}
      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <MessageCircle className="h-4 w-4" /> {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
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
                  {r.isKai && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">Master Agent</span>}
                  <span className="text-[11px] text-slate-500">{when(r.createdAt)}</span>
                </div>
                {r.body && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{r.body}</p>}
                <AttachmentList items={r.attachments} />
              </div>
              {r.canDelete && (
                <button onClick={() => deleteReply(r.id)} className="shrink-0 text-slate-500 hover:text-rose-400" title="Delete reply"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reply composer */}
      <div className="card mt-4 p-4">
        {locked ? (
          <p className="text-center text-sm text-slate-500"><Lock className="mr-1 inline h-3.5 w-3.5" /> This discussion is locked.</p>
        ) : (
          <>
            <textarea
              className="input resize-y"
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onPaste={(e) => { const imgs = imagesFromClipboard(e); if (imgs.length) setReplyFiles((f) => [...f, ...imgs]); }}
              placeholder="Add to the discussion…"
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
