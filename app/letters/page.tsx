"use client";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import {
  Mails, Loader2, AlertTriangle, Copy, Check, Printer, Sparkles, Send, Trash2,
  Upload, ArrowUpRight, ShieldCheck, Download, Pencil,
} from "lucide-react";
import {
  ownResponseLatencyDays, forecastFor, POSSIBLE_RESPONSES,
  REINVESTIGATION_DAYS, MAIL_TRANSIT_DAYS, daysElapsedSinceEstimatedReceipt,
} from "@/lib/forecast";

interface Tradeline {
  id: string; creditorName: string; balance: number; accountType: string;
  bureaus: string[]; recommendedStrategy: string | null; recommendedReason: string;
  furnisherName?: string | null; furnisherAddress?: string | null;
}
interface Strategy { id: string; label: string; blurb: string; riskNote?: string; recipient: string; }
interface SavedLetter {
  id: string; creditorName: string | null; recipientName: string; status: string;
  strategy: string; round: number; targetBureau: string | null;
  createdAt: string; mailedAt: string | null; responseAt: string | null; preview: string;
  hasResponse: boolean; responseOutcome: string | null; responseAnalysis: string | null;
  parentLetterId: string | null; tradelineId: string | null;
  // RB-4: server-computed on the RENDERED body (post render-time sender
  // resolution) — true while the printable artifact still carries any
  // placeholder. Optional so a stale cached response can't crash the page.
  needsDetails?: boolean;
}

// Phase 1A (F1): the SAME derived package-grouping key lib/mailCenter.ts's
// packageKeyFor() computes — duplicated here (not imported) because that
// module pulls in @/lib/mail, which imports prisma, and this is a "use
// client" page (CLAUDE.md gotcha 2: client pages must not import
// prisma-bearing modules). Keep in sync if the grouping key ever changes;
// scripts/mailCenter.test.ts pins the literal format both sides rely on.
function packageIdFor(l: Pick<SavedLetter, "id" | "tradelineId" | "strategy" | "round">): string {
  return l.tradelineId ? `tl:${l.tradelineId}:${l.strategy}:${l.round}` : `solo:${l.id}`;
}

const BUREAU_LABEL: Record<string, string> = { EQUIFAX: "Equifax", EXPERIAN: "Experian", TRANSUNION: "TransUnion" };
const BUREAU_SHORT: Record<string, string> = { EQUIFAX: "EQ", EXPERIAN: "EX", TRANSUNION: "TU" };

