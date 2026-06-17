"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { KaiBadge } from "@/components/community/KaiAvatar";
import { useCommunityAccess } from "@/components/community/useCommunityAccess";
import { AttachmentPicker, imagesFromClipboard } from "@/components/Attachments";
import { CATEGORIES, categoryLabel } from "@/lib/communityShared";
import {
  MessagesSquare, Loader2, Pin, Lock, Plus, Sparkles, MessageCircle, Building2, ArrowRight,
} from "lucide-react";

interface ThreadCard {
  id: string;
  title: string;
  category: string;
  authorName: string;
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  kaiAnswered: boolean;
  lastActivityAt: string;
  excerpt: string;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CommunityPage() {
  const router = useRouter();
  const access = useCommunityAccess();
  const [threads, setThreads] = useState<ThreadCard[]>([]);
  const [cat, setCat] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Composer
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formCat, setFormCat] = useState("general");
  const [askKai, setAskKai] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/community/threads${cat ? `?category=${cat}` : ""}`)
      .then((r) => (r.ok ? r.json() : { threads: [] }))
      .then((d) => setThreads(d.threads || []))
      .finally(() => setLoading(false));
  }, [cat]);

  useEffect(() => {
    if (access?.canAccess) load();
  }, [access, load]);

  async function submit() {
    if (title.trim().length < 3) { setError("Give your discussion a title."); return; }
    if (body.trim().length < 3) { setError("Add some detail to your post."); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.set("title", title);
      form.set("body", body);
      form.set("category", formCat);
      form.set("askKai", askKai ? "true" : "false");
      files.forEach((f) => form.append("files", f));
      const res = await fetch("/api/community/threads", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not post."); return; }
      router.push(`/community/${j.id}`);
    } catch {
      setError("Network error. Try again.");
    } finally { setBusy(false); }
  }

  // ---- Access gating ----
  if (access === null) {
    return (
      <AppShell title="/ Community">
        <div className="grid h-64 place-items-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </AppShell>
    );
  }
  if (!access.canAccess) {
    return (
      <AppShell title="/ Community">
        <div className="card mx-auto mt-6 max-w-lg p-8 text-center">
          <Building2 className="mx-auto mb-3 h-9 w-9 text-brand-400" />
          <h2 className="mb-2 text-lg font-semibold">The Community Hub is for Agency members</h2>
          <p className="mb-5 text-sm text-slate-400">
            Connect with other agency operators, share wins and strategy, and get expert answers from <strong>Kai</strong>,
            the CreditVector master agent. Unlock it with an Agency subscription.
          </p>
          <Link href="/pricing" className="btn-primary inline-flex">See Agency plans <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="/ Community">
      <EduBanner />

      {/* Kai hero */}
      <div className="card mb-5 flex flex-col gap-4 bg-gradient-to-br from-amber-500/10 to-transparent p-5 sm:flex-row sm:items-center">
        <KaiBadge className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Agency Hub — with Kai, your master agent</h2>
          <p className="text-sm text-slate-400">
            Chat with fellow operators, share what&apos;s working, and ask <strong className="text-amber-300">Kai</strong> anything about
            disputes, the law, or running your agency on CreditVector. Start a discussion and tick &ldquo;Ask Kai&rdquo; for an expert take.
          </p>
        </div>
        <button onClick={() => { setOpen((v) => !v); setFormCat(cat || "general"); }} className="btn-primary shrink-0">
          <Plus className="h-4 w-4" /> New discussion
        </button>
      </div>

      {/* Composer */}
      {open && (
        <div className="card mb-5 p-5">
          <label className="label">Title</label>
          <input className="input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to discuss?" maxLength={140} />
          <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="label">Category</label>
              <select className="input" value={formCat} onChange={(e) => setFormCat(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <label className="label">Details</label>
          <textarea
            className="input resize-y"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={(e) => { const imgs = imagesFromClipboard(e); if (imgs.length) setFiles((f) => [...f, ...imgs]); }}
            placeholder="Share context, a question, a win, or a tactic…"
            maxLength={8000}
          />
          <div className="mt-2">
            <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={askKai} onChange={(e) => setAskKai(e.target.checked)} className="h-4 w-4 accent-amber-500" />
            <Sparkles className="h-4 w-4 text-amber-400" /> Ask Kai for an expert take on this
          </label>
          {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button onClick={submit} disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessagesSquare className="h-4 w-4" />}
              {busy ? (askKai ? "Posting & asking Kai…" : "Posting…") : "Post discussion"}
            </button>
            <button onClick={() => setOpen(false)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setCat("")} className={chip(cat === "")}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={chip(cat === c.key)}>{c.label}</button>
        ))}
      </div>

      {/* Thread list */}
      {loading ? (
        <div className="grid h-40 place-items-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : threads.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <MessagesSquare className="h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">No discussions here yet. Be the first to start one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <Link key={t.id} href={`/community/${t.id}`} className="card block p-4 transition hover:border-brand-500/50">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {t.pinned && <Pin className="h-3.5 w-3.5 text-amber-400" />}
                    {t.locked && <Lock className="h-3.5 w-3.5 text-slate-500" />}
                    <span className="truncate font-medium">{t.title}</span>
                    {t.kaiAnswered && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        <Sparkles className="h-3 w-3" /> Kai answered
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{t.excerpt}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="rounded bg-ink-700/70 px-1.5 py-0.5 text-slate-300">{categoryLabel(t.category)}</span>
                    <span>{t.authorName}</span>
                    <span>·</span>
                    <span>{timeAgo(t.lastActivityAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                  <MessageCircle className="h-3.5 w-3.5" /> {t.replyCount}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function chip(active: boolean): string {
  return `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
    active ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-ink-600 text-slate-400 hover:border-slate-500"
  }`;
}
