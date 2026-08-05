"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { CXOS_ROOMS } from "@/lib/cxos/rooms";
import { detectTier } from "@/lib/cxos/capability";
import { WALKTHROUGH_STEP_CROSSFADE_MS } from "@/lib/cxos/pacing";
import { ProgressRail } from "@/components/cxos/walkthrough/ProgressRail";
import { SimulatedSignIn } from "@/components/cxos/walkthrough/SimulatedSignIn";
import {
  STEP_META,
  parsePersona,
  resolveStepIndex,
  stepsForPersona,
  walkthroughHref,
  type WalkthroughPersona,
  type WalkthroughStepKey,
} from "./steps";
import { MISSION_BOOT_FIXTURE } from "./fixtures";
import { clearBeat, clearWalkthroughSession, hasSeenBeat, markSeenBeat } from "./session";

// Every composed room loads on demand, not upfront. A first static-import
// pass through all six put ~190 kB of route-specific JS (Threshold's
// three.js/gsap scene, Agency Command's ~3,400-line stage, Passage's full
// timeline) into ONE bundle that loaded in full before the Founder ever
// left the overview screen, even though only one step's room is ever
// visible at a time. next/dynamic + ssr:false defers each room's code to
// the moment its OWN step actually mounts — this is the same lazy-load
// discipline ThresholdGate.tsx already uses for the exact same reason
// (three/gsap never enter a synchronous bundle), just applied at the
// walkthrough level. ssr:false is safe here: every one of these components
// is already "use client" and gated behind reviewBuildAllowed() two layers
// up, so there is no SEO/no-JS surface to preserve.
const Threshold = dynamic(
  () => import("@/components/cxos/Threshold").then((m) => m.Threshold),
  { ssr: false }
);
const MissionEntry = dynamic(
  () => import("@/components/cxos/mission/MissionEntry").then((m) => m.MissionEntry),
  { ssr: false }
);
const PassageJourney = dynamic(
  () => import("@/components/cxos/passage/PassageJourney").then((m) => m.PassageJourney),
  { ssr: false }
);
const MissionControlStage = dynamic(
  () => import("@/app/review/mission-control/stage").then((m) => m.MissionControlStage),
  { ssr: false }
);
const ArenaStage = dynamic(
  () => import("@/app/review/arena/stage").then((m) => m.ArenaStage),
  { ssr: false }
);
const AgencyCommandStage = dynamic(
  () => import("@/app/review/agency-command/stage").then((m) => m.AgencyCommandStage),
  { ssr: false }
);
const LandingJourneyReview = dynamic(() => import("@/app/review/landing/page"), {
  ssr: false,
});

// CXOS Phase 1A-CX2 (C) — the Founder Walkthrough: a director/orchestrator
// over the six rooms CX2-A/B and their predecessors already shipped. This
// file introduces NO new room interior — every step below composes an
// existing room via its public export (import list above) or, for the two
// beats no room already covers (the sign-in theater, and the settled-
// Threshold placeholder below), a small new presentational component.
//
// Deep-linkable, refresh-recoverable by construction: `step`/`persona` are
// read straight from the URL on every render — there is no separate React
// state that could desync from it, so there is nothing for a refresh, a
// back/forward, or a hand-typed link to leave "stuck." Absent `?step`, this
// renders the overview (banner + ordered list + BEGIN + full room index).

