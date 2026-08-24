"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// ── S11 CE4-1 · THE SERVER'S ANSWER REACHES THE CONSUMER ─────────────────────
//
// This button used to be `await fetch(...)` with the result unassigned: no
// `res.ok`, no body, straight to `router.refresh()`. So on `/tradelines` — a
// page with no status region, in an app with no global toast or error boundary
// — the AI-ceiling refusal this whole round was built to make visible, and the
// "N older reports were left as they are" notice from the fan-out cap, were
// both unreachable. The consumer pressed the button, the page re-rendered
// identically, and a silent refresh reads as "it ran and found nothing new".
// The same person taking the same action from /upload was told the truth.
//
// Every line below is the SERVER'S own wording where the server supplied one
// (`notice`, `error`); nothing here invents a reason for a refusal it cannot
// see. And nothing here mentions money: a spend ceiling is a platform pause,
// never a prompt to pay.

// Mirrored, not imported: the route is a server module and this is a "use
// client" component (CLAUDE.md gotcha 2). Same value and same reasoning as
// app/upload/page.tsx's REANALYZE_BATCH — an upper bound stays true at any
// server cap ≤ 5, and the authoritative numbers always come back in the
// response, never from here.
const REANALYZE_BATCH = 5;

interface AnalyzeResult {
  reportsAnalyzed?: number;
  tradelines?: number;
  skipped?: number;
  usedAI?: boolean;
  degraded?: boolean;
  aiRefused?: boolean;
  notice?: string;
  error?: string;
}

/**
 * The one line the consumer reads after a 200. It may never report a degraded
 * run as a clean one, so the three axes the route reports on — how many were
 * actually re-read, whether a ceiling stopped it, and whether the full reader
 * was used throughout — each have to be able to reach this string.
 */
export function reanalyzeStatusLine(j: AnalyzeResult): string {
  const notice = typeof j.notice === "string" ? j.notice.trim() : "";
  const analyzed = Number(j.reportsAnalyzed) || 0;
  const tradelines = Number(j.tradelines) || 0;
  const skipped = Number(j.skipped) || 0;
  const reports = `${analyzed} ${analyzed === 1 ? "report" : "reports"}`;

  // A fallback-reader run is a degraded run even when nothing refused and
  // nothing was skipped — the case that otherwise renders as an unqualified
  // success. When the ceiling DID refuse, the server's notice already says so
  // in its own words and this sentence would repeat it.
  const fallbackUsed = j.degraded === true && j.aiRefused !== true;
  const fallbackSentence = fallbackUsed
    ? "My full reader wasn't available for all of it, so I used the built-in pattern reader as a backup — it may have picked up less."
    : "";

  const head = notice
    ? notice
    : skipped > 0
    ? `Re-read ${reports} — ${tradelines} tradelines. ${skipped} older ${skipped === 1 ? "report was" : "reports were"} left as they are.`
    : analyzed
    ? `Re-read ${reports} — ${tradelines} tradelines.`
    : "Re-analysis finished.";

  return [head, fallbackSentence].filter(Boolean).join(" ");
}

export function ReanalyzeButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  async function run() {
    setLoading(true);
    setStatus(null);
    setFailed(false);
    try {
      const res = await fetch("/api/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => null);

      if (!res) {
        setFailed(true);
        setStatus("The connection dropped mid-request. Try again — nothing was lost.");
        return;
      }
      const j: AnalyzeResult = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFailed(true);
        setStatus(
          res.status === 401
            ? "Your session ended. Sign in again in a new tab, then press Re-analyze — your reports are saved."
            : // The server's own words for a refusal (a spend ceiling, a rate
              // limit). Never paraphrased, never given a reason we invented.
              j.error || "The re-analysis didn't finish. Try again in a moment."
        );
        return;
      }
      setStatus(reanalyzeStatusLine(j));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
      <button onClick={run} disabled={loading} className="btn-ghost !py-1.5 self-start sm:self-auto">
        <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {/* An upper bound, like /upload's: a flat "Re-analyze report" promised
            something the endpoint would not do for a consumer holding more
            reports than the server's fan-out cap. */}
        {loading ? "Re-analyzing…" : `Re-analyze up to ${REANALYZE_BATCH} reports`}
      </button>
      {status && (
        <p
          role="status"
          aria-live="polite"
          className={`max-w-md text-xs leading-relaxed sm:text-right ${failed ? "text-gold-300" : "text-slate-400"}`}
        >
          {status}
        </p>
      )}
    </div>
  );
}
