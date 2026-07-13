import { STATUTES, type StatuteKey } from "@/lib/statutes";

// One statute, plain-English first, the real operative text one disclosure away
// (W13 law-as-UI). No client JS — native details/summary. Safe in server and
// client trees alike: lib/statutes.ts is a dependency-free const.
export function StatuteCard({ statute }: { statute: StatuteKey }) {
  const s = STATUTES[statute];
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-semibold text-slate-200">{s.short}</span>
        <span className="text-[11px] text-slate-500">{s.usc}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{s.desc}</p>
      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-brand-400 hover:text-brand-300 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Read the actual law ▾</span>
          <span className="hidden group-open:inline">Close ▴</span>
        </summary>
        <blockquote className="mt-2 border-l-2 border-ink-600 pl-3 text-xs italic leading-relaxed text-slate-400">
          {s.text}
        </blockquote>
      </details>
    </div>
  );
}
