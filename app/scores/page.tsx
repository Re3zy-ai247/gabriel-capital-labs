"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { LineChart, Loader2, Plus } from "lucide-react";

interface Entry { id: string; bureau: string; score: number; recordedAt: string; }

const BUREAUS = [
  { id: "EQUIFAX", label: "Equifax", color: "#34d399" },
  { id: "EXPERIAN", label: "Experian", color: "#60a5fa" },
  { id: "TRANSUNION", label: "TransUnion", color: "#f59e0b" },
];
const COLOR: Record<string, string> = Object.fromEntries(BUREAUS.map((b) => [b.id, b.color]));

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ScoresPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bureau, setBureau] = useState("EQUIFAX");
  const [score, setScore] = useState("");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/scores")
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setEntries(d.entries || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    setError(null);
    const n = Number(score);
    if (!Number.isFinite(n) || n < 300 || n > 850) { setError("Score must be 300–850."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/scores", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bureau, score: n, recordedAt: date }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "That entry didn't save. Try again — nothing was lost."); return; }
      setScore("");
      load();
    } catch {
      setError("The connection dropped before I could save that. Try again — nothing was lost.");
    } finally { setBusy(false); }
  }

  // latest score per bureau
  const latest = useMemo(() => {
    const m: Record<string, Entry> = {};
    for (const e of entries) m[e.bureau] = e; // entries are asc, so last wins
    return m;
  }, [entries]);

  return (
    <AppShell title="/ Score Tracker">
      <EduBanner />
      <h2 className="mb-1 text-xl font-semibold">Credit Score Tracker</h2>
      <p className="mb-4 max-w-2xl text-sm text-slate-400">
        <span className="mr-2 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        I log every score you record and hold the trend across all three bureaus
        {!loading && entries.length > 0 && <> — {entries.length} entr{entries.length === 1 ? "y" : "ies"} so far</>}.
        Enter scores from your own monitoring — I don&apos;t pull live scores.
      </p>

      {/* Latest scores */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {BUREAUS.map((b) => (
          <div key={b.id} className="card p-4 text-center">
            <div className="text-[11px] uppercase text-slate-400">{b.label}</div>
            <div className="text-2xl font-bold" style={{ color: b.color }}>
              {latest[b.id]?.score ?? "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card mb-4 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <LineChart className="h-4 w-4 text-brand-400" /> Score History
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">I&apos;m pulling up your score history…</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No entries yet. Log your first score below — I&apos;ll plot it here and hold the trend from there.
          </p>
        ) : (
          <ScoreChart entries={entries} />
        )}
        <div className="mt-3 flex gap-4 text-xs">
          {BUREAUS.map((b) => (
            <span key={b.id} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: b.color }} /> {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Add entry */}
      <div className="card p-5">
        <div className="mb-3 text-sm font-semibold">Log a score</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Bureau</label>
            <select value={bureau} onChange={(e) => setBureau(e.target.value)} className="input">
              {BUREAUS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Score</label>
            <input value={score} onChange={(e) => setScore(e.target.value)} inputMode="numeric" placeholder="700"
              className="input w-28" />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <button onClick={add} disabled={busy} className="btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>
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

  const series = BUREAUS.map((b) => ({
    color: b.color,
    pts: entries.filter((e) => e.bureau === b.id).map((e) => ({ cx: x(new Date(e.recordedAt).getTime()), cy: y(e.score) })),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 240 }}>
      {/* gridlines at 550, 670, 740 */}
      {[400, 550, 670, 740, 800].map((s) => (
        <g key={s}>
          <line x1={PAD} y1={y(s)} x2={W - PAD} y2={y(s)} stroke="#1e293b" strokeWidth="1" />
          <text x={4} y={y(s) + 3} fontSize="9" fill="#64748b">{s}</text>
        </g>
      ))}
      {series.map((ser, i) =>
        ser.pts.length > 1 ? (
          <polyline key={i} fill="none" stroke={ser.color} strokeWidth="2"
            points={ser.pts.map((p) => `${p.cx},${p.cy}`).join(" ")} />
        ) : null
      )}
      {series.map((ser, i) =>
        ser.pts.map((p, j) => <circle key={`${i}-${j}`} cx={p.cx} cy={p.cy} r="3" fill={ser.color} />)
      )}
    </svg>
  );
}