export function FounderWalkthroughStage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const persona = parsePersona(searchParams.get("persona"));
  const rawStep = searchParams.get("step");
  const overview = rawStep === null;
  const sequence = stepsForPersona(persona);
  const stepIndex = resolveStepIndex(persona, rawStep);
  const activeKey: WalkthroughStepKey | null = overview ? null : sequence[stepIndex - 1];

  // One monotonic counter, bumped only by "Replay this transition." It is
  // never reset per-step: combined with persona+stepIndex into a single
  // remount key below, an ordinary step change already changes that key on
  // its own (different persona/stepIndex), so this counter only needs to
  // move the needle on an explicit replay of the SAME step.
  const [replayNonce, setReplayNonce] = useState(0);

  // Resolution for the two beats with their own once-per-walkthrough-session
  // guard (see ./session.ts for why these are the walkthrough's OWN keys,
  // not the production cx-threshold/cx-mc ones). "pending" is the one tick
  // before the effect below resolves it — both ceremonies already render
  // nothing during their own equivalent detection window, so this matches
  // their own house pattern rather than inventing a new one.
  const [arrivalMode, setArrivalMode] = useState<"pending" | "play" | "settled">("pending");
  const [bootVariant, setBootVariant] = useState<"first" | "returning" | null>(null);

  useEffect(() => {
    if (activeKey === "arrival") {
      setArrivalMode(hasSeenBeat("threshold") ? "settled" : "play");
    } else if (activeKey === "mission-boot") {
      const seen = hasSeenBeat("mission-boot");
      // MissionEntry exposes no onDone (by design — it plays OVER an
      // already-rendered room and just dismisses itself). Marking "seen" at
      // the moment we decide to show it, rather than waiting for a
      // completion callback that does not exist, is the closest honest
      // approximation: the veil WILL dismiss itself shortly either way, and
      // this is exactly what determines whether the NEXT visit to this step
      // gets the short "returning" variant.
      setBootVariant(seen ? "returning" : "first");
      if (!seen) markSeenBeat("mission-boot");
    }
    // activeKey and replayNonce are the only two things this resolution
    // should react to — persona/stepIndex changes are already implied by
    // activeKey changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, replayNonce]);

  const goToStep = useCallback(
    (nextPersona: WalkthroughPersona, index: number | null) => {
      router.push(walkthroughHref(nextPersona, index));
    },
    [router]
  );

  const goRelative = useCallback(
    (delta: number) => {
      const next = stepIndex + delta;
      if (next < 1 || next > sequence.length) {
        goToStep(persona, null); // before step 1, or past the last step: the overview
        return;
      }
      goToStep(persona, next);
    },
    [stepIndex, sequence.length, persona, goToStep]
  );

  const handleThresholdDone = useCallback(() => {
    markSeenBeat("threshold");
    // The Threshold is the one composed ceremony with a real completion
    // callback, so — unlike Mission Boot's veil — advancing automatically
    // here is exact, not an approximation: a returning operator should not
    // need to click Next after watching the whole entrance, any more than a
    // real visitor clicks anything for the landing page to appear beneath it.
    goRelative(1);
  }, [goRelative]);

  const handleReplay = useCallback(() => {
    if (activeKey === "arrival") clearBeat("threshold");
    else if (activeKey === "mission-boot") clearBeat("mission-boot");
    setReplayNonce((n) => n + 1);
  }, [activeKey]);

  const handleRestart = useCallback(() => {
    clearWalkthroughSession();
    goToStep(persona, 1);
  }, [persona, goToStep]);

  if (overview) {
    return (
      <WalkthroughOverview
        persona={persona}
        onPersonaChange={(next) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("persona", next);
          router.replace(`/review/cxos?${params.toString()}`);
        }}
        onBegin={() => goToStep(persona, 1)}
      />
    );
  }

  const stepMeta = activeKey ? STEP_META[activeKey] : null;
  const fadeKey = `${persona}:${stepIndex}:${replayNonce}`;

  return (
    <>
      <ProgressRail
        persona={persona}
        stepIndex={stepIndex}
        totalSteps={sequence.length}
        stepTitle={stepMeta?.title ?? ""}
        prevLabel={stepIndex === 1 ? "← Overview" : "← Back"}
        nextLabel={stepIndex === sequence.length ? "Finish →" : "Next →"}
        onPrev={() => goRelative(-1)}
        onNext={() => goRelative(1)}
        onReplay={handleReplay}
        onRestart={handleRestart}
      />
      <StepFade fadeKey={fadeKey}>
        {activeKey === "landing" && <LandingJourneyReview />}
        {activeKey === "simulated-signin" && (
          <SimulatedSignIn onContinue={() => goRelative(1)} />
        )}
        {activeKey === "arrival" &&
          (arrivalMode === "play" ? (
            <main className="min-h-screen bg-ink-950">
              <Threshold review onDone={handleThresholdDone} />
            </main>
          ) : arrivalMode === "settled" ? (
            <ThresholdSettledPlaceholder onReplay={handleReplay} />
          ) : null)}
        {activeKey === "mission-boot" && (
          <>
            <MissionControlStage />
            {bootVariant && (
              // key carries the replay nonce: after Replay clears the session
              // key, the re-resolved variant can be VALUE-identical, so without
              // a key change React reconciles in place and the veil never
              // remounts (found live in the CX2-D evidence pass, R7).
              <MissionEntry
                key={fadeKey}
                {...MISSION_BOOT_FIXTURE}
                forceReview
                forceVariant={bootVariant}
              />
            )}
          </>
        )}
        {activeKey === "mission-control" && <MissionControlStage />}
        {activeKey === "the-passage" && <PassageJourney />}
        {activeKey === "arena" && <ArenaStage />}
        {activeKey === "agency-hq" && <AgencyCommandStage />}
      </StepFade>
    </>
  );
}

