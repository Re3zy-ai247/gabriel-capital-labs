import Link from "next/link";
import { CircleAlert, Pin, Sparkles, Activity } from "lucide-react";
import { timeAgo, isOpenLoop, type OperatorThread } from "./format";

// Network State — the Operator Network's context panel (Phase 1.1). Intelligence-
// shaped operational context, not social widgets: every section is a derived,
// provable state of the network's WORK (open loops, activity, Kai's answers,
// pinned context), computed from the SAME thread query the feed uses — zero
// extra reads, zero fabricated numbers, no people-popularity surfaces.
// Sections render honest educational empty states or not at all.
//
// Depth: these sections sit on a quieter plane than the feed's work items —
// border-only containment, no filled card surface (Design Bible §2.6).

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border border-ink-700/50 p-4">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function ThreadLine({ t, meta }: { t: OperatorThread; meta: string }) {
  return (
    <li>
      <Link href={`/community/${t.id}`} className="group block">
        <span className="block truncate text-xs font-medium text-slate-300 group-hover:text-brand-300">{t.title}</span>
        <span className="mt-0.5 block text-[11px] text-slate-500 tnum">{meta}</span>
      </Link>
    </li>
  );
}

export function NowPanel({ threads }: { threads: OperatorThread[] }) {
  const awaiting = threads.filter(isOpenLoop).slice(0, 3);
  const active = threads
    .filter((t) => !isOpenLoop(t) && t.replyCount > 0)
    .sort((a, b) => +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt) || (a.id < b.id ? -1 : 1))
    .slice(0, 3);
  const pinned = threads.filter((t) => t.pinned).slice(0, 3);
  const kaiThreads = threads.filter((t) => t.kaiAnswered);
  // Most recently ACTIVE Kai thread (recency + stable id), pin-agnostic — the
  // payload carries no Kai-reply timestamp, so "latest answer" cannot be claimed.
  const latestKai = kaiThreads.slice().sort((a, b) => +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt) || (a.id < b.id ? -1 : 1))[0] ?? null;

  return (
    <div className="space-y-3">
      <Section icon={<CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />} title="Needs attention">
        {awaiting.length === 0 ? (
          <p className="text-xs leading-relaxed text-slate-500">Every discussion has a first response. The queue is clear.</p>
        ) : (
          <ul className="space-y-2.5">
            {awaiting.map((t) => (
              <ThreadLine key={t.id} t={t} meta={`awaiting first response · updated ${timeAgo(t.lastActivityAt)}`} />
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />} title="Recently active">
        {active.length === 0 ? (
          <p className="text-xs leading-relaxed text-slate-500">Discussions with responses land here as the network works.</p>
        ) : (
          <ul className="space-y-2.5">
            {active.map((t) => (
              <ThreadLine key={t.id} t={t} meta={`${t.replyCount} ${t.replyCount === 1 ? "response" : "responses"} · ${timeAgo(t.lastActivityAt)}`} />
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />} title="Kai activity">
        {kaiThreads.length === 0 ? (
          <p className="text-xs leading-relaxed text-slate-500">
            Bring Kai into a thread and the answer lands here — statutes and process, never promises.
          </p>
        ) : (
          <div className="text-xs leading-relaxed text-slate-400">
            <p>
              <span className="mr-1.5 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
              <span className="tnum font-medium text-slate-200">{kaiThreads.length}</span>{" "}
              {kaiThreads.length === 1 ? "thread carries" : "threads carry"} a Kai answer.
            </p>
            {latestKai && (
              <Link href={`/community/${latestKai.id}`} className="mt-1.5 block truncate font-medium text-slate-300 hover:text-brand-300">
                Most recently active: {latestKai.title}
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
