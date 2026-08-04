"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import {
  CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES,
  CXOS_CORE_RUNTIME_VERSION,
  deriveCxosRuntimeEnvironment,
  resolveCxosDistrictTransitionDirection,
  resolveCxosDistrictTransitionDuration,
  resolveCxosLivingEnvironmentProjection,
  resolveCxosRuntimeProjection,
  selectCxosActiveDistrict,
  validateCxosRoomRuntime,
  type CxosDistrictTransitionDirection,
  type CxosAttentionState,
  type CxosExperienceProjection,
  type CxosIdlePresentationState,
  type CxosKaiResponseState,
  type CxosRoomRuntimeDefinition,
  type CxosRuntimeCapabilities,
} from "@/lib/cxos/runtime";

// Headless browser adapter for the CXOS Core Runtime.
//
// The adapter coordinates lifecycle, focus, native-scroll district activation,
// visibility pausing, and fail-open navigation. It renders nothing and knows no
// room copy, fixture value, visual component, or Kai command.

export interface CxosRoomRuntimeMessages {
  staticArrival: string;
  escapeArrival: string;
  departure: string;
}

export interface UseCxosRoomRuntimeOptions<DistrictId extends string> {
  definition: CxosRoomRuntimeDefinition<DistrictId>;
  projection: CxosExperienceProjection;
  reducedMotionOverride: boolean;
  roomRootRef: RefObject<HTMLElement>;
  roomHeadingRef: RefObject<HTMLElement>;
  observerKey?: string | number;
  messages: CxosRoomRuntimeMessages;
  announce: (message: string) => void;
  onRouteReset?: () => void;
  presentationSignals?: {
    attention?: CxosAttentionState;
    kai?: CxosKaiResponseState;
  };
}

export interface CxosChamberTransition<DistrictId extends string> {
  phase: "settled" | "passage";
  sourceDistrict: DistrictId;
  targetDistrict: DistrictId | null;
  direction: CxosDistrictTransitionDirection;
  sequence: number;
}

interface CxosRootScrollSnapshot {
  value: string;
  priority: string;
}

let cxosInstantScrollOwners = 0;
let cxosRootScrollSnapshot: CxosRootScrollSnapshot | null = null;

function acquireCxosInstantScroll() {
  const root = document.documentElement;
  if (cxosInstantScrollOwners === 0) {
    cxosRootScrollSnapshot = {
      value: root.style.getPropertyValue("scroll-behavior"),
      priority: root.style.getPropertyPriority("scroll-behavior"),
    };
    root.style.setProperty("scroll-behavior", "auto", "important");
  }
  cxosInstantScrollOwners += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    cxosInstantScrollOwners = Math.max(0, cxosInstantScrollOwners - 1);
    if (cxosInstantScrollOwners !== 0) return;

    const snapshot = cxosRootScrollSnapshot;
    cxosRootScrollSnapshot = null;
    const stillOwned =
      root.style.getPropertyValue("scroll-behavior") === "auto" &&
      root.style.getPropertyPriority("scroll-behavior") === "important";
    if (!snapshot || !stillOwned) return;
    if (snapshot.value) {
      root.style.setProperty("scroll-behavior", snapshot.value, snapshot.priority);
    } else {
      root.style.removeProperty("scroll-behavior");
    }
  };
}

export function scrollCxosWindowImmediately(top: number, left = 0) {
  const release = acquireCxosInstantScroll();
  try {
    window.scrollTo({ top, left, behavior: "instant" });
  } catch {
    release();
    return;
  }
  if (typeof window.requestAnimationFrame === "function") {
    // rAF is paused while hidden; race a timeout so release cannot get stuck.
    window.requestAnimationFrame(release);
    window.setTimeout(release, 0);
  } else {
    release();
  }
}

export function scrollCxosElementImmediately(element: HTMLElement) {
  const scrollMarginTop = Number.parseFloat(
    window.getComputedStyle(element).scrollMarginTop,
  );
  const top =
    window.scrollY +
    element.getBoundingClientRect().top -
    (Number.isFinite(scrollMarginTop) ? scrollMarginTop : 0);
  scrollCxosWindowImmediately(Math.max(0, top));
}

function readCxosRuntimeCapabilities(): CxosRuntimeCapabilities {
  try {
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };

    return {
      browserReduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      saveData: nav.connection?.saveData === true,
      lowMemory: typeof nav.deviceMemory === "number" && nav.deviceMemory < 4,
      mobile: window.matchMedia("(max-width: 767px)").matches,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      intersectionObserver:
        typeof window.IntersectionObserver === "function",
      detectionFailed: false,
    };
  } catch {
    return CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES;
  }
}

function sameCxosRuntimeCapabilities(
  a: CxosRuntimeCapabilities,
  b: CxosRuntimeCapabilities,
): boolean {
  return (
    a.browserReduced === b.browserReduced &&
    a.saveData === b.saveData &&
    a.lowMemory === b.lowMemory &&
    a.mobile === b.mobile &&
    a.coarsePointer === b.coarsePointer &&
    a.intersectionObserver === b.intersectionObserver &&
    a.detectionFailed === b.detectionFailed
  );
}

function subscribeCxosMediaQuery(
  query: MediaQueryList,
  listener: () => void,
): () => void {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }
  if (typeof query.addListener === "function") {
    query.addListener(listener);
    return () => query.removeListener(listener);
  }
  throw new Error("Media query change events are unavailable");
}

function findCxosElementById(root: HTMLElement, id: string) {
  if (root.id === id) return root;
  return Array.from(root.querySelectorAll<HTMLElement>("[id]")).find(
    (element) => element.id === id,
  );
}

function findCxosDistrict(root: HTMLElement, districtId: string) {
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-cxos-district]"),
  ).find((element) => element.dataset.cxosDistrict === districtId);
}

