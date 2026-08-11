"use client";
import { useCallback, useEffect, useState } from "react";
import { SUPPORT_CATEGORIES, supportCategoryLabel } from "@/lib/supportShared";
import { AttachmentPicker, AttachmentList, imagesFromClipboard } from "@/components/Attachments";
import type { AttachmentMeta } from "@/lib/attachmentsShared";
import { LifeBuoy, Loader2, Plus, Send, ArrowLeft, ShieldCheck } from "lucide-react";

interface TicketRow {
  id: string; subject: string; category: string; status: string;
  userName: string; userEmail: string; messageCount: number;
  lastActivityAt: string; createdAt: string;
}
interface Msg { id: string; authorName: string; isStaff: boolean; body: string; createdAt: string; attachments?: AttachmentMeta[]; }
interface TicketDetail {
  id: string; subject: string; category: string; categoryLabel: string; status: string;
  userName: string; userEmail: string; createdAt: string; messages: Msg[];
}

function when(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function statusChip(status: string) {
  const map: Record<string, string> = {
    open: "bg-amber-500/15 text-amber-300",
    responded: "bg-success-500/15 text-success-300",
    closed: "bg-slate-500/15 text-slate-400",
  };
  return map[status] || "bg-slate-500/15 text-slate-400";
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [selLoading, setSelLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyBusy, setReplyBusy] = useState(false);

  const loadList = useCallback(() => {
    setLoading(true);
    fetch("/api/support/tickets")
      .then((r) => (r.ok ? r.json() : { tickets: [] }))
      .then((d) => { setTickets(d.tickets || []); setIsAdmin(!!d.isAdmin); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  function openTicket(id: string) {
    setSelLoading(true); setSelected(null);
    fetch(`/api/support/tickets/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setSelected(d.ticket); })
      .finally(() => setSelLoading(false));
  }

  async function submit() {
    if (subject.trim().length < 3) { setError("Add a short subject."); return; }
    if (body.trim().length < 5) { setError("Please describe the issue."); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.set("subject", subject);
      form.set("category", category);
      form.set("body", body);
      files.forEach((f) => form.append("files", f));
      const res = await fetch("/api/support/tickets", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not submit."); return; }
      setSubject(""); setBody(""); setCategory("general"); setFiles([]); setOpen(false);
      loadList(); openTicket(j.id);
    } catch { setError("The connection dropped mid-request. Try again — nothing was lost."); } finally { setBusy(false); }
  }

  async function sendReply() {
    if (!selected || (reply.trim().length < 1 && replyFiles.length === 0)) return;
    setReplyBusy(true);
    try {
      const form = new FormData();
      form.set("body", reply);
      replyFiles.forEach((f) => form.append("files", f));
      const res = await fetch(`/api/support/tickets/${selected.id}/messages`, { method: "POST", body: form });
      if (res.ok) { setReply(""); setReplyFiles([]); openTicket(selected.id); loadList(); }
    } finally { setReplyBusy(false); }
  }

  async function setStatus(status: string) {
    if (!selected) return;
    await fetch(`/api/support/tickets/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    openTicket(selected.id); loadList();
  }

  // ---- Thread view ----
  if (selected || selLoading) {
    return (
      <>
        <button onClick={() => setSelected(null)} className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-3.5 w-3.5" /> All tickets
        </button>
        {selLoading || !selected ? (
          <div className="grid h-64 place-items-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <div className="card p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusChip(selected.status)}`}>{selected.status}</span>
                <span className="rounded bg-ink-700/70 px-1.5 py-0.5 text-[11px] text-slate-300">{selected.categoryLabel}</span>
              </div>
              <h1 className="text-xl font-semibold">{selected.subject}</h1>
              {isAdmin && <div className="mt-1 text-xs text-slate-500">{selected.userName} · {selected.userEmail}</div>}
              <div className="mt-4 space-y-3">
                {selected.messages.map((m) => (
                  <div key={m.id} className={`rounded-lg p-3 text-sm ${m.isStaff ? "border border-brand-500/30 bg-brand-500/[0.06]" : "bg-ink-800/60"}`}>
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className={`font-medium ${m.isStaff ? "text-brand-300" : "text-slate-300"}`}>{m.authorName}</span>
                      {m.isStaff && <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-brand-300">Staff</span>}
                      <span>{when(m.createdAt)}</span>
                    </div>
                    {m.body && <p className="whitespace-pre-wrap leading-relaxed text-slate-200">{m.body}</p>}
                    <AttachmentList items={m.attachments} />
                  </div>
                ))}
              </div>
            </div>

            {isAdmin && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-slate-500">Set status:</span>
                {["open", "responded", "closed"].map((s) => (
                  <button key={s} onClick={() => setStatus(s)} disabled={selected.status === s}
                    className="btn-ghost text-xs capitalize disabled:opacity-40">{s}</button>
                ))}
              </div>
            )}

            {selected.status === "closed" && !isAdmin ? (
              <p className="card mt-3 p-4 text-center text-sm text-slate-500">This ticket is closed. Open a new one if you still need help.</p>
            ) : (
              <div className="card mt-3 p-4">
                <textarea
                  className="input resize-y"
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onPaste={(e) => { const imgs = imagesFromClipboard(e); if (imgs.length) setReplyFiles((f) => [...f, ...imgs]); }}
                  placeholder={isAdmin ? "Reply as support…" : "Add a reply…"}
                  maxLength={6000}
                />
                <div className="mt-2">
                  <AttachmentPicker files={replyFiles} onChange={setReplyFiles} disabled={replyBusy} />
                </div>
                <button onClick={sendReply} disabled={replyBusy} className="btn-primary mt-3 text-sm">
                  {replyBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  {replyBusy ? "Sending…" : "Send"}
                </button>
              </div>
            )}
          </>
        )}
      </>
    );
  }

  // ---- List view ----
  return (
    <>
      <div className="card mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <LifeBuoy className="h-9 w-9 shrink-0 text-brand-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{isAdmin ? "Support — all tickets" : "Help & Support"}</h2>
          <p className="text-sm text-slate-400">
            {isAdmin
              ? "Every customer ticket lands here. Open one to reply as staff or change its status."
              : "Having an issue or a question about CreditVector? Open a ticket and our team will get back to you."}
          </p>
        </div>
        {isAdmin ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-500/15 px-2 py-1 text-[11px] font-semibold text-brand-300"><ShieldCheck className="h-3.5 w-3.5" /> Staff view</span>
        ) : (
          <button onClick={() => setOpen((v) => !v)} className="btn-primary shrink-0"><Plus className="h-4 w-4" /> New ticket</button>
        )}
      </div>

      {open && !isAdmin && (
        <div className="card mb-5 p-5">
          <p className="mb-4 text-sm leading-relaxed text-slate-300">
            <span className="mr-2 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            Tell me what&apos;s wrong. If it&apos;s about a dispute in progress, check the letter&apos;s card first — I keep each one&apos;s status current.
          </p>
          <label className="label">Subject</label>
          <input className="input mb-3" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Briefly, what's the issue?" maxLength={160} />
          <label className="label">Category</label>
          <select className="input mb-3" value={category} onChange={(e) => setCategory(e.target.value)}>
            {SUPPORT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <label className="label">Details</label>
          <textarea
            className="input resize-y"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={(e) => { const imgs = imagesFromClipboard(e); if (imgs.length) setFiles((f) => [...f, ...imgs]); }}
            placeholder="What happened, what you expected, and any steps to reproduce…"
            maxLength={6000}
          />
          <div className="mt-2">
            <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />
          </div>
          {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button onClick={submit} disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {busy ? "Filing this with the team…" : "Submit ticket"}
            </button>
            <button onClick={() => setOpen(false)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid h-40 place-items-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : tickets.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <LifeBuoy className="h-8 w-8 text-slate-600" aria-hidden="true" />
          {isAdmin ? (
            <p className="text-sm text-slate-400">No tickets yet.</p>
          ) : (
            <p className="text-sm text-slate-400">
              <span className="mr-2 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
              No open tickets. If something&apos;s off, I&apos;m here.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => openTicket(t.id)} className="card block w-full p-4 text-left transition hover:border-brand-500/50">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusChip(t.status)}`}>{t.status}</span>
                    <span className="truncate font-medium">{t.subject}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="rounded bg-ink-700/70 px-1.5 py-0.5 text-slate-300">{supportCategoryLabel(t.category)}</span>
                    {isAdmin && <span>{t.userName}</span>}
                    <span>·</span>
                    <span>{when(t.lastActivityAt)}</span>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-slate-500">{t.messageCount} msg</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
