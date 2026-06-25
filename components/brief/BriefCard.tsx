import Link from "next/link";
import { ExternalLink, Star, Heart } from "lucide-react";
import { briefCoverUrl, type BriefCardData } from "@/lib/briefShared";

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Presentational article card (no hooks) — reused by the SSR feed and the client
// filter component, so it renders the same in server HTML and after hydration.
export function BriefCard({ a }: { a: BriefCardData }) {
  return (
    <Link
      href={`/brief/${a.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-800/50 transition hover:-translate-y-0.5 hover:border-brand-500/40"
    >
      {/* Branded, auto-generated cover (no external/licensed imagery). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={briefCoverUrl(a.title, a.categoryLabel)} alt="" loading="lazy" className="aspect-[1200/630] w-full object-cover" />

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-300">
            {a.categoryLabel}
          </span>
          {a.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-semibold text-gold-300">
              <Star className="h-3 w-3" /> Featured
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold leading-snug text-white transition group-hover:text-brand-100">{a.title}</h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-400">{a.excerpt}</p>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink-700/60 pt-3 text-[11px] text-slate-500">
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            <ExternalLink className="h-3 w-3 shrink-0" /> {a.sourceName}
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            {a.likeCount > 0 && (
              <span className="inline-flex items-center gap-1" aria-label={`${a.likeCount} likes`}>
                <Heart className="h-3 w-3" fill="currentColor" /> {a.likeCount}
              </span>
            )}
            <span>{when(a.publishedAt)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
