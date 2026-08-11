"use client";

// Cinematic Transition Runtime — T1.3
// (app/review/transition-runtime/MotionPreviewControl.tsx)
//
// The Founder-facing MOTION PREVIEW switch for the review harness. Renders a
// three-way radiogroup (SYSTEM / FULL MOTION / REDUCED MOTION) plus a live
// line showing what the OS currently reports, so a reviewer always knows
// whether "system" resolves to the reduced or the cinematic path on THIS
// machine. Review-harness-only by construction: it exists solely inside the
// /review/transition-runtime segment (production 404s the whole subtree) and
// only feeds the provider's review-only `motionPreview` prop.
import { useEffect, useState } from "react";
import type { MotionPreviewMode } from "@/components/transition-runtime/TransitionRuntimeProvider";

const OPTIONS: ReadonlyArray<{ mode: MotionPreviewMode; label: string; hint: string }> = [
  { mode: "system", label: "System", hint: "production behavior — honors the OS setting" },
  { mode: "full", label: "Full motion", hint: "review override — the T1 cinematic path" },
  { mode: "reduced", label: "Reduced motion", hint: "accessibility path — deterministic, no veil" },
];

export function MotionPreviewControl({
  value,
  onChange,
}: {
  value: MotionPreviewMode;
  onChange: (mode: MotionPreviewMode) => void;
}) {
  // Read in an effect, never during render: the OS answer is
  // browser-only, and this keeps server and first client render identical.
  const [osReduced, setOsReduced] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setOsReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const effective =
    value === "full"
      ? "cinematic (override)"
      : value === "reduced"
        ? "reduced (explicit)"
        : osReduced === null
          ? "…"
          : osReduced
            ? "reduced (OS)"
            : "cinematic (OS)";

  return (
    <aside
      aria-label="Motion preview"
      className="fixed right-4 top-4 z-[1000] rounded-xl2 border border-ink-700/60 bg-ink-900/95 p-3 text-xs shadow-lg backdrop-blur-none"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-300">
        Motion preview
      </p>
      <div role="radiogroup" aria-label="Motion preview mode" className="mt-2 flex gap-1.5">
        {OPTIONS.map((option) => {
          const selected = option.mode === value;
          return (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={selected}
              title={option.hint}
              onClick={() => onChange(option.mode)}
              className={`rounded-lg border px-2.5 py-1.5 font-semibold transition ${
                selected
                  ? "border-brand-300/70 bg-brand-300/15 text-brand-300"
                  : "border-ink-700/60 bg-ink-950/60 text-slate-300 hover:border-ink-600 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-slate-400">
        OS reports: {osReduced === null ? "…" : osReduced ? "reduce" : "no-preference"} · journeys
        resolve: {effective}
      </p>
    </aside>
  );
}
