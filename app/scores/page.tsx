// Adopted from the p0 score-intelligence lane: 96da6d1 ("fix: make Score
// Tracker explicitly self-reported") for the self-reported labeling, visible
// history table, and accessibility work, and 99ddf70 ("fix preview score
// tracker authentication path") for the 401-aware load/submit handling.
//
// REQUIRED ADAPTATION (RC1):
//  - The p0 version colored bureaus via `rgb(var(--score-series-*))` custom
//    properties and used `score-tracker-*` classes, all defined in
//    app/globals.css. That file is outside this slice's owned paths, so this
//    restores the base's own hardcoded hex colors and reuses the base's
//    existing text-brand-300 / text-success-400 / text-rose-400 utilities —
//    zero new CSS.
//  - `todayISO()` was inlined here in p0. Moved to lib/selfReportedScores.ts
//    as localDateIso/todayIso (RC1 addition, matching the letters lane's
//    already-approved app/letters/page.tsx localDateIso/todayIso naming) so
//    it is a plain testable export instead of a private closure.
"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { LineChart, Loader2, Plus } from "lucide-react";
import {
  SELF_REPORTED_SCORE_COMPARABILITY_NOTE,
  SELF_REPORTED_SCORE_DISCLOSURE,
  buildSelfReportedScoreSeries,
  compareSelfReportedScoreEntries,
  formatUserRecordedScoreChange,
  todayIso,
} from "@/lib/selfReportedScores";

interface Entry { id: string; bureau: string; score: number; recordedAt: string; createdAt: string; }

// Series colors from the token palette (brand teal / ocean blue / gold) — green
// stays reserved for success states, so it isn't a bureau color. Hardcoded
// here (not a CSS custom property) because app/globals.css is outside this
// slice's owned paths — see file header.
const BUREAUS = [
  { id: "EQUIFAX", label: "Equifax", color: "#28c2db" },
  { id: "EXPERIAN", label: "Experian", color: "#60a5fa" },
  { id: "TRANSUNION", label: "TransUnion", color: "#f2c14e" },
];

