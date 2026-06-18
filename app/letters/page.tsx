"use client";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import {
  Mails, Loader2, AlertTriangle, Copy, Check, Printer, Sparkles, Send, Trash2,
  Lightbulb, Upload, ArrowUpRight, ShieldCheck,
} from "lucide-react";

interface Tradeline {
  id: string; creditorName: string; balance: number; accountType: string;
  bureaus: string[]; recommendedStrategy: string | null; recommendedReason: string;
  furnisherName?: string | null; furnisherAddress?: string | null;
}
interface Strategy { id: string; label: string; blurb: string; riskNote?: string; recipient: string; }
interface SavedLetter {
  id: string; creditorName: string | null; recipientName: string; status: string;
  strategy: string; round: number; targetBureau: string | null;
  createdAt: string; mailedAt: string | null; preview: string;
  hasResponse: boolean; responseOutcome: string | null; responseAnalysis: string | null;
  parentLetterId: string | null;
}

const BUREAU_LABEL: Record<string, string> = { EQUIFAX: "Equifax", EXPERIAN: "Experian", TRANSUNION: "TransUnion" };
const BUREAU_SHORT: Record<string, string> = { EQUIFAX: "EQ", EXPERIAN: "EX", TRANSUNION: "TU" };

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
const OUTCOME_LABEL: Record<string, string> = {
  verified: "Verified (kept)", deleted: "Deleted ✓", updated: "Updated", no_response: "Non-response", unknown: "Logged",
};
const OUTCOME_COLOR: Record<string, string> = {
  deleted: "bg-emerald-500/15 text-emerald-300",
  verified: "bg-rose-500/15 text-rose-300",
  updated: "bg-gold-500/15 text-gold-300",
  no_response: "bg-rose-500/15 text-rose-300",
  unknown: "bg-slate-500/15 text-slate-300",
};

