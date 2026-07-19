"use client";
import { useState } from "react";
import type { CouncilOption } from "./specimen";

// GXL Gallery — the Council: options laid as considered documents, bearing
// lines converging on the recommendation, and THE DECISION BOUNDARY made
// physical (GXL §2.5 / L12): the system recommends with receipts; seating a
// course is the human's act, lands with a heavier detent, states its
// consequence in words, and is recorded with its author — by Append, into the
// minutes. Deciding again is a NEW entry referencing the old (L3: history
// cannot disappear). Specimen data throughout.

export function GxlCouncil({ styles, options }: { styles: Record<string, string>; options: CouncilOption[] }) {
  const [minutes, setMinutes] = useState<Array<{ text: string; at: string }>>([]);
  const [seated, setSeated] = useState<string | null>(null);

  function seat(o: CouncilOption) {
    if (o.id === seated) return;
    const at = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMinutes((m) => [
      ...m,
      {
        at,
        text:
          m.length === 0
            ? `Course seated: "${o.label}." Decided by the operator; the room recommended ${options.find((x) => x.recommended)?.label === o.label ? "this course" : `"${options.find((x) => x.recommended)?.label}"`}.`
            : `Course changed to: "${o.label}" — supersedes the prior entry, which remains on the record.`,
      },
    ]);
    setSeated(o.id);
  }

  return (
    <section aria-label="Strategy Council" className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => seat(o)}
            aria-pressed={seated === o.id}
            className={`${styles.seat} ${seated === o.id ? styles.seatChosen : ""} block p-4 text-left`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`${styles.record} text-[14px] leading-snug text-slate-100`}>{o.label}</span>
              {o.recommended && (
                <span className="shrink-0 rounded bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-brand-300" title="The room's recommendation — labeled and sourced; the decision is yours">
                  RECOMMENDED
                </span>
              )}
            </div>
            <p className={`${styles.record} mt-2 text-[12px] leading-relaxed text-slate-500`}>{o.basis}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{o.bearing}</p>
            <span className={`${styles.engraved} mt-3 block`}>{seated === o.id ? "Seated — recorded below" : "Seat this course"}</span>
          </button>
        ))}
      </div>

      <div>
        <div className={`${styles.engraved} mb-1`}>Minutes — decisions recorded with their author</div>
        {minutes.length === 0 ? (
          <p className={`${styles.record} border-t border-ink-700/50 py-3 text-[13px] text-slate-500`}>
            No course seated. The recommendation stands ready; the decision belongs to you.
          </p>
        ) : (
          <ol className={`${styles.folio}`}>
            {minutes.map((m, i) => (
              <li key={i} className={`${styles.appended} py-2.5`}>
                <p className={`${styles.record} text-[13px] leading-relaxed text-slate-200`}>{m.text}</p>
                <span className="tnum font-mono text-[10px] text-slate-600">entered {m.at} · Specimen Operator (you)</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