// RC1-S5 — the lifecycle the consumer actually walks: a draft they can change,
// an approval they give, then mailing. `PRINTED` is the enum member that carries
// "approved" until LetterStatus gains an APPROVED value (the reasoning, and the
// exact follow-up, are documented in app/api/letters/[id]/route.ts).
const APPROVED_STATUS = "PRINTED";
const EDITABLE_STATUSES = ["GENERATED", "DRAFT"];
const STATUS_LABEL: Record<string, string> = {
  GENERATED: "Draft — not approved", PRINTED: "Approved · ready to print", MAILED: "Mailed",
  RESPONSE_RECEIVED: "Response received", RESOLVED: "Closed out", DRAFT: "Your draft — not approved",
};
const STATUS_COLOR: Record<string, string> = {
  GENERATED: "bg-slate-500/15 text-slate-300",
  DRAFT: "bg-slate-500/15 text-slate-300",
  PRINTED: "bg-brand-500/15 text-brand-300",
  MAILED: "bg-ocean-500/15 text-ocean-300",
  RESPONSE_RECEIVED: "bg-gold-500/15 text-gold-300",
  RESOLVED: "bg-success-500/15 text-success-300",
};
const OUTCOME_LABEL: Record<string, string> = {
  verified: "Verified (kept)", deleted: "Deleted ✓", updated: "Updated", no_response: "Non-response", unknown: "Logged",
};
const OUTCOME_COLOR: Record<string, string> = {
  deleted: "bg-success-500/15 text-success-300",
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
  const [letter, setLetter] = useState<{ id: string; body: string; createdAt: string } | null>(null);
  const [genCount, setGenCount] = useState(0);
  const [aiRefined, setAiRefined] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // RC1-S5: the freshly-composed letter's own edit/approval state. A letter is
  // born unapproved; nothing may mail it until the consumer has said it is right.
  const [editing, setEditing] = useState(false);
  const [approved, setApproved] = useState(false);
  const deepApplied = useRef(false);

  const [loaded, setLoaded] = useState(false);

  const loadSaved = useCallback(() => {
    fetch("/api/letters").then((r) => r.json()).then((d) => setSaved(d.letters || []));
  }, []);

  useEffect(() => {
    // The loaded flag gates the empty state so users with data never see a
    // misleading "nothing to work with" flash before the fetch resolves.
    fetch("/api/tradelines")
      .then((r) => r.json())
      .then((d) => setTradelines(d.tradelines || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
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
    setEditing(false); setApproved(false); // a recomposed letter is unapproved again
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
      if (!res.ok) { setError(j.error || "That letter didn't generate. Try again in a moment."); return; }
      setLetter({ id: j.letter.id, body: j.letter.body, createdAt: j.letter.createdAt });
      setGenCount(j.count || 1);
      setAiRefined(Boolean(j.aiRefined));
      setWarning(j.warning);
      setUpgrade(Boolean(j.upgrade));
      setRemaining(j.entitlement?.lettersRemaining ?? null);
      loadSaved();
    } catch {
      setError("The connection dropped mid-request. Try again — nothing was lost.");
    } finally { setBusy(false); }
  }

  // Phase 1A honesty triple (part c): an optional `mailedAt` ("YYYY-MM-DD")
  // captures the ACTUAL mailing date instead of letting the server silently
  // stamp "now" — used by MarkMailedControl below. Returns an error string on
  // failure (e.g. a rejected date) so the control can show it inline, or null
  // on success.
  //
  // RC1-S5: `outcome` rides along when a dispute is closed out — the server
  // refuses to record a resolution the consumer did not state (A3 L-11).
  async function setStatus(
    id: string,
    status: string,
    opts?: { mailedAt?: string; outcome?: string }
  ): Promise<string | null> {
    const res = await fetch(`/api/letters/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        ...(opts?.mailedAt ? { mailedAt: opts.mailedAt } : {}),
        ...(opts?.outcome ? { outcome: opts.outcome } : {}),
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return j.error || "That didn't go through. Try again in a moment.";
    }
    loadSaved();
    return null;
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
        <div className="mb-4 rounded-lg border border-success-500/40 bg-success-500/10 px-4 py-3 text-sm text-success-300">
          🎉 Payment received — your letter pack is being added. Your extra letters will be available momentarily.
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Dispute Letter Builder</h2>
        {tradelines.length > 1 && (
          <Link href="/campaigns" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-300 hover:underline">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Disputing several items? Let Kai plan a focused campaign →
          </Link>
        )}
      </div>

      {!loaded ? (
        <div className="card p-10 text-center text-sm text-slate-500" aria-busy="true">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden /> Pulling up your items…
        </div>
      ) : noTradelines ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <Mails className="h-8 w-8 text-slate-600" aria-hidden />
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            <p className="text-sm font-medium text-slate-200">I have nothing to work with yet.</p>
          </div>
          <p className="max-w-sm text-sm text-slate-400">
            Upload a credit report and I&apos;ll flag the items worth challenging — every letter starts there.
          </p>
          <Link href="/upload" className="btn-primary">Upload a credit report</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[340px_1fr]">
          <div className="card h-fit p-4">
            <label htmlFor="letter-item" className="label">Negative Item</label>
            <select id="letter-item" className="input mb-1" value={tradelineId} onChange={(e) => applyItem(e.target.value)}>
              <option value="">Select a negative item…</option>
              {tradelines.map((t) => (
                <option key={t.id} value={t.id}>{t.creditorName} — ${(t.balance / 100).toLocaleString()}</option>
              ))}
            </select>

            {/* Recommendation guidance — items Kai advises against get the warning here;
                the positive recommendation renders as Kai's insight above the button. */}
            {selectedTradeline && !selectedTradeline.recommendedStrategy && (
              <div className="mb-3 flex gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{selectedTradeline.recommendedReason}</span>
              </div>
            )}

            <label htmlFor="letter-strategy" className="label">Letter Type / Strategy</label>
            <select id="letter-strategy" className="input mb-1" value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
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
                <span className="label" id="letter-bureaus-label">Send to bureau(s)</span>
                <p className="mb-2 text-[11px] text-slate-500">
                  This account is reported by {selectedTradeline.bureaus.map((b) => BUREAU_LABEL[b]).join(", ") || "—"}.
                  Generate one letter per bureau you select.
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="letter-bureaus-label">
                  {(selectedTradeline.bureaus.length ? selectedTradeline.bureaus : ["EQUIFAX", "EXPERIAN", "TRANSUNION"]).map((b) => (
                    <button
                      key={b}
                      aria-pressed={bureausSel.includes(b)}
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
                <label htmlFor="letter-recipient-name" className="label">
                  Send to ({strategy?.recipient === "collector" ? "collection agency" : "furnisher / creditor"})
                </label>
                {selectedTradeline.furnisherAddress ? (
                  <p className="mb-2 flex gap-2 rounded-lg border border-success-500/30 bg-success-500/10 p-2 text-[11px] text-success-300">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>I pulled this {strategy?.recipient === "collector" ? "collector" : "furnisher"}&apos;s mailing
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
                  id="letter-recipient-name"
                  className="input mb-2"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient name"
                />
                <textarea
                  aria-label="Recipient mailing address"
                  className="input resize-y"
                  rows={3}
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder={"Mailing address\nP.O. Box / Street\nCity, State ZIP"}
                />
              </div>
            )}

            {/* Kai's insight — real recommendation from lib/recommend, never invented. */}
            {selectedTradeline?.recommendedStrategy && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 p-2.5 text-[11px] leading-relaxed text-slate-300">
                <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                <span>
                  I&apos;d challenge this under{" "}
                  {strategies.find((s) => s.id === selectedTradeline.recommendedStrategy)?.label || "the recommended strategy"} —{" "}
                  {selectedTradeline.recommendedReason}
                </span>
              </div>
            )}

            <button onClick={generate} disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mails className="h-4 w-4" />}
              {busy
                ? "Preparing your letter…"
                : (() => {
                    // RB-6: when an unmailed draft already covers this item +
                    // strategy, the server updates it in place (no new row, no
                    // extra letter used) — the button says so instead of
                    // reading like a fresh, charged generation.
                    const willUpdate = saved.some(
                      (sl) => sl.tradelineId === tradelineId && sl.strategy === strategyId && !sl.mailedAt && sl.round === 1
                    );
                    const n = isBureauStrategy && bureausSel.length > 1 ? bureausSel.length : 1;
                    if (willUpdate) return n > 1 ? `Regenerate ${n} Letters (updates your drafts)` : "Regenerate Letter (updates your draft)";
                    return n > 1 ? `Generate ${n} Letters` : "Generate Letter";
                  })()}
            </button>
            {remaining !== null && (
              <p className="mt-2 text-center text-[11px] text-slate-500">{remaining} free letters left this month</p>
            )}
            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
            {upgrade && (
              <div className="mt-2 space-y-1.5 text-center">
                <Link href="/pricing" className="block text-xs font-semibold text-brand-300 underline">
                  Upgrade to Professional for unlimited letters →
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
                      <span className="pill bg-ocean-500/15 text-ocean-300">
                        Generated {genCount} letters — one per bureau
                      </span>
                    )}
                    {aiRefined && (
                      <span className="pill bg-brand-500/15 text-brand-300">
                        <Sparkles className="h-3 w-3" aria-hidden /> Refined by Kai
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={copyLetter} className="btn-ghost text-xs">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                    </button>
                    {/* RC1-S5: read it, change what's wrong, then approve it —
                        in that order, on the letter you are about to sign. */}
                    {!approved && !editing && (
                      <button onClick={() => setEditing(true)} className="btn-ghost min-h-[44px] text-xs">
                        <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit letter
                      </button>
                    )}
                    {approved ? (
                      <>
                        <Link href={`/letters/print/${letter.id}`} target="_blank" className="btn-primary !py-1.5 text-xs">
                          <Printer className="h-3.5 w-3.5" /> Print / PDF
                        </Link>
                        <button
                          onClick={async () => {
                            const err = await setStatus(letter.id, "DRAFT");
                            if (err) setError(err); else { setApproved(false); setEditing(true); }
                          }}
                          className="btn-ghost min-h-[44px] text-xs"
                        >
                          Re-open for editing
                        </button>
                      </>
                    ) : (
                      <Link
                        href={`/letters/print/${letter.id}`}
                        target="_blank"
                        onClick={() => { void setStatus(letter.id, APPROVED_STATUS).then((e) => { setError(e); if (!e) setApproved(true); }); }}
                        className="btn-primary !py-1.5 text-xs"
                        title="Mark this letter approved and open the printable copy."
                      >
                        <Printer className="h-3.5 w-3.5" /> Approve &amp; print
                      </Link>
                    )}
                    {approved && (
                      <MarkMailedControl
                        onConfirm={(d) => setStatus(letter.id, "MAILED", { mailedAt: d })}
                        minDate={localDateOf(letter.createdAt)}
                        className="btn-ghost min-h-[44px] text-xs"
                      />
                    )}
                    {/* Live mailing (MAIL_LIVE) is off during beta — this is a queue-for-later flow, honestly
                        labeled and de-emphasized so it's never mistaken for a letter that's already been sent. */}
                    <Link href={`/mail/send/${letter.id}`} className="btn-ghost text-xs text-slate-400" title="Queue this dispute for CreditVector to mail once live mailing is switched on — nothing is charged or sent yet.">
                      <Send className="h-3.5 w-3.5" /> Mail via CreditVector (soon)
                    </Link>
                  </div>
                </div>
                {/* Evidence-asymmetry disclosure (Phase 1A honesty triple, part b) —
                    wherever Download and Send are both presented. */}
                <p className="mb-3 text-[11px] text-slate-500">
                  Evidence differs by path: self-mail leaves your own mailing record as proof. CreditVector Fulfillment
                  (soon) adds a certified-mail receipt and tracking evidence once it&apos;s live.
                </p>
                {warning && (
                  <div className="mb-4 flex gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-3 text-xs text-gold-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {warning}
                  </div>
                )}
                {!approved && !editing && (
                  <p className="mb-3 text-[11px] text-slate-500">
                    Read it as the person signing it. Anything that isn&apos;t right about your account — change it
                    with <span className="text-slate-300">Edit letter</span>, then approve it.
                  </p>
                )}
                {editing ? (
                  <LetterEditor
                    letterId={letter.id}
                    initialBody={letter.body}
                    onSaved={(b) => { setLetter({ ...letter, body: b }); loadSaved(); }}
                    onCancel={() => setEditing(false)}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-200">{letter.body}</pre>
                )}
              </>
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-slate-500">
                <div>
                  <Mails className="mx-auto mb-2 h-8 w-8 text-slate-600" aria-hidden />
                  <div className="mb-1 flex items-center justify-center gap-1.5">
                    <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                    <span className="font-medium text-slate-300">No letters yet.</span>
                  </div>
                  Pick a flagged item and I&apos;ll draft the first round —<br />grounded in the statutes and in the
                  facts you confirm.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved letters */}
      {saved.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-1 text-lg font-semibold">Your Letters</h3>
          {/* Evidence-asymmetry disclosure (Phase 1A honesty triple, part b) —
              wherever Download and Send are both presented; shown once for the
              whole list rather than per row. */}
          <p className="mb-3 text-[11px] text-slate-500">
            Evidence differs by path: self-mail leaves your own mailing record as proof. CreditVector Fulfillment
            (soon) adds a certified-mail receipt and tracking evidence once it&apos;s live.
          </p>
          <div className="card divide-y divide-ink-700/50">
            {saved.map((l) => (
              <LetterRow
                key={l.id}
                l={l}
                ownLatency={ownResponseLatencyDays(saved, l.targetBureau)}
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

// Kai's one-line status story for a letter — computed only from the row's own
// real fields (status, mailedAt, targetBureau). Same day math as the dashboard.
function letterStoryline(l: SavedLetter): string | null {
  if (l.hasResponse) return null; // the Kai Response Card takes over from here
  if (l.status === "MAILED" && l.mailedAt) {
    const daySinceMailed = Math.floor((Date.now() - new Date(l.mailedAt).getTime()) / 86400000);
    if (!l.targetBureau) {
      return daySinceMailed <= 0
        ? "Mailed today — I'm watching for their response."
        : `Day ${daySinceMailed} since mailing — I'm watching for their response.`;
    }
    // Phase 1A honesty triple: §611's clock is receipt-anchored, not mailing-
    // anchored — the day count below uses the same shared transit-allowance
    // estimate lib/mailCenter.ts uses, never the raw mailing date.
    const day = daysElapsedSinceEstimatedReceipt(new Date(l.mailedAt).getTime(), Date.now());
    if (daySinceMailed < MAIL_TRANSIT_DAYS) {
      return `Mailed ${daySinceMailed <= 0 ? "today" : `${daySinceMailed} day${daySinceMailed === 1 ? "" : "s"} ago`} — the §611 clock starts once the bureau receives it (estimating ~${MAIL_TRANSIT_DAYS} days for delivery). I'm watching for it.`;
    }
    if (day >= REINVESTIGATION_DAYS) return `Estimating from receipt, day ${day} of the ~${REINVESTIGATION_DAYS}-day §611 window — it's likely passed. If nothing arrived, log that; a non-response is worth escalating.`;
    return `Day ${day} of ~${REINVESTIGATION_DAYS} on my receipt estimate — I'm watching the reinvestigation window.`;
  }
  if (l.status === "GENERATED" || l.status === "PRINTED" || l.status === "DRAFT") {
    // RB-4: never claim "Ready to mail" while the rendered artifact still
    // carries a placeholder — the server computes this on the SAME rendered
    // body the print/download surfaces produce, so card and artifact agree.
    if (l.needsDetails) {
      return "Needs your details before mailing — open the letter to see what's missing.";
    }
    // RC1-S5: "Ready to mail" was said of a letter nobody had read yet. A draft
    // is ready for the consumer to read and approve; only an approved letter is
    // ready to go in an envelope.
    if (l.status !== APPROVED_STATUS) {
      return "Read it, change anything that's wrong, then approve it — nothing gets mailed until you do.";
    }
    return l.targetBureau
      ? "Approved and ready to mail — the §611 clock starts when the bureau receives it."
      : "Approved and ready to mail — the response clock starts once it arrives.";
  }
  return null;
}

// Phase 1A-R RB-5: LOCAL calendar date, not UTC. `toISOString()` is always
// UTC, so on a US evening (already past UTC midnight, still "today" for the
// operator) it silently returns tomorrow's date — the exact bug that froze
// the mark-mailed picker's min/max/value to one forced, un-editable value.
// getFullYear/getMonth/getDate are local-time getters (unlike their UTC
// counterparts), so this is the operator's own wall-clock calendar date.
function localDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayIso(): string {
  return localDateIso(new Date());
}
// The letter's OWN creation day, in the OPERATOR's local timezone — mirrors
// todayIso() above. `iso.slice(0, 10)` on the raw (UTC) timestamp string
// would read the UTC calendar day, which is "tomorrow" for a US operator
// working in the evening; that mismatch is what let min > the true local
// today and froze the picker.
function localDateOf(iso: string | null | undefined): string | undefined {
  return iso ? localDateIso(new Date(iso)) : undefined;
}

// Phase 1A honesty triple (part c): the mark-mailed action prompts for the
// ACTUAL mailing date (defaulting to today) instead of silently stamping
// "now" — every §611 estimate anchors on this date. Shared by both places
// "Mark mailed myself" renders on this page (the freshly-generated letter
// panel and each saved-letter row).
function MarkMailedControl({
  onConfirm, minDate, className = "btn-primary min-h-[44px] !py-1.5 text-xs",
}: {
  onConfirm: (dateStr: string) => Promise<string | null>;
  minDate?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setErr(null); setDate(todayIso()); }}
        className={className}
        title="Printed and mailed it yourself? Mark it mailed — the response clock starts once it's received."
      >
        Mark mailed myself
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input
        type="date"
        aria-label="Date you mailed this"
        value={date}
        min={minDate}
        max={todayIso()}
        onChange={(e) => setDate(e.target.value)}
        className="min-h-[44px] rounded-lg border border-ink-600 bg-ink-900 px-2 text-xs text-slate-200"
      />
      <button
        onClick={async () => {
          setBusy(true); setErr(null);
          const result = await onConfirm(date);
          setBusy(false);
          if (result) setErr(result); else setOpen(false);
        }}
        disabled={busy}
        className="btn-primary min-h-[44px] !py-1.5 text-xs"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Confirm"}
      </button>
      <button onClick={() => setOpen(false)} disabled={busy} className="min-h-[44px] px-1 text-xs text-slate-400 hover:text-slate-200">
        Cancel
      </button>
      {err && <span className="basis-full text-[11px] text-rose-400" role="alert">{err}</span>}
    </span>
  );
}

