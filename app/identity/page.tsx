"use client";
import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DocumentsManager } from "@/components/DocumentsManager";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { ScanSearch, Loader2, AlertTriangle, Printer, Sparkles, ShieldAlert } from "lucide-react";

interface Discrepancy {
  category: string;
  reportValue: string;
  yourValue: string;
  severity: "high" | "medium" | "low";
  explanation: string;
  bureaus?: string[];
}
interface ReportedItem {
  value: string;
  bureaus?: string[];
  status?: string;
}
interface Result {
  reportedNames: ReportedItem[];
  reportedAddresses: ReportedItem[];
  reportedEmployers: ReportedItem[];
  discrepancies: Discrepancy[];
  usedId?: boolean;
}

const SEV_COLOR: Record<string, string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  medium: "border-gold-500/40 bg-gold-500/10 text-gold-300",
  low: "border-slate-600 bg-slate-500/10 text-slate-300",
};

const BUREAU_SHORT: Record<string, string> = {
  EQUIFAX: "Equifax",
  EXPERIAN: "Experian",
  TRANSUNION: "TransUnion",
};

// Small bureau chips shown on findings and reported items.
function BureauTags({ bureaus }: { bureaus?: string[] }) {
  if (!bureaus?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {bureaus.map((b) => (
        <span key={b} className="pill bg-ink-800 text-[10px] uppercase tracking-wide text-slate-300">
          {BUREAU_SHORT[b] || b}
        </span>
      ))}
    </span>
  );
}

