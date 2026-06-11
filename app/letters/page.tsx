"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { Mails, Loader2, AlertTriangle } from "lucide-react";

interface Tradeline { id: string; creditorName: string; balance: number; accountType: string; }
interface Strategy { id: string; label: string; blurb: string; riskNote?: string; recipient: string; }

export default function LettersPage() {
  const [tradelines, setTradelines] = useState<Tradeline[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategyId, setStrategyId] = useState("fcra_611");
  const [tradelineId, setTradelineId] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tradelines").then((r) => r.json()).then((d) => setTradelines(d.tradelines || []));
    fetch("/api/strategies").then((r) => r.json()).then((d) => setStrategies(d.strategies || []));
  }, []);

  const strategy = strategies.find((s) => s.id === strategyId);

  async function generate() {
    if (!tradelineId) { setError("Select an item to dispute."); return; }
    setBusy(true); setError(null); setLetter(null); setWarning(null);
    try {
      const res = await fetch("/api/letters/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradelineId, strategyId }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Generation failed"); return; }
      setLetter(j.letter.body); setWarning(j.warning);
    } catch {
      setError("Network error. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <AppShell title="/ Dispute Letters">
      <EduBanner />
      <h2 className="mb-4 text-xl font-semibold">Dispute Letter Builder</h2>
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="card h-fit p-4">
          <label className="label">Letter Type / Strategy</label>
          <select className="input mb-1" value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
            {strategies.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {strategy && <p className="mb-3 text-[11px] text-slate-500">{strategy.blurb}</p>}
          {strategy?.riskNote && (
            <div className="mb-3 flex gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-2 text-[11px] text-gold-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {strategy.riskNote}
            </div>
          )}
          <label className="label">Negative Item</label>
          <select className="input mb-4" value={tradelineId} onChange={(e) => setTradelineId(e.target.value)}>
            <option value="">Select a negative item…</option>
            {tradelines.map((t) => <option key={t.id} value={t.id}>{t.creditorName} — ${(t.balance / 100).toLocaleString()}</option>)}
          </select>
          <button onClick={generate} disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mails className="h-4 w-4" />}
            {busy ? "Generating…" : "Generate Letter"}
          </button>
          {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
        </div>

        <div className="card min-h-[400px] p-5">
          {warning && (
            <div className="mb-4 flex gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-3 text-xs text-gold-400">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {warning}
            </div>
          )}
          {letter ? (
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-200">{letter}</pre>
          ) : (
            <div className="grid h-full place-items-center text-center text-sm text-slate-500">
              <div><Mails className="mx-auto mb-2 h-8 w-8 text-slate-600" />Select an item and generate a letter.<br />Your AI-grounded dispute letter will appear here.</div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
