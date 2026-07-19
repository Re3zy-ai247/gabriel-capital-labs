"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare, Loader2, Plus, Sparkles } from "lucide-react";
import { AttachmentPicker, imagesFromClipboard } from "@/components/Attachments";
import { CATEGORIES } from "@/lib/communityShared";

// The composer island — the ONLY stateful client logic on the Operator Network
// shell. Extracted from the previous community page with its behavior preserved
// verbatim: multipart POST to /api/community/threads (title, body, category,
// askKai, files), paste-to-attach, and navigation to the new thread. All
// compliance copy (Kai line, house rule) is carried over unchanged.
//
// Collapsed, it reads as a calm affordance, not a form. Draft state survives
// collapse (Design Bible §12: the composer never loses work).
export function Composer({ initialCategory }: { initialCategory: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formCat, setFormCat] = useState(initialCategory || "general");
  const [askKai, setAskKai] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function expand() {
    setOpen(true);
    // Bring the form into view for the mobile sticky trigger.
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

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
      setError("The connection dropped mid-request. Try again — nothing was lost.");
    } finally { setBusy(false); }
  }

  return (
    <div ref={formRef}>
      {!open ? (
        <button
          onClick={expand}
          className="card flex min-h-[44px] w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-slate-500 transition hover:border-brand-500/50"
        >
          <Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          Start a discussion — a question, a win, or a bureau response you&apos;re unsure about…
        </button>
      ) : (
        <div className="card p-5">
          <label className="label" htmlFor="composer-title">Title</label>
          <input
            id="composer-title"
            className="input mb-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to discuss?"
            maxLength={140}
            autoFocus
          />
          <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="label" htmlFor="composer-category">Channel</label>
              <select id="composer-category" className="input" value={formCat} onChange={(e) => setFormCat(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <label className="label" htmlFor="composer-body">Details</label>
          <textarea
            id="composer-body"
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
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={askKai} onChange={(e) => setAskKai(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" />
            <span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-400" aria-hidden="true" /> Bring Kai into this thread
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">I answer with statutes and process — never promises.</span>
            </span>
          </label>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            <span className="mr-1.5 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            House rule: process language, never promised outcomes. Threads are moderated — claims of guaranteed
            deletions or score gains don&apos;t belong here and can be removed.
          </p>
          {error && <p className="mt-3 text-xs text-rose-400" role="alert">{error}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button onClick={submit} disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MessagesSquare className="h-4 w-4" aria-hidden="true" />}
              {busy ? (askKai ? "Posting & asking Kai…" : "Posting…") : "Post discussion"}
            </button>
            <button onClick={() => setOpen(false)} disabled={busy} className="btn-ghost text-sm">Close</button>
          </div>
        </div>
      )}

      {/* Mobile composer affordance: sticky, above the app's bottom nav, hidden
          once the form is open. Same island, same state — no duplicate logic. */}
      {!open && (
        <div className="pointer-events-none sticky bottom-20 z-10 -mb-10 flex justify-end pr-1 sm:hidden">
          <button onClick={expand} className="btn-primary pointer-events-auto !rounded-full !px-4 shadow-glow" aria-label="Start a discussion">
            <Plus className="h-4 w-4" aria-hidden="true" /> New
          </button>
        </div>
      )}
    </div>
  );
}
