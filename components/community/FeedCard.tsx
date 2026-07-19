import Link from "next/link";
import { Pin, Lock, Sparkles, MessageCircle } from "lucide-react";
import { categoryLabel } from "@/lib/communityShared";
import { timeAgo, isOpenLoop, type OperatorThread } from "./format";

// Operator Network work item (Phase 1.1). This is an intelligence work object,
// not a forum row: the operational subject and its PROVABLE state dominate;
// human attribution is secondary (demoted to the footer). Every state shown is
// backed by an existing authoritative field — pinned, locked, replyCount,
// isKai-derived kaiAnswered, lastActivityAt. Nothing is implied beyond those
// fields — richer epistemic state labels belong to later phases and their data.
// Hover stays a border-tone shift only; no entrance animation (Design Bible §4).
export function FeedCard({ t }: { t: OperatorThread }) {
  const open = isOpenLoop(t);
  return (
    <Link
      href={`/community/${t.id}`}
      className="card block p-4 transition hover:border-brand-500/50 focus-visible:border-brand-500/50"
    >
      {/* Domain + provable state — the work object's header */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded bg-ink-700/70 px-1.5 py-0.5 font-medium text-slate-300">{categoryLabel(t.category)}</span>
        {t.pinned && (
          <span className="inline-flex items-center gap-1 text-slate-400">
            <Pin className="h-3 w-3" aria-hidden="true" /> Pinned
          </span>
        )}
        {open ? (
          <span className="inline-flex items-center gap-1 rounded border border-gold-500/30 bg-gold-500/10 px-1.5 py-0.5 font-semibold text-gold-400">
            Awaiting first response
          </span>
        ) : t.locked ? (
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Lock className="h-3 w-3" aria-hidden="true" /> Closed
          </span>
        ) : (
          <span className="text-slate-500">In discussion</span>
        )}
        {t.kaiAnswered && (
          <span className="inline-flex items-center gap-1 rounded bg-brand-500/15 px-1.5 py-0.5 font-semibold text-brand-300">
            <Sparkles className="h-3 w-3" aria-hidden="true" /> Kai answered
          </span>
        )}
      </div>

      {/* Substance — dominant */}
      <div className="mt-2 min-w-0">
        <span className="block text-sm font-medium leading-snug text-slate-100">{t.title}</span>
        {t.excerpt && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{t.excerpt}</p>}
      </div>

      {/* Activity + attribution — secondary, one quiet line */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="tnum">{t.replyCount}</span> {t.replyCount === 1 ? "response" : "responses"}
        </span>
        <span aria-hidden="true">·</span>
        <span className="tnum">updated {timeAgo(t.lastActivityAt)}</span>
        <span className="ml-auto truncate">opened by {t.authorName}</span>
      </div>
    </Link>
  );
}
