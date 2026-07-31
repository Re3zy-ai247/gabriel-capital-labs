"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./agency-command.module.css";
import {
  AGENCY_BOTTLENECKS,
  AGENCY_EVIDENCE_FIELD,
  AGENCY_FIXTURE_STATES,
  AGENCY_HEARTBEAT_SIGNALS,
  AGENCY_HEALTH_DRIVERS,
  AGENCY_KAI_NOTE_SEED,
  AGENCY_KAI_WORKFLOWS,
  AGENCY_PORTFOLIO,
  AGENCY_QUEUE,
  AGENCY_QUEUE_FILTERS,
  AGENCY_TEAM_SPECIMEN,
  AGENCY_WORKLOAD_FIELD,
  type AgencyFixtureState,
  type AgencyQueueItem,
  type AgencyQueueKind,
  type KaiWorkflowId,
} from "./fixtures";

type ExperienceProjection = "auto" | "cinematic" | "static";
type OperatingModel = "solo" | "team";
type ExperienceTier = "A" | "B" | "C" | "D";
type QueueFilter = "all" | AgencyQueueKind;

const DEFAULT_KAI_WORKFLOW: KaiWorkflowId = "activity-summary";

interface ReviewCapabilities {
  browserReduced: boolean;
  saveData: boolean;
  lowMemory: boolean;
  mobile: boolean;
  coarsePointer: boolean;
  detectionFailed: boolean;
}

interface ProjectionResolution {
  tier: ExperienceTier;
  reason: string;
  cinematicAvailable: boolean;
}

const CONSERVATIVE_CAPABILITIES: ReviewCapabilities = {
  browserReduced: false,
  saveData: false,
  lowMemory: false,
  mobile: false,
  coarsePointer: false,
  detectionFailed: true,
};

function readReviewCapabilities(): ReviewCapabilities {
  try {
    const browserReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };

    return {
      browserReduced,
      saveData: nav.connection?.saveData === true,
      lowMemory:
        typeof nav.deviceMemory === "number" && nav.deviceMemory < 4,
      mobile,
      coarsePointer,
      detectionFailed: false,
    };
  } catch {
    return CONSERVATIVE_CAPABILITIES;
  }
}

function resolveProjection(
  projection: ExperienceProjection,
  capabilities: ReviewCapabilities,
  reducedMotionOverride: boolean
): ProjectionResolution {
  const constrained =
    capabilities.detectionFailed ||
    capabilities.saveData ||
    capabilities.lowMemory;

  if (projection === "static") {
    return {
      tier: "D",
      reason: "Complete static review document",
      cinematicAvailable: !constrained,
    };
  }

  if (constrained) {
    return {
      tier: "C",
      reason: capabilities.detectionFailed
        ? "Capability detection failed safely"
        : capabilities.saveData
          ? "Data Saver keeps the review conservative"
          : "Low-memory safety keeps the review conservative",
      cinematicAvailable: false,
    };
  }

  if (
    capabilities.browserReduced &&
    !(projection === "cinematic" && reducedMotionOverride)
  ) {
    return {
      tier: "D",
      reason: "Browser requests reduced motion",
      cinematicAvailable: true,
    };
  }

  if (capabilities.mobile || capabilities.coarsePointer) {
    return {
      tier: "B",
      reason:
        projection === "cinematic"
          ? "Explicit single-plane review cinema"
          : "Single-plane mobile or coarse-pointer projection",
      cinematicAvailable: true,
    };
  }

  return {
    tier: "A",
    reason:
      projection === "cinematic"
        ? "Explicit full review cinema"
        : "Full desktop or tablet projection",
    cinematicAvailable: true,
  };
}

function stateLabel(state: AgencyFixtureState): string {
  return (
    AGENCY_FIXTURE_STATES.find((option) => option.key === state)?.label ??
    state
  );
}

function scrollWindowImmediately(top: number, left = 0) {
  const root = document.documentElement;
  const previousValue = root.style.getPropertyValue("scroll-behavior");
  const previousPriority = root.style.getPropertyPriority("scroll-behavior");
  root.style.setProperty("scroll-behavior", "auto", "important");
  window.scrollTo({
    top: window.scrollY,
    left: window.scrollX,
    behavior: "instant",
  });
  window.scrollTo({ top, left, behavior: "instant" });
  window.requestAnimationFrame(() => {
    if (previousValue) {
      root.style.setProperty(
        "scroll-behavior",
        previousValue,
        previousPriority
      );
    } else {
      root.style.removeProperty("scroll-behavior");
    }
  });
}