function LettersInner() {
  const params = useSearchParams();
  const [tradelines, setTradelines] = useState<Tradeline[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [saved, setSaved] = useState<SavedLetter[]>([]);
  const [strategyId, setStrategyId] = useState("fcra_611");
  const [tradelineId, setTradelineId] = useState("");
  const [bureausSel, setBureausSel] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [letter, setLetter] = useState<{ id: string; body: string } | null>(null);
  const [genCount, setGenCount] = useState(0);
  const [aiRefined, setAiRefined] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const deepApplied = useRef(false);

  const loadSaved = useCallback(() => {
    fetch("/api/letters").then((r) => r.json()).then((d) => setSaved(d.letters || []));
  }, []);

  useEffect(() => {
    fetch("/api/tradelines").then((r) => r.json()).then((d) => setTradelines(d.tradelines || []));
    fetch("/api/strategies").then((r) => r.json()).then((d) => setStrategies(d.strategies || []));
    loadSaved();
  }, [loadSaved]);

  const strategy = strategies.find((s) => s.id === strategyId);
  const selectedTradeline = tradelines.find((t) => t.id === tradelineId);
  const isBureauStrategy = !strategy || strategy.recipient === "bureau";

  // Apply the recommended strategy + the item's bureaus when an item is chosen.
  function applyItem(id: string, overrideStrategy?: string) {
    setTradelineId(id);
    const tl = tradelines.find((t) => t.id === id);
    if (tl) {
      setBureausSel(tl.bureaus.length ? tl.bureaus : ["EQUIFAX"]);
      // Pre-fill the furnisher/collector recipient from the contact we parsed off
      // the report, so the letter is mail-ready with no manual entry. Both fields
      // stay editable; fall back to the creditor name / blank address when absent.
      setRecipientName(tl.furnisherName || tl.creditorName);
      setRecipientAddress(tl.furnisherAddress || "");
      if (overrideStrategy) setStrategyId(overrideStrategy);
      else if (tl.recommendedStrategy) setStrategyId(tl.recommendedStrategy);
    }
  }

  // Deep link from Tradelines/Strategist (?tradeline=&strategy=).
  useEffect(() => {
    if (deepApplied.current || tradelines.length === 0) return;
    const t = params.get("tradeline");
    const s = params.get("strategy");
    if (t) {
      applyItem(t, s ?? undefined);
      deepApplied.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, tradelines]);

  function toggleBureau(b: string) {
    setBureausSel((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  }

  async function generate() {
    if (!tradelineId) { setError("Select an item to dispute."); return; }
    if (isBureauStrategy && bureausSel.length === 0) { setError("Choose at least one bureau to send to."); return; }
    setBusy(true); setError(null); setLetter(null); setWarning(null); setUpgrade(false); setAiRefined(false); setGenCount(0);
    try {
      const res = await fetch("/api/letters/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradelineId,
          strategyId,
          ...(isBureauStrategy
            ? { targetBureaus: bureausSel }
            : { recipientName: recipientName.trim(), recipientAddress: recipientAddress.trim() }),
        }),
      });
      const j = await res.json();
      if (res.status === 402) { setError(j.error); setUpgrade(true); return; }
      if (!res.ok) { setError(j.error || "Generation failed"); return; }
      setLetter({ id: j.letter.id, body: j.letter.body });
      setGenCount(j.count || 1);
      setAiRefined(Boolean(j.aiRefined));
      setWarning(j.warning);
      setUpgrade(Boolean(j.upgrade));
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

  async function deleteLetter(id: string) {
    const res = await fetch(`/api/letters/${id}`, { method: "DELETE" });
    if (res.ok) {
      setConfirmDelete(null);
      if (letter?.id === id) setLetter(null);
      loadSaved();
    }
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
      {params.get("purchase") === "success" && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          🎉 Payment received — your letter pack is being added. Your extra letters will be available momentarily.
        </div>
      )}
      <h2 className="mb-4 text-xl font-semibold">Dispute Letter Builder</h2>

      {noTradelines ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <Mails className="h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">No accounts to dispute yet.</p>
          <Link href="/upload" className="btn-primary">Upload a credit report</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[340px_1fr]">
          <div className="card h-fit p-4">
            <label className="label">Negative Item</label>
            <select className="input mb-1" value={tradelineId} onChange={(e) => applyItem(e.target.value)}>
              <option value="">Select a negative item…</option>
              {tradelines.map((t) => (
                <option key={t.id} value={t.id}>{t.creditorName} — ${(t.balance / 100).toLocaleString()}</option>
              ))}
            </select>

            {/* Recommendation guidance */}
            {selectedTradeline && (
              selectedTradeline.recommendedStrategy ? (
                <div className="mb-3 flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-300">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                  <span>{selectedTradeline.recommendedReason}</span>
                </div>
              ) : (
                <div className="mb-3 flex gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{selectedTradeline.recommendedReason}</span>
                </div>
              )
            )}

            <label className="label">Letter Type / Strategy</label>
            <select className="input mb-1" value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}{selectedTradeline?.recommendedStrategy === s.id ? "  ★ recommended" : ""}
                </option>
              ))}
            </select>
            {strategy && <p className="mb-3 text-[11px] text-slate-500">{strategy.blurb}</p>}
            {strategy?.riskNote && (
              <div className="mb-3 flex gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-2 text-[11px] text-gold-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {strategy.riskNote}
              </div>
            )}

            {/* Bureau targeting */}
            {isBureauStrategy && selectedTradeline && (
              <div className="mb-4">
                <label className="label">Send to bureau(s)</label>
                <p className="mb-2 text-[11px] text-slate-500">
                  This account is reported by {selectedTradeline.bureaus.map((b) => BUREAU_LABEL[b]).join(", ") || "—"}.
                  Generate one letter per bureau you select.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(selectedTradeline.bureaus.length ? selectedTradeline.bureaus : ["EQUIFAX", "EXPERIAN", "TRANSUNION"]).map((b) => (
                    <button
                      key={b}
                      onClick={() => toggleBureau(b)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        bureausSel.includes(b)
                          ? "border-brand-500 bg-brand-500/15 text-brand-300"
                          : "border-ink-600 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {BUREAU_LABEL[b]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Furnisher / collector recipient address — makes the letter mail-ready */}
            {!isBureauStrategy && selectedTradeline && (
              <div className="mb-4">
                <label className="label">
                  Send to ({strategy?.recipient === "collector" ? "collection agency" : "furnisher / creditor"})
                </label>
                {selectedTradeline.furnisherAddress ? (
                  <p className="mb-2 flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span>We pulled this {strategy?.recipient === "collector" ? "collector" : "furnisher"}&apos;s mailing
                    address straight from your report — review it and edit if needed.</span>
                  </p>
                ) : (
                  <p className="mb-2 text-[11px] text-slate-500">
                    This letter is sent directly to the {strategy?.recipient === "collector" ? "collector" : "furnisher"} —
                    add their mailing address so it&apos;s ready to send. You&apos;ll find it on the account statement or the
                    account&apos;s entry on your credit report.
                  </p>
                )}
                <input
                  className="input mb-2"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient name"
                />
                <textarea
                  className="input resize-y"
                  rows={3}
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder={"Mailing address\nP.O. Box / Street\nCity, State ZIP"}
                />
              </div>
            )}

            <button onClick={generate} disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mails className="h-4 w-4" />}
              {busy ? "Generating…" : isBureauStrategy && bureausSel.length > 1 ? `Generate ${bureausSel.length} Letters` : "Generate Letter"}
            </button>
            {remaining !== null && (
              <p className="mt-2 text-center text-[11px] text-slate-500">{remaining} free letters left this month</p>
            )}
            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
            {upgrade && (
              <div className="mt-2 space-y-1.5 text-center">
                <Link href="/pricing" className="block text-xs font-semibold text-brand-300 underline">
                  Upgrade to Premium for unlimited letters →
                </Link>
                <button
                  onClick={async () => {
                    const r = await fetch("/api/stripe/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ product: "letters_5" }),
                    });
                    const j = await r.json();
                    if (r.ok && j.url) window.location.href = j.url;
                  }}
                  className="text-[11px] text-slate-400 underline hover:text-slate-200"
                >
                  …or buy a one-time 5-letter pack for $19
                </button>
              </div>
            )}
          </div>

          <div className="card min-h-[400px] p-5">
            {letter ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {genCount > 1 && (
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
                        Generated {genCount} letters — one per bureau
                      </span>
                    )}
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
                <div><Mails className="mx-auto mb-2 h-8 w-8 text-slate-600" />Pick an item — we&apos;ll recommend the right letter and bureaus.<br />Your AI-grounded dispute letter will appear here.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved letters */}
      {saved.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-lg font-semibold">Your Letters</h3>
          <div className="card divide-y divide-ink-700/50">
            {saved.map((l) => (
              <LetterRow
                key={l.id}
                l={l}
                onStatus={setStatus}
                onDelete={() => setConfirmDelete(l.id)}
                confirming={confirmDelete === l.id}
                onConfirmDelete={() => deleteLetter(l.id)}
                onCancelDelete={() => setConfirmDelete(null)}
                onChanged={loadSaved}
              />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// A single saved-letter row with the Round 2 response flow.
function LetterRow({
  l, onStatus, onDelete, confirming, onConfirmDelete, onCancelDelete, onChanged,
}: {
  l: SavedLetter;
  onStatus: (id: string, s: string) => void;
  onDelete: () => void;
  confirming: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onChanged: () => void;
}) {
  const [openResp, setOpenResp] = useState(false);
  const [respText, setRespText] = useState("");
  const [respFile, setRespFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const analysis = l.responseAnalysis ? safeParse(l.responseAnalysis) : null;

  async function submitResponse() {
    setBusy(true); setMsg(null);
    try {
      const form = new FormData();
      if (respText.trim()) form.set("text", respText);
      if (respFile) form.set("file", respFile);
      if (!respText.trim() && !respFile) { setMsg("Paste the response text or attach a PDF."); setBusy(false); return; }
      const res = await fetch(`/api/letters/${l.id}/response`, { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error || "Failed"); setBusy(false); return; }
      setOpenResp(false); setRespText(""); setRespFile(null);
      onChanged();
    } catch { setMsg("Network error."); } finally { setBusy(false); }
  }

  async function genRound2() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/letters/${l.id}/round2`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error || "Failed"); setBusy(false); return; }
      onChanged();
    } catch { setMsg("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate font-medium">
            {l.creditorName || l.recipientName}
            {l.round > 1 && <span className="pill bg-blue-500/15 text-blue-300">Round {l.round}</span>}
            {l.targetBureau && <span className="pill bg-ink-700 text-slate-300">{BUREAU_SHORT[l.targetBureau]}</span>}
          </div>
          <div className="truncate text-xs text-slate-500">
            {l.recipientName} · {new Date(l.createdAt).toLocaleDateString()}
          </div>
        </div>
        {l.hasResponse && l.responseOutcome && (
          <span className={`pill ${OUTCOME_COLOR[l.responseOutcome] || "bg-slate-500/15 text-slate-300"}`}>
            {OUTCOME_LABEL[l.responseOutcome] || l.responseOutcome}
          </span>
        )}
        <span className={`pill ${STATUS_COLOR[l.status] || "bg-slate-500/15 text-slate-300"}`}>
          {STATUS_LABEL[l.status] || l.status}
        </span>

        {confirming ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Delete?</span>
            <button onClick={onConfirmDelete} className="rounded-md bg-rose-600 px-2 py-1 font-medium text-white keep-white hover:bg-rose-700">Delete</button>
            <button onClick={onCancelDelete} className="rounded-md border border-ink-600 px-2 py-1 text-slate-300">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Link href={`/letters/print/${l.id}`} target="_blank" className="btn-ghost text-xs"><Printer className="h-3.5 w-3.5" /></Link>
            {l.status !== "MAILED" && l.status !== "RESOLVED" && l.status !== "RESPONSE_RECEIVED" && (
              <button onClick={() => onStatus(l.id, "MAILED")} className="btn-ghost text-xs">Mark mailed</button>
            )}
            {(l.status === "MAILED" || l.status === "RESPONSE_RECEIVED") && !l.hasResponse && (
              <button onClick={() => setOpenResp((v) => !v)} className="btn-ghost text-xs">
                <Upload className="h-3.5 w-3.5" /> Log response
              </button>
            )}
            {l.hasResponse && l.responseOutcome !== "deleted" && (
              <button onClick={genRound2} disabled={busy} className="btn-ghost text-xs text-brand-300">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />} Round 2
              </button>
            )}
            {l.status === "MAILED" && (
              <button onClick={() => onStatus(l.id, "RESOLVED")} className="btn-ghost text-xs">Resolved</button>
            )}
            <button onClick={onDelete} className="btn-ghost text-xs text-slate-400 hover:text-rose-400" title="Delete letter">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* AI analysis of the logged response */}
      {analysis && (
        <div className="mt-2 rounded-lg border border-ink-700 bg-ink-900/50 p-3 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-200">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-400" /> AI analysis of the response
          </div>
          <p className="text-slate-400">{analysis.summary}</p>
          {analysis.weaknesses?.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-slate-400">
              {analysis.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {l.responseOutcome !== "deleted" && (
            <p className="mt-2 text-brand-300">Recommended: {analysis.recommendedNextStep}</p>
          )}
        </div>
      )}

      {/* Inline response logger */}
      {openResp && (
        <div className="mt-2 rounded-lg border border-ink-700 bg-ink-900/50 p-3">
          <p className="mb-2 text-xs text-slate-400">Paste the bureau&apos;s response, or attach the PDF. AI will assess it and draft a Round 2 escalation.</p>
          <textarea
            value={respText}
            onChange={(e) => setRespText(e.target.value)}
            rows={4}
            placeholder="Paste the response letter text here…"
            className="mb-2 w-full resize-y rounded-lg border border-ink-700 bg-ink-900 p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <label className="btn-ghost cursor-pointer text-xs">
              <Upload className="h-3.5 w-3.5" /> {respFile ? respFile.name : "Attach PDF"}
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setRespFile(e.target.files?.[0] ?? null)} />
            </label>
            <button onClick={submitResponse} disabled={busy} className="btn-primary text-xs">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Analyze response
            </button>
            <button onClick={() => setOpenResp(false)} className="text-xs text-slate-400">Cancel</button>
          </div>
          {msg && <p className="mt-2 text-xs text-rose-400">{msg}</p>}
        </div>
      )}
      {msg && !openResp && <p className="mt-2 text-xs text-rose-400">{msg}</p>}
    </div>
  );
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

export default function LettersPage() {
  return (
    <Suspense fallback={<AppShell title="/ Dispute Letters"><div /></AppShell>}>
      <LettersInner />
    </Suspense>
  );
}