// A single saved-letter row with the Round 2 response flow.
function LetterRow({
  l, ownLatency, onStatus, onDelete, confirming, onConfirmDelete, onCancelDelete, onChanged,
}: {
  l: SavedLetter;
  ownLatency: { medianDays: number; sample: number } | null;
  onStatus: (id: string, s: string, opts?: { mailedAt?: string; outcome?: string }) => Promise<string | null>;
  onDelete: () => void;
  confirming: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onChanged: () => void;
}) {
  const [openResp, setOpenResp] = useState(false);
  const [openForecast, setOpenForecast] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [respText, setRespText] = useState("");
  const [respFile, setRespFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // RC1-S4 (L-03) — the consumer's own opt-in, unchecked by default. Round 2
  // used to state an intent to file CFPB / state-AG complaints that nobody had
  // expressed, on a letter the consumer could not edit before signing.
  const [complaintIntent, setComplaintIntent] = useState(false);
  const isEditable = EDITABLE_STATUSES.includes(l.status) && !l.mailedAt;
  const isApproved = l.status === APPROVED_STATUS && !l.mailedAt;
  const analysis = l.responseAnalysis ? safeParse(l.responseAnalysis) : null;
  const storyline = letterStoryline(l);
  // §611 window progress — same visual grammar as the Kai Home radar, so the
  // clock reads identically everywhere. Only for mailed rows still waiting.
  // Phase 1A honesty triple: receipt-anchored (the shared transit-allowance
  // estimate), not the raw mailing date — see lib/forecast.ts.
  const windowDay =
    l.status === "MAILED" && l.mailedAt && !l.hasResponse
      ? daysElapsedSinceEstimatedReceipt(new Date(l.mailedAt).getTime(), Date.now())
      : null;
  const windowOverdue = windowDay != null && windowDay >= REINVESTIGATION_DAYS;
  // Engine 3 Tier A — the forecast for this mailed-waiting dispute, from statute
  // + this user's own history. Predictive of timeline/options, never of result.
  const forecast = forecastFor(l, ownLatency);

  async function submitResponse() {
    setBusy(true); setMsg(null);
    try {
      const form = new FormData();
      if (respText.trim()) form.set("text", respText);
      if (respFile) form.set("file", respFile);
      if (!respText.trim() && !respFile) { setMsg("Paste the response text or attach a PDF."); setBusy(false); return; }
      const res = await fetch(`/api/letters/${l.id}/response`, { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error || "That didn't go through. Try again in a moment."); setBusy(false); return; }
      setOpenResp(false); setRespText(""); setRespFile(null);
      // RC1-S5 (A3 L-10): the route already tells us when nothing read the
      // response (`needsAI`), and the page used to throw that away and show a
      // bare "Logged" — the consumer was left believing an assessment happened.
      if (j.needsAI) {
        setMsg(
          "Saved to this dispute. Automatic reading of the response isn't available right now, so nothing has assessed it — read it yourself, and you can still draft a follow-up round."
        );
      }
      onChanged();
    } catch { setMsg("The connection dropped mid-request. Try again — nothing was lost."); } finally { setBusy(false); }
  }

  async function genRound2() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/letters/${l.id}/round2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sent explicitly every time, so the letter states this intent only
        // when the box beside it is ticked (RC1-S4 L-03).
        body: JSON.stringify({ complaintIntent }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error || "That didn't go through. Try again in a moment."); setBusy(false); return; }
      onChanged();
    } catch { setMsg("The connection dropped mid-request. Try again — nothing was lost."); } finally { setBusy(false); }
  }

  return (
    <div className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate font-medium">
            {l.creditorName || l.recipientName}
            {l.round > 1 && <span className="pill bg-ocean-500/15 text-ocean-300">Round {l.round}</span>}
            {l.targetBureau && <span className="pill bg-ink-700 text-slate-300">{BUREAU_SHORT[l.targetBureau]}</span>}
          </div>
          <div className="truncate text-xs text-slate-500">
            {l.recipientName} · {new Date(l.createdAt).toLocaleDateString()}
          </div>
          {storyline && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="rounded bg-brand-500/15 px-1 py-px text-[9px] font-bold tracking-widest text-brand-300">KAI</span>
              <span className="truncate">{storyline}</span>
            </div>
          )}
          {windowDay != null && (
            <div className="mt-1.5 flex items-center gap-2">
              <div
                className="h-1.5 w-32 overflow-hidden rounded-full bg-ink-700"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={REINVESTIGATION_DAYS}
                aria-valuenow={Math.min(windowDay, REINVESTIGATION_DAYS)}
                aria-label={`Estimating from receipt, day ${windowDay} of the ~${REINVESTIGATION_DAYS}-day reinvestigation window`}
              >
                <div
                  className={`h-full transition-[width] duration-700 ${windowOverdue ? "bg-rose-500" : "bg-gold-500"}`}
                  style={{ width: `${Math.min(100, (windowDay / REINVESTIGATION_DAYS) * 100)}%` }}
                />
              </div>
              <span className={`text-[10px] ${windowOverdue ? "font-semibold text-rose-300" : "text-slate-500"}`}>
                {windowOverdue ? "window likely passed" : `~${Math.max(0, REINVESTIGATION_DAYS - windowDay)}d left`}
              </span>
              {forecast && (
                <button
                  onClick={() => setOpenForecast((v) => !v)}
                  className="text-[10px] font-semibold text-brand-400 hover:underline"
                  aria-expanded={openForecast}
                >
                  {openForecast ? "hide forecast" : "what happens next →"}
                </button>
              )}
            </div>
          )}
          {/* Engine 3 Tier A — Kai's forecast: window, own-history, options,
              contingency. Predictive of timeline/options, never of outcome. */}
          {forecast && openForecast && (
            <div className="mt-2 rounded-lg border border-ink-700 bg-ink-900/50 p-3 text-xs">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="rounded bg-brand-500/15 px-1 py-px text-[9px] font-bold tracking-widest text-brand-300">KAI</span>
                <span className="font-semibold text-slate-200">What happens next</span>
              </div>
              <p className="text-slate-400">{forecast.windowText}</p>
              {forecast.ownHistoryText && <p className="mt-1 text-slate-500">{forecast.ownHistoryText}</p>}
              <div className="mt-2">
                <div className="mb-1 font-semibold text-slate-300">The bureau can come back four ways</div>
                <ul className="space-y-1 text-slate-400">
                  {POSSIBLE_RESPONSES.map((r) => (
                    <li key={r.outcome}>
                      <span className="font-medium text-slate-300">{r.outcome}:</span> {r.meaning}{" "}
                      <span className="text-slate-500">{r.next}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-2 text-slate-500">{forecast.contingency}</p>
            </div>
          )}
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
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/letters/print/${l.id}`} target="_blank" className="btn-ghost min-h-[44px] min-w-[44px] justify-center text-xs" aria-label="Open the printable letter" title={isEditable ? "Preview the printable letter (this does not approve it)" : "Open the printable letter"}><Printer className="h-3.5 w-3.5" aria-hidden /></Link>
            {/* RC1-S5 (A3 L-01): edit → approve → mail, in that order. The letter
                is the consumer's signed statement, so it is theirs to change
                until they say it is right, and nothing can mail it before then. */}
            {isEditable && (
              <button onClick={() => setOpenEdit((v) => !v)} className="btn-ghost min-h-[44px] text-xs">
                <Pencil className="h-3.5 w-3.5" aria-hidden /> {openEdit ? "Close editor" : "Read & edit"}
              </button>
            )}
            {isEditable && (
              <Link
                href={`/letters/print/${l.id}`}
                target="_blank"
                onClick={() => { void onStatus(l.id, APPROVED_STATUS).then(setMsg); }}
                className="btn-primary min-h-[44px] !py-1.5 text-xs"
                title="Mark this letter approved and open the printable copy."
              >
                <Check className="h-3.5 w-3.5" aria-hidden /> Approve &amp; print
              </Link>
            )}
            {isApproved && (
              <button
                onClick={async () => { const e = await onStatus(l.id, "DRAFT"); setMsg(e); if (!e) setOpenEdit(true); }}
                className="btn-ghost min-h-[44px] text-xs"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Re-open for editing
              </button>
            )}
            {l.status !== "MAILED" && l.status !== "RESOLVED" && l.status !== "RESPONSE_RECEIVED" && (
              <>
                {/* Phase 1A F1: the Download flow's reachable entry from the
                    natural post-generation surface — before this fix, Download
                    was only reachable AFTER something in the same package had
                    already been mailed. */}
                <Link
                  href={`/mail/download/${encodeURIComponent(packageIdFor(l))}`}
                  className="btn-ghost min-h-[44px] text-xs"
                  title="Review this dispute and download it to print and mail."
                >
                  <Download className="h-3.5 w-3.5" aria-hidden /> Review &amp; download package
                </Link>
                {isApproved && (
                  <MarkMailedControl onConfirm={(d) => onStatus(l.id, "MAILED", { mailedAt: d })} minDate={localDateOf(l.createdAt)} />
                )}
                {/* MAIL_LIVE off during beta — queue-for-later, de-emphasized so it never reads as already 'sent'. */}
                <Link href={`/mail/send/${l.id}`} className="btn-ghost min-h-[44px] text-xs text-slate-400" title="Queue this dispute for CreditVector to mail once live mailing is switched on — nothing is charged or sent yet.">
                  <Send className="h-3.5 w-3.5" aria-hidden /> Mail via CreditVector (soon)
                </Link>
              </>
            )}
            {(l.status === "MAILED" || l.status === "RESPONSE_RECEIVED") && !l.hasResponse && (
              <button onClick={() => setOpenResp((v) => !v)} className="btn-ghost min-h-[44px] text-xs">
                <Upload className="h-3.5 w-3.5" /> Log response
              </button>
            )}
            {l.hasResponse && l.responseOutcome !== "deleted" && (
              <button onClick={genRound2} disabled={busy} className="btn-ghost min-h-[44px] text-xs text-brand-300">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />} Round {l.round + 1}
              </button>
            )}
            {(l.status === "MAILED" || l.status === "RESPONSE_RECEIVED") && (
              <ResolveControl onConfirm={(outcome) => onStatus(l.id, "RESOLVED", { outcome })} />
            )}
            <button onClick={onDelete} className="btn-ghost min-h-[44px] min-w-[44px] justify-center text-xs text-slate-400 hover:text-rose-400" title="Delete letter" aria-label="Delete letter">
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* The letter itself, open for editing. */}
      {openEdit && isEditable && (
        <div className="mt-2">
          <LetterEditor
            letterId={l.id}
            onSaved={() => { onChanged(); }}
            onCancel={() => setOpenEdit(false)}
          />
        </div>
      )}

      {/* Kai Response Card — outcome, evidence, why, and exactly one next action. */}
      {analysis && (
        <div
          className={`mt-2 rounded-lg border p-3 text-xs ${
            l.responseOutcome === "deleted"
              ? "border-success-500/40 bg-success-500/[0.06]"
              : "border-ink-700 bg-ink-900/50"
          }`}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="rounded bg-brand-500/15 px-1 py-px text-[9px] font-bold tracking-widest text-brand-300">KAI</span>
            <span className="font-semibold text-slate-200">
              {l.responseOutcome === "deleted" && "The item was deleted. One down."}
              {l.responseOutcome === "verified" && "They said “verified” — that's a claim, not the end."}
              {l.responseOutcome === "updated" && "They changed the item — check what, exactly."}
              {l.responseOutcome === "no_response" && "This reply doesn't actually answer your dispute."}
              {(!l.responseOutcome || l.responseOutcome === "unknown") && "Here's what I read in the response."}
            </span>
          </div>

          {/* What this outcome means — teach one transferable thing. */}
          <p className="text-slate-400">
            {l.responseOutcome === "verified" &&
              "“Verified” means the bureau claims the furnisher confirmed the item. Under FCRA §611(a)(7) you can demand the method of verification — how exactly they checked."}
            {l.responseOutcome === "deleted" &&
              "The item should no longer appear on this bureau's report. Watch your next report to confirm it stays gone — reinsertion requires the bureau to notify you (§611(a)(5))."}
            {l.responseOutcome === "updated" &&
              "Compare the updated fields against your records — a partial correction can still leave inaccurate data worth a targeted follow-up."}
            {l.responseOutcome === "no_response" &&
              "A non-substantive reply doesn't satisfy the bureau's §611 reinvestigation duty. That failure itself becomes the basis for your escalation."}
          </p>

          {/* Evidence — the model's grounded read of the response text. */}
          <div className="mt-2">
            <div className="mb-0.5 font-semibold text-slate-300">What the response says</div>
            <p className="text-slate-400">{analysis.summary}</p>
          </div>
          {analysis.weaknesses?.length > 0 && (
            <div className="mt-2">
              <div className="mb-0.5 font-semibold text-slate-300">Weaknesses a follow-up can target</div>
              <ul className="list-disc space-y-0.5 pl-4 text-slate-400">
                {analysis.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* One next action + the honest basis line. */}
          {l.responseOutcome !== "deleted" && (
            <ComplaintIntentChoice checked={complaintIntent} onChange={setComplaintIntent} />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {l.responseOutcome !== "deleted" ? (
              <button onClick={genRound2} disabled={busy} className="btn-primary !py-1.5 text-xs">
                {busy ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing Round {l.round + 1}…</>
                ) : (
                  // RC1-S5 (D-2 / P1-35): a template escalation asks for the
                  // method of verification and follows up on the prior dispute.
                  // It does not read the weaknesses above and write around them,
                  // so the button no longer says it does.
                  <>Draft Round {l.round + 1} — follow up on this response →</>
                )}
              </button>
            ) : (
              <Link href="/journey" className="btn-ghost !py-1.5 text-xs">See it on your timeline →</Link>
            )}
            <span className="text-[10px] text-slate-500">
              ● Based only on the response text you logged, nothing invented.
            </span>
          </div>
        </div>
      )}

      {/* No analysis card, but a follow-up round is still offered — the opt-in
          has to be reachable from wherever that round can be started. */}
      {l.hasResponse && !analysis && l.responseOutcome !== "deleted" && (
        <div className="mt-2 rounded-lg border border-ink-700 bg-ink-900/50 p-3">
          <ComplaintIntentChoice checked={complaintIntent} onChange={setComplaintIntent} />
        </div>
      )}

      {/* Inline response logger */}
      {openResp && (
        <div className="mt-2 rounded-lg border border-ink-700 bg-ink-900/50 p-3">
          {/* RC1-S5 (A3 L-10): this used to promise "AI will assess it and draft
              a Round 2 escalation" unconditionally, while the assessment
              silently returns nothing when it is unavailable — and the drafting
              is a separate step the consumer takes. It now says what logging
              the response actually does. */}
          <p className="mb-2 text-xs text-slate-400">
            Paste the bureau&apos;s response, or attach the PDF. It&apos;s saved to this dispute, and where an
            automatic reading is available it summarizes the reply and lists what a follow-up round can target. Either
            way you decide whether to send another round.
          </p>
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
              {busy ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving the response…</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Log this response</>
              )}
            </button>
            <button onClick={() => setOpenResp(false)} className="min-h-[44px] px-2 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
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

// RC1-S5 (A3 L-01 / P1-31) — THE LETTER EDITOR.
//
// The consumer signs and mails this document, so the consumer gets to change it.
// Before this, the body was a read-only <pre> with a Copy button: if one
// generated sentence was wrong for their circumstances, their only options were
// to mail it anyway, regenerate the whole letter from scratch, or copy it into a
// word processor and abandon the print/enclosure/mail-tracking chain.
//
// Three things this deliberately does NOT do: it does not call the model, it
// does not reformat what they typed (their whitespace is theirs), and it never
// silently rewrites a sentence. The compliance bar runs server-side on save; a
// sentence it must change comes back here, shown, BEFORE the letter is approved,
// and a sentence it refuses is refused with the reason — their text stays in the
// box exactly as they wrote it.
//
// LETTER_BODY_MAX_UI mirrors lib/letter.ts's LETTER_BODY_MAX. It is duplicated
// rather than imported for CLAUDE.md gotcha 2 (a "use client" page must not pull
// a server module into the browser bundle); scripts/letter-control.test.ts pins
// the two to the same number.
const LETTER_BODY_MAX_UI = 20_000;

interface ComplianceNote { sentence: string; why: string; replacedWith?: string; rule?: string }

function LetterEditor({
  letterId, initialBody, onSaved, onCancel,
}: {
  letterId: string;
  initialBody?: string;
  onSaved: (body: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialBody ?? "");
  const [loading, setLoading] = useState(initialBody === undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<ComplianceNote[]>([]);
  const [adjustments, setAdjustments] = useState<ComplianceNote[]>([]);

  useEffect(() => {
    if (initialBody !== undefined) return;
    let live = true;
    fetch(`/api/letters/${letterId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((j) => { if (live) setDraft(j.letter?.body ?? ""); })
      .catch(() => { if (live) setError("I couldn't load this letter to edit. Try again in a moment."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [letterId, initialBody]);

  async function save() {
    setBusy(true); setError(null); setRefusals([]); setAdjustments([]);
    try {
      const res = await fetch(`/api/letters/${letterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "That didn't save. Try again in a moment.");
        if (Array.isArray(j.complianceRefusals)) setRefusals(j.complianceRefusals);
        return;
      }
      const savedBody: string = j.letter?.body ?? draft;
      if (Array.isArray(j.complianceAdjustments) && j.complianceAdjustments.length > 0) {
        setAdjustments(j.complianceAdjustments);
        setDraft(savedBody); // show them the letter as it will actually print
      }
      onSaved(savedBody);
    } catch {
      setError("The connection dropped mid-save. Your text is still here — try again.");
    } finally { setBusy(false); }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-4 text-xs text-slate-400" aria-busy="true">
        <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden /> Opening your letter…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-3">
      <label htmlFor={`edit-${letterId}`} className="label">Your letter — edit anything you want changed</label>
      <p className="mb-2 text-[11px] text-slate-500">
        What you save here is exactly what prints and exactly what you sign. Nothing is rewritten for you: if a
        sentence has to change to keep the letter mailable, I&apos;ll show you the change before you approve it.
      </p>
      <textarea
        id={`edit-${letterId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={22}
        maxLength={LETTER_BODY_MAX_UI}
        spellCheck
        className="w-full resize-y whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-900 p-3 font-sans text-[13px] leading-relaxed text-slate-200 focus:border-brand-500 focus:outline-none"
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-slate-500">
          {(LETTER_BODY_MAX_UI - draft.length).toLocaleString()} characters left
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} disabled={busy} className="min-h-[44px] px-2 text-xs text-slate-400 hover:text-slate-200">
            Discard changes
          </button>
          <button onClick={save} disabled={busy} className="btn-primary min-h-[44px] !py-1.5 text-xs">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
            {busy ? "Saving…" : "Save my letter"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400" role="alert">{error}</p>}
      {refusals.length > 0 && (
        <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          <p className="mb-1 font-semibold">Nothing was saved. These sentences have to change first:</p>
          <ul className="space-y-2">
            {refusals.map((r, i) => (
              <li key={i}>
                <span className="block italic text-rose-100">“{r.sentence}”</span>
                <span className="text-rose-300/90">{r.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {adjustments.length > 0 && (
        <div className="mt-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-3 text-xs text-gold-300">
          <p className="mb-1 font-semibold">Saved — with {adjustments.length === 1 ? "one sentence" : `${adjustments.length} sentences`} changed. Read {adjustments.length === 1 ? "it" : "them"} before you approve:</p>
          <ul className="space-y-2">
            {adjustments.map((a, i) => (
              <li key={i}>
                <span className="block text-gold-200/80 line-through">“{a.sentence}”</span>
                <span className="block italic text-gold-100">“{a.replacedWith}”</span>
                <span className="text-gold-400/90">{a.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// RC1-S4 (A3 L-03) / RC1-S5 — THE COMPLAINT INTENT IS THE CONSUMER'S TO DECLARE.
//
// The round-2 prompt used to instruct the model, unconditionally, to state "the
// consumer's intent to file complaints with the CFPB and state Attorney
// General", and the deterministic template said the same from round 4. Nobody
// had said it. It was reached by one click, persisted immediately, and — with
// the body read-only — could not be taken out before signing.
//
// It is an opt-in now, and only this control can set it. Unchecked by default,
// worded as the consumer's own statement, and it gives no advice about whether
// filing a complaint is a good idea — that is their decision to make.
function ComplaintIntentChoice({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-slate-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
      />
      <span>
        Include that I intend to file a complaint with the CFPB and my state Attorney General if this is not
        corrected.{" "}
        <span className="text-slate-500">
          Off unless you tick it — the letter will only say this if you decide to say it.
        </span>
      </span>
    </label>
  );
}

// RC1-S5 (A3 L-11) — CLOSING A DISPUTE OUT IS A CLAIM, SO THE CONSUMER MAKES IT.
// "Resolved" used to be one button that flipped `tradeline.resolved = true` —
// feeding Mission Control, the strategist and the admin dashboard — on no
// evidence at all. The consumer now says which of the two things happened, and
// only the first is a statement about the item on their report.
function ResolveControl({ onConfirm }: { onConfirm: (outcome: string) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setErr(null); }} className="btn-ghost min-h-[44px] text-xs">
        Close this out
      </button>
    );
  }
  const choose = async (outcome: string) => {
    setBusy(true); setErr(null);
    const result = await onConfirm(outcome);
    setBusy(false);
    if (result) setErr(result); else setOpen(false);
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-400">How did this end?</span>
      <button onClick={() => choose("corrected_or_deleted")} disabled={busy} className="btn-primary min-h-[44px] !py-1.5 text-xs">
        It was corrected or removed
      </button>
      <button onClick={() => choose("closed_no_change")} disabled={busy} className="btn-ghost min-h-[44px] text-xs">
        Still reported — closing anyway
      </button>
      <button onClick={() => setOpen(false)} disabled={busy} className="min-h-[44px] px-1 text-xs text-slate-400 hover:text-slate-200">
        Cancel
      </button>
      {err && <span className="basis-full text-[11px] text-rose-400" role="alert">{err}</span>}
    </span>
  );
}

export default function LettersPage() {
  return (
    <Suspense fallback={<AppShell title="/ Dispute Letters"><div /></AppShell>}>
      <LettersInner />
    </Suspense>
  );
}
