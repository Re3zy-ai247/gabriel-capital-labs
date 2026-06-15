"use client";
import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  tone: string;
}

const toneClass: Record<string, string> = {
  info: "border-brand-500/30 bg-brand-500/10 text-brand-200",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  warning: "border-gold-500/30 bg-gold-500/10 text-gold-200",
};

// Shows the active broadcast announcement to signed-in users. Dismissal is stored
// per device (localStorage), keyed by announcement id, so a new one re-appears.
export function AnnouncementBanner() {
  const [a, setA] = useState<Announcement | null>(null);

  useEffect(() => {
    fetch("/api/announcements/active")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const ann: Announcement | null = d?.announcement || null;
        if (ann && localStorage.getItem(`ann_dismissed_${ann.id}`) !== "1") setA(ann);
      })
      .catch(() => {});
  }, []);

  if (!a) return null;

  function dismiss() {
    if (a) localStorage.setItem(`ann_dismissed_${a.id}`, "1");
    setA(null);
  }

  return (
    <div className={`flex items-start justify-between gap-3 border-b px-5 py-2 text-xs ${toneClass[a.tone] ?? toneClass.info}`}>
      <span className="flex items-start gap-2">
        <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold">{a.title}</span>
          {a.body ? <span className="opacity-90"> — {a.body}</span> : null}
        </span>
      </span>
      <button onClick={dismiss} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
