"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Hash } from "lucide-react";

// Cursor-polling realtime. Serverless has no persistent socket, so "live" is the
// client GETting messages newer than a cursor every few seconds and appending them,
// de-duplicated by id. Sends are idempotent: each carries a stable clientMsgId, so a
// retried or double-fired send collapses to one row server-side.

export interface NetworkChannel {
  key: string;
  label: string;
}
interface Message {
  id: string;
  channel: string;
  authorName: string;
  body: string;
  isKai: boolean;
  isOwn: boolean;
  createdAt: string;
}

const POLL_MS = 4000;

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export function NetworkClient({ channels, me }: { channels: NetworkChannel[]; me: string }) {
  const [active, setActive] = useState(channels[0]?.key ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursorRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const merge = useCallback((incoming: Message[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const next = [...prev];
      for (const m of incoming) {
        if (seenRef.current.has(m.id)) continue;
        seenRef.current.add(m.id);
        next.push(m);
      }
      return next;
    });
  }, []);

  // Poll the active channel. Resets state on channel switch.
  useEffect(() => {
    let alive = true;
    cursorRef.current = null;
    seenRef.current = new Set();
    setMessages([]);
    setError(null);

    const tick = async () => {
      try {
        const q = new URLSearchParams({ channel: active });
        if (cursorRef.current) q.set("since", cursorRef.current);
        const res = await fetch(`/api/network/messages?${q.toString()}`, { cache: "no-store" });
        if (!res.ok) {
          if (alive && res.status === 403) setError("You don't have access to this channel.");
          return;
        }
        const data = (await res.json()) as { messages: Message[]; cursor: string | null };
        if (!alive) return;
        merge(data.messages);
        if (data.cursor) cursorRef.current = data.cursor;
      } catch {
        /* transient network error — the next tick retries */
      }
    };

    tick();
    const h = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, [active, merge]);

  // Keep the view pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/network/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: active, body, clientMsgId: uuid() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Couldn't send. Try again.");
        return;
      }
      setDraft("");
      if (data?.message) merge([data.message as Message]);
    } catch {
      setError("Couldn't send. Check your connection.");
    } finally {
      setSending(false);
    }
  }, [draft, sending, active, merge]);

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-5xl gap-4">
      {/* Channel rail */}
      <nav className="hidden w-56 shrink-0 flex-col gap-1 sm:flex" aria-label="Channels">
        {channels.map((c) => (
          <button
            key={c.key}
            onClick={() => setActive(c.key)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
              active === c.key
                ? "bg-brand-500/15 font-semibold text-brand-200"
                : "text-slate-400 hover:bg-ink-700/40 hover:text-slate-200"
            }`}
          >
            <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{c.label}</span>
          </button>
        ))}
      </nav>

      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col card p-0">
        <header className="flex items-center gap-2 border-b border-ink-700/50 px-4 py-3">
          <Hash className="h-4 w-4 text-brand-300" aria-hidden />
          <h1 className="text-sm font-semibold text-slate-100">
            {channels.find((c) => c.key === active)?.label ?? "Channel"}
          </h1>
        </header>

        {/* Mobile channel selector */}
        <div className="border-b border-ink-700/40 px-3 py-2 sm:hidden">
          <select
            value={active}
            onChange={(e) => setActive(e.target.value)}
            className="w-full rounded-md bg-ink-800 px-2 py-1.5 text-sm text-slate-200"
            aria-label="Channel"
          >
            {channels.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="pt-8 text-center text-sm text-slate-500">
              No messages yet. Start the conversation.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.isOwn ? "items-end" : "items-start"}`}>
                <div className="mb-0.5 flex items-center gap-2 px-1">
                  <span className={`text-[11px] font-semibold ${m.isKai ? "text-brand-300" : "text-slate-400"}`}>
                    {m.isOwn ? "You" : m.authorName}
                  </span>
                  <time className="text-[10px] text-slate-600" dateTime={m.createdAt}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </time>
                </div>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                    m.isOwn
                      ? "bg-brand-500/20 text-slate-100"
                      : "bg-ink-700/50 text-slate-200"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            ))
          )}
        </div>

        {error && (
          <p className="px-4 py-1.5 text-center text-xs text-rose-300" role="alert">{error}</p>
        )}

        <form
          className="flex items-end gap-2 border-t border-ink-700/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`Message ${channels.find((c) => c.key === active)?.label ?? ""}…`}
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg bg-ink-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}
