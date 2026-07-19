"use client";
import { useEffect, useRef, useState } from "react";

// GXL Gallery — the Bench: the Sweep + the Append + the Verified Lamp as one
// interactive organ. Press "Run the check" and a REAL (demo) computation runs:
// the sweep hand rotates exactly while it runs and stops dead at 12; the result
// is typeset into the folio by Append (the rule sets itself beneath it); if the
// step is a verification, the green lamp etches on — the only green in GXL.
//
// Motion = computation, literally: the hand is driven by the same state that
// gates the work. Reduced motion: the hand never rotates; the textual state
// ("computing…") carries the same information (M5 parity).
// All content is SPECIMEN and process-language — no outcomes, no promises.

interface BenchStep { text: string; cite?: string; verify?: boolean }

export function GxlBench({
  styles, title, steps, buttonLabel = "Run the check", disclosures,
}: {
  styles: Record<string, string>;
  title: string;
  steps: BenchStep[];
  buttonLabel?: string;
  disclosures?: { read: string; lacked: string; confidence: string };
}) {
  const [entries, setEntries] = useState<Array<BenchStep & { at: string }>>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  function run() {
    if (running || done) return;
    setRunning(true);
    steps.forEach((s, i) => {
      timers.current.push(window.setTimeout(() => {
        const at = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        setEntries((e) => [...e, { ...s, at }]);
        if (i === steps.length - 1) { setRunning(false); setDone(true); }
      }, 900 + i * 1100));
    });
  }

  return (
    <section aria-label={title} className="border border-ink-700/50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className={`${styles.record} text-[15px] text-slate-100`}>{title}</h3>
          <p className={`${styles.engraved} mt-1`}>{running ? "Computing — the hand runs only now" : done ? "At rest — the hand stopped when the work did" : "At rest"}</p>
        </div>
        <div className={`${styles.dial} ${running ? styles.dialRunning : ""} shrink-0`} aria-hidden="true" />
      </div>

      {!done && (
        <button onClick={run} disabled={running} className="btn-ghost mt-4 text-sm disabled:opacity-60">
          {running ? "Working…" : buttonLabel}
        </button>
      )}

      {entries.length > 0 && (
        <ol className={`${styles.folio} mt-4`}>
          {entries.map((e, i) => (
            <li key={i} className={`${styles.appended} py-2.5`}>
              <p className={`${styles.record} text-[13.5px] leading-relaxed text-slate-200`}>
                {e.text}
                {e.cite && (
                  <span className="ml-2 whitespace-nowrap font-mono text-[10px] text-ocean-300">[{e.cite}]</span>
                )}
                {e.verify && <span className={`${styles.verifiedLamp} ml-2 align-middle`} title="Verified — the only green in the system" />}
              </p>
              <span className="tnum font-mono text-[10px] text-slate-600">entered {e.at}</span>
            </li>
          ))}
        </ol>
      )}

      {done && disclosures && (
        <dl className="mt-4 space-y-1 border-t border-ink-700/60 pt-3 text-[11px] leading-relaxed text-slate-500">
          <div><dt className={`${styles.engraved} inline`}>What it read — </dt><dd className="inline">{disclosures.read}</dd></div>
          <div><dt className={`${styles.engraved} inline`}>What it lacked — </dt><dd className="inline">{disclosures.lacked}</dd></div>
          <div><dt className={`${styles.engraved} inline`}>Confidence — </dt><dd className="inline">{disclosures.confidence}</dd></div>
        </dl>
      )}
    </section>
  );
}