export function AgencyCommandStage() {
  const [projection, setProjection] =
    useState<ExperienceProjection>("auto");
  const [operatingModel, setOperatingModel] =
    useState<OperatingModel>("solo");
  const [fixtureState, setFixtureState] =
    useState<AgencyFixtureState>("populated");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [expandedQueueId, setExpandedQueueId] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [arrivalKey, setArrivalKey] = useState(0);
  const [arrivalSettled, setArrivalSettled] = useState(false);
  const [activeKaiWorkflow, setActiveKaiWorkflow] =
    useState<KaiWorkflowId>(DEFAULT_KAI_WORKFLOW);
  const [preparedKaiWorkflow, setPreparedKaiWorkflow] =
    useState<KaiWorkflowId | null>(DEFAULT_KAI_WORKFLOW);
  const [kaiNoteDraft, setKaiNoteDraft] = useState(AGENCY_KAI_NOTE_SEED);
  const [departing, setDeparting] = useState(false);
  const [capabilities, setCapabilities] = useState<ReviewCapabilities>(
    CONSERVATIVE_CAPABILITIES
  );
  const [reducedMotionOverride, setReducedMotionOverride] = useState(false);
  const [cinematicPromptOpen, setCinematicPromptOpen] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "Agency Command synthetic review loaded."
  );

  const roomHeadingRef = useRef<HTMLHeadingElement>(null);
  const stateHeadingRef = useRef<HTMLHeadingElement>(null);
  const directorRef = useRef<HTMLDetailsElement>(null);
  const directorSummaryRef = useRef<HTMLElement>(null);
  const replayFocusPendingRef = useRef(false);
  const capabilitiesHydratedRef = useRef(false);
  const previousReducedMotionRef = useRef<boolean | null>(null);
  const departureCommittedRef = useRef(false);
  const returnFallbackRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => setCapabilities(readReviewCapabilities());
    const media = [
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      window.matchMedia("(max-width: 767px)"),
      window.matchMedia("(pointer: coarse)"),
    ];

    update();
    media.forEach((query) => query.addEventListener("change", update));
    return () =>
      media.forEach((query) => query.removeEventListener("change", update));
  }, []);

  useEffect(() => {
    const update = () => setDocumentHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(
    () => () => {
      if (returnFallbackRef.current !== null) {
        window.clearTimeout(returnFallbackRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (capabilities.detectionFailed) return;

    const previous = previousReducedMotionRef.current;
    const current = capabilities.browserReduced;

    if (!capabilitiesHydratedRef.current) {
      capabilitiesHydratedRef.current = true;
      previousReducedMotionRef.current = current;
      return;
    }

    previousReducedMotionRef.current = current;
    if (previous === current) return;

    setCinematicPromptOpen(false);
    setReducedMotionOverride(false);
    if (current && projection === "cinematic") {
      setProjection("static");
      setAnnouncement(
        "Browser reduced motion became active. Static projection restored; select Cinematic again to review the confirmation."
      );
    } else {
      setAnnouncement(
        "Browser reduced-motion preference changed. Any route-instance override was cleared."
      );
    }
  }, [
    capabilities.browserReduced,
    capabilities.detectionFailed,
    projection,
  ]);

  const resolution = useMemo(
    () =>
      resolveProjection(
        projection,
        capabilities,
        reducedMotionOverride
      ),
    [capabilities, projection, reducedMotionOverride]
  );

  useEffect(() => {
    if (resolution.tier !== "D") return;

    const root = document.documentElement;
    const previousValue = root.style.getPropertyValue("scroll-behavior");
    const previousPriority = root.style.getPropertyPriority("scroll-behavior");
    root.style.setProperty("scroll-behavior", "auto", "important");

    return () => {
      if (previousValue) {
        root.style.setProperty(
          "scroll-behavior",
          previousValue,
          previousPriority
        );
      } else {
        root.style.removeProperty("scroll-behavior");
      }
    };
  }, [resolution.tier]);

  useEffect(() => {
    if (!replayFocusPendingRef.current) return;
    replayFocusPendingRef.current = false;
    roomHeadingRef.current?.focus({ preventScroll: true });
    scrollWindowImmediately(0);
    setAnnouncement(`Arrival replayed in Tier ${resolution.tier}.`);
  }, [arrivalKey, resolution.tier]);

  const capacity =
    fixtureState === "capacity"
      ? { active: 15, limit: 15 }
      : fixtureState === "empty"
        ? { active: 0, limit: 15 }
        : { active: 12, limit: 15 };

  const visibleQueue = useMemo(() => {
    const source =
      fixtureState === "unavailable" || fixtureState === "error"
        ? AGENCY_QUEUE.slice(0, 2)
        : AGENCY_QUEUE;
    return queueFilter === "all"
      ? source
      : source.filter((item) => item.kind === queueFilter);
  }, [fixtureState, queueFilter]);

  const visiblePortfolio =
    fixtureState === "empty"
      ? []
      : fixtureState === "unavailable" || fixtureState === "error"
        ? AGENCY_PORTFOLIO.slice(0, 2)
        : AGENCY_PORTFOLIO;

  const closeDirectorAndRestoreFocus = (message: string) => {
    const scrollTop = window.scrollY;
    directorRef.current?.removeAttribute("open");
    window.requestAnimationFrame(() => {
      directorSummaryRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: scrollTop, left: 0, behavior: "auto" });
      setAnnouncement(message);
    });
  };

  const applyProjection = (next: ExperienceProjection) => {
    if (next === "cinematic" && !resolution.cinematicAvailable) {
      setCinematicPromptOpen(false);
      closeDirectorAndRestoreFocus(
        "Cinematic projection is unavailable on this constrained device. The conservative projection remains active."
      );
      return;
    }

    if (
      next === "cinematic" &&
      capabilities.browserReduced &&
      !reducedMotionOverride
    ) {
      setCinematicPromptOpen(true);
      setAnnouncement(
        "Cinematic review needs confirmation because the browser requests reduced motion."
      );
      return;
    }

    setProjection(next);
    if (next !== "cinematic") setReducedMotionOverride(false);
    setCinematicPromptOpen(false);
    closeDirectorAndRestoreFocus(`${next} experience projection selected.`);
  };

  const forceCinematicForReview = () => {
    setReducedMotionOverride(true);
    setProjection("cinematic");
    setCinematicPromptOpen(false);
    closeDirectorAndRestoreFocus(
      "Cinematic projection selected for this review instance only."
    );
  };

  const keepReducedMotion = () => {
    setReducedMotionOverride(false);
    setProjection("static");
    setCinematicPromptOpen(false);
    closeDirectorAndRestoreFocus(
      "Static projection retained. Browser settings were not changed."
    );
  };

  const applyOperatingModel = (next: OperatingModel) => {
    setOperatingModel(next);
    closeDirectorAndRestoreFocus(
      next === "team"
        ? "Synthetic Team Specimen selected."
        : "Solo Agency projection selected."
    );
  };

  const applyFixtureState = (next: AgencyFixtureState) => {
    setFixtureState(next);
    setQueueFilter("all");
    setExpandedQueueId(null);
    setIntakeOpen(false);
    setActiveKaiWorkflow(DEFAULT_KAI_WORKFLOW);
    setPreparedKaiWorkflow(DEFAULT_KAI_WORKFLOW);
    setKaiNoteDraft(AGENCY_KAI_NOTE_SEED);
    closeDirectorAndRestoreFocus(`${stateLabel(next)} fixture state selected.`);
  };

  const selectKaiWorkflow = (next: KaiWorkflowId) => {
    setActiveKaiWorkflow(next);
    setPreparedKaiWorkflow(null);
    const workflow = AGENCY_KAI_WORKFLOWS.find((item) => item.id === next);
    setAnnouncement(
      `${workflow?.label ?? next} synthetic workflow selected. No action has been prepared or saved.`
    );
  };

  const prepareKaiWorkflow = () => {
    setPreparedKaiWorkflow(activeKaiWorkflow);
    const workflow = AGENCY_KAI_WORKFLOWS.find(
      (item) => item.id === activeKaiWorkflow
    );
    setAnnouncement(
      `${workflow?.label ?? activeKaiWorkflow} preview prepared. Nothing was saved, sent, scheduled, assigned, or changed.`
    );
  };

  const updateKaiNoteDraft = (value: string) => {
    setKaiNoteDraft(value);
    setPreparedKaiWorkflow(null);
    setAnnouncement(
      "Synthetic note draft changed in this route instance. Nothing was saved."
    );
  };

  const resetKaiWorkbench = () => {
    setActiveKaiWorkflow(DEFAULT_KAI_WORKFLOW);
    setPreparedKaiWorkflow(DEFAULT_KAI_WORKFLOW);
    setKaiNoteDraft(AGENCY_KAI_NOTE_SEED);
    setAnnouncement(
      "Synthetic Kai workbench reset to the deterministic activity summary."
    );
  };

  const toggleIntakeHandoff = () => {
    const nextOpen = !intakeOpen;
    setIntakeOpen(nextOpen);
    setAnnouncement(
      nextOpen
        ? "Synthetic intake handoff opened. No information is collected."
        : "Synthetic intake handoff closed."
    );

    if (nextOpen) {
      window.requestAnimationFrame(() => {
        const handoff = document.getElementById("synthetic-intake-handoff");
        handoff?.focus({ preventScroll: true });
        handoff?.scrollIntoView({ block: "center", behavior: "auto" });
      });
    }
  };

  const focusIntakeHandoffControl = () => {
    window.requestAnimationFrame(() => {
      const control = document.getElementById(
        "synthetic-intake-handoff-control"
      );
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({ block: "center", behavior: "auto" });
      setAnnouncement(
        "Synthetic intake handoff control focused. No information is collected."
      );
    });
  };

  const replayArrival = () => {
    replayFocusPendingRef.current = true;
    setArrivalSettled(false);
    setArrivalKey((key) => key + 1);
    directorRef.current?.removeAttribute("open");
  };

  const settleArrival = () => {
    if (!arrivalSettled) setArrivalSettled(true);
  };

  const focusResponseQueue = () => {
    setQueueFilter("responses");
    setExpandedQueueId("response-014");
    window.requestAnimationFrame(() => {
      const control = document.getElementById("queue-inspect-response-014");
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({ block: "center", behavior: "auto" });
      setAnnouncement(
        "Response queue focused. One synthetic response specimen is expanded."
      );
    });
  };

  const focusAvailableQueue = () => {
    setQueueFilter("all");
    setExpandedQueueId("response-014");
    window.requestAnimationFrame(() => {
      const control = document.getElementById("queue-inspect-response-014");
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({ block: "center", behavior: "auto" });
      setAnnouncement(
        "Available synthetic source focused. Unavailable sources remain labeled."
      );
    });
  };

  const restorePopulatedFixture = () => {
    setFixtureState("populated");
    setQueueFilter("all");
    setExpandedQueueId(null);
    setActiveKaiWorkflow(DEFAULT_KAI_WORKFLOW);
    setPreparedKaiWorkflow(DEFAULT_KAI_WORKFLOW);
    setKaiNoteDraft(AGENCY_KAI_NOTE_SEED);
    closeDirectorAndRestoreFocus("Populated synthetic fixture restored.");
  };

  const commitMissionControlReturn = () => {
    if (!departureCommittedRef.current) return;
    departureCommittedRef.current = false;
    if (returnFallbackRef.current !== null) {
      window.clearTimeout(returnFallbackRef.current);
      returnFallbackRef.current = null;
    }
    window.location.assign("/review/mission-control");
  };

  const beginMissionControlReturn = (
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    if (resolution.tier === "C" || resolution.tier === "D") return;
    event.preventDefault();
    departureCommittedRef.current = true;
    setDeparting(true);
    directorRef.current?.removeAttribute("open");
    if (returnFallbackRef.current !== null) {
      window.clearTimeout(returnFallbackRef.current);
    }
    returnFallbackRef.current = window.setTimeout(
      commitMissionControlReturn,
      800
    );
    setAnnouncement(
      "Return acknowledged. Agency instruments are receding toward Mission Control."
    );
  };

  const completeMissionControlReturn = (
    event: React.AnimationEvent<HTMLDivElement>
  ) => {
    if (
      event.currentTarget !== event.target ||
      !departureCommittedRef.current
    ) {
      return;
    }
    commitMissionControlReturn();
  };

  const handleDirectorKeyDown = (
    event: React.KeyboardEvent<HTMLDetailsElement>
  ) => {
    if (event.key !== "Escape" || !directorRef.current?.open) return;
    directorRef.current.removeAttribute("open");
    directorSummaryRef.current?.focus();
    setAnnouncement("Director controls closed.");
  };

  const fixtureLabel = stateLabel(fixtureState);
  const healthStatus =
    fixtureState === "empty"
      ? "NOT RATED"
      : fixtureState === "loading"
        ? "RESOLVING"
        : fixtureState === "unavailable"
          ? "INSUFFICIENT COVERAGE"
          : fixtureState === "error"
            ? "DISPLAY ERROR"
            : fixtureState === "capacity"
              ? "AT CAPACITY"
              : "WATCH";

  return (
    <main
      id="main"
      tabIndex={-1}
      className={styles.room}
      data-tier={resolution.tier}
      data-fixture={fixtureState}
      data-hidden={documentHidden ? "true" : "false"}
      data-departing={departing ? "true" : "false"}
      data-arrival-settled={arrivalSettled ? "true" : "false"}
      data-motion-override={
        reducedMotionOverride && projection === "cinematic" ? "true" : "false"
      }
      onKeyDown={settleArrival}
      onPointerDown={settleArrival}
      onTouchStart={settleArrival}
      onWheel={settleArrival}
    >
      <div aria-hidden className={styles.gridField} />
      <div aria-hidden className={styles.overheadLight} />
      <div aria-hidden className={styles.horizon} />
      <div aria-hidden className={styles.ambientSweep} />
      <div aria-hidden className={styles.roomBreath} />
      <div
        aria-hidden
        className={styles.departureHandoff}
        onAnimationEnd={completeMissionControlReturn}
      >
        <span>MISSION CONTROL</span>
        <i />
      </div>

      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <div key={arrivalKey} className={styles.arrival}>
        <div
          aria-hidden
          className={styles.arrivalClock}
          onAnimationEnd={settleArrival}
        />
        <header className={styles.identity}>
          <div>
            <p className={styles.eyebrow}>
              Founder Review · CXOS Phase 6.1
            </p>
            <h1
              ref={roomHeadingRef}
              tabIndex={-1}
              className={styles.roomTitle}
            >
              Agency Command
            </h1>
            {fixtureState !== "permission" && (
              <p className={styles.identityLine}>
                Founder review agency ·{" "}
                {operatingModel === "solo"
                  ? "Solo Agency projection"
                  : "Team Specimen projection"}{" "}
                ·{" "}
                {fixtureState === "loading"
                  ? "capacity unresolved"
                  : `${capacity.active} / ${capacity.limit} illustrative workspaces`}
              </p>
            )}
          </div>
          <div className={styles.reviewIdentity}>
            <span>FACILITY 06</span>
            <span>AGENCY OPERATIONS</span>
          </div>
        </header>

        <div className={styles.disclosure} role="note">
          <strong>SYNTHETIC FOUNDER REVIEW</strong>
          <span>
            Illustrative data only. No customer records, live agency operations,
            billing, revenue, legal deadlines, or automated actions are
            connected.
          </span>
        </div>

        <section
          className={styles.stateBand}
          aria-labelledby="fixture-state-heading"
        >
          <h2
            id="fixture-state-heading"
            ref={stateHeadingRef}
            tabIndex={-1}
            className={styles.stateHeading}
          >
            Fixture state · {fixtureLabel}
          </h2>
          <p>
            Director controls change this display only. They do not change a
            browser setting, customer record, subscription, or product state.
          </p>
        </section>

        {fixtureState !== "permission" && (
          <ActivationRail state={fixtureState} />
        )}

        {fixtureState === "permission" ? (
          <PermissionState />
        ) : (
          <>
            <section
              className={styles.commandWall}
              aria-label="Agency operating wall"
              aria-busy={fixtureState === "loading"}
            >
              <article
                className={styles.kaiBrief}
                aria-labelledby="kai-brief-heading"
              >
                <InstrumentHeader
                  eyebrow="KAI · EXECUTIVE CHANNEL"
                  title="Executive morning brief"
                  id="kai-brief-heading"
                />
                <KaiBrief
                  state={fixtureState}
                  onFocusResponses={focusResponseQueue}
                  onFocusAvailable={focusAvailableQueue}
                  onStageIntake={focusIntakeHandoffControl}
                  onRestore={restorePopulatedFixture}
                />
                <p className={styles.receipt}>
                  SYNTHETIC FIXTURE · Suggested review only. Verify the displayed
                  source record before acting. Educational information, not legal
                  advice.
                </p>
              </article>

              <OperationalHeartbeat
                state={fixtureState}
                active={capacity.active}
                limit={capacity.limit}
              />

              {(fixtureState === "populated" ||
                fixtureState === "capacity") && (
                <KaiOperatingDesk
                  activeWorkflow={activeKaiWorkflow}
                  preparedWorkflow={preparedKaiWorkflow}
                  noteDraft={kaiNoteDraft}
                  onSelect={selectKaiWorkflow}
                  onPrepare={prepareKaiWorkflow}
                  onReset={resetKaiWorkbench}
                  onNoteChange={updateKaiNoteDraft}
                />
              )}

              {fixtureState === "loading" ? (
                <LoadingState />
              ) : fixtureState === "empty" ? (
                <EmptyState
                  intakeOpen={intakeOpen}
                  onStageIntake={toggleIntakeHandoff}
                />
              ) : (
                <>
                  {fixtureState === "unavailable" && (
                    <div className={styles.statusNotice} role="status">
                      One illustrative source is unavailable. The room preserves
                      displayed records and labels the coverage gap; it does not
                      replace missing facts with zero.
                    </div>
                  )}
                  {fixtureState === "error" && (
                    <div className={styles.errorNotice} role="alert">
                      The portfolio specimen was interrupted. Two previously
                      displayed rows remain available; no missing value is
                      guessed.
                      <button type="button" onClick={restorePopulatedFixture}>
                        Restore populated specimen
                      </button>
                    </div>
                  )}

                  <PriorityQueue
                    items={visibleQueue}
                    filter={queueFilter}
                    expandedId={expandedQueueId}
                    onFilter={(next) => {
                      setQueueFilter(next);
                      setExpandedQueueId(null);
                      setAnnouncement(
                        `${AGENCY_QUEUE_FILTERS.find((item) => item.key === next)?.label ?? next} queue filter selected.`
                      );
                    }}
                    onExpand={(id) => {
                      setExpandedQueueId((current) =>
                        current === id ? null : id
                      );
                      setAnnouncement(
                        currentExpansionMessage(expandedQueueId, id)
                      );
                    }}
                  />
                </>
              )}

              <aside
                className={styles.healthBank}
                aria-labelledby="agency-health-heading"
              >
                <InstrumentHeader
                  eyebrow="SYNTHETIC FIXTURE"
                  title="Agency health"
                  id="agency-health-heading"
                />
                <p className={styles.healthState}>{healthStatus}</p>
                {fixtureState === "loading" ? (
                  <StaticSkeleton rows={4} />
                ) : (
                  <dl className={styles.driverList}>
                    {AGENCY_HEALTH_DRIVERS[fixtureState].map((driver) => (
                      <div key={driver.label}>
                        <dt>{driver.label}</dt>
                        <dd>
                          <span>{driver.value}</span>
                          <small>{driver.note}</small>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className={styles.instrumentFootnote}>
                  Qualitative review specimen. No production scoring formula,
                  financial-health assessment, or compliance certification.
                </p>
              </aside>

              <aside
                className={styles.scopeBank}
                aria-labelledby="portfolio-scope-heading"
              >
                <InstrumentHeader
                  eyebrow="ILLUSTRATIVE SCOPE"
                  title="Portfolio scope"
                  id="portfolio-scope-heading"
                />
                {fixtureState === "loading" ? (
                  <StaticSkeleton rows={4} />
                ) : (
                  <dl className={styles.scopeList}>
                    <div>
                      <dt>Aggregate workspaces</dt>
                      <dd>{capacity.active}</dd>
                    </div>
                    <div>
                      <dt>Portfolio rows shown</dt>
                      <dd>{visiblePortfolio.length}</dd>
                    </div>
                    <div>
                      <dt>Capacity remaining</dt>
                      <dd>{Math.max(0, capacity.limit - capacity.active)}</dd>
                    </div>
                    <div>
                      <dt>Coverage</dt>
                      <dd>
                        {fixtureState === "unavailable"
                          ? "2 of 5 · partial"
                          : fixtureState === "error"
                            ? "2 of 5 · preserved"
                            : fixtureState === "empty"
                              ? "0 of 0 · empty"
                              : "5 of 5 · specimen"}
                      </dd>
                    </div>
                  </dl>
                )}
                {fixtureState === "capacity" && (
                  <p className={styles.capacityNotice}>
                    Capacity specimen reached. Existing illustrative work remains
                    available; synthetic intake is disabled.
                  </p>
                )}
                <CapacityHorizon
                  active={capacity.active}
                  limit={capacity.limit}
                  state={fixtureState}
                />
              </aside>
            </section>

            {fixtureState !== "loading" && fixtureState !== "empty" && (
              <>
                <PortfolioLedger
                  items={visiblePortfolio}
                  capacityReached={fixtureState === "capacity"}
                />

                <OperationsStation operatingModel={operatingModel} />
              </>
            )}
          </>
        )}

        <footer className={styles.footer}>
          <p>
            Phase 6.1 source is presentation-only. The live{" "}
            <code>/agency</code> surface and its APIs are unchanged.
          </p>
          <nav aria-label="Founder review navigation">
            <a href="/review">All rooms</a>
            <a
              className={styles.returnThreshold}
              href="/review/mission-control"
              onClick={beginMissionControlReturn}
            >
              <span>Return handoff</span>
              <strong>Mission Control</strong>
            </a>
          </nav>
        </footer>
      </div>

      <details
        ref={directorRef}
        className={styles.director}
        onKeyDown={handleDirectorKeyDown}
      >
        <summary ref={directorSummaryRef}>
          <span>DIRECTOR</span>
          <strong>
            {projection.toUpperCase()} · {operatingModel.toUpperCase()} ·{" "}
            {fixtureLabel.toUpperCase()}
          </strong>
        </summary>
        <div className={styles.directorPanel}>
          <div className={styles.directorStatus}>
            <span>Resolved projection</span>
            <strong>
              Tier {resolution.tier} · {resolution.reason}
            </strong>
          </div>

          <fieldset>
            <legend>Experience</legend>
            <div className={styles.controlGrid}>
              {(["auto", "cinematic", "static"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={projection === option}
                  disabled={
                    option === "cinematic" && !resolution.cinematicAvailable
                  }
                  onClick={() => applyProjection(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          {cinematicPromptOpen && (
            <div className={styles.motionPrompt} role="alert">
              <p>
                The browser requests reduced motion. Force review cinema for this
                route instance only? Browser settings will not change.
              </p>
              <div>
                <button type="button" onClick={keepReducedMotion}>
                  Keep static
                </button>
                <button
                  type="button"
                  onClick={forceCinematicForReview}
                  disabled={!resolution.cinematicAvailable}
                >
                  Force review cinema
                </button>
              </div>
            </div>
          )}

          <fieldset>
            <legend>Operating model</legend>
            <div className={styles.controlGrid}>
              {(["solo", "team"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={operatingModel === option}
                  onClick={() => applyOperatingModel(option)}
                >
                  {option === "solo" ? "Solo Agency" : "Team Specimen"}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Fixture state</legend>
            <div className={styles.stateControls}>
              {AGENCY_FIXTURE_STATES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={fixtureState === option.key}
                  onClick={() => applyFixtureState(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            className={styles.replay}
            onClick={replayArrival}
          >
            Replay room settle
          </button>
        </div>
      </details>
    </main>
  );
}

function currentExpansionMessage(
  currentId: string | null,
  nextId: string
): string {
  return currentId === nextId
    ? "Queue evidence collapsed."
    : "Queue evidence expanded.";
}

function InstrumentHeader({
  eyebrow,
  title,
  id,
}: {
  eyebrow: string;
  title: string;
  id: string;
}) {
  return (
    <div className={styles.instrumentHeader}>
      <p>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
    </div>
  );
}

function ActivationRail({ state }: { state: AgencyFixtureState }) {
  const steps =
    state === "loading"
      ? [
          ["01", "Review identity set", "Synthetic agency scope"],
          ["02", "Fixture sources unresolved", "No live connection"],
          ["03", "Capacity horizon held", "No occupancy inferred"],
          ["04", "Ledgers held", "No records asserted"],
          ["05", "Kai fixture held", "Awaiting displayed sources"],
        ]
      : [
    ["01", "Review identity set", "Synthetic agency scope"],
    ["02", "Fixture sources present", "No live connection"],
    ["03", "Capacity horizon formed", "Fixed aggregate"],
    ["04", "Ledgers ready", "Five displayed records"],
    ["05", "Kai fixture ready", "Route-instance only"],
        ];

  return (
    <ol
      className={styles.activationRail}
      aria-label="Agency Command settled activation sequence"
    >
      {steps.map(([index, label, detail]) => (
        <li key={index}>
          <span>{index}</span>
          <strong>{label}</strong>
          <small>{detail}</small>
        </li>
      ))}
    </ol>
  );
}

function CapacityHorizon({
  active,
  limit,
  state,
}: {
  active: number;
  limit: number;
  state: AgencyFixtureState;
}) {
  const unresolved = state === "loading";

  return (
    <div className={styles.capacityHorizonBlock}>
      <div className={styles.capacityHorizonHeading}>
        <span>CAPACITY HORIZON</span>
        <strong>
          {unresolved
            ? "Unresolved · no occupancy inferred"
            : `${active} occupied · ${Math.max(0, limit - active)} reserve`}
        </strong>
      </div>
      <div
        aria-hidden
        className={styles.capacityHorizon}
        data-capacity-state={state}
      >
        {!unresolved &&
          Array.from({ length: limit }, (_, index) => (
            <i key={index} data-occupied={index < active ? "true" : "false"} />
          ))}
        <b />
      </div>
      <p>
        {unresolved
          ? "Fixture sources are unresolved. The rail is held and displays no capacity value."
          : "Fifteen deterministic fixture positions. The rail does not count or mutate live workspaces."}
      </p>
    </div>
  );
}

function OperationalHeartbeat({
  state,
  active,
  limit,
}: {
  state: AgencyFixtureState;
  active: number;
  limit: number;
}) {
  const boundary =
    state === "loading"
      ? "The heartbeat is manually held while fixture sources are unresolved. No timer or simulated completion runs."
      : state === "empty"
        ? "The room is truthfully idle: no illustrative work is staged and no synthetic activity is fabricated."
        : state === "unavailable"
          ? "The available source boundary remains visible. Missing flow positions and evidence are not inferred."
          : state === "error"
            ? "The heartbeat is held at the disclosed display-error boundary. Preserved records remain readable; missing movement is not guessed."
            : null;

  return (
    <section
      className={styles.heartbeatStation}
      data-heartbeat-state={state}
      aria-labelledby="heartbeat-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stationIndex}>OPERATING HEARTBEAT</p>
          <h2 id="heartbeat-heading">The agency is breathing</h2>
        </div>
        <p>FIXED CHOREOGRAPHY · VALUES NEVER CHANGE</p>
      </div>

      <p className={styles.heartbeatDisclosure} role="note">
        DETERMINISTIC FIXTURE RHYTHM · NOT LIVE. Motion replays fixed work
        states—entering, advancing, waiting, blocked, and resolving—without
        changing a count, rank, label, record, or canonical fact.
      </p>

      {boundary ? (
        <div className={styles.heartbeatBoundary} role="status">
          <strong>{state.toUpperCase()} FIXTURE</strong>
          <p>{boundary}</p>
        </div>
      ) : (
        <div className={styles.heartbeatGrid}>
          <article
            className={styles.flowInstrument}
            aria-labelledby="client-flow-heading"
          >
            <div className={styles.instrumentTitle}>
              <div>
                <p>CLIENT FLOW RAIL</p>
                <h3 id="client-flow-heading">Five fixed work positions</h3>
              </div>
              <dl>
                <div>
                  <dt>Packets</dt>
                  <dd>5 staged</dd>
                </div>
                <div>
                  <dt>Motion-bearing</dt>
                  <dd>3 states</dd>
                </div>
                <div>
                  <dt>Throughput rate</dt>
                  <dd>Not instrumented</dd>
                </div>
              </dl>
            </div>
            <ol className={styles.flowList}>
              {AGENCY_HEARTBEAT_SIGNALS.map((signal) => (
                <li
                  key={signal.id}
                  data-motion={signal.motion}
                  data-position={signal.position}
                >
                  <div>
                    <strong>{signal.workspace}</strong>
                    <span>{signal.lane}</span>
                  </div>
                  <div className={styles.flowTrack} aria-hidden>
                    <i />
                    <b />
                  </div>
                  <div>
                    <strong>{signal.motion}</strong>
                    <span>{signal.detail}</span>
                  </div>
                </li>
              ))}
            </ol>
            <p className={styles.instrumentFootnote}>
              Positions describe this fixed specimen, not historical volume or
              a live rate.
            </p>
          </article>

          <article
            className={styles.ageInstrument}
            aria-labelledby="response-age-heading"
          >
            <div className={styles.instrumentTitle}>
              <div>
                <p>RESPONSE AGING RULER</p>
                <h3 id="response-age-heading">Oldest displayed marker</h3>
              </div>
              <strong>2 illustrative days</strong>
            </div>
            <div
              className={styles.ageRuler}
              role="img"
              aria-label="Illustrative response-age marker at two days on a zero to three-plus day ruler; this is not a legal deadline"
            >
              <span>0</span>
              <span>1</span>
              <span data-current="true">2</span>
              <span>3+</span>
              <i aria-hidden />
            </div>
            <p className={styles.instrumentFootnote}>
              Estimated fixture marker · not a legal deadline.
            </p>
          </article>

          <article
            className={styles.workloadInstrument}
            aria-labelledby="workload-heading"
          >
            <div className={styles.instrumentTitle}>
              <div>
                <p>WORK PRESSURE FIELD</p>
                <h3 id="workload-heading">Displayed queue composition</h3>
              </div>
            </div>
            <ul className={styles.workloadField}>
              {AGENCY_WORKLOAD_FIELD.map((band) => (
                <li key={band.id} data-pressure={band.pressure}>
                  <div>
                    <strong>{band.label}</strong>
                    <span>{band.detail}</span>
                  </div>
                  <div aria-hidden>
                    <i />
                  </div>
                  <small>{band.count}</small>
                </li>
              ))}
            </ul>
            <p className={styles.instrumentFootnote}>
              Queue composition, not an urgency score or team-performance rank.
            </p>
          </article>

          <article
            className={styles.evidenceInstrument}
            aria-labelledby="evidence-field-heading"
          >
            <div className={styles.instrumentTitle}>
              <div>
                <p>EVIDENCE COVERAGE RAIL</p>
                <h3 id="evidence-field-heading">Five disclosed source states</h3>
              </div>
            </div>
            <ol className={styles.evidenceField}>
              {AGENCY_EVIDENCE_FIELD.map((item) => (
                <li key={item.id} data-evidence-state={item.state}>
                  <span aria-hidden />
                  <strong>{item.workspace}</strong>
                  <small>
                    {item.state} · {item.detail}
                  </small>
                </li>
              ))}
            </ol>
          </article>

          <article
            className={styles.bottleneckInstrument}
            aria-labelledby="bottleneck-heading"
          >
            <div className={styles.instrumentTitle}>
              <div>
                <p>BOTTLENECK GATES</p>
                <h3 id="bottleneck-heading">Decisions and evidence holding flow</h3>
              </div>
              <strong>
                {active} / {limit} capacity
              </strong>
            </div>
            <ol className={styles.bottleneckList}>
              {AGENCY_BOTTLENECKS.map((item) => (
                <li key={item.id}>
                  <span>{item.state}</span>
                  <div>
                    <strong>
                      {item.label} · {item.workspace}
                    </strong>
                    <small>{item.safeReview}</small>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </div>
      )}
    </section>
  );
}

function KaiOperatingDesk({
  activeWorkflow,
  preparedWorkflow,
  noteDraft,
  onSelect,
  onPrepare,
  onReset,
  onNoteChange,
}: {
  activeWorkflow: KaiWorkflowId;
  preparedWorkflow: KaiWorkflowId | null;
  noteDraft: string;
  onSelect: (next: KaiWorkflowId) => void;
  onPrepare: () => void;
  onReset: () => void;
  onNoteChange: (value: string) => void;
}) {
  const workflow =
    AGENCY_KAI_WORKFLOWS.find((item) => item.id === activeWorkflow) ??
    AGENCY_KAI_WORKFLOWS[0];
  const prepared = preparedWorkflow === activeWorkflow;
  const atBaseline =
    activeWorkflow === DEFAULT_KAI_WORKFLOW &&
    preparedWorkflow === DEFAULT_KAI_WORKFLOW &&
    noteDraft === AGENCY_KAI_NOTE_SEED;

  return (
    <section
      className={styles.kaiDesk}
      aria-labelledby="kai-operating-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stationIndex}>KAI OPERATING PRESENCE</p>
          <h2 id="kai-operating-heading">Executive delegation console</h2>
        </div>
        <p>LOCAL SYNTHETIC PREVIEWS · OPERATOR RETAINS CONTROL</p>
      </div>

      <div className={styles.kaiPresenceRail}>
        <span>MODE · SYNTHETIC</span>
        <span>SOURCES · FIXTURE LEDGERS</span>
        <span>PERSISTENCE · OFF</span>
        <span>PRODUCTION WRITES · 0</span>
      </div>

      <div className={styles.kaiWorkbenchDisclosure} role="note">
        <strong>SYNTHETIC KAI WORKBENCH · ROUTE-INSTANCE ONLY</strong>
        <p>
          Every option below uses deterministic fictional fixtures. Selections
          and draft text remain only in this open page and are discarded on
          refresh or exit. This interface does not save notes, create reminders
          or tasks, write calendars, change customer records, contact anyone, or
          trigger production action. Do not enter real customer information.
        </p>
      </div>

      <div className={styles.kaiWorkbench}>
        <fieldset className={styles.workflowSelector}>
          <legend>Delegate a synthetic workflow</legend>
          <div>
            {AGENCY_KAI_WORKFLOWS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={activeWorkflow === option.id}
                aria-controls="kai-workflow-preview"
                onClick={() => onSelect(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <article
          id="kai-workflow-preview"
          className={styles.workflowPreview}
          aria-labelledby="kai-workflow-heading"
        >
          <p className={styles.workflowClassification}>
            {workflow.classification}
          </p>
          <h3 id="kai-workflow-heading">{workflow.label}</h3>
          <p className={styles.workflowPurpose}>{workflow.purpose}</p>
          <dl className={styles.workflowSources}>
            <div>
              <dt>Fixture sources</dt>
              <dd>{workflow.sources}</dd>
            </div>
            <div>
              <dt>Authority</dt>
              <dd>Preview only · operator review required</dd>
            </div>
          </dl>

          {activeWorkflow === "note-taking" && (
            <div className={styles.noteDraft}>
              <label htmlFor="kai-synthetic-note">
                Synthetic operator note
              </label>
              <textarea
                id="kai-synthetic-note"
                aria-describedby="kai-synthetic-note-boundary"
                value={noteDraft}
                maxLength={280}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => onNoteChange(event.target.value)}
              />
              <small id="kai-synthetic-note-boundary">
                Fixture text only · {noteDraft.length} / 280 · do not enter real
                customer information.
              </small>
            </div>
          )}

          <div className={styles.workflowActions}>
            <button
              type="button"
              onClick={onPrepare}
              disabled={prepared}
            >
              {prepared ? "Preview prepared" : workflow.actionLabel}
            </button>
            <button type="button" onClick={onReset} disabled={atBaseline}>
              {atBaseline ? "Workbench at baseline" : "Reset workbench"}
            </button>
          </div>

          <div
            className={styles.preparedArtifact}
            data-prepared={prepared ? "true" : "false"}
          >
            {prepared ? (
              <>
                <p>PREPARED SYNTHETIC ARTIFACT</p>
                {activeWorkflow === "note-taking" ? (
                  <blockquote>{noteDraft}</blockquote>
                ) : (
                  <ul>
                    {workflow.previewLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                <p className={styles.workflowReceipt}>{workflow.receipt}</p>
                <strong>
                  PREVIEW PREPARED · Nothing was saved, sent, scheduled, assigned,
                  or changed. Kai recommends; the operator reviews. Educational
                  information, not legal advice.
                </strong>
              </>
            ) : (
              <p>
                READY TO PREPARE · Review the fixture sources and activate the
                preview control. No external action is available.
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function KaiBrief({
  state,
  onFocusResponses,
  onFocusAvailable,
  onStageIntake,
  onRestore,
}: {
  state: AgencyFixtureState;
  onFocusResponses: () => void;
  onFocusAvailable: () => void;
  onStageIntake: () => void;
  onRestore: () => void;
}) {
  if (state === "loading") {
    return (
      <div className={styles.briefBody} role="status">
        <p className={styles.briefSignal}>Resolving displayed fixture sources</p>
        <p>
          This manually held loading state reserves the final command-wall
          geometry. It does not run a timer or hide the rest of the document.
        </p>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className={styles.briefBody}>
        <p className={styles.briefSignal}>No work is staged in this fixture.</p>
        <p>
          This design specimen illustrates how a future authorized first-workspace
          flow could present an operational handoff. No Phase 6 workflow is
          connected here.
        </p>
        <button type="button" onClick={onStageIntake}>
          Review synthetic intake handoff
        </button>
      </div>
    );
  }

  if (state === "unavailable") {
    return (
      <div className={styles.briefBody}>
        <p className={styles.briefSignal}>
          One source is unavailable; two displayed records remain usable.
        </p>
        <p>
          The specimen names the missing coverage and makes no claim about the
          records it cannot display.
        </p>
        <button type="button" onClick={onFocusAvailable}>
          Inspect available source
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={styles.briefBody}>
        <p className={styles.briefSignal}>
          Portfolio display interrupted; preserved rows remain visible.
        </p>
        <p>
          Restore the deterministic populated fixture when the failure treatment
          has been reviewed.
        </p>
        <button type="button" onClick={onRestore}>
          Restore populated specimen
        </button>
      </div>
    );
  }

  return (
    <div className={styles.briefBody}>
      <p className={styles.briefSignal}>
        One displayed response record needs an operator decision.
      </p>
      <p>
        Start with Client 014 because the displayed fixture contains a response
        record, mail receipt, and complete workspace coverage.
      </p>
      <button type="button" onClick={onFocusResponses}>
        Focus response queue
      </button>
    </div>
  );
}

function PermissionState() {
  return (
    <section
      className={styles.permissionState}
      aria-labelledby="permission-heading"
    >
      <p className={styles.stationIndex}>ACCESS BOUNDARY</p>
      <h2 id="permission-heading">Not found</h2>
      <div role="alert">
        The permission-denied projection reveals no agency identity, workspace,
        count, queue, team, billing, or portfolio metadata.
      </div>
      <p>
        This is a tenant-safe review specimen. No sign-in or recovery action is
        connected from this route.
      </p>
    </section>
  );
}

function LoadingState() {
  return (
    <section className={styles.loadingState} aria-labelledby="loading-heading">
      <p className={styles.stationIndex}>MANUALLY HELD FIXTURE</p>
      <h2 id="loading-heading">Command ledgers are resolving</h2>
      <p role="status">
        Loading remains visible until the Founder selects another fixture state.
        No spinner, countdown, request, or simulated completion runs.
      </p>
      <div aria-hidden className={styles.loadingLedger}>
        <StaticSkeleton rows={5} />
        <StaticSkeleton rows={4} />
      </div>
    </section>
  );
}

function EmptyState({
  intakeOpen,
  onStageIntake,
}: {
  intakeOpen: boolean;
  onStageIntake: () => void;
}) {
  return (
    <section className={styles.emptyState} aria-labelledby="empty-heading">
      <p className={styles.stationIndex}>FIRST WORKSPACE</p>
      <h2 id="empty-heading">No illustrative work is staged</h2>
      <p>
        This design specimen shows a proposed first-workspace presentation:
        portfolio row, source-coverage receipt, and review queue. No Phase 6
        intake or workspace-creation flow is connected here.
      </p>
      <button
        id="synthetic-intake-handoff-control"
        type="button"
        aria-expanded={intakeOpen}
        aria-controls="synthetic-intake-handoff"
        onClick={onStageIntake}
      >
        {intakeOpen ? "Close intake handoff" : "Stage synthetic intake handoff"}
      </button>
      <div
        id="synthetic-intake-handoff"
        tabIndex={-1}
        hidden={!intakeOpen}
      >
        <strong>DISPLAY-ONLY HANDOFF</strong>
        <p>
          In a future authorized product flow, intake would require verified
          ownership, encrypted storage, role scope, consent, and server
          validation. None of that is connected here.
        </p>
      </div>
    </section>
  );
}

function PriorityQueue({
  items,
  filter,
  expandedId,
  onFilter,
  onExpand,
}: {
  items: AgencyQueueItem[];
  filter: QueueFilter;
  expandedId: string | null;
  onFilter: (next: QueueFilter) => void;
  onExpand: (id: string) => void;
}) {
  return (
    <section className={styles.queueStation} aria-labelledby="queue-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stationIndex}>COMMAND LEDGER 01</p>
          <h2 id="queue-heading">Priority work queue</h2>
        </div>
        <p>SYNTHETIC TASK RECORDS · DISPLAY-STATE CONTROLS ONLY</p>
      </div>

      <fieldset className={styles.filters}>
        <legend>Filter illustrative work</legend>
        {AGENCY_QUEUE_FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={filter === option.key}
            onClick={() => onFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </fieldset>

      {items.length === 0 ? (
        <p className={styles.noResults}>
          No displayed records match this review filter.
        </p>
      ) : (
        <ol className={styles.queueList}>
          {items.map((item) => {
            const expanded = expandedId === item.id;
            const detailId = `queue-detail-${item.id}`;
            return (
              <li key={item.id} className={styles.queueItem}>
                <div className={styles.queueRow}>
                  <span className={styles.queueRank}>{item.rank}</span>
                  <div className={styles.queueIdentity}>
                    <strong>{item.workspace}</strong>
                    <span>{item.kind.replace("-", " ")}</span>
                  </div>
                  <div className={styles.queueReason}>
                    <strong>{item.label}</strong>
                    <span>{item.reason}</span>
                  </div>
                  <span className={styles.queueMarker}>{item.marker}</span>
                  <button
                    id={`queue-inspect-${item.id}`}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={detailId}
                    onClick={() => onExpand(item.id)}
                  >
                    {expanded ? "Close evidence" : "Inspect evidence"}
                  </button>
                </div>
                <div
                  id={detailId}
                  className={styles.queueDetail}
                  hidden={!expanded}
                >
                  <div>
                    <span>Evidence receipt</span>
                    <strong>{item.receipt}</strong>
                  </div>
                  <div>
                    <span>Suggested operator review</span>
                    <strong>{item.nextReview}</strong>
                  </div>
                  <p>
                    Synthetic fixture. No customer record or automated action is
                    connected.
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function PortfolioLedger({
  items,
  capacityReached,
}: {
  items: typeof AGENCY_PORTFOLIO;
  capacityReached: boolean;
}) {
  return (
    <section
      className={styles.portfolioStation}
      aria-labelledby="portfolio-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stationIndex}>COMMAND LEDGER 02</p>
          <h2 id="portfolio-heading">Client portfolio ledger</h2>
        </div>
        <p>ILLUSTRATIVE WORKSPACES · NO CUSTOMER DATA</p>
      </div>

      <ul className={styles.portfolioList}>
        {items.map((item) => (
          <li key={item.id}>
            <div className={styles.portfolioIdentity}>
              <strong>{item.workspace}</strong>
              <span>{item.region}</span>
            </div>
            <dl>
              <div>
                <dt>Work state</dt>
                <dd>{item.workState}</dd>
              </div>
              <div>
                <dt>Displayed items</dt>
                <dd>{item.reportedItems}</dd>
              </div>
              <div>
                <dt>Letter record</dt>
                <dd>{item.letterRecord}</dd>
              </div>
              <div>
                <dt>Latest round</dt>
                <dd>{item.latestRound}</dd>
              </div>
              <div>
                <dt>Timing</dt>
                <dd>{item.timing}</dd>
              </div>
              <div>
                <dt>Coverage</dt>
                <dd>{item.coverage}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className={styles.intakeRail}>
        <div>
          <span>SYNTHETIC INTAKE</span>
          <strong>
            {capacityReached
              ? "Disabled in capacity specimen"
              : "Display handoff available in the Empty fixture"}
          </strong>
        </div>
        <button type="button" disabled>
          {capacityReached ? "Capacity reached" : "No live intake action"}
        </button>
      </div>
    </section>
  );
}

function OperationsStation({
  operatingModel,
}: {
  operatingModel: OperatingModel;
}) {
  return (
    <section
      className={styles.operationsStation}
      aria-labelledby="operations-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stationIndex}>OPERATING HORIZON</p>
          <h2 id="operations-heading">Team load and business signals</h2>
        </div>
        <p>UNCONNECTED CAPABILITIES STAY UNCONNECTED</p>
      </div>

      <div className={styles.operationsGrid}>
        <article aria-labelledby="team-load-heading">
          <p className={styles.miniEyebrow}>TEAM LOAD</p>
          <h3 id="team-load-heading">
            {operatingModel === "solo"
              ? "Unavailable in Solo Agency"
              : "Synthetic Team Specimen"}
          </h3>
          {operatingModel === "solo" ? (
            <div className={styles.unavailablePanel}>
              <strong>NOT CONNECTED</strong>
              <p>
                Solo operator projection. No assignment, invitation, role, staff
                seat, presence, or workload system is being simulated.
              </p>
            </div>
          ) : (
            <>
              <p className={styles.teamDisclosure}>
                SYNTHETIC TEAM PROJECTION · NOT A LIVE CAPABILITY
              </p>
              <ul className={styles.teamList}>
                {AGENCY_TEAM_SPECIMEN.map((seat) => (
                  <li key={seat.id}>
                    <div>
                      <strong>{seat.role}</strong>
                      <span>{seat.note}</span>
                    </div>
                    <div>
                      <span>{seat.assigned}</span>
                      <strong>{seat.load}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>

        <article aria-labelledby="business-signals-heading">
          <p className={styles.miniEyebrow}>BUSINESS SIGNALS</p>
          <h3 id="business-signals-heading">Coverage before claims</h3>
          <dl className={styles.businessList}>
            <div>
              <dt>Client-service revenue</dt>
              <dd>Not instrumented</dd>
            </div>
            <div>
              <dt>Agency billing</dt>
              <dd>Not connected to this prototype</dd>
            </div>
            <div>
              <dt>Activity history</dt>
              <dd>Fixture only · not an audit trail</dd>
            </div>
            <div>
              <dt>Automated actions</dt>
              <dd>None</dd>
            </div>
          </dl>
          <p className={styles.instrumentFootnote}>
            Platform revenue is not agency revenue. Missing business inputs are
            never estimated.
          </p>
        </article>
      </div>
    </section>
  );
}

function StaticSkeleton({ rows }: { rows: number }) {
  return (
    <div className={styles.staticSkeleton} aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}
