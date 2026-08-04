"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";

// CXOS — the Threshold's review stage. Mounts the real experience in Director
// mode (looping, console open, session memory untouched) on any build where
// review is allowed. Reduced motion is respected even here: the instrument
// panel never overrides an accessibility preference.
export default function ThresholdReview() {
  const [Threshold, setThreshold] = useState<ComponentType<{ onDone: () => void; review?: boolean }> | null>(null);
  const [state, setState] = useState<"loading" | "running" | "blocked-motion" | "blocked-gl" | "done">("loading");

  useEffect(() => {
    if (!reviewBuildAllowed()) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setState("blocked-motion");
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl"))) return setState("blocked-gl");
    import("@/components/cxos/Threshold").then((m) => {
      setThreshold(() => m.Threshold);
      setState("running");
    });
  }, []);

  if (!reviewBuildAllowed()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-950 p-8 text-slate-400">
        <p className="text-sm">Founder Review is not enabled in this build.</p>
      </main>
    );
  }
  if (state === "blocked-motion" || state === "blocked-gl") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-950 p-8 text-slate-400">
        <p className="text-sm">
          {state === "blocked-motion"
            ? "This system prefers reduced motion, so the Threshold never plays here — exactly as it won't for visitors with the same preference."
            : "WebGL is unavailable in this browser, so the Threshold never plays here — visitors without WebGL land directly on the page."}
        </p>
        <Link href="/review" className="text-xs font-semibold text-brand-300">← Back to Founder Review</Link>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-ink-950">
      {state === "done" ? (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-400">
          <p className="text-sm">Threshold review ended.</p>
          <button type="button" onClick={() => location.reload()} className="btn-ghost">Replay</button>
          <Link href="/review" className="text-xs font-semibold text-brand-300">← Back to Founder Review</Link>
        </div>
      ) : null}
      {Threshold && state === "running" ? <Threshold review onDone={() => setState("done")} /> : null}
    </main>
  );
}
