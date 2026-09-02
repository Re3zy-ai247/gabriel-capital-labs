"use client";

import { useEffect, useState, type ComponentType } from "react";
import { isDirectorActive } from "@/lib/cxos/reviewMode";
import { cinematicEntranceOptIn, detectTier, thresholdAlreadySeen } from "@/lib/cxos/capability";

// CXOS Threshold — the GATE (Phase 2), RC1 posture (Founder Decision D-6).
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
//   · D-6: not opted in ............. nothing. Task-first is the default for
//                                     EVERYONE; the entrance is a choice the
//                                     visitor makes in the footer/app control,
//                                     not a toll the product charges them.
//   · D-6/C-02: not tier A .......... nothing. The entrance now consults the
//                                     SAME capability policy every other CXOS
//                                     surface consults, so Data Saver, a
//                                     sub-4 GB device and a ≤768 px viewport
//                                     are honored here too — the bypass that
//                                     let a Data-Saver phone download three.js
//                                     and play the full entrance is closed.
//   · already entered ............... nothing (the Threshold plays once; the
//                                     settled landing is the return state).
//                                     C-13: durable, not per-tab.
//   · no WebGL ...................... nothing (progressive enhancement: Tier-1
//                                     CSS arrival still plays beneath)
//   · otherwise ..................... import() the experience AFTER the window
//                                     load event + an idle callback, so not one
//                                     cinematic byte competes with LCP.
export function ThresholdGate() {
  const [Threshold, setThreshold] = useState<ComponentType<{ onDone: () => void; review?: boolean }> | null>(null);
  const [review, setReview] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The pre-paint script may have dropped the page into darkness; every early
    // return below must lift it, or a condition mismatch would strand black.
    const lift = () => document.documentElement.removeAttribute("data-cxenter");
    // Founder Review Mode (?director on a non-production build) replays the
    // entry regardless of session memory. It never overrides reduced motion.
    const director = isDirectorActive();
    if (director) setReview(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return lift();
    // D-6: the entrance is opt-in, and the opt-in is still subject to the tier
    // policy — an explicit "yes please" is a request for the entrance, never a
    // waiver of the protections that decide a device can afford it.
    if (!director && !cinematicEntranceOptIn()) return lift();
    if (!director && detectTier() !== "A") return lift();
    try {
      if (!director && sessionStorage.getItem("cx-threshold") === "1") return lift();
    } catch {
      return lift(); // storage unavailable — never risk replaying forever
    }
    if (!director && thresholdAlreadySeen()) return lift(); // C-13: durable memory
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) return lift();

    let cancelled = false;
    // C-02: the pre-paint darkness is bounded HERE, not only by the CSS safety
    // fade 12 s away. If the lazy chunk has not mounted (which lifts it at
    // Threshold.tsx's own mount) within 1.5 s, the landing wins — a visible
    // hero that the entrance then covers is strictly better than a black
    // screen over painted content.
    const bound = window.setTimeout(lift, 1500);
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
      window.clearTimeout(bound);
    };
  }, []);

  if (done || !Threshold) return null;
  return <Threshold review={review} onDone={() => setDone(true)} />;
}
