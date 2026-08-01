"use client";

import {
  useCallback,
  useEffect,
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
  resolveCxosRuntimeProjection,
  selectCxosActiveDistrict,
  validateCxosRoomRuntime,
  type CxosDistrictTransitionDirection,
  type CxosExperienceProjection,
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
    window.requestAnimationFrame(release);
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
  const [documentHidden, setDocumentHidden] = useState(false);
  const [departing, setDeparting] = useState(false);

  const replayFocusPendingRef = useRef(false);
  const staticArrivalFocusRef = useRef(false);
  const departureCommittedRef = useRef(false);
  const departureFallbackRef = useRef<number | null>(null);
  const activeDistrictRef = useRef<DistrictId>(definition.initialDistrict);
  const chamberTransitionRef = useRef<CxosChamberTransition<DistrictId>>(
    chamberTransition,
  );
  const districtTransitionFallbackRef = useRef<number | null>(null);
  const districtFocusFrameRef = useRef<number | null>(null);
  const visibilityFocusPendingRef = useRef(false);
  const announceRef = useRef(announce);
  const routeResetRef = useRef(onRouteReset);
  const districtMode = definition.districtMode ?? "flow";

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

  const focusDistrict = useCallback(
    (districtId: DistrictId) => {
      const root = roomRootRef.current;
      if (!root) return;
      const district = findCxosDistrict(root, districtId);
      const heading = findCxosElementById(root, `${districtId}-heading`);
      heading?.focus({ preventScroll: true });
      if (district) scrollCxosElementImmediately(district);
    },
    [roomRootRef],
  );

  const clearDistrictTransitionFallback = useCallback(() => {
    if (districtTransitionFallbackRef.current === null) return;
    window.clearTimeout(districtTransitionFallbackRef.current);
    districtTransitionFallbackRef.current = null;
  }, []);

  const cancelDistrictFocus = useCallback(() => {
    if (districtFocusFrameRef.current === null) return;
    window.cancelAnimationFrame(districtFocusFrameRef.current);
    districtFocusFrameRef.current = null;
  }, []);

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
      activeDistrictRef.current = destination;
      chamberTransitionRef.current = settled;
      setActiveDistrict(destination);
      setChamberTransition(settled);
      if (focusDestination) scheduleDistrictFocus(destination);
    },
    [clearDistrictTransitionFallback, scheduleDistrictFocus],
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

  useEffect(() => {
    scrollCxosWindowImmediately(0);
    const update = () => {
      setCapabilities(readCxosRuntimeCapabilities());
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
      clearDistrictTransitionFallback();
      cancelDistrictFocus();
      visibilityFocusPendingRef.current = false;
      const sequence = chamberTransitionRef.current.sequence + 1;
      const settled: CxosChamberTransition<DistrictId> = {
        phase: "settled",
        sourceDistrict: definition.initialDistrict,
        targetDistrict: null,
        direction: "same",
        sequence,
      };
      activeDistrictRef.current = definition.initialDistrict;
      chamberTransitionRef.current = settled;
      setActiveDistrict(definition.initialDistrict);
      setChamberTransition(settled);
      setDeparting(false);
      setKaiContextDistrict(definition.initialDistrict);
      routeResetRef.current?.();
    };
    const resetRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener("pagehide", reset);
    window.addEventListener("pageshow", resetRestoredPage);
    return () => {
      window.removeEventListener("pagehide", reset);
      window.removeEventListener("pageshow", resetRestoredPage);
    };
  }, [
    cancelDistrictFocus,
    clearDistrictTransitionFallback,
    definition.initialDistrict,
  ]);

  useEffect(() => {
    if ((!capabilitiesReady && validation.valid) || arrivalSettled) return;
    if (resolution.tier !== "C" && resolution.tier !== "D") return;

    setArrivalSettled(true);
    if (!staticArrivalFocusRef.current) {
      staticArrivalFocusRef.current = true;
      window.requestAnimationFrame(() => {
        focusRoom();
        announceRef.current(messages.staticArrival);
      });
    }
  }, [
    arrivalSettled,
    capabilitiesReady,
    focusRoom,
    messages.staticArrival,
    resolution.tier,
    validation.valid,
  ]);

  useEffect(() => {
    if (arrivalSettled) return;
    const skipOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setArrivalSettled(true);
      window.requestAnimationFrame(() => {
        focusRoom();
        announceRef.current(messages.escapeArrival);
      });
    };
    window.addEventListener("keydown", skipOnEscape);
    return () => window.removeEventListener("keydown", skipOnEscape);
  }, [arrivalSettled, focusRoom, messages.escapeArrival]);

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

  useEffect(() => {
    if (!(definition.kaiContextHoldDistricts ?? []).includes(activeDistrict)) {
      setKaiContextDistrict(activeDistrict);
    }
  }, [activeDistrict, definition.kaiContextHoldDistricts]);

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
      setArrivalSettled(true);
      window.requestAnimationFrame(() => {
        if (options.focus.kind === "room") focusRoom();
        else focusDistrict(options.focus.districtId);
        announceRef.current(options.announcement);
      });
    },
    [focusDistrict, focusRoom],
  );

  const replayArrival = useCallback((announcement: string) => {
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
          scheduleDistrictFocus(sourceDistrict);
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
        activeDistrictRef.current = districtId;
        chamberTransitionRef.current = settled;
        setActiveDistrict(districtId);
        setChamberTransition(settled);
        if (documentHidden || document.hidden) {
          visibilityFocusPendingRef.current = true;
        } else {
          scheduleDistrictFocus(districtId);
        }
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
      setChamberTransition(passage);
      districtTransitionFallbackRef.current = window.setTimeout(
        (expectedSequence: number) => {
          if (chamberTransitionRef.current.sequence !== expectedSequence) return;
          settlePendingDistrictTransition(true);
        },
        districtTransitionDurationMs,
        sequence,
      );
    },
    [
      cancelDistrictFocus,
      capabilitiesReady,
      clearDistrictTransitionFallback,
      definition.districts,
      districtMode,
      districtTransitionDurationMs,
      documentHidden,
      focusDistrict,
      resolution.tier,
      scheduleDistrictFocus,
      settlePendingDistrictTransition,
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
      clearDistrictTransitionFallback();
      cancelDistrictFocus();
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
    "data-cxos-motion-channels": definition.motionChannels.join(" "),
    "data-cxos-phase": environment.phase,
    "data-cxos-motion": environment.motion,
    "data-cxos-heartbeat": environment.heartbeat,
    "data-cxos-lighting": environment.lighting,
    "data-cxos-atmosphere": environment.atmosphere,
    "data-cxos-kai-presence": environment.kaiPresence,
  } as const;

  return {
    validation,
    capabilities,
    capabilitiesReady,
    resolution,
    environment,
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
