"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { UploadCloud, Loader2 } from "lucide-react";

export default function UploadPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reanalyze() {
    setBusy(true); setStatus("Re-analyzing stored reports with the latest engine…");
    const res = await fetch("/api/reports/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = await res.json();
    setBusy(false);
    setStatus(res.ok ? `Done — ${j.tradelines} tradelines rebuilt across ${j.reportsAnalyzed} report(s).` : (j.error || "Failed"));
    router.refresh();
  }

  return (
    <AppShell title="/ Upload Report">
      <EduBanner />
      <h2 className="mb-4 text-xl font-semibold">Upload Credit Report</h2>

      <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
        <UploadCloud className="h-10 w-10 text-brand-400" />
        <p className="text-sm text-slate-300">Drag & drop a PDF credit report, or click to browse.</p>
        <p className="max-w-md text-xs text-slate-500">
          For best results, upload reports from all three bureaus. The analyzer records which bureau each item comes from and
          will never assert what a bureau reports unless that bureau&apos;s report was actually uploaded.
        </p>
        <input type="file" accept="application/pdf" className="input max-w-xs" />
        <button className="btn-primary mt-2" disabled>Analyze (connect storage to enable)</button>
      </div>

      <div className="card mt-4 p-5">
        <div className="text-sm font-semibold">Already uploaded reports?</div>
        <p className="mt-1 text-xs text-slate-400">Re-run the current analysis pipeline on stored reports to apply the latest classification, bureau attribution, duplicate detection, and scoring.</p>
        <button onClick={reanalyze} disabled={busy} className="btn-ghost mt-3">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Re-analyze stored reports
        </button>
        {status && <p className="mt-3 text-xs text-brand-300">{status}</p>}
      </div>
    </AppShell>
  );
}
