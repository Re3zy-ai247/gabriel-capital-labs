// CreditVector Academy (Sprint XXI, Phase 3) — the progressive learning path.
// Presentational only: it renders what the deterministic Academy engine produced and
// computes nothing. Lessons expand (native <details>, no client JS) and connect to
// the reader's real file when the data is present.
import Link from "next/link";
import type { Academy, AcademyLesson } from "@/lib/academy";
import { GraduationCap, ArrowUpRight, ChevronDown, Sparkles, CircleDot } from "lucide-react";

export function AcademyView({ academy }: { academy: Academy }) {
  const { lessons, nextLesson, note } = academy;
  return (
    <section aria-label="CreditVector Academy" className="mb-4 space-y-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-brand-300" aria-hidden />
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">CreditVector Academy</h3>
        <span className="text-[11px] text-slate-500">· learn your rights, step by step</span>
      </div>

      {nextLesson && (
        <Link href={`#lesson-${nextLesson.id}`} className="block">
          <div className="card border-brand-500/40 bg-brand-500/[0.06] p-4 transition-colors hover:bg-brand-500/[0.1]">
            <div className="mb-1 flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-300" aria-hidden /><span className="text-[10px] font-bold uppercase tracking-widest text-brand-300">Recommended next lesson</span></div>
            <div className="text-sm font-semibold text-slate-100">Level {nextLesson.level} — {nextLesson.title}</div>
            <div className="mt-0.5 text-[12px] text-slate-400">{nextLesson.connection ?? nextLesson.summary}</div>
          </div>
        </Link>
      )}

      <ol className="space-y-2">
        {lessons.map((l) => <LessonCard key={l.id} l={l} isNext={l.id === nextLesson?.id} />)}
      </ol>

      <p className="text-[10px] leading-relaxed text-slate-500">{note}</p>
    </section>
  );
}

function LessonCard({ l, isNext }: { l: AcademyLesson; isNext: boolean }) {
  return (
    <li id={`lesson-${l.id}`} className={`card overflow-hidden p-0 ${isNext ? "border-brand-500/40" : ""}`}>
      <details className="group" open={isNext}>
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-800/40 [&::-webkit-details-marker]:hidden">
          <span className={`tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${l.relevant ? "bg-brand-500/20 text-brand-200" : "bg-ink-700 text-slate-400"}`}>{l.level}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-100">{l.title}</span>
              {l.relevant && <span className="pill inline-flex items-center gap-1 bg-brand-500/15 text-brand-200"><CircleDot className="h-2.5 w-2.5" aria-hidden />on your file</span>}
            </div>
            <div className="truncate text-[11px] text-slate-400">{l.summary}</div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
        </summary>

        <div className="space-y-3 border-t border-ink-700/50 px-4 py-3 text-[12px]">
          {l.connection && (
            <div className="rounded-md bg-ink-800/50 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Your file · </span>
              <span className="text-slate-300">{l.connection}</span>
            </div>
          )}
          <ul className="space-y-1.5">
            {l.keyPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-300">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          {l.cta && (
            <Link href={l.cta.href} className="inline-flex items-center gap-1 font-medium text-brand-300 hover:text-brand-200">{l.cta.text}<ArrowUpRight className="h-3 w-3" aria-hidden /></Link>
          )}
        </div>
      </details>
    </li>
  );
}