export default function IdentityPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [state, setState] = useState<"idle" | "needsIdentity" | "needsReport" | "needsAI" | "ok">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState<{ id: string; body: string } | null>(null);
  const [letterBusy, setLetterBusy] = useState(false);
  const [letterMsg, setLetterMsg] = useState<string | null>(null);
  const [bureau, setBureau] = useState("EQUIFAX");
  // RC1-S6b (closing RC1-S4's L-09 handoff). The route
  // app/api/identity/letter/route.ts disputes an item ONLY if the consumer
  // confirmed THAT item (`confirmed === true`, strictly), and until this control
  // existed it refused every request from this page with a 400 whose `nextStep`
  // said, truthfully, that the confirmation control did not exist yet. This is
  // that control. Keyed by index into `result.discrepancies`; cleared whenever a
  // new analysis lands, because a confirmation is about one specific finding.
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({});
  const [unconfirmed, setUnconfirmed] = useState<number[]>([]);

  async function run() {
    setBusy(true); setError(null); setResult(null); setLetter(null); setLetterMsg(null);
    setConfirmed({}); setUnconfirmed([]);
    try {
      const res = await fetch("/api/identity/discrepancies", { method: "POST" });
      const j = await res.json();
      if (j.needsIdentity) { setState("needsIdentity"); return; }
      if (j.needsReport) { setState("needsReport"); return; }
      if (j.needsAI) { setState("needsAI"); return; }
      if (!res.ok) { setError(j.error || "Analysis failed."); return; }
      setResult(j); setState("ok");
    } catch {
      setError("The connection dropped mid-request. Try again — nothing was lost.");
    } finally { setBusy(false); }
  }

  async function makeLetter() {
    if (!result?.discrepancies.length) return;
    setLetterBusy(true); setLetterMsg(null); setLetter(null); setUnconfirmed([]);
    try {
      const res = await fetch("/api/identity/letter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Each item carries the consumer's own confirmation for THAT item.
          // The whole array is still sent — the route drops what is not
          // confirmed rather than trusting the client to pre-filter.
          discrepancies: result.discrepancies.map((d, i) => (confirmed[i] ? { ...d, confirmed: true } : d)),
          bureau,
        }),
      });
      const j = await res.json();
      // RC1-S6b: the 402 branch ("Generating correction letters is a
      // Professional feature.") and the "Upgrade →" link it rendered are gone.
      // S6a removed that paywall from the route — the analysis was free and the
      // finished letter was sold, which is the shape a consumer discovers only
      // after spending an identity analysis on it.
      if (!res.ok) {
        setLetterMsg([j.error, j.nextStep].filter(Boolean).join(" ") || "Could not generate the letter.");
        if (Array.isArray(j.unconfirmed)) setUnconfirmed(j.unconfirmed as number[]);
        return;
      }
      setLetter({ id: j.letter.id, body: j.letter.body });
    } catch {
      setLetterMsg("The connection dropped mid-request. Try again — nothing was lost.");
    } finally { setLetterBusy(false); }
  }

  // How many detected items the currently selected bureau actually reports —
  // mirrors the server-side filter so the count matches what the letter contains.
  // RC1-S6b: mirrors the server's filter EXACTLY — reported by the selected
  // bureau AND confirmed by the consumer — so the number beside the button is
  // the number of items the letter will actually contain, and the button is
  // disabled until at least one is confirmed (the route's 400 stays a backstop
  // rather than the normal path).
  const forBureauCount = result
    ? result.discrepancies.filter((d, i) => (!d.bureaus?.length || d.bureaus.includes(bureau)) && confirmed[i]).length
    : 0;
  const bureauItemCount = result
    ? result.discrepancies.filter((d) => !d.bureaus?.length || d.bureaus.includes(bureau)).length
    : 0;

  return (
    <AppShell title="/ Identity Check">
      <EduBanner />
      <h2 className="mb-1 text-xl font-semibold">Identity &amp; Discrepancy Detection</h2>
      <p className="mb-4 max-w-2xl text-sm text-slate-400">
        Bureaus keep a Personal Information section — names, addresses, and employers tied to your file. Inaccurate or
        unrecognized entries there undermine the accuracy of your whole report and are some of the easiest, highest-value
        items to dispute first. This compares that section against your verified identity.
      </p>

      <div className="mb-5">
        <DocumentsManager />
      </div>

      <div className="card mb-5 flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-2 text-sm">
          <ScanSearch className="h-5 w-5 text-brand-400" />
          Run an AI check against your most recent uploaded report.
        </div>
        <button onClick={run} disabled={busy} className="btn-primary shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          {busy ? "Analyzing…" : "Run identity check"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {state === "needsIdentity" && (
        <div className="card p-6 text-sm text-slate-300">
          Add your legal name and current address first so we know what to compare against.{" "}
          <Link href="/settings" className="font-semibold text-brand-400 underline">Go to Settings →</Link>
        </div>
      )}
      {state === "needsReport" && (
        <div className="card p-6 text-sm text-slate-300">
          Upload a credit report first.{" "}
          <Link href="/upload" className="font-semibold text-brand-400 underline">Upload a report →</Link>
        </div>
      )}
      {state === "needsAI" && (
        <div className="card flex items-start gap-3 p-6 text-sm text-slate-300">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
          The identity check needs KAI, which isn&apos;t configured for this deployment yet.
        </div>
      )}

      {result && (
        <>
          {result.usedId && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-success-500/30 bg-success-500/10 px-3 py-1.5 text-xs text-success-300">
              <ScanSearch className="h-3.5 w-3.5" /> Compared against your uploaded government ID.
            </div>
          )}
          {result.discrepancies.length === 0 ? (
            <div className="card p-6 text-sm text-slate-300">
              No clear personal-information discrepancies found against your verified identity. ✅
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-semibold">
                <span className="mr-2 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                I found {result.discrepancies.length} potential discrepanc{result.discrepancies.length === 1 ? "y" : "ies"} to dispute first
                {result.discrepancies.filter((d) => d.severity === "high").length > 0
                  ? ` — ${result.discrepancies.filter((d) => d.severity === "high").length} high severity`
                  : ""}. Confirm each one you know is wrong, then draft the correction letter below.
              </div>
              {result.discrepancies.map((d, i) => (
                <div key={i} className={`card border p-4 ${SEV_COLOR[d.severity] || ""}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="pill bg-ink-800 text-[10px] uppercase">{d.category}</span>
                    <span className="text-[10px] uppercase tracking-wide opacity-80">{d.severity} severity</span>
                    {d.bureaus?.length ? (
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
                        reported by <BureauTags bureaus={d.bureaus} />
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-400">Report shows:</span> <span className="font-medium">{d.reportValue || "—"}</span>
                    <span className="mx-2 text-slate-600">vs.</span>
                    <span className="text-slate-400">yours:</span> <span className="font-medium">{d.yourValue || "—"}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{d.explanation}</p>

                  {/* THE CONFIRMATION (RC1-S6b, closing RC1-S4's L-09 handoff).
                      Worded as the consumer's own statement, because that is
                      what the letter will say in their name. Unchecked by
                      default — an unaffirmed assertion about someone's legal
                      name, address or employer is exactly the thing that must
                      never be mailed on their behalf. */}
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-700 bg-ink-900/50 p-2.5 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
                      checked={Boolean(confirmed[i])}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setConfirmed((prev) => ({ ...prev, [i]: next }));
                        setUnconfirmed((prev) => prev.filter((x) => x !== i));
                      }}
                    />
                    <span>
                      I confirm my correct {d.category.toLowerCase()} is{" "}
                      <span className="font-medium text-slate-200">{d.yourValue || "—"}</span>, and that what the report
                      shows is wrong.
                    </span>
                  </label>
                  {unconfirmed.includes(i) && !confirmed[i] && (
                    <p className="mt-1.5 text-[11px] text-gold-300">Still needs your confirmation before it can be disputed.</p>
                  )}
                </div>
              ))}

              {/* Draft a correction letter. RC1-S6b: this card was labelled
                  "(premium)" and its button rendered fully enabled with no lock
                  and no price — the consumer discovered the paywall only after
                  spending an identity analysis on it. There is no paywall here
                  now. The only gate left is the consumer's own confirmation,
                  which is about truth rather than money. */}
              <div className="card mt-4 p-5">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-brand-400" /> Draft a Personal Information correction letter
                </div>
                <p className="mb-3 text-xs text-slate-400">
                  Pick a bureau — the letter will include <span className="font-medium text-slate-300">only the items that bureau reports</span>, never another bureau&apos;s data.
                  It states, in your name, what your correct information is, so it includes{" "}
                  <span className="font-medium text-slate-300">only the items you confirmed above</span>.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <select value={bureau} onChange={(e) => setBureau(e.target.value)} className="input max-w-[200px]">
                    <option value="EQUIFAX">Equifax</option>
                    <option value="EXPERIAN">Experian</option>
                    <option value="TRANSUNION">TransUnion</option>
                  </select>
                  <button onClick={makeLetter} disabled={letterBusy || forBureauCount === 0} className="btn-primary">
                    {letterBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {letterBusy ? "Drafting…" : "Draft correction letter"}
                  </button>
                  <span className={`text-xs ${forBureauCount > 0 ? "text-slate-400" : "text-slate-500"}`}>
                    {bureauItemCount === 0
                      ? `No items reported by ${BUREAU_SHORT[bureau]}`
                      : forBureauCount > 0
                      ? `${forBureauCount} confirmed item${forBureauCount === 1 ? "" : "s"} reported by ${BUREAU_SHORT[bureau]}`
                      : `Confirm at least one of the ${bureauItemCount} item${bureauItemCount === 1 ? "" : "s"} ${BUREAU_SHORT[bureau]} reports`}
                  </span>
                  {letterMsg && <span className="text-xs text-rose-400">{letterMsg}</span>}
                </div>
                {letter && (
                  <div className="mt-4">
                    <div className="mb-2 flex justify-end">
                      <Link href={`/letters/print/${letter.id}`} target="_blank" className="btn-ghost text-xs">
                        <Printer className="h-3.5 w-3.5" /> Print / PDF
                      </Link>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-900/60 p-4 font-sans text-[13px] leading-relaxed text-slate-200">{letter.body}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* What the bureau has on file — each value tagged with the bureau(s) reporting it */}
          <div className="card mt-5 p-5 text-sm">
            <div className="mb-3 font-semibold">What the report lists on your file</div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="mb-1 text-xs uppercase text-slate-500">Names</div>
                {(result.reportedNames || []).map((n, i) => (
                  <div key={i} className="mb-1 flex flex-wrap items-center gap-2 text-slate-300">
                    <span>{n.value}</span>
                    <BureauTags bureaus={n.bureaus} />
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 text-xs uppercase text-slate-500">Addresses</div>
                {(result.reportedAddresses || []).map((n, i) => (
                  <div key={i} className="mb-1 flex flex-wrap items-center gap-2 text-slate-300">
                    <span>
                      {n.value}
                      {n.status ? <span className="text-slate-500"> ({n.status})</span> : null}
                    </span>
                    <BureauTags bureaus={n.bureaus} />
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 text-xs uppercase text-slate-500">Employers</div>
                {(result.reportedEmployers || []).map((n, i) => (
                  <div key={i} className="mb-1 flex flex-wrap items-center gap-2 text-slate-300">
                    <span>{n.value}</span>
                    <BureauTags bureaus={n.bureaus} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <Disclaimer />
    </AppShell>
  );
}