// Threshold has no "returning" shortcut of its own (unlike MissionEntry/
// ArenaEntry) — mounting it always plays the same ~10s sequence. Once this
// walkthrough session has already seen it, this settled card stands in for
// "the entrance already happened" instead of silently replaying a ~10s
// WebGL sequence the Founder did not ask to see again — deep-linking or
// refreshing back onto this step is then still deterministic (always this
// card, never a surprise replay), and the room beyond is reachable with
// Next exactly as if the entrance had just finished.
function ThresholdSettledPlaceholder({ onReplay }: { onReplay: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-950 px-6 text-center text-white">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-300">
        Arrival · The Threshold
      </p>
      <h1 className="h-display text-2xl md:text-3xl">Already entered this session</h1>
      <p className="max-w-md text-sm leading-relaxed text-slate-400">
        Matching how a returning operator never re-walks the entrance on ordinary
        navigation, the Threshold does not replay automatically once this walkthrough
        session has already passed through it. Replay it on demand, or continue.
      </p>
      <button type="button" onClick={onReplay} className="btn-ghost">
        Replay the entrance
      </button>
    </main>
  );
}

// The step-to-step hand-off crossfade. See lib/cxos/pacing.ts's
// WALKTHROUGH_STEP_CROSSFADE_MS doc comment for why this number exists and
// where it comes from. Under reduced motion / the cinematic-off toggle
// (tier D), this adds NO inline style at all — full opacity, no transition
// — so nothing new ever animates under PRM; every composed room's own tier-D
// static state is unaffected either way, this wrapper just stops adding its
// OWN motion on top of it.
function StepFade({ fadeKey, children }: { fadeKey: string; children: React.ReactNode }) {
  const reduced = detectTier() === "D";
  const [entered, setEntered] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setEntered(true);
      return;
    }
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [fadeKey, reduced]);

  return (
    <div
      style={
        reduced
          ? undefined
          : {
              opacity: entered ? 1 : 0,
              transition: `opacity ${WALKTHROUGH_STEP_CROSSFADE_MS}ms ease`,
            }
      }
    >
      {children}
    </div>
  );
}

function WalkthroughOverview({
  persona,
  onPersonaChange,
  onBegin,
}: {
  persona: WalkthroughPersona;
  onPersonaChange: (persona: WalkthroughPersona) => void;
  onBegin: () => void;
}) {
  const sequence = stepsForPersona(persona);

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-300">
          {BRAND.product} · Founder Review · The Founder Walkthrough
        </p>
        <h1 className="h-display mt-2 text-3xl md:text-4xl">One coherent walkthrough</h1>

        <div className="mt-5 rounded-xl border border-gold-400/30 bg-gold-400/10 p-4" role="note">
          <strong className="text-[11px] font-bold uppercase tracking-widest text-gold-400">
            SYNTHETIC FOUNDER REVIEW
          </strong>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
            Illustrative deterministic data only, composed entirely from the same
            repository-backed fixtures each individual review room already uses. No customer
            records, live AI, live billing, real authentication, mailed correspondence,
            revenue, or automated actions are connected to this walkthrough at any step. The
            simulated sign-in beat collects nothing — it is a labeled theatrical beat, not a
            form.
          </p>
        </div>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-slate-400">
          Open this one URL and follow the experience end to end without needing to know any
          internal route. This is a Founder review runtime — it is not yet authorization to
          replace production product navigation.
        </p>

        <div
          className="mt-8 flex flex-wrap items-center gap-2"
          role="radiogroup"
          aria-label="Walkthrough persona"
        >
          {(["returning", "new"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={persona === option}
              onClick={() => onPersonaChange(option)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                persona === option
                  ? "border-brand-500 bg-brand-500/15 text-brand-200"
                  : "border-ink-600 text-slate-400 hover:border-brand-500/50"
              }`}
            >
              {option === "returning" ? "Returning Operator" : "New Visitor"}
            </button>
          ))}
        </div>

        <ol className="mt-6 space-y-2">
          {sequence.map((key, i) => (
            <li key={key}>
              <Link
                href={walkthroughHref(persona, i + 1)}
                className="card flex items-center gap-3 p-3 hover:border-brand-500/40"
              >
                <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-800 text-xs font-bold text-slate-300">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-100">
                    {STEP_META[key].title}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {STEP_META[key].synopsis}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onBegin}
          className="btn-primary btn-lg mt-8 w-full sm:w-auto"
        >
          Begin the walkthrough
        </button>

        <h2 className="mt-14 text-sm font-bold uppercase tracking-widest text-slate-300">
          Every room, direct (regression review access)
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {CXOS_ROOMS.filter((room) => room.key !== "founder-walkthrough").map((room) => (
            <article key={room.key} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-100">{room.name}</h3>
                <span className="rounded-full border border-brand-500/50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">
                  {room.status}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{room.line}</p>
              <Link
                href={room.href}
                className="mt-3 inline-block text-[11px] font-semibold text-brand-300 hover:text-brand-200"
              >
                Enter →
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-10 text-[11px] leading-relaxed text-slate-600">
          <Link href="/review" className="text-brand-300">
            ← Founder Review index
          </Link>
        </p>
      </div>
    </main>
  );
}
