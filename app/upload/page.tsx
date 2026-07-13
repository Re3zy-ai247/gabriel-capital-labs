"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { UploadCloud, Loader2, FileText, ClipboardPaste, CheckCircle2, Trash2 } from "lucide-react";

interface StoredReport {
  id: string;
  fileName: string;
  bureaus: string[];
  uploadedAt: string;
  tradelines: number;
}

// The reveal payload — every number computed server-side from the rows just
// persisted, by the same engines that power tradelines/letters.
interface Reveal {
  accounts: number;
  bureaus: string[];
  conflicts: number;
  obsolete: number;
  high: number;
  medium: number;
  top: {
    id: string;
    creditor: string;
    probability: string;
    reason: string;
    strategy: string | null;
    why: string;
  } | null;
}

// Each line maps to a REAL pipeline stage the server just entered — the server
// only emits a stage when that work actually begins (never animated fiction).
const STAGE_LINES: Record<string, string> = {
  extracting: "I've got your PDF — reading the text out of it now.",
  received: "I'm encrypting your report before it's stored.",
  reading: "I'm reading every account on the report.",
  scoring: "I'm comparing bureaus and scoring each account's dispute position.",
};

const BUREAUS = [
  { id: "EQUIFAX", label: "Equifax" },
  { id: "EXPERIAN", label: "Experian" },
  { id: "TRANSUNION", label: "TransUnion" },
];

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"paste" | "pdf">("paste");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [bureaus, setBureaus] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ tradelines: number; usedAI: boolean } | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function loadReports() {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) setReports((await res.json()).reports || []);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    loadReports();
  }, []);

  async function deleteReport(id: string) {
    const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
    if (res.ok) {
      setConfirmDelete(null);
      await loadReports();
      router.refresh();
    }
  }

  function acceptFile(f: File | null | undefined) {
    if (!f) return;
    if (f.type && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file (or use Paste text).");
      return;
    }
    setError(null);
    setFile(f);
    setMode("pdf");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  }

  function toggleBureau(id: string) {
    setBureaus((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }

  async function submit() {
    setError(null);
    setDone(null);
    if (!bureaus.length) {
      setError("Select which bureau(s) this report covers.");
      return;
    }
    if (mode === "paste" && text.trim().length < 40) {
      setError("Paste the account/tradeline section of your report (a bit more text needed).");
      return;
    }
    if (mode === "pdf" && !file) {
      setError("Choose a PDF file to upload.");
      return;
    }

    setBusy(true);
    setReveal(null);
    setStatus("Sending your report…");
    try {
      const form = new FormData();
      form.set("bureaus", bureaus.join(","));
      if (mode === "paste") form.set("text", text);
      if (mode === "pdf" && file) form.set("file", file);

      const res = await fetch("/api/reports/upload", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        // Validation/auth failures come back as plain JSON with a status code.
        const j = await res.json().catch(() => ({}));
        setBusy(false);
        setStatus(null);
        setError(
          res.status === 401
            ? "Your session ended. Sign in again in a new tab, then come back here — everything you entered is still on this page."
            : j.error || "Upload failed."
        );
        return;
      }

      // NDJSON stream: narrate each real stage as the server enters it; the
      // final line carries the result (and the reveal).
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      let final: {
        ok?: boolean;
        tradelines?: number;
        usedAI?: boolean;
        warning?: string;
        error?: string;
        reveal?: Reveal;
      } | null = null;
      for (;;) {
        const { done: eof, value } = await reader.read();
        if (eof) break;
        buffered += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffered.indexOf("\n")) >= 0) {
          const line = buffered.slice(0, nl).trim();
          buffered = buffered.slice(nl + 1);
          if (!line) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.stage && STAGE_LINES[evt.stage]) setStatus(STAGE_LINES[evt.stage]);
            else final = evt;
          } catch {
            /* partial line noise — ignore */
          }
        }
      }

      setBusy(false);
      setStatus(null);
      if (!final || final.error) {
        setError(final?.error || "The analysis hit a snag on our side — nothing about your report or your credit caused this. Give it another try in a moment.");
        return;
      }
      setDone({ tradelines: final.tradelines ?? 0, usedAI: Boolean(final.usedAI) });
      if ((final.tradelines ?? 0) > 0 && final.reveal) {
        setReveal(final.reveal);
        loadReports();
      } else if (final.warning) {
        // Saved-but-no-accounts is guidance, not failure: KAI-badged status
        // line, and the saved report appears below with its Delete affordance.
        loadReports();
        setStatus(final.warning);
      }
    } catch {
      setBusy(false);
      setStatus(null);
      // The server may have finished persisting after the connection dropped —
      // pointing at the list below prevents a duplicate re-upload.
      loadReports();
      setError("The connection dropped mid-read. Check 'Your uploaded reports' just below — if this report is listed, it made it through; if it isn't, try again.");
    }
  }

  return (
    <AppShell title="/ Upload Report">
      <EduBanner />
      <h2 className="mb-1 text-xl font-semibold">Upload Your Credit Report</h2>
      <p className="mb-5 max-w-2xl text-sm text-slate-400">
        Get your free reports at{" "}
        <a href="https://www.annualcreditreport.com" target="_blank" rel="noreferrer" className="text-brand-400 underline">
          AnnualCreditReport.com
        </a>
        . Paste the report text or upload the PDF. We record which bureau each item comes from and never assert what a
        bureau reports unless its report was actually uploaded.
      </p>

      {reveal ? (
        <div className="card animate-rise p-6">
          {/* The reveal — a professional walking in with answers. Every number
              below was computed from the rows just persisted. */}
          <div className="flex items-center gap-2">
            <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            <span className="text-lg font-semibold">I finished reviewing your report.</span>
          </div>

          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            {reveal.accounts} account{reveal.accounts === 1 ? "" : "s"} across{" "}
            {reveal.bureaus.map((b) => BUREAUS.find((x) => x.id === b)?.label ?? b).join(", ")}.
            {reveal.conflicts > 0 && (
              <> {reveal.conflicts} account{reveal.conflicts === 1 ? " doesn't" : "s don't"} tell one story across bureaus.</>
            )}
            {reveal.obsolete > 0 && (
              <> {reveal.obsolete} {reveal.obsolete === 1 ? "is" : "are"} past the FCRA §605 time limit — the law caps how long items like these can stay on a report.</>
            )}
            {reveal.conflicts === 0 && reveal.obsolete === 0 && (
              <> No cross-bureau conflicts or age-limit flags stand out — my read on each account is in its row.</>
            )}
          </p>

          {reveal.top && (
            <div className="mt-4 rounded-lg border border-brand-500/30 bg-brand-500/[0.06] p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-300">What matters most</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">{reveal.top.creditor}</span>
                <span className={`pill ${reveal.top.probability === "HIGH" ? "bg-brand-500/15 text-brand-300" : "bg-gold-500/15 text-gold-400"}`}>
                  {reveal.top.probability === "HIGH" ? "Strong dispute grounds" : "Worth disputing"}
                </span>
              </div>
              {reveal.top.reason && <p className="mt-1 text-sm text-slate-400">{reveal.top.reason}</p>}
              {reveal.top.why && <p className="mt-1.5 text-xs text-slate-500">{reveal.top.why}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={() =>
                    router.push(
                      `/letters?tradeline=${reveal.top!.id}${reveal.top!.strategy ? `&strategy=${reveal.top!.strategy}` : ""}`
                    )
                  }
                  className="btn-primary"
                >
                  Start with {reveal.top.creditor} →
                </button>
                <button onClick={() => router.push("/tradelines")} className="btn-ghost text-sm">
                  See every account →
                </button>
              </div>
            </div>
          )}
          {!reveal.top && (
            <div className="mt-4">
              <button onClick={() => router.push("/tradelines")} className="btn-primary">See every account →</button>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            {reveal.high > 0 || reveal.medium > 0
              ? `${reveal.high} account${reveal.high === 1 ? "" : "s"} with strong dispute grounds · ${reveal.medium} with moderate grounds. `
              : ""}
            Scored by fixed rules against the data read from your report — each account&apos;s row shows exactly why it
            was flagged.
          </p>
        </div>
      ) : done && done.tradelines > 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-brand-400" />
          <div className="text-lg font-semibold">Analyzed {done.tradelines} accounts</div>
          <p className="text-sm text-slate-400">
            {done.usedAI ? "Extraction complete." : "Report parsed."}{" "}
            <button onClick={() => router.push("/tradelines")} className="font-semibold text-brand-400 hover:underline">
              See your tradelines →
            </button>
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="card p-5">
            {/* Mode toggle */}
            <div className="mb-4 inline-flex rounded-lg border border-ink-700 p-1 text-sm">
              <button
                onClick={() => setMode("paste")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${mode === "paste" ? "bg-brand-500 text-brand-ink" : "text-slate-300"}`}
              >
                <ClipboardPaste className="h-4 w-4" /> Paste text
              </button>
              <button
                onClick={() => setMode("pdf")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${mode === "pdf" ? "bg-brand-500 text-brand-ink" : "text-slate-300"}`}
              >
                <FileText className="h-4 w-4" /> Upload PDF
              </button>
            </div>

            {mode === "paste" ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                aria-label="Credit report text — paste the accounts section of your report"
                placeholder={"Paste your credit report's accounts section here…\n\nDiscover Card\nType: Revolving\nBalance: $1,477\nStatus: Charge-off\nAccount#: XXXX1477"}
                className="w-full resize-y rounded-lg border border-ink-700 bg-ink-900 p-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
              />
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center transition ${
                  dragging ? "border-brand-400 bg-brand-500/10" : "border-ink-600 bg-ink-900/50 hover:border-brand-500"
                }`}
              >
                <UploadCloud className={`h-10 w-10 ${dragging ? "text-brand-300" : "text-brand-400"}`} />
                {file ? (
                  <span className="text-sm text-slate-200">{file.name}</span>
                ) : (
                  <>
                    <span className="text-sm text-slate-300">{dragging ? "Drop your PDF here" : "Drag & drop a PDF, or click to choose"}</span>
                    <span className="text-xs text-slate-500">Text-based PDFs work best. Scanned images won&apos;t extract — paste text instead.</span>
                  </>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => acceptFile(e.target.files?.[0])}
                />
              </label>
            )}
          </div>

          {/* Bureau selection + submit */}
          <div className="card h-fit p-5">
            <div className="mb-2 text-sm font-semibold">Which bureau(s) does this report cover?</div>
            <p className="mb-3 text-xs text-slate-500">This powers our accuracy guarantee. A tri-merge from AnnualCreditReport.com covers all three.</p>
            <div className="space-y-2">
              {BUREAUS.map((b) => (
                <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bureaus.includes(b.id)}
                    onChange={() => toggleBureau(b.id)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  {b.label}
                </label>
              ))}
            </div>

            <button onClick={submit} disabled={busy} className="btn-primary mt-5 w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {busy ? "Kai is reading…" : "Analyze Report"}
            </button>
            {status && (
              <p aria-live="polite" className="mt-3 flex items-center gap-2 text-xs text-brand-300">
                <span className="rounded bg-brand-500/15 px-1 py-px text-[9px] font-bold tracking-widest text-brand-300">KAI</span>
                {status}
              </p>
            )}
            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
          </div>
        </div>
      )}

      {/* Manage uploaded reports */}
      <div className="card mt-6 p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Your uploaded reports</div>
          <button
            onClick={async () => {
              setBusy(true);
              setStatus("Re-analyzing stored reports…");
              const res = await fetch("/api/reports/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
              setBusy(false);
              if (!res) {
                setStatus("The connection dropped mid-request. Try again — nothing was lost.");
                return;
              }
              const j = await res.json().catch(() => ({}));
              setStatus(res.ok ? `All re-read — ${j.tradelines} tradelines across ${j.reportsAnalyzed} ${j.reportsAnalyzed === 1 ? "report" : "reports"}.` : res.status === 401 ? "Your session ended. Sign in again in a new tab, then press Re-analyze — your reports are saved." : j.error || "The re-analysis didn't finish. Try again in a moment.");
              await loadReports();
              router.refresh();
            }}
            disabled={busy || reports.length === 0}
            className="btn-ghost text-xs"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Re-analyze all
          </button>
        </div>

        {reports.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No reports uploaded yet. Analyze one above to get started.</p>
        ) : (
          <div className="mt-3 divide-y divide-ink-700/50">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-200">{r.fileName}</div>
                  <div className="text-xs text-slate-500">
                    {r.tradelines} account{r.tradelines === 1 ? "" : "s"} · {r.bureaus.join(", ") || "—"} ·{" "}
                    {new Date(r.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
                {confirmDelete === r.id ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Delete this report &amp; its accounts?</span>
                    <button onClick={() => deleteReport(r.id)} className="rounded-md bg-rose-600 px-2 py-1 font-medium text-white keep-white hover:bg-rose-700">
                      Delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="rounded-md border border-ink-600 px-2 py-1 text-slate-300">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(r.id)}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-xs text-slate-400 hover:border-rose-500 hover:text-rose-400"
                    title="Delete report"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Deleting a report removes its analyzed accounts. Letters you already generated are kept.
        </p>
      </div>
    </AppShell>
  );
}
