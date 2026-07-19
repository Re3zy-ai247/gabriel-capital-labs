import Link from "next/link";
import { Pin, Sparkles, TrendingUp, Users } from "lucide-react";
import { timeAgo, type OperatorThread } from "./format";

// The "Now" context panel (Design Bible §5: peripheral context, never primary).
// Server-rendered from the SAME thread query the feed uses — every number here
// is real, derived, and zero-extra-cost (law: nothing fabricated; no extra
// Accelerate queries for ambiance). Sections render honest educational empty
// states rather than invented activity.

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="card p-4">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const text = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  return (
    <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink-600 bg-ink-700/70 text-[10px] font-semibold text-slate-300">
      {text}
    </span>
  );
}

export function NowPanel({ threads }: { threads: OperatorThread[] }) {
  const trending = threads
    .filter((t) => t.replyCount > 0)
    .sort((a, b) => b.replyCount - a.replyCount || +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt))
    .slice(0, 3);
  const pinned = threads.filter((t) => t.pinned).slice(0, 3);
  const kaiThreads = threads.filter((t) => t.kaiAnswered);
  const latestKai = kaiThreads[0] ?? null; // threads arrive pinned-then-recency ordered
  const contributors: string[] = [];
  for (const t of threads) {
    if (!contributors.includes(t.authorName)) contributors.push(t.authorName);
    if (contributors.length >= 5) break;
  }

  return (
    <div className="space-y-3">
      <Section icon={<TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />} title="Most active">
        {trending.length === 0 ? (
          <p className="text-xs leading-relaxed text-slate-500">Discussions with replies surface here — activity, not popularity.</p>
        ) : (
          <ul className="space-y-2.5">
            {trending.map((t) => (
              <li key={t.id}>
                <Link href={`/community/${t.id}`} className="group block">
                  <span className="block truncate text-xs font-medium text-slate-300 group-hover:text-brand-300">{t.title}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    <span className="tnum">{t.replyCount}</span> {t.replyCount === 1 ? "reply" : "replies"} · <span className="tnum">{timeAgo(t.lastActivityAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />} title="Recent contributors">
        {contributors.length === 0 ? (
          <p className="text-xs leading-relaxed text-slate-500">Operators who post appear here.</p>
        ) : (
          <ul className="space-y-2">
            {contributors.map((name) => (
              <li key={name} className="flex items-center gap-2 text-xs text-slate-300">
                <Initials name={name} /> <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />} title="Kai in the network">
        {kaiThreads.length === 0 ? (
          <p className="text-xs leading-relaxed text-slate-500">
            Bring Kai into a thread and the answer lands here — statutes and process, never promises.
          </p>
        ) : (
          <div className="text-xs leading-relaxed text-slate-400">
            <p>
              <span className="mr-1.5 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
              Answered <span className="tnum font-medium text-slate-200">{kaiThreads.length}</span>{" "}
              {kaiThreads.length === 1 ? "thread" : "threads"} in this lounge.
            </p>
            {latestKai && (
              <Link href={`/community/${latestKai.id}`} className="mt-1.5 block truncate font-medium text-slate-300 hover:text-brand-300">
                Latest: {latestKai.title}
              </Link>
            )}
          </div>
        )}
      </Section>

      {pinned.length > 0 && (
        <Section icon={<Pin className="h-3.5 w-3.5" aria-hidden="true" />} title="Pinned">
          <ul className="space-y-2">
            {pinned.map((t) => (
              <li key={t.id}>
                <Link href={`/community/${t.id}`} className="block truncate text-xs text-slate-400 hover:text-brand-300">{t.title}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
