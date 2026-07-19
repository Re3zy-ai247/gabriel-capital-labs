import Link from "next/link";
import { Pin, Lock, Sparkles, MessageCircle } from "lucide-react";
import { categoryLabel } from "@/lib/communityShared";
import { timeAgo, type OperatorThread } from "./format";

// Operator Network feed card (Design Bible §6: Discussion). Server-rendered,
// zero client JS. Universal card anatomy: attribution → substance → state →
// affordance. Hover is a border-tone shift only (no lift, no shadow — §4.3);
// cards render without entrance animation. An unanswered discussion is the
// network's open loop, so it carries the one attention accent on the card.
export function FeedCard({ t }: { t: OperatorThread }) {
  const open = t.replyCount === 0 && !t.locked;
  return (
    <Link
      href={`/community/${t.id}`}
      className="card block p-4 transition hover:border-brand-500/50 focus-visible:border-brand-500/50"
    >
      {/* Attribution — muted meta zone */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span className="rounded bg-ink-700/70 px-1.5 py-0.5 text-slate-300">{categoryLabel(t.category)}</span>
        <span className="truncate">{t.authorName}</span>
        <span aria-hidden="true">·</span>
        <span className="tnum">{timeAgo(t.lastActivityAt)}</span>
        {t.pinned && <Pin className="h-3.5 w-3.5 text-gold-400" aria-label="Pinned" />}
        {t.locked && <Lock className="h-3.5 w-3.5 text-slate-500" aria-label="Locked" />}
      </div>

      {/* Substance */}
      <div className="mt-1.5 min-w-0">
        <span className="block truncate font-medium text-slate-100">{t.title}</span>
        {t.excerpt && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{t.excerpt}</p>}
      </div>

      {/* State + response affordance */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
        {t.kaiAnswered && (
          <span className="inline-flex items-center gap-1 rounded bg-brand-500/15 px-1.5 py-0.5 font-semibold text-brand-300">
            <Sparkles className="h-3 w-3" aria-hidden="true" /> Kai answered
          </span>
        )}
        {open && (
          <span className="inline-flex items-center gap-1 rounded border border-gold-500/30 bg-gold-500/10 px-1.5 py-0.5 font-semibold text-gold-400">
            Awaiting first reply
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-slate-500">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="tnum">{t.replyCount}</span>
          <span className="sr-only">{t.replyCount === 1 ? "reply" : "replies"}</span>
        </span>
      </div>
    </Link>
  );
}
