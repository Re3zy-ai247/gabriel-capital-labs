"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { BRIEF_CATEGORIES, type BriefCardData } from "@/lib/briefShared";
import { BriefCard } from "./BriefCard";

// Client filter/search over the published feed. Seeded with SSR data (`initial`)
// so the default view is server-rendered for SEO; only filtered views re-fetch.
export function BriefFeed({ initial }: { initial: BriefCardData[] }) {
  const [articles, setArticles] = useState<BriefCardData[]>(initial);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    // Default view is already SSR'd — don't refetch on mount.
    if (first.current) {
      first.current = false;
      return;
    }
    if (!cat && !q.trim()) {
      setArticles(initial);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (cat) params.set("category", cat);
      if (q.trim()) params.set("q", q.trim());
      fetch(`/api/brief?${params.toString()}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { articles: [] }))
        .then((d) => setArticles(d.articles || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [cat, q, initial]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!cat} onClick={() => setCat("")} label="All" />
          {BRIEF_CATEGORIES.map((c) => (
            <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)} label={c.label} />
          ))}
        </div>
        <div className="relative md:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the Brief…"
            className="input w-full pl-9"
            aria-label="Search articles"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-2xl border border-ink-700/70 bg-ink-800/40 p-10 text-center text-sm text-slate-400">
          No articles here yet. Check back soon.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <BriefCard key={a.slug} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-brand-500/15 text-brand-300" : "text-slate-400 hover:bg-ink-700/60 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
