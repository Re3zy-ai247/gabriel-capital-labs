"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { UploadCloud, Loader2, FileText, ClipboardPaste, CheckCircle2 } from "lucide-react";

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
  const [dragging, setDragging] = useState(false);

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
    setStatus(mode === "pdf" ? "Reading your PDF and analyzing accounts…" : "Analyzing your report…");
    try {
      const form = new FormData();
      form.set("bureaus", bureaus.join(","));
      if (mode === "paste") form.set("text", text);
      if (mode === "pdf" && file) form.set("file", file);

      const res = await fetch("/api/reports/upload", { method: "POST", body: form });
      const j = await res.json();
      setBusy(false);
      setStatus(null);
      if (!res.ok) {
        setError(j.error || "Upload failed.");
        return;
      }
      setDone({ tradelines: j.tradelines, usedAI: j.usedAI });
      if (j.tradelines > 0) {
        setTimeout(() => router.push("/tradelines"), 1400);
      } else if (j.warning) {
        setError(j.warning);
      }
    } catch {
      setBusy(false);
      setStatus(null);
      setError("Network error. Please try again.");
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

      {done && done.tradelines > 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-brand-400" />
          <div className="text-lg font-semibold">Analyzed {done.tradelines} accounts</div>
          <p className="text-sm text-slate-400">
            {done.usedAI ? "AI extraction complete." : "Report parsed."} Taking you to your tradelines…
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="card p-5">
            {/* Mode toggle */}
            <div className="mb-4 inline-flex rounded-lg border border-ink-700 p-1 text-sm">
              <button
                onClick={() => setMode("paste")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${mode === "paste" ? "bg-brand-500 text-ink-950" : "text-slate-300"}`}
              >
                <ClipboardPaste className="h-4 w-4" /> Paste text
              </button>
              <button
                onClick={() => setMode("pdf")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${mode === "pdf" ? "bg-brand-500 text-ink-950" : "text-slate-300"}`}
              >
                <FileText className="h-4 w-4" /> Upload PDF
              </button>
            </div>

            {mode === "paste" ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
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
                    className="h-4 w-4 accent-emerald-500"
                  />
                  {b.label}
                </label>
              ))}
            </div>

            <button onClick={submit} disabled={busy} className="btn-primary mt-5 w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {busy ? "Analyzing…" : "Analyze Report"}
            </button>
            {status && <p className="mt-3 text-xs text-brand-300">{status}</p>}
            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
          </div>
        </div>
      )}

      {/* Re-analyze existing */}
      <div className="card mt-6 p-5">
        <div className="text-sm font-semibold">Already uploaded reports?</div>
        <p className="mt-1 text-xs text-slate-400">
          Re-run the latest analysis pipeline on your stored reports to apply improved classification, bureau attribution,
          duplicate detection, and scoring.
        </p>
        <button
          onClick={async () => {
            setBusy(true);
            setStatus("Re-analyzing stored reports…");
            const res = await fetch("/api/reports/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
            const j = await res.json();
            setBusy(false);
            setStatus(res.ok ? `Done — ${j.tradelines} tradelines across ${j.reportsAnalyzed} report(s).` : j.error || "Failed");
            router.refresh();
          }}
          disabled={busy}
          className="btn-ghost mt-3"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Re-analyze stored reports
        </button>
      </div>
    </AppShell>
  );
}
