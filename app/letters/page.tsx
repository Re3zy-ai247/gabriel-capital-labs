"use client";
import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { Mails, Loader2, AlertTriangle, Copy, Check, Printer, Sparkles, Send } from "lucide-react";

interface Tradeline { id: string; creditorName: string; balance: number; accountType: string; }
interface Strategy { id: string; label: string; blurb: string; riskNote?: string; recipient: string; }
interface SavedLetter {
  id: string; creditorName: string | null; recipientName: string; status: string;
  strategy: string; createdAt: string; mailedAt: string | null; preview: string;
}

const STATUS_LABEL: Record<string, string> = {
  GENERATED: "Generated", PRINTED: "Printed", MAILED: "Mailed",
  RESPONSE_RECEIVED: "Response received", RESOLVED: "Resolved", DRAFT: "Draft",
};
const STATUS_COLOR: Record<string, string> = {
  GENERATED: "bg-slate-500/15 text-slate-300",
  MAILED: "bg-blue-500/15 text-blue-300",
  RESPONSE_RECEIVED: "bg-gold-500/15 text-gold-300",
  RESOLVED: "bg-emerald-500/15 text-emerald-300",
};

function LettersInner() {
  const params = useSearchParams();
  const [tradelines, setTradelines] = useState<Tradeline[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [saved, setSaved] = useState<SavedLetter[]>([]);
  const [strategyId, setStrategyId] = useState("fcra_611");
  const [tradelineId, setTradelineId] = useState("");
  const [letter, setLetter] = useState<{ id: string; body: string } | null>(null);
  const [aiRefined, setAiRefined] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadSaved = useCallback(() => {
    fetch("/api/letters").then((r) => r.json()).then((d) => setSaved(d.letters || []));
  }, []);

  useEffect(() => {
    fetch("/api/tradelines").then((r) => r.json()).then((d) => setTradelines(d.tradelines || []));
    fetch("/api/strategies").then((r) => r.json()).then((d) => setStrategies(d.strategies || []));
    loadSaved();
  }, [loadSaved]);

  // Preselect from ?tradeline= / ?strategy= (deep link from Tradelines/Strategist).
  useEffect(() => {
    const t = params.get("tradeline");
    const s = params.get("strategy");
    if (t) setTradelineId(t);
    if (s) setStrategyId(s);
  }, [params]);

  const strategy = strategies.find((s) => s.id === strategyId);

  async function generate() {
    if (!tradelineId) { setError("Select an item to dispute."); return; }
    setBusy(true); setError(null); setLetter(null); setWarning(null); setUpgrade(false); setAiRefined(false);
    try {
      const res = await fetch("/api/letters/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradelineId, strategyId }),
      });
      const j = await res.json();
      if (res.status === 402) { setError(j.error); setUpgrade(true); return; }
      if (!res.ok) { setError(j.error || "Generation failed"); return; }
      setLetter({ id: j.letter.id, body: j.letter.body });
      setAiRefined(Boolean(j.aiRefined));
      setWarning(j.warning);
      setRemaining(j.entitlement?.lettersRemaining ?? null);
      loadSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally { setBusy(false); }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/letters/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadSaved();
  }

  async function copyLetter() {
    if (!letter) return;
    await navigator.clipboard.writeText(letter.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const noTradelines = tradelines.length === 0;

  return (
    <AppShell title="/ Dispute Letters">
      <EduBanner />
      <h2 className="mb-4 text-xl font-semibold">Dispute Letter Builder</h2>

      {noTradelines ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <Mails className="h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">No accounts to dispute yet.</p>
          <Link href="/upload" className="btn-primary">Upload a credit report</Link>
        </div>
      ) : (
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
            {remaining !== null && (
              <p className="mt-2 text-center text-[11px] text-slate-500">{remaining} free letters left this month</p>
            )}
            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
            {upgrade && (
              <Link href="/pricing" className="mt-2 block text-center text-xs font-semibold text-emerald-400 underline">
                Upgrade to Premium for unlimited letters →
              </Link>
            )}
          </div>

          <div className="card min-h-[400px] p-5">
            {letter ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {aiRefined && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        <Sparkles className="h-3 w-3" /> AI-refined (Opus 4.8)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={copyLetter} className="btn-ghost text-xs">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                    </button>
                    <Link href={`/letters/print/${letter.id}`} target="_blank" className="btn-ghost text-xs">
                      <Printer className="h-3.5 w-3.5" /> Print / PDF
                    </Link>
                    <button onClick={() => setStatus(letter.id, "MAILED")} className="btn-ghost text-xs">
                      <Send className="h-3.5 w-3.5" /> Mark mailed
                    </button>
                  </div>
                </div>
                {warning && (
                  <div className="mb-4 flex gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-3 text-xs text-gold-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {warning}
                  </div>
                )}
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-200">{letter.body}</pre>
              </>
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-slate-500">
                <div><Mails className="mx-auto mb-2 h-8 w-8 text-slate-600" />Select an item and generate a letter.<br />Your AI-grounded dispute letter will appear here.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved letters */}
      {saved.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-lg font-semibold">Your Letters</h3>
          <div className="card overflow-hidden">
            {saved.map((l) => (
              <div key={l.id} className="flex items-center gap-3 border-b border-ink-700/50 px-4 py-3 text-sm last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{l.creditorName || l.recipientName}</div>
                  <div className="truncate text-xs text-slate-500">
                    {l.recipientName} · {new Date(l.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`pill ${STATUS_COLOR[l.status] || "bg-slate-500/15 text-slate-300"}`}>
                  {STATUS_LABEL[l.status] || l.status}
                </span>
                <Link href={`/letters/print/${l.id}`} target="_blank" className="btn-ghost text-xs">
                  <Printer className="h-3.5 w-3.5" />
                </Link>
                {l.status !== "MAILED" && l.status !== "RESOLVED" && (
                  <button onClick={() => setStatus(l.id, "MAILED")} className="btn-ghost text-xs">Mark mailed</button>
                )}
                {l.status === "MAILED" && (
                  <button onClick={() => setStatus(l.id, "RESOLVED")} className="btn-ghost text-xs">Mark resolved</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function LettersPage() {
  return (
    <Suspense fallback={<AppShell title="/ Dispute Letters"><div /></AppShell>}>
      <LettersInner />
    </Suspense>
  );
}
