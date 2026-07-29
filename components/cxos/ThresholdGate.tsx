"use client";

import { useEffect, useState, type ComponentType } from "react";

// CXOS Threshold — the GATE (Phase 2).
//
// This component is the only Threshold code in the landing's synchronous
// bundle, and it is deliberately tiny. Its entire job is to decide whether
// this visit gets the entry experience, and to load it lazily if so. The
// decision is fail-closed toward the plain landing:
//
//   · server render / no JS ......... nothing (the real page is beneath — SEO,
//                                     crawlers and no-JS readers see the full
//                                     landing; the Threshold never gates content)
//   · prefers-reduced-motion ........ nothing (grammar §5.16: the same narrative
//                                     with the motion removed — and zero bytes
//                                     of WebGL are ever downloaded)
//   · already entered this session .. nothing (the Threshold plays once; the
//                                     settled landing is the return state)
//   · no WebGL ...................... nothing (progressive enhancement: Tier-1
//                                     CSS arrival still plays beneath)
//   · otherwise ..................... import() the experience AFTER the window
//                                     load event + an idle callback, so not one
//                                     cinematic byte competes with LCP.
export function ThresholdGate() {
  const [Threshold, setThreshold] = useState<ComponentType<{ onDone: () => void }> | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The pre-paint script may have dropped the page into darkness; every early
    // return below must lift it, or a condition mismatch would strand black.
    const lift = () => document.documentElement.removeAttribute("data-cxenter");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return lift();
    try {
      if (sessionStorage.getItem("cx-threshold") === "1") return lift();
    } catch {
      return lift(); // storage unavailable — never risk replaying forever
    }
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) return lift();

    let cancelled = false;
    const load = () => {
      const idle: (cb: () => void) => void =
        "requestIdleCallback" in window
          ? (cb) => (window as Window & { requestIdleCallback(cb: () => void): number }).requestIdleCallback(cb)
          : (cb) => void setTimeout(cb, 200);
      idle(() => {
        if (cancelled) return;
        import("./Threshold").then(
          (m) => {
            if (!cancelled) setThreshold(() => m.Threshold);
          },
          () => lift() // chunk failed to load: the landing, not a black screen
        );
      });
    };
    if (document.readyState === "complete") load();
    else window.addEventListener("load", load, { once: true });
    return () => {
      cancelled = true;
    };
  }, []);

  if (done || !Threshold) return null;
  return <Threshold onDone={() => setDone(true)} />;
}