export default function ScoresPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bureau, setBureau] = useState("EQUIFAX");
  const [score, setScore] = useState("");
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/scores");
      // The layout already gates unauthenticated access server-side; this
      // client-side check handles a session that expired mid-visit. A 401
      // must send the visitor to sign in — never render as "zero entries".
      if (response.status === 401) {
        window.location.replace("/login?callbackUrl=/scores");
        return;
      }
      if (!response.ok) throw new Error("score history request failed");
      const data = await response.json();
      setEntries(data.entries || []);
    } catch {
      setLoadError("Your self-reported score history could not be loaded. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    // Hydrate the date default and the picker's max on the client, from the
    // VISITOR's own local calendar date — not the server's, and never UTC.
    // Computing this on the server would default to the server's timezone,
    // which is a different bug than the one being fixed (S-02): a US-evening
    // visitor is already "tomorrow" in UTC, so `toISOString().slice(0, 10)`
    // silently pre-fills and allows submitting a future-dated entry.
    const localToday = todayIso();
    setToday(localToday);
    setDate(localToday);
  }, []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConfirmation(null);
    const n = Number(score);
    if (!Number.isFinite(n) || n < 300 || n > 850) { setError("Score must be 300–850."); return; }
    if (!date) { setError("Choose the date you recorded this score."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/scores", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bureau, score: n, recordedAt: date }),
      });
      if (res.status === 401) {
        window.location.replace("/login?callbackUrl=/scores");
        return;
      }
      const j = await res.json();
      if (!res.ok) { setError(j.error || "That entry didn't save. Try again — nothing was lost."); return; }
      setScore("");
      const selectedBureau = BUREAUS.find((item) => item.id === bureau)?.label ?? bureau;
      const recordedDate = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
      });
      setConfirmation(`Self-reported ${selectedBureau} score ${n} for ${recordedDate} added.`);
      await load();
    } catch {
      setError("The connection dropped before I could save that. Try again — nothing was lost.");
    } finally { setBusy(false); }
  }

  const seriesByBureau = useMemo(() => {
    const series = buildSelfReportedScoreSeries(entries);
    return Object.fromEntries(series.map((item) => [item.bureau, item]));
  }, [entries]);

  return (
    <AppShell title="/ Scores">
      <EduBanner />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">Self-Reported Score Tracker</h2>
        <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-300">
          SELF-REPORTED
        </span>
      </div>
      <p id="self-reported-score-disclosure" className="mb-3 max-w-3xl text-sm leading-relaxed text-slate-300">
        {SELF_REPORTED_SCORE_DISCLOSURE}
      </p>
      <p className="mb-5 max-w-3xl text-sm text-slate-400">
        <span className="mr-2 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        I can help you understand the scores you record and why they may differ
        {!loading && !loadError && entries.length > 0 && <> — {entries.length} entr{entries.length === 1 ? "y" : "ies"} so far</>}.
        I cannot verify a score or determine what caused it to change.
      </p>

      {/* Latest scores */}
      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {BUREAUS.map((b) => {
          const series = seriesByBureau[b.id];
          const change = series?.change ?? null;
          const cardState = loading ? "loading" : loadError ? "unavailable" : series ? "available" : "empty";
          const since = series
            ? new Date(series.first.recordedAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
            : null;
          return (
            <section
              key={b.id}
              className="card min-w-0 p-4 text-center"
              aria-label={cardState === "loading"
                ? `${b.label} self-reported score: loading`
                : cardState === "unavailable"
                  ? `${b.label} self-reported score: unavailable`
                  : series
                    ? `${b.label} self-reported score: latest ${series.latest.score}`
                    : `${b.label} self-reported score: no entry`}
              aria-describedby="self-reported-score-disclosure"
            >
              <div className="text-[11px] uppercase text-slate-400">{b.label}</div>
              <div className="mt-1 text-[9px] font-bold tracking-[0.14em] text-brand-300">SELF-REPORTED</div>
              <div className={`${cardState === "unavailable" ? "text-sm" : "text-2xl"} font-bold tnum`} style={{ color: b.color }}>
                {cardState === "loading" ? "…" : cardState === "unavailable" ? "Unavailable" : series?.latest.score ?? "—"}
              </div>
              {cardState === "available" && change != null && (
                <div
                  className={`mt-1 text-[11px] font-medium tnum ${change > 0 ? "text-success-400" : change < 0 ? "text-rose-400" : "text-slate-400"}`}
                  title={`${formatUserRecordedScoreChange(change)} From your first to latest ${b.label} entry since ${since}. ${SELF_REPORTED_SCORE_COMPARABILITY_NOTE}`}
                >
                  <span className="block">User-recorded score change</span>
                  <span className="block text-sm">{change > 0 ? "+" : change < 0 ? "−" : ""}{Math.abs(change)} points</span>
                  <span className="block font-normal text-slate-400">first to latest · since {since}</span>
                </div>
              )}
              {cardState === "available" && change == null && series && (
                <div className="mt-1 text-[11px] text-slate-400">First self-reported entry — add another when you want to compare what you recorded.</div>
              )}
              {cardState === "empty" && (
                <div className="mt-1 text-[11px] text-slate-400">No self-reported entry yet.</div>
              )}
            </section>
          );
        })}
      </div>
      <p className="mb-4 text-xs leading-relaxed text-slate-400">{SELF_REPORTED_SCORE_COMPARABILITY_NOTE}</p>

      {/* Chart */}
      <section className="card mb-4 p-5" aria-labelledby="self-reported-history-heading">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <LineChart className="h-4 w-4 text-brand-400" aria-hidden />
          <span id="self-reported-history-heading">Self-reported score history</span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">Loading your self-reported score history…</p>
        ) : loadError ? (
          <p role="alert" className="py-8 text-center text-sm text-rose-400">{loadError}</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No entries yet. Add your first self-reported score below and it will appear here.
          </p>
        ) : (
          <ScoreChart entries={entries} />
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {BUREAUS.map((b) => (
            <span key={b.id} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: b.color }} aria-hidden /> {b.label} · self-reported
            </span>
          ))}
        </div>
      </section>

      {/* Add entry */}
      <section className="card p-5" aria-labelledby="add-self-reported-score-heading">
        <h3 id="add-self-reported-score-heading" className="mb-1 text-sm font-semibold">Add a self-reported score</h3>
        <p id="score-entry-help" className="mb-3 text-xs leading-relaxed text-slate-400">
          Enter a score from your own monitoring. CreditVector does not retrieve or verify this score.
        </p>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3" aria-describedby="score-entry-help">
          <div>
            <label htmlFor="self-reported-score-bureau" className="label">Bureau selected by you</label>
            <select id="self-reported-score-bureau" value={bureau} onChange={(e) => setBureau(e.target.value)} className="input">
              {BUREAUS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="self-reported-score-value" className="label">Self-reported score</label>
            <input id="self-reported-score-value" type="number" value={score} onChange={(e) => setScore(e.target.value)} inputMode="numeric" placeholder="700"
              min={300} max={850} step={1} required className="input w-32" />
          </div>
          <div>
            <label htmlFor="self-reported-score-date" className="label">Date recorded</label>
            <input id="self-reported-score-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today || undefined} required className="input" />
          </div>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {busy ? "Adding…" : "Add self-reported score"}
          </button>
        </form>
        {confirmation && <p role="status" aria-live="polite" className="mt-3 text-xs text-success-400">{confirmation}</p>}
        {error && <p role="alert" className="mt-3 text-xs text-rose-400">{error}</p>}
      </section>
    </AppShell>
  );
}