function isPlainPrimaryAnchorClick(event: ReactMouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.currentTarget.hasAttribute("download") &&
    (!event.currentTarget.target || event.currentTarget.target === "_self")
  );
}

export function useCxosRoomRuntime<DistrictId extends string>({
  definition,
  projection,
  reducedMotionOverride,
  roomRootRef,
  roomHeadingRef,
  observerKey,
  messages,
  announce,
  onRouteReset,
  presentationSignals,
}: UseCxosRoomRuntimeOptions<DistrictId>) {
  const validation = useMemo(
    () => validateCxosRoomRuntime(definition),
    [definition],
  );
  const [capabilities, setCapabilities] = useState<CxosRuntimeCapabilities>(
    CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES,
  );
  const [capabilitiesReady, setCapabilitiesReady] = useState(false);
  const [arrivalKey, setArrivalKey] = useState(0);
  const [arrivalSettled, setArrivalSettled] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState<DistrictId>(
    definition.initialDistrict,
  );
  const [chamberTransition, setChamberTransition] = useState<
    CxosChamberTransition<DistrictId>
  >({
    phase: "settled",
    sourceDistrict: definition.initialDistrict,
    targetDistrict: null,
    direction: "same",
    sequence: 0,
  });
  const [kaiContextDistrict, setKaiContextDistrict] = useState<DistrictId>(
    definition.initialDistrict,
  );
  // Render-time-adjustment tracker for kaiContextDistrict below (not an
  // effect dependency) -- see the render-time adjustment for why this
  // isn't a useEffect.
  const lastActiveDistrictForKaiContextRef = useRef(definition.initialDistrict);
  const [documentHidden, setDocumentHidden] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [detectedAttention, setDetectedAttention] =
    useState<CxosAttentionState>("ambient");
  const [idleState, setIdleState] =
    useState<CxosIdlePresentationState>("engaged");

  const replayFocusPendingRef = useRef(false);
  const staticArrivalFocusRef = useRef(false);
  const arrivalCommitFocusRef = useRef<{
    key: number;
    focus:
      | { kind: "room" }
      | { kind: "district"; districtId: DistrictId };
    announcement: string;
  } | null>(null);
  const departureCommittedRef = useRef(false);
  const departureFallbackRef = useRef<number | null>(null);
  const activeDistrictRef = useRef<DistrictId>(definition.initialDistrict);
  const chamberTransitionRef = useRef<CxosChamberTransition<DistrictId>>(
    chamberTransition,
  );
  const districtTransitionFallbackRef = useRef<number | null>(null);
  const districtFocusFrameRef = useRef<number | null>(null);
  const districtScrollFrameRef = useRef<number | null>(null);
  const districtScrollSettleFrameRef = useRef<number | null>(null);
  const districtCommitFocusRef = useRef<{
    districtId: DistrictId;
    sequence: number;
  } | null>(null);
  const visibilityFocusPendingRef = useRef(false);
  const activitySequenceRef = useRef(0);
  const idleTrackingActiveRef = useRef(false);
  const idleTimingRef = useRef({ idleAfterMs: 0, settleAfterMs: 0 });
  const idleTimerRef = useRef<number | null>(null);
  const announceRef = useRef(announce);
  const routeResetRef = useRef(onRouteReset);
  const districtMode = definition.districtMode ?? "flow";
  const requestedAttention = presentationSignals?.attention ?? "ambient";
  const requestedKai = presentationSignals?.kai ?? "quiet";
  const attention: CxosAttentionState =
    detectedAttention === "inspecting"
      ? "inspecting"
      : requestedAttention !== "ambient"
        ? requestedAttention
        : detectedAttention;

  useEffect(() => {
    announceRef.current = announce;
  }, [announce]);

  useEffect(() => {
    routeResetRef.current = onRouteReset;
  }, [onRouteReset]);

  const resolution = useMemo(
    () =>
      resolveCxosRuntimeProjection(
        projection,
        capabilities,
        reducedMotionOverride,
        validation.valid,
        districtMode,
      ),
    [
      capabilities,
      districtMode,
      projection,
      reducedMotionOverride,
      validation.valid,
    ],
  );

  const baseEnvironment = useMemo(
    () =>
      deriveCxosRuntimeEnvironment({
        contractValid: validation.valid,
        tier: resolution.tier,
        arrivalSettled,
        departing,
        documentHidden,
      }),
    [
      arrivalSettled,
      departing,
      documentHidden,
      resolution.tier,
      validation.valid,
    ],
  );

  const environment = useMemo(() => {
    if (chamberTransition.phase !== "passage") return baseEnvironment;
    return {
      ...baseEnvironment,
      motion:
        baseEnvironment.motion === "static" ? "static" : ("paused" as const),
      heartbeat:
        baseEnvironment.heartbeat === "static"
          ? "static"
          : ("paused" as const),
      atmosphere:
        baseEnvironment.atmosphere === "static"
          ? "static"
          : ("paused" as const),
      kaiPresence:
        baseEnvironment.kaiPresence === "unavailable" ||
        baseEnvironment.kaiPresence === "static"
          ? baseEnvironment.kaiPresence
          : ("paused" as const),
      scrollActivation: false,
    };
  }, [baseEnvironment, chamberTransition.phase]);

  const armIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!idleTrackingActiveRef.current) return;
    setIdleState("engaged");
    const { idleAfterMs, settleAfterMs } = idleTimingRef.current;
    idleTimerRef.current = window.setTimeout(() => {
      setIdleState("settling");
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        setIdleState("settled");
      }, settleAfterMs);
    }, idleAfterMs);
  }, []);

  useEffect(() => {
    const root = roomRootRef.current;
    if (!root || !definition.livingEnvironment) return;

    const readAttention = () => {
      if (!root.isConnected) return;
      const inspecting = root.querySelector(
        "details[data-cxos-inspection][open]",
      );
      if (inspecting) {
        setDetectedAttention("inspecting");
        return;
      }
      // Reading is narrow on purpose: only an actual text-entry surface
      // quiets the room on focus alone. Every other interactive element
      // (links, buttons, summary disclosures, the facility rail) is ambient
      // — focusing or activating them still registers activity below, but
      // does not itself classify as "reading a document".
      const focused = document.activeElement;
      const textEntryFocus =
        focused instanceof HTMLElement &&
        focused.closest(
          'input:not([type="button" i]):not([type="submit" i]), textarea, [contenteditable]',
        );
      setDetectedAttention(
        focused instanceof HTMLElement &&
          root.contains(focused) &&
          focused !== root &&
          textEntryFocus
          ? "reading"
          : "ambient",
      );
    };
    const registerActivity = () => {
      activitySequenceRef.current += 1;
      armIdleTimer();
    };
    const settleAttentionAfterEvent = () => queueMicrotask(readAttention);
    const onFocus = () => {
      registerActivity();
      settleAttentionAfterEvent();
    };
    // Scrolling and wheel input are operating the room, not idling in it, but
    // both can fire at very high frequency — trailing-throttle to at most one
    // activity arm per ~900ms so the idle timer is reset without a clear/set
    // pair running on every frame of a fast scroll.
    let scrollActivityThrottle: number | null = null;
    const registerScrollActivity = () => {
      if (scrollActivityThrottle !== null) return;
      scrollActivityThrottle = window.setTimeout(() => {
        scrollActivityThrottle = null;
        registerActivity();
      }, 900);
    };

    root.addEventListener("pointerdown", registerActivity, true);
    root.addEventListener("click", registerActivity, true);
    root.addEventListener("keydown", registerActivity, true);
    root.addEventListener("input", registerActivity, true);
    root.addEventListener("focusin", onFocus, true);
    root.addEventListener("focusout", settleAttentionAfterEvent, true);
    root.addEventListener("toggle", settleAttentionAfterEvent, true);
    // Chamber content scrolls at the document/window level (the room itself
    // is not a scroll container), so the window listener is the one that
    // actually observes native scrolling; the root listener is kept too in
    // case a chamber ever becomes independently scrollable.
    root.addEventListener("scroll", registerScrollActivity, { passive: true });
    root.addEventListener("wheel", registerScrollActivity, { passive: true });
    window.addEventListener("scroll", registerScrollActivity, { passive: true });
    readAttention();

    return () => {
      root.removeEventListener("pointerdown", registerActivity, true);
      root.removeEventListener("click", registerActivity, true);
      root.removeEventListener("keydown", registerActivity, true);
      root.removeEventListener("input", registerActivity, true);
      root.removeEventListener("focusin", onFocus, true);
      root.removeEventListener("focusout", settleAttentionAfterEvent, true);
      root.removeEventListener("toggle", settleAttentionAfterEvent, true);
      root.removeEventListener("scroll", registerScrollActivity);
      root.removeEventListener("wheel", registerScrollActivity);
      window.removeEventListener("scroll", registerScrollActivity);
      if (scrollActivityThrottle !== null) {
        window.clearTimeout(scrollActivityThrottle);
        scrollActivityThrottle = null;
      }
    };
  }, [armIdleTimer, definition.livingEnvironment, observerKey, roomRootRef]);

  useEffect(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    const livingEnvironment = definition.livingEnvironment;
    if (!livingEnvironment) {
      idleTrackingActiveRef.current = false;
      setIdleState("engaged");
      return;
    }

    const hardSettle =
      !validation.valid ||
      resolution.tier === "C" ||
      resolution.tier === "D" ||
      environment.phase !== "operating" ||
      documentHidden ||
      chamberTransition.phase === "passage" ||
      attention !== "ambient" ||
      requestedKai !== "quiet";
    if (hardSettle) {
      idleTrackingActiveRef.current = false;
      setIdleState("settled");
      return;
    }

    idleTrackingActiveRef.current = true;
    // Each chamber may carry its own idleAfterMs identity (faster/slower to
    // settle than the room-level default); resolve the ACTIVE chamber's
    // timing here so re-arming below always uses the current district's
    // value, falling back to the shared default when a chamber omits it.
    const activeChamber = livingEnvironment.chambers.find(
      (chamber) => chamber.id === activeDistrict,
    );
    const chamberIdleAfterMs =
      activeChamber?.idleAfterMs ?? livingEnvironment.idleAfterMs;
    idleTimingRef.current = {
      idleAfterMs:
        resolution.tier === "A" ? chamberIdleAfterMs.A : chamberIdleAfterMs.B,
      settleAfterMs: resolution.tier === "A" ? 400 : 300,
    };
    armIdleTimer();

    return () => {
      idleTrackingActiveRef.current = false;
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [
    activeDistrict,
    arrivalKey,
    armIdleTimer,
    attention,
    chamberTransition.phase,
    definition.livingEnvironment,
    documentHidden,
    environment.phase,
    requestedKai,
    resolution.tier,
    validation.valid,
  ]);

  const livingEnvironment = useMemo(
    () =>
      resolveCxosLivingEnvironmentProjection(definition, activeDistrict, {
        contractValid: validation.valid,
        tier: resolution.tier,
        phase: environment.phase,
        documentHidden,
        passage: chamberTransition.phase === "passage",
        attention,
        kai: requestedKai,
        idle: idleState,
      }),
    [
      activeDistrict,
      attention,
      chamberTransition.phase,
      definition,
      documentHidden,
      environment.phase,
      idleState,
      requestedKai,
      resolution.tier,
      validation.valid,
    ],
  );

  // Belt-and-suspenders enforcement for the Living Environment's continuous
  // motion channels, not a second policy: the room's own CSS already gates
  // every continuous:* channel to zero the instant continuousAnimationBudget
  // drops to 0 (a settle/reading/quiet kill list plus, on each WP2 opt-in,
  // that same negation restated directly on the opt-in's own selector so
  // the two !important declarations are structurally mutually exclusive).
  // That was verified correct both by static specificity and by forcing the
  // transition directly. It was ALSO observed, empirically, against a real
  // long multi-step interaction session under heavy concurrent main-thread
  // load (per-chamber Axe audits, animations:"disabled" screenshot capture)
  // to occasionally leave one specific long-running (18s, linear infinite)
  // continuous animation still reported as running well after
  // continuousAnimationBudget read 0 in the DOM -- the cascade's
  // cancellation was not reliably picked up for that element, for reasons
  // this hook has no way to detect or distinguish from the outside. Rather
  // than chase that further, this explicitly cancels any still-running
  // continuous:* animation via the Web Animations API the moment motion
  // stops being "active", using the exact same data-cxos-motion-channel
  // token grammar the CSS and the acceptance harness already use as the
  // single source of truth -- no new concept, no room-specific knowledge.
  // useLayoutEffect (not useEffect) so this runs before the next paint.
  //
  // RC2 WP-FIX2 (F5, adversarial-confirmed over-reach): an owner can declare
  // more than one token on ONE attribute (.districtEnvironment carries
  // "continuous:chamber-breath transient:chamber-acquire scroll:depth-
  // parallax" for 3 physically distinct animations -- the breath on the
  // owner itself, and the acquire/scroll pair on its [data-plane="depth"]
  // child). The original net used target.closest("[data-cxos-motion-channel]")
  // to find the OWNER, then cancelled whenever the OWNER's raw attribute
  // STRING merely contained a "continuous:" substring -- true for all of the
  // animations sharing that owner, so leaving "active" force-cancelled a
  // still-in-flight transient:chamber-acquire entry or the scroll:depth-
  // parallax ViewTimeline animation too, neither of which is continuous.
  // The fix scopes both the classification and the computed-style gate to
  // THIS animation alone: cancel only when (a) this specific animation's own
  // token resolves to continuous: (never scroll, never transient), AND (b)
  // this animation's own animationName is absent from getComputedStyle of
  // its OWN target/pseudo-element (never the shared owner) -- i.e. the
  // cascade has already disowned THIS animation specifically. In the normal
  // quiet path the CSS negation has already flipped that element's
  // animation-name to none and this is a no-op; it exists only for the rare
  // long-running-animation residual documented above. Gating per animation
  // name on the animation's own target means a still-CSS-owned animation
  // (acquire/scroll on the depth child) is never force-cancelled just
  // because it shares an owner with a continuous channel, so it stays free
  // to run to completion / restart on re-engage. Cheap: only runs on quiet
  // transitions, and getComputedStyle is read only for owner-declared
  // continuous candidates, never for every running animation in the room.
  useLayoutEffect(() => {
    const root = roomRootRef.current;
    if (!root || !livingEnvironment || livingEnvironment.motion === "active") {
      return;
    }
    for (const animation of root.getAnimations({ subtree: true })) {
      const effect = animation.effect;
      // KeyframeEffect is the only AnimationEffect subtype with a target or
      // a pseudoElement (spec-accurate; also narrows the TypeScript types
      // cleanly, unlike a bare "in" check against the base AnimationEffect
      // interface). CSSAnimation is the only Animation subtype with a
      // spec'd animationName.
      const target = effect instanceof KeyframeEffect ? effect.target : null;
      if (!(target instanceof Element)) continue;
      const animationName =
        animation instanceof CSSAnimation ? animation.animationName : null;
      // Only a genuine named CSS animation can be "CSS-orphaned" -- there is
      // no computed animation-name to compare a nameless Web Animation
      // against, so it is never a candidate for this net.
      if (!animationName) continue;
      const owner = target.closest("[data-cxos-motion-channel]");
      const channel = owner?.getAttribute("data-cxos-motion-channel") ?? "";
      const isDeclaredContinuous = channel
        .split(/\s+/)
        .some((token) => token.startsWith("continuous:"));
      if (!isDeclaredContinuous) continue;
      const pseudoElement =
        effect instanceof KeyframeEffect
          ? effect.pseudoElement ?? undefined
          : undefined;
      const computedNames = getComputedStyle(target, pseudoElement)
        .animationName.split(",")
        .map((name) => name.trim());
      // Per-animation-name, per-OWN-target gate: this is what keeps the net
      // from over-reaching onto a sibling transient/scroll animation that
      // merely shares a multi-token owner -- getComputedStyle is read on
      // THIS animation's own target (the depth child for acquire/scroll,
      // the owner itself for breath), never on the shared owner element, so
      // a rule that never applied to this target in the first place cannot
      // spuriously "still own" it.
      if (!computedNames.includes(animationName)) {
        animation.cancel();
      }
    }
  }, [livingEnvironment, roomRootRef]);

  const districtTransitionDurationMs = useMemo(
    () =>
      resolveCxosDistrictTransitionDuration(
        definition,
        resolution.tier,
        validation.valid,
      ),
    [definition, resolution.tier, validation.valid],
  );

  const focusRoom = useCallback(() => {
    roomHeadingRef.current?.focus({ preventScroll: true });
  }, [roomHeadingRef]);

  const cancelDistrictScroll = useCallback(() => {
    if (districtScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(districtScrollFrameRef.current);
      districtScrollFrameRef.current = null;
    }
    if (districtScrollSettleFrameRef.current !== null) {
      window.cancelAnimationFrame(districtScrollSettleFrameRef.current);
      districtScrollSettleFrameRef.current = null;
    }
  }, []);

  const scheduleDistrictScroll = useCallback(
    (districtId: DistrictId) => {
      cancelDistrictScroll();
      const focusOrigin = document.activeElement;
      districtScrollFrameRef.current = window.requestAnimationFrame(() => {
        districtScrollFrameRef.current = null;
        districtScrollSettleFrameRef.current = window.requestAnimationFrame(() => {
          districtScrollSettleFrameRef.current = null;
          if (document.hidden) {
            visibilityFocusPendingRef.current = true;
            return;
          }
          if (activeDistrictRef.current !== districtId) return;
          const activeElement = document.activeElement;
          const operatorMovedFocus =
            activeElement !== focusOrigin &&
            activeElement instanceof HTMLElement &&
            activeElement !== document.body &&
            activeElement !== document.documentElement;
          if (operatorMovedFocus) return;
          const root = roomRootRef.current;
          if (!root) return;
          const district = findCxosDistrict(root, districtId);
          if (!district?.isConnected) return;
          const heading = findCxosElementById(root, `${districtId}-heading`);
          scrollCxosElementImmediately(district);
          heading?.focus({ preventScroll: true });
        });
      });
    },
    [cancelDistrictScroll, roomRootRef],
  );

  const focusDistrict = useCallback(
    (districtId: DistrictId) => {
      scheduleDistrictScroll(districtId);
    },
    [scheduleDistrictScroll],
  );

  const queueArrivalCommitFocus = useCallback(
    (options: {
      focus:
        | { kind: "room" }
        | { kind: "district"; districtId: DistrictId };
      announcement: string;
    }) => {
      arrivalCommitFocusRef.current = { key: arrivalKey, ...options };
    },
    [arrivalKey],
  );

  useLayoutEffect(() => {
    const pending = arrivalCommitFocusRef.current;
    if (!arrivalSettled || !pending || pending.key !== arrivalKey) return;

    arrivalCommitFocusRef.current = null;
    if (!documentHidden && !document.hidden) {
      const activeElement = document.activeElement;
      const operatorMovedFocus =
        activeElement instanceof HTMLElement &&
        activeElement !== document.body &&
        activeElement !== document.documentElement &&
        (activeElement === roomRootRef.current ||
          !roomRootRef.current?.contains(activeElement));

      if (!operatorMovedFocus) {
        if (pending.focus.kind === "room") focusRoom();
        else focusDistrict(pending.focus.districtId);
      }
    }
    announceRef.current(pending.announcement);
  }, [
    arrivalKey,
    arrivalSettled,
    documentHidden,
    focusDistrict,
    focusRoom,
    roomRootRef,
  ]);

  const clearDistrictTransitionFallback = useCallback(() => {
    if (districtTransitionFallbackRef.current === null) return;
    window.clearTimeout(districtTransitionFallbackRef.current);
    districtTransitionFallbackRef.current = null;
  }, []);

  const cancelDistrictFocus = useCallback(() => {
    districtCommitFocusRef.current = null;
    cancelDistrictScroll();
    if (districtFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(districtFocusFrameRef.current);
      districtFocusFrameRef.current = null;
    }
  }, [cancelDistrictScroll]);

  const scheduleDistrictFocus = useCallback(
    (districtId: DistrictId) => {
      cancelDistrictFocus();
      districtFocusFrameRef.current = window.requestAnimationFrame(() => {
        districtFocusFrameRef.current = null;
        focusDistrict(districtId);
      });
    },
    [cancelDistrictFocus, focusDistrict],
  );

  const queueDistrictCommitFocus = useCallback(
    (districtId: DistrictId, sequence: number) => {
      cancelDistrictFocus();
      districtCommitFocusRef.current = { districtId, sequence };
    },
    [cancelDistrictFocus],
  );

  useLayoutEffect(() => {
    const pending = districtCommitFocusRef.current;
    if (
      districtMode !== "chamber" ||
      chamberTransition.phase !== "settled" ||
      !pending ||
      pending.districtId !== activeDistrict ||
      pending.sequence !== chamberTransition.sequence
    ) {
      return;
    }

    districtCommitFocusRef.current = null;
    if (documentHidden || document.hidden) {
      visibilityFocusPendingRef.current = true;
      return;
    }
    focusDistrict(pending.districtId);
  }, [
    activeDistrict,
    chamberTransition.phase,
    chamberTransition.sequence,
    districtMode,
    documentHidden,
    focusDistrict,
  ]);

  const settlePendingDistrictTransition = useCallback(
    (focusDestination: boolean) => {
      const pending = chamberTransitionRef.current;
      if (pending.phase !== "passage" || !pending.targetDistrict) return;
      clearDistrictTransitionFallback();
      const destination = pending.targetDistrict;
      const settled: CxosChamberTransition<DistrictId> = {
        phase: "settled",
        sourceDistrict: destination,
        targetDistrict: null,
        direction: pending.direction,
        sequence: pending.sequence,
      };
      if (focusDestination) {
        queueDistrictCommitFocus(destination, pending.sequence);
      }
      activeDistrictRef.current = destination;
      chamberTransitionRef.current = settled;
      startTransition(() => {
        setActiveDistrict(destination);
        setChamberTransition(settled);
      });
    },
    [clearDistrictTransitionFallback, queueDistrictCommitFocus],
  );

  const completeDistrictTransition = useCallback(
    (
      event?: ReactAnimationEvent<HTMLElement>,
      expectedSequence?: number,
    ) => {
      if (event && event.currentTarget !== event.target) return;
      const pending = chamberTransitionRef.current;
      const renderedSequence = event?.currentTarget.dataset.cxosTransitionSequence;
      if (
        (expectedSequence !== undefined &&
          expectedSequence !== pending.sequence) ||
        (renderedSequence !== undefined &&
          renderedSequence !== String(pending.sequence))
      ) {
        return;
      }
      settlePendingDistrictTransition(true);
    },
    [settlePendingDistrictTransition],
  );

  useLayoutEffect(() => {
    if (
      districtMode !== "chamber" ||
      chamberTransition.phase !== "passage" ||
      !chamberTransition.targetDistrict
    ) {
      return;
    }

    clearDistrictTransitionFallback();
    const expectedSequence = chamberTransition.sequence;
    districtTransitionFallbackRef.current = window.setTimeout(() => {
      if (chamberTransitionRef.current.sequence !== expectedSequence) return;
      settlePendingDistrictTransition(true);
    }, districtTransitionDurationMs);

    return clearDistrictTransitionFallback;
  }, [
    chamberTransition.phase,
    chamberTransition.sequence,
    chamberTransition.targetDistrict,
    clearDistrictTransitionFallback,
    districtMode,
    districtTransitionDurationMs,
    settlePendingDistrictTransition,
  ]);

  useEffect(() => {
    scrollCxosWindowImmediately(0);
    const update = () => {
      const next = readCxosRuntimeCapabilities();
      setCapabilities((prev) =>
        sameCxosRuntimeCapabilities(prev, next) ? prev : next,
      );
      setCapabilitiesReady(true);
    };
    const cleanups: Array<() => void> = [];
    const cleanupMedia = () => {
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // A broken media-query implementation cannot keep the room cinematic.
        }
      });
    };
    try {
      const media = [
        window.matchMedia("(prefers-reduced-motion: reduce)"),
        window.matchMedia("(max-width: 767px)"),
        window.matchMedia("(pointer: coarse)"),
      ];
      update();
      media.forEach((query) => {
        cleanups.push(subscribeCxosMediaQuery(query, update));
      });
    } catch {
      cleanupMedia();
      setCapabilities(CONSERVATIVE_CXOS_RUNTIME_CAPABILITIES);
      setCapabilitiesReady(true);
      return;
    }
    return cleanupMedia;
  }, []);

  useEffect(() => {
    const update = () => setDocumentHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    const reset = () => {
      departureCommittedRef.current = false;
      if (departureFallbackRef.current !== null) {
        window.clearTimeout(departureFallbackRef.current);
        departureFallbackRef.current = null;
      }
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      clearDistrictTransitionFallback();
      cancelDistrictFocus();
      arrivalCommitFocusRef.current = null;
      replayFocusPendingRef.current = false;
      visibilityFocusPendingRef.current = false;
      roomRootRef.current
        ?.querySelectorAll<HTMLDetailsElement>(
          "details[data-cxos-inspection][open]",
        )
        .forEach((inspection) => inspection.removeAttribute("open"));
      const pending = chamberTransitionRef.current;
      const settled: CxosChamberTransition<DistrictId> = {
        phase: "settled",
        sourceDistrict: pending.sourceDistrict,
        targetDistrict: null,
        direction: "same",
        sequence: pending.sequence + 1,
      };
      chamberTransitionRef.current = settled;
      setChamberTransition(settled);
      setDeparting(false);
      setDetectedAttention("ambient");
      idleTrackingActiveRef.current = false;
      setIdleState("settled");
      activitySequenceRef.current += 1;
      // District identity is room-owned history, not a runtime default;
      // routeResetRef restores it instead of asserting initialDistrict here.
      routeResetRef.current?.();
    };
    const resetHiddenPage = () => {
      setDocumentHidden(true);
      reset();
    };
    const resetRestoredPage = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setDocumentHidden(document.hidden);
      reset();
    };
    window.addEventListener("pagehide", resetHiddenPage);
    window.addEventListener("pageshow", resetRestoredPage);
    return () => {
      window.removeEventListener("pagehide", resetHiddenPage);
      window.removeEventListener("pageshow", resetRestoredPage);
    };
  }, [cancelDistrictFocus, clearDistrictTransitionFallback, roomRootRef]);

  useEffect(() => {
    if ((!capabilitiesReady && validation.valid) || arrivalSettled) return;
    if (resolution.tier !== "C" && resolution.tier !== "D") return;

    if (!staticArrivalFocusRef.current) {
      staticArrivalFocusRef.current = true;
      queueArrivalCommitFocus({
        focus: { kind: "room" },
        announcement: messages.staticArrival,
      });
    }
    setArrivalSettled(true);
  }, [
    arrivalSettled,
    capabilitiesReady,
    messages.staticArrival,
    queueArrivalCommitFocus,
    resolution.tier,
    validation.valid,
  ]);

  useEffect(() => {
    if (arrivalSettled) return;
    const skipOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      queueArrivalCommitFocus({
        focus: { kind: "room" },
        announcement: messages.escapeArrival,
      });
      setArrivalSettled(true);
    };
    window.addEventListener("keydown", skipOnEscape);
    return () => window.removeEventListener("keydown", skipOnEscape);
  }, [arrivalSettled, messages.escapeArrival, queueArrivalCommitFocus]);

  useEffect(() => {
    if (districtMode === "chamber" || !environment.scrollActivation) return;
    const root = roomRootRef.current;
    if (!root) return;
    const visibility = new Map<DistrictId, number>();
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-cxos-district]"),
    );
    if (sections.length === 0 || typeof IntersectionObserver === "undefined") {
      return;
    }

    let observer: IntersectionObserver;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = entry.target.getAttribute(
              "data-cxos-district",
            ) as DistrictId | null;
            if (!id || !definition.districts.includes(id)) continue;
            visibility.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
          }
          setActiveDistrict((current) =>
            selectCxosActiveDistrict(definition.districts, visibility, current),
          );
        },
        {
          rootMargin: "-18% 0px -56% 0px",
          threshold: [0, 0.01, 0.08, 0.24, 0.5],
        },
      );
    } catch {
      setCapabilities((current) => ({
        ...current,
        intersectionObserver: false,
      }));
      return;
    }

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [
    definition.districts,
    districtMode,
    environment.scrollActivation,
    observerKey,
    roomRootRef,
  ]);

  useEffect(() => {
    activeDistrictRef.current = activeDistrict;
  }, [activeDistrict]);

  // Adjusted during rendering (React's documented pattern for deriving state
  // from a prop change without a visible lag: see "Storing information from
  // previous renders" in the useState docs), NOT via a useEffect. An effect
  // runs after commit/paint, so for exactly one already-painted frame on
  // EVERY district change (not only entry into a held district)
  // kaiContextDistrict still held the PREVIOUS chamber while activeDistrict
  // had already moved to the new one, making KaiContextSpine's
  // carriedContext read true and render an extra "CARRIED CONTEXT ·
  // [previous chamber]" line -- a real, painted, then-reverted height
  // change on .kaiContext, observed as a genuine (if small) per-navigation
  // layout shift once the larger passage/masthead max-height shift (fixed
  // separately) stopped dominating every phase's CLS budget on its own.
  // Adjusting synchronously here means React redoes the render with the
  // correct value before anything commits, so the incorrect intermediate
  // state is never painted. kaiContextHoldDistricts' actual behavior
  // (kai-suite intentionally keeps showing the prior chamber's line) is
  // unchanged -- this only removes the one-frame lag for every OTHER
  // transition, which was never supposed to carry context at all.
  if (
    lastActiveDistrictForKaiContextRef.current !== activeDistrict &&
    !(definition.kaiContextHoldDistricts ?? []).includes(activeDistrict)
  ) {
    lastActiveDistrictForKaiContextRef.current = activeDistrict;
    setKaiContextDistrict(activeDistrict);
  }

  useEffect(() => {
    if (resolution.tier !== "D") return;
    return acquireCxosInstantScroll();
  }, [resolution.tier]);

  useEffect(() => {
    if (!replayFocusPendingRef.current) return;
    replayFocusPendingRef.current = false;
    focusRoom();
    scrollCxosWindowImmediately(0);
  }, [arrivalKey, focusRoom]);

  const settleArrival = useCallback(
    (options: {
      focus:
        | { kind: "room" }
        | { kind: "district"; districtId: DistrictId };
      announcement: string;
    }) => {
      queueArrivalCommitFocus(options);
      setArrivalSettled(true);
    },
    [queueArrivalCommitFocus],
  );

  const replayArrival = useCallback((announcement: string) => {
    arrivalCommitFocusRef.current = null;
    replayFocusPendingRef.current = true;
    setArrivalSettled(false);
    setArrivalKey((key) => key + 1);
    announceRef.current(announcement);
  }, []);

  const moveToDistrict = useCallback(
    (districtId: DistrictId, options?: { immediate?: boolean }) => {
      if (!definition.districts.includes(districtId)) return;

      if (districtMode === "flow") {
        activeDistrictRef.current = districtId;
        setActiveDistrict(districtId);
        focusDistrict(districtId);
        return;
      }

      clearDistrictTransitionFallback();
      cancelDistrictFocus();
      const sourceDistrict = activeDistrictRef.current;
      const sequence = chamberTransitionRef.current.sequence + 1;
      const direction = resolveCxosDistrictTransitionDirection(
        definition.districts,
        sourceDistrict,
        districtId,
      );

      if (districtId === sourceDistrict) {
        const settled: CxosChamberTransition<DistrictId> = {
          phase: "settled",
          sourceDistrict,
          targetDistrict: null,
          direction: "same",
          sequence,
        };
        chamberTransitionRef.current = settled;
        setChamberTransition(settled);
        if (documentHidden || document.hidden) {
          visibilityFocusPendingRef.current = true;
        } else {
          focusDistrict(sourceDistrict);
        }
        return;
      }

      const immediate =
        options?.immediate === true ||
        !capabilitiesReady ||
        !validation.valid ||
        resolution.tier === "C" ||
        resolution.tier === "D" ||
        documentHidden ||
        document.hidden;

      if (immediate) {
        const settled: CxosChamberTransition<DistrictId> = {
          phase: "settled",
          sourceDistrict: districtId,
          targetDistrict: null,
          direction,
          sequence,
        };
        if (documentHidden || document.hidden) {
          visibilityFocusPendingRef.current = true;
        } else {
          queueDistrictCommitFocus(districtId, sequence);
        }
        activeDistrictRef.current = districtId;
        chamberTransitionRef.current = settled;
        setActiveDistrict(districtId);
        setChamberTransition(settled);
        return;
      }

      const passage: CxosChamberTransition<DistrictId> = {
        phase: "passage",
        sourceDistrict,
        targetDistrict: districtId,
        direction,
        sequence,
      };
      chamberTransitionRef.current = passage;
      startTransition(() => {
        setChamberTransition(passage);
      });
    },
    [
      cancelDistrictFocus,
      capabilitiesReady,
      clearDistrictTransitionFallback,
      definition.districts,
      districtMode,
      documentHidden,
      focusDistrict,
      queueDistrictCommitFocus,
      resolution.tier,
      validation.valid,
    ],
  );

  useEffect(() => {
    if (districtMode !== "chamber") return;
    if (!documentHidden && visibilityFocusPendingRef.current) {
      visibilityFocusPendingRef.current = false;
      scheduleDistrictFocus(activeDistrictRef.current);
      return;
    }
    if (chamberTransition.phase !== "passage") return;
    if (documentHidden) {
      visibilityFocusPendingRef.current = true;
      settlePendingDistrictTransition(false);
      return;
    }
    if (
      !validation.valid ||
      resolution.tier === "C" ||
      resolution.tier === "D"
    ) {
      settlePendingDistrictTransition(true);
    }
  }, [
    chamberTransition.phase,
    districtMode,
    documentHidden,
    resolution.tier,
    scheduleDistrictFocus,
    settlePendingDistrictTransition,
    validation.valid,
  ]);

  const commitDeparture = useCallback(() => {
    if (!departureCommittedRef.current) return;
    departureCommittedRef.current = false;
    if (departureFallbackRef.current !== null) {
      window.clearTimeout(departureFallbackRef.current);
      departureFallbackRef.current = null;
    }
    window.location.assign(definition.departure.href);
  }, [definition.departure.href]);

  const beginDeparture = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      if (!isPlainPrimaryAnchorClick(event)) return false;
      if (
        !validation.valid ||
        resolution.tier === "C" ||
        resolution.tier === "D"
      ) {
        return false;
      }
      event.preventDefault();
      if (departureCommittedRef.current) return true;
      clearDistrictTransitionFallback();
      cancelDistrictFocus();
      const pending = chamberTransitionRef.current;
      if (pending.phase === "passage") {
        const settled: CxosChamberTransition<DistrictId> = {
          phase: "settled",
          sourceDistrict: pending.sourceDistrict,
          targetDistrict: null,
          direction: "same",
          sequence: pending.sequence + 1,
        };
        chamberTransitionRef.current = settled;
        setChamberTransition(settled);
      }
      departureCommittedRef.current = true;
      setDeparting(true);
      if (departureFallbackRef.current !== null) {
        window.clearTimeout(departureFallbackRef.current);
      }
      departureFallbackRef.current = window.setTimeout(
        commitDeparture,
        definition.departure.fallbackMs,
      );
      announceRef.current(messages.departure);
      return true;
    },
    [
      cancelDistrictFocus,
      clearDistrictTransitionFallback,
      commitDeparture,
      definition.departure.fallbackMs,
      messages.departure,
      resolution.tier,
      validation.valid,
    ],
  );

  const completeDeparture = useCallback(
    (event: ReactAnimationEvent<HTMLElement>) => {
      if (event.currentTarget !== event.target) return;
      commitDeparture();
    },
    [commitDeparture],
  );

  useEffect(
    () => () => {
      if (departureFallbackRef.current !== null) {
        window.clearTimeout(departureFallbackRef.current);
      }
      arrivalCommitFocusRef.current = null;
      clearDistrictTransitionFallback();
      cancelDistrictFocus();
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    },
    [cancelDistrictFocus, clearDistrictTransitionFallback],
  );

  const arrivalDurationMs =
    resolution.tier === "A"
      ? definition.arrivalDurationMs.A
      : resolution.tier === "B"
        ? definition.arrivalDurationMs.B
        : 0;

  const attributes = {
    "data-cxos-runtime": environment.contract,
    "data-cxos-runtime-version": CXOS_CORE_RUNTIME_VERSION,
    "data-cxos-room": definition.roomId,
    "data-cxos-district-mode": districtMode,
    "data-cxos-district-transition": chamberTransition.phase,
    "data-cxos-district-direction": chamberTransition.direction,
    "data-cxos-district-transition-ms": districtTransitionDurationMs,
    "data-cxos-arrival-beats": definition.arrivalBeats.join(" "),
    "data-cxos-arrival-duration-ms": arrivalDurationMs,
    // RC2 WP-FIX2 (F7): rootMotionChannels, when a room supplies it, is the
    // real per-surface "<class>:<name>" token vocabulary (see lib/cxos/
    // runtime.ts's CxosRoomRuntimeDefinition comment); motionChannels
    // remains the fallback for a room that omits it.
    "data-cxos-motion-channels": (
      definition.rootMotionChannels ?? definition.motionChannels
    ).join(" "),
    "data-cxos-phase": environment.phase,
    "data-cxos-motion": environment.motion,
    "data-cxos-heartbeat": environment.heartbeat,
    "data-cxos-lighting": environment.lighting,
    "data-cxos-atmosphere": environment.atmosphere,
    "data-cxos-kai-presence": environment.kaiPresence,
    "data-cxos-tier": resolution.tier,
    // Undefined optional values are omitted by React. Invalid or legacy room
    // contracts therefore cannot accidentally opt into Living Environment CSS.
    "data-cxos-environment": livingEnvironment?.profileId,
    "data-cxos-profile": livingEnvironment?.chamber.id,
    "data-cxos-camera": livingEnvironment?.chamber.camera,
    "data-cxos-light": livingEnvironment?.chamber.lighting,
    "data-cxos-depth": livingEnvironment?.chamber.depth,
    "data-cxos-signature": livingEnvironment?.chamber.motion,
    "data-cxos-focus": livingEnvironment?.chamber.focus,
    "data-cxos-attention": livingEnvironment?.attention,
    "data-cxos-kai": livingEnvironment?.kai,
    "data-cxos-idle": livingEnvironment?.idle,
    "data-cxos-environment-motion": livingEnvironment?.motion,
    "data-cxos-animation-budget": livingEnvironment?.continuousAnimationBudget,
  } as const;

  return {
    validation,
    capabilities,
    capabilitiesReady,
    resolution,
    environment,
    livingEnvironment,
    attention,
    idleState: livingEnvironment?.idle ?? "settled",
    attributes,
    arrivalBeats: definition.arrivalBeats,
    arrivalDurationMs,
    motionChannels: definition.motionChannels,
    arrivalKey,
    arrivalSettled,
    activeDistrict,
    chamberTransition,
    districtTransitionDurationMs,
    kaiContextDistrict,
    documentHidden,
    departing,
    setKaiContextDistrict,
    settleArrival,
    replayArrival,
    moveToDistrict,
    completeDistrictTransition,
    beginDeparture,
    completeDeparture,
  };
}