function ScoreChart({ entries }: { entries: Entry[] }) {
  const W = 720, H = 220, PAD = 32;
  const times = entries.map((e) => new Date(e.recordedAt).getTime());
  const tMin = Math.min(...times), tMax = Math.max(...times);
  const sMin = 300, sMax = 850;
  const x = (t: number) => (tMax === tMin ? PAD : PAD + ((t - tMin) / (tMax - tMin)) * (W - 2 * PAD));
  const y = (s: number) => H - PAD - ((s - sMin) / (sMax - sMin)) * (H - 2 * PAD);

  const series = BUREAUS.map((b) => {
    const list = entries.filter((e) => e.bureau === b.id).sort(compareSelfReportedScoreEntries);
    return {
      label: b.label,
      color: b.color,
      list,
      pts: list.map((e) => ({ cx: x(new Date(e.recordedAt).getTime()), cy: y(e.score) })),
    };
  });

  const described = series
    .filter((s) => s.list.length > 0)
    .map((s) =>
      s.list.length > 1
        ? `${s.label}: ${s.list.length} entries, ${s.list[0].score} to ${s.list[s.list.length - 1].score}`
        : `${s.label}: 1 entry at ${s.list[0].score}`
    )
    .join(". ");

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 240 }}
        role="img"
        aria-labelledby="self-reported-score-chart-title self-reported-score-chart-description"
      >
      <title id="self-reported-score-chart-title">Self-reported score history</title>
      <desc id="self-reported-score-chart-description">{`These values were entered by you and are not verified by CreditVector. ${described}.`}</desc>
      {[400, 550, 670, 740, 800].map((s) => (
        <g key={s}>
          <line x1={PAD} y1={y(s)} x2={W - PAD} y2={y(s)} className="stroke-ink-700" strokeWidth="1" />
          <text x={4} y={y(s) + 3} fontSize="9" className="fill-slate-400">{s}</text>
        </g>
      ))}
      {series.map((ser, i) =>
        ser.pts.length > 1 ? (
          <polyline
            key={i}
            fill="none"
            stroke={ser.color}
            strokeWidth="2"
            points={ser.pts.map((p) => `${p.cx},${p.cy}`).join(" ")}
            pathLength={1}
            className="animate-draw"
            style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
          />
        ) : null
      )}
      {series.map((ser, i) =>
        ser.pts.map((p, j) => (
          <circle
            key={`${i}-${j}`}
            cx={p.cx}
            cy={p.cy}
            r="3"
            fill={ser.color}
            className="animate-fadein"
          >
            <title>{`${ser.label} · SELF-REPORTED · ${ser.list[j].score} · ${new Date(ser.list[j].recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`}</title>
          </circle>
        ))
      )}
      </svg>
      <details className="mt-3 text-xs">
        <summary className="w-fit cursor-pointer rounded text-slate-300 underline decoration-slate-500 underline-offset-4">
          View exact self-reported entries
        </summary>
        <p className="mt-2 text-slate-400">These values were entered by you and have not been verified by CreditVector.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <caption className="sr-only">Exact self-reported score history</caption>
            <thead className="text-slate-300"><tr><th scope="col" className="py-2 pr-4">Bureau selected by you</th><th scope="col" className="py-2 pr-4">Self-reported score</th><th scope="col" className="py-2">Date recorded</th></tr></thead>
            <tbody>
              {[...entries].sort(compareSelfReportedScoreEntries).map((entry) => (
                <tr key={entry.id} className="border-t border-ink-700/70">
                  <td className="py-2 pr-4">{BUREAUS.find((bureau) => bureau.id === entry.bureau)?.label ?? entry.bureau}</td>
                  <td className="py-2 pr-4 tnum">{entry.score}</td>
                  <td className="py-2">{new Date(entry.recordedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
