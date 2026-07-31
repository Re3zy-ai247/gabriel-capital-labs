"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  scrollCxosElementImmediately,
  useCxosRoomRuntime,
} from "@/components/cxos/runtime/useCxosRoomRuntime";
import type {
  CxosExperienceProjection,
  CxosRoomRuntimeDefinition,
} from "@/lib/cxos/runtime";
import styles from "./agency-command.module.css";
import {
  AGENCY_AUTHORIZED_SOURCES,
  AGENCY_BOTTLENECKS,
  AGENCY_DISTRICTS,
  AGENCY_EVIDENCE_FIELD,
  AGENCY_FIXTURE_STATES,
  AGENCY_HEARTBEAT_SIGNALS,
  AGENCY_HEALTH_DRIVERS,
  AGENCY_KAI_NO_ACTION_RECEIPT,
  AGENCY_PERSONALIZATIONS,
  AGENCY_PORTFOLIO,
  AGENCY_QUEUE,
  AGENCY_QUEUE_FILTERS,
  AGENCY_TEAM_SPECIMEN,
  AGENCY_WORKLOAD_FIELD,
  resolveAgencyKaiIntent,
  type AgencyDistrict,
  type AgencyDistrictId,
  type AgencyFixtureState,
  type AgencyKaiResolution,
  type AgencyOperatingModel,
  type AgencyPersonalization,
  type AgencyQueueItem,
  type AgencyQueueKind,
} from "./fixtures";

type QueueFilter = "all" | AgencyQueueKind;

interface KaiConversationTurn {
  id: string;
  command: string;
  districtId: AgencyDistrictId;
  resolution: AgencyKaiResolution;
}

const AGENCY_ARRIVAL_BEATS = [
  "mission-control-origin",
  "operator-authority",
  "agency-identity",
  "systems-readiness",
  "kai-recognition",
  "destination-acquisition",
  "command-settlement",
] as const;

const AGENCY_MOTION_CHANNELS = [
  "room-breath",
  "operational-sweep",
  "client-flow",
] as const;

function resolveAgencyArrivalProjection(
  state: AgencyFixtureState,
  personalization: AgencyPersonalization
) {
  if (state === "populated" || state === "capacity") {
    return {
      greeting: personalization.greeting,
      destination: personalization.recommendedDestination,
      destinationLabel: "Recommended first destination",
    } as const;
  }

  const boundaryGreetings: Record<AgencyFixtureState, string> = {
    populated: personalization.greeting,
    capacity: personalization.greeting,
    loading:
      "Agency Command is available in a held loading fixture. Source-backed operating facts remain unresolved.",
    empty:
      "Agency Command is ready in an empty synthetic fixture. No illustrative work is staged.",
    unavailable:
      "Agency Command is available at a source-unavailable boundary. No connected source is inferred.",
    error:
      "Agency Command is available in a held error fixture. No failed live system is implied.",
    permission:
      "Agency Command is unavailable because operator authority could not be projected. No agency identity is disclosed.",
  };

  return {
    greeting: boundaryGreetings[state],
    destination: "Central Command",
    destinationLabel: "Review destination",
  } as const;
}

const AGENCY_CORE_RUNTIME = {
  roomId: "agency-command",
  districts: AGENCY_DISTRICTS.map((district) => district.id),
  initialDistrict: "central-command",
  arrivalBeats: AGENCY_ARRIVAL_BEATS,
  arrivalDurationMs: { A: 1500, B: 700 },
  motionChannels: AGENCY_MOTION_CHANNELS,
  kaiContextHoldDistricts: ["kai-suite"],
  departure: {
    href: "/review/mission-control",
    fallbackMs: 800,
  },
} satisfies CxosRoomRuntimeDefinition<AgencyDistrictId>;

function stateLabel(state: AgencyFixtureState): string {
  return (
    AGENCY_FIXTURE_STATES.find((option) => option.key === state)?.label ??
    state
  );
}

export function AgencyCommandStage() {
  const [projection, setProjection] =
    useState<CxosExperienceProjection>("auto");
  const [operatingModel, setOperatingModel] =
    useState<AgencyOperatingModel>("solo");
  const [fixtureState, setFixtureState] =
    useState<AgencyFixtureState>("populated");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [expandedQueueId, setExpandedQueueId] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [kaiCommand, setKaiCommand] = useState("");
  const [kaiTurns, setKaiTurns] = useState<KaiConversationTurn[]>([]);
  const [editingKaiTurnId, setEditingKaiTurnId] = useState<string | null>(null);
  const [kaiCommandReceipt, setKaiCommandReceipt] = useState(
    "ROUTE SESSION EMPTY · Nothing is prepared and no production action is connected."
  );
  const [reducedMotionOverride, setReducedMotionOverride] = useState(false);
  const [cinematicPromptOpen, setCinematicPromptOpen] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "Agency Command synthetic review loaded."
  );

  const roomRootRef = useRef<HTMLElement>(null);
  const roomHeadingRef = useRef<HTMLHeadingElement>(null);
  const directorRef = useRef<HTMLDetailsElement>(null);
  const directorSummaryRef = useRef<HTMLElement>(null);
  const capabilitiesHydratedRef = useRef(false);
  const previousReducedMotionRef = useRef<boolean | null>(null);
  const kaiTurnSequenceRef = useRef(0);
  const kaiSubmitLockedRef = useRef(false);
  const kaiInputRef = useRef<HTMLInputElement>(null);
  const personalization = AGENCY_PERSONALIZATIONS[operatingModel];
  const arrivalProjection = resolveAgencyArrivalProjection(
    fixtureState,
    personalization
  );
  const kaiWorkflowAvailable =
    fixtureState === "populated" || fixtureState === "capacity";

  const clearKaiSession = useCallback(() => {
    setKaiCommand("");
    setKaiTurns([]);
    setEditingKaiTurnId(null);
    setKaiCommandReceipt(
      "ROUTE SESSION EMPTY · Nothing is prepared and no production action is connected."
    );
    kaiTurnSequenceRef.current = 0;
  }, []);

  const runtime = useCxosRoomRuntime({
    definition: AGENCY_CORE_RUNTIME,
    projection,
    reducedMotionOverride,
    roomRootRef,
    roomHeadingRef,
    observerKey: fixtureState,
    messages: {
      staticArrival: `Complete static Agency Command projection. ${arrivalProjection.greeting}`,
      escapeArrival: `Agency Command arrival skipped. ${arrivalProjection.greeting}`,
      departure:
        "Return acknowledged. Kai confirms the review-route handoff to Mission Control; Agency instruments are receding.",
    },
    announce: setAnnouncement,
    onRouteReset: clearKaiSession,
  });

  const {
    capabilities,
    resolution,
    environment,
    arrivalKey,
    arrivalSettled,
    activeDistrict,
    kaiContextDistrict,
    documentHidden,
    departing,
    setKaiContextDistrict,
    settleArrival: settleRuntimeArrival,
    replayArrival: replayRuntimeArrival,
    moveToDistrict,
    beginDeparture,
    completeDeparture,
  } = runtime;
  const journeyCapable = resolution.tier === "A" || resolution.tier === "B";

  useEffect(() => {
    const closeDirectorOnEscape = (event: KeyboardEvent) => {
      const director = directorRef.current;
      if (event.key !== "Escape" || !director?.open) return;
      const focusWasInside = director.contains(document.activeElement);
      event.preventDefault();
      event.stopImmediatePropagation();
      director.removeAttribute("open");
      if (focusWasInside) {
        directorSummaryRef.current?.focus({ preventScroll: true });
      }
      setAnnouncement("Director controls closed.");
    };

    window.addEventListener("keydown", closeDirectorOnEscape, true);
    return () =>
      window.removeEventListener("keydown", closeDirectorOnEscape, true);
  }, []);

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

  const applyProjection = (next: CxosExperienceProjection) => {
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

  const applyOperatingModel = (next: AgencyOperatingModel) => {
    setOperatingModel(next);
    clearKaiSession();
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
    clearKaiSession();
    closeDirectorAndRestoreFocus(`${stateLabel(next)} fixture state selected.`);
  };

  const prepareKaiCommand = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (kaiSubmitLockedRef.current) return;
    kaiSubmitLockedRef.current = true;
    window.requestAnimationFrame(() => {
      kaiSubmitLockedRef.current = false;
    });
    const sourceCommand = kaiCommand.slice(0, 240);
    const resolutionResult = resolveAgencyKaiIntent(sourceCommand);
    if (resolutionResult.status === "empty") {
      setAnnouncement("Enter one supported synthetic fixture command.");
      kaiInputRef.current?.focus();
      return;
    }

    const nextTurn: KaiConversationTurn = {
      id:
        editingKaiTurnId ??
        `kai-turn-${String(++kaiTurnSequenceRef.current).padStart(2, "0")}`,
      command: sourceCommand.trim(),
      districtId: kaiContextDistrict,
      resolution: resolutionResult,
    };
    setKaiTurns((current) => {
      const withoutEdited = editingKaiTurnId
        ? current.filter((turn) => turn.id !== editingKaiTurnId)
        : current;
      return [...withoutEdited, nextTurn].slice(-8);
    });
    setKaiCommand("");
    setEditingKaiTurnId(null);
    setKaiCommandReceipt(
      resolutionResult.status === "supported"
        ? `PREVIEW PREPARED · ${AGENCY_KAI_NO_ACTION_RECEIPT}`
        : `NOT PREPARED · ${AGENCY_KAI_NO_ACTION_RECEIPT}`
    );
    setAnnouncement(
      resolutionResult.status === "supported"
        ? `${resolutionResult.headline} matched locally. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
        : `Request not prepared. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
    );
  };

  const reviseKaiTurn = (turn: KaiConversationTurn) => {
    setKaiTurns((current) => current.filter((item) => item.id !== turn.id));
    setEditingKaiTurnId(turn.id);
    setKaiCommand(turn.command);
    setKaiCommandReceipt(
      `COMMAND REVISED · The prior synthetic preview was cleared. Prepare again. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
    );
    window.requestAnimationFrame(() => kaiInputRef.current?.focus());
    setAnnouncement(
      `Command revised. The prior synthetic preview was cleared. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
    );
  };

  const cancelKaiTurn = (id: string) => {
    setKaiTurns((current) => current.filter((turn) => turn.id !== id));
    setKaiCommandReceipt(
      `PREVIEW CANCELED · The route-local preview was cleared. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
    );
    setAnnouncement(
      `Preview canceled. The route-local preview was cleared. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
    );
  };

  const clearKaiCommand = () => {
    clearKaiSession();
    setKaiCommandReceipt(
      `COMMAND CLEARED · Command text and previews were removed from this page. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
    );
    setAnnouncement(
      `Command cleared. Command text and previews were removed from this page. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
    );
  };

  const stageKaiSuggestion = (
    suggestion: string,
    sourceDistrict: AgencyDistrictId
  ) => {
    if (sourceDistrict !== "kai-suite") {
      setKaiContextDistrict(sourceDistrict);
    }
    setKaiCommand(suggestion);
    setEditingKaiTurnId(null);
    setKaiCommandReceipt(
      `COMMAND STAGED · Prepare the fixed local preview. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
    );
    moveToDistrict("kai-suite");
    window.requestAnimationFrame(() => kaiInputRef.current?.focus());
    setAnnouncement(
      "Contextual synthetic command staged. Prepare the preview to run the fixed local match."
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
    replayRuntimeArrival(`Arrival replayed in Tier ${resolution.tier}.`);
    directorRef.current?.removeAttribute("open");
  };

  const completeArrival = () => {
    if (arrivalSettled) return;
    settleRuntimeArrival({
      focus: { kind: "room" },
      announcement: `Agency Command settled. ${arrivalProjection.greeting}`,
    });
  };

  const skipArrival = () => {
    if (fixtureState === "permission") {
      settleRuntimeArrival({
        focus: { kind: "room" },
        announcement:
          "Agency Command arrival skipped. Operator authority could not be projected; no agency identity is disclosed.",
      });
      return;
    }

    settleRuntimeArrival({
      focus: { kind: "district", districtId: "central-command" },
      announcement: "Agency Command arrival skipped. Central Command is ready.",
    });
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
    clearKaiSession();
    closeDirectorAndRestoreFocus("Populated synthetic fixture restored.");
  };

  const beginMissionControlReturn = (
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    clearKaiSession();
    if (beginDeparture(event)) directorRef.current?.removeAttribute("open");
  };

  const completeMissionControlReturn = (
    event: React.AnimationEvent<HTMLDivElement>
  ) => {
    completeDeparture(event);
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
      ref={roomRootRef}
      tabIndex={-1}
      className={styles.room}
      {...runtime.attributes}
      style={
        {
          "--cxos-arrival-duration": `${runtime.arrivalDurationMs}ms`,
        } as CSSProperties
      }
      data-tier={resolution.tier}
      data-fixture={fixtureState}
      data-hidden={documentHidden ? "true" : "false"}
      data-departing={departing ? "true" : "false"}
      data-arrival-settled={arrivalSettled ? "true" : "false"}
      data-active-district={activeDistrict}
      data-scroll-ready={environment.scrollActivation ? "true" : "false"}
      data-motion-override={
        reducedMotionOverride && projection === "cinematic" ? "true" : "false"
      }
    >
      <div aria-hidden className={styles.gridField} />
      <div aria-hidden className={styles.overheadLight} />
      <div aria-hidden className={styles.horizon} />
      <div
        aria-hidden
        className={styles.ambientSweep}
        data-cxos-motion-channel={runtime.motionChannels[1]}
      />
      <div
        aria-hidden
        className={styles.roomBreath}
        data-cxos-motion-channel={runtime.motionChannels[0]}
      />
      <div
        aria-hidden
        className={styles.facilityPulse}
        data-cxos-motion-channel={runtime.motionChannels[2]}
      >
        <span data-channel="capacity"><i /></span>
        <span data-channel="client-flow"><i /></span>
        <span data-channel="queue-pressure"><i /></span>
        <span data-channel="evidence"><i /></span>
        <span data-channel="bottleneck"><i /></span>
        <span data-channel="kai"><i /></span>
      </div>
      <div
        aria-hidden
        className={styles.departureHandoff}
        onAnimationEnd={completeMissionControlReturn}
      >
        <span>OPERATING STATE ACKNOWLEDGED</span>
        <strong>KAI HANDOFF · MISSION CONTROL ACQUIRED</strong>
        <i />
      </div>

      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <div key={arrivalKey} className={styles.arrival}>
        <section className={styles.arrivalThreshold} aria-labelledby="agency-command-title">
          <div
            aria-hidden
            className={styles.arrivalClock}
            onAnimationEnd={completeArrival}
          />
          <p className={styles.arrivalOrigin}>
            MISSION CONTROL ORIGIN · FACILITY TRANSFER · AGENCY COMMAND
          </p>
          <header className={styles.identity}>
            <div>
              <p className={styles.eyebrow}>
                Founder Review · CXOS Phase 6.2
              </p>
              <h1
                id="agency-command-title"
                ref={roomHeadingRef}
                tabIndex={-1}
                className={styles.roomTitle}
              >
                Agency Command
              </h1>
              {fixtureState !== "permission" && (
                <p className={styles.identityLine}>
                  {personalization.operatorRole} · {personalization.agencyName} ·{" "}
                  {fixtureState === "loading"
                    ? "capacity unresolved"
                    : `${capacity.active} / ${capacity.limit} illustrative positions`}
                </p>
              )}
            </div>
            <div className={styles.reviewIdentity}>
              <span>FACILITY 06</span>
              <span>AGENCY HEADQUARTERS</span>
            </div>
          </header>

          {fixtureState !== "permission" ? (
            <>
              <ActivationRail
                state={fixtureState}
                beatOrder={runtime.arrivalBeats}
                recommendedDestination={arrivalProjection.destination}
              />
              <div className={styles.arrivalGreeting}>
                <p>KAI EXECUTIVE CHANNEL · SYNTHETIC FIXTURE</p>
                <strong>{arrivalProjection.greeting}</strong>
                <span>
                  {arrivalProjection.destinationLabel} · {arrivalProjection.destination}
                </span>
              </div>
            </>
          ) : (
            <p className={styles.arrivalBoundary}>
              Authority could not be projected. No agency identity or operating metadata is shown.
            </p>
          )}

          <div className={styles.arrivalActions}>
            <button type="button" onClick={skipArrival}>
              Skip arrival
            </button>
            <span>Escape also settles the complete static facility.</span>
          </div>
        </section>

        <div className={styles.disclosure} role="note">
          <strong>SYNTHETIC FOUNDER REVIEW</strong>
          <span>
            Illustrative deterministic data only. No customer records, live AI,
            Agency APIs, billing, revenue, legal deadlines, command-text
            persistence, or automated actions are connected to this review
            surface.
          </span>
        </div>

        <section className={styles.stateBand} aria-labelledby="fixture-state-heading">
          <h2
            id="fixture-state-heading"
            tabIndex={-1}
            className={styles.stateHeading}
          >
            Fixture state · {fixtureLabel}
          </h2>
          <p>
            Director controls alter only this deterministic projection. Browser,
            customer, subscription, and production state remain unchanged.
          </p>
        </section>

        <details
          ref={directorRef}
          className={styles.director}
          onToggle={(event) => {
            if (event.currentTarget.open) {
              scrollCxosElementImmediately(event.currentTarget);
            }
          }}
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
              disabled={departing}
            >
              Replay grand arrival
            </button>
          </div>
        </details>

        {fixtureState !== "permission" && (
          <FacilityDirectory
            activeDistrict={journeyCapable ? activeDistrict : null}
            onNavigate={moveToDistrict}
          />
        )}

        {fixtureState === "permission" ? (
          <>
            <PermissionState />
            <footer className={styles.footer}>
              <p>
                Permission-denied fixture · no agency identity or operating data
                is disclosed.
              </p>
              <nav aria-label="Founder review navigation">
                <a href="/review">All rooms</a>
                <a href="/review/mission-control">Return to Mission Control</a>
              </nav>
            </footer>
          </>
        ) : (
          <>
            <AgencyDistrictShell
              district={AGENCY_DISTRICTS[0]}
              activeDistrict={activeDistrict}
              journeyActive={journeyCapable}
              kaiAvailable={kaiWorkflowAvailable}
              onNavigate={moveToDistrict}
              onStageKai={stageKaiSuggestion}
            >
              <PersonalizationProjection
                personalization={personalization}
                fixtureState={fixtureState}
              />
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
              <div className={styles.centralCondition}>
                <span>AGENCY CONDITION</span>
                <strong>{healthStatus}</strong>
                <p>{personalization.priorityCondition}</p>
                <small>
                  Fixed fixture interpretation · not a financial-health assessment.
                </small>
              </div>
            </AgencyDistrictShell>

            <AgencyDistrictShell
              district={AGENCY_DISTRICTS[1]}
              activeDistrict={activeDistrict}
              journeyActive={journeyCapable}
              kaiAvailable={kaiWorkflowAvailable}
              onNavigate={moveToDistrict}
              onStageKai={stageKaiSuggestion}
            >
              <OperationalHeartbeat
                state={fixtureState}
                active={capacity.active}
                limit={capacity.limit}
              />
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
            </AgencyDistrictShell>

            <AgencyDistrictShell
              district={AGENCY_DISTRICTS[2]}
              activeDistrict={activeDistrict}
              journeyActive={journeyCapable}
              kaiAvailable={kaiWorkflowAvailable}
              onNavigate={moveToDistrict}
              onStageKai={stageKaiSuggestion}
            >
              <TeamOperationsRoom operatingModel={operatingModel} />
            </AgencyDistrictShell>

            <AgencyDistrictShell
              district={AGENCY_DISTRICTS[3]}
              activeDistrict={activeDistrict}
              journeyActive={journeyCapable}
              kaiAvailable={kaiWorkflowAvailable}
              onNavigate={moveToDistrict}
              onStageKai={stageKaiSuggestion}
            >
              <div className={styles.observatoryGrid}>
                <AgencyHealthBank state={fixtureState} healthStatus={healthStatus} />
                <BusinessSignals />
              </div>
            </AgencyDistrictShell>

            <AgencyDistrictShell
              district={AGENCY_DISTRICTS[4]}
              activeDistrict={activeDistrict}
              journeyActive={journeyCapable}
              kaiAvailable={kaiWorkflowAvailable}
              onNavigate={moveToDistrict}
              onStageKai={stageKaiSuggestion}
            >
              {fixtureState === "loading" ? (
                <ArchiveBoundaryState state="loading" />
              ) : fixtureState === "empty" ? (
                <ArchiveBoundaryState state="empty" />
              ) : (
                <PortfolioLedger
                  items={visiblePortfolio}
                  capacityReached={fixtureState === "capacity"}
                />
              )}
              <EvidenceArchive state={fixtureState} />
            </AgencyDistrictShell>

            <AgencyDistrictShell
              district={AGENCY_DISTRICTS[5]}
              activeDistrict={activeDistrict}
              journeyActive={journeyCapable}
              kaiAvailable={kaiWorkflowAvailable}
              onNavigate={moveToDistrict}
              onStageKai={stageKaiSuggestion}
            >
              <KaiExecutiveSuite
                enabled={fixtureState === "populated" || fixtureState === "capacity"}
                command={kaiCommand}
                turns={kaiTurns}
                editingTurnId={editingKaiTurnId}
                commandReceipt={kaiCommandReceipt}
                inputRef={kaiInputRef}
                suggestions={AGENCY_DISTRICTS.find(
                  (district) => district.id === kaiContextDistrict
                )?.suggestions ?? AGENCY_DISTRICTS[5].suggestions}
                onCommandChange={(value) => {
                  setKaiCommand(value);
                  if (editingKaiTurnId) {
                    setKaiCommandReceipt(
                      `COMMAND REVISED · The prior synthetic preview remains cleared. Prepare again. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
                    );
                    setAnnouncement(
                      `Command revised. Prepare again to match the revised text. ${AGENCY_KAI_NO_ACTION_RECEIPT}`
                    );
                  }
                }}
                onSubmit={prepareKaiCommand}
                onSuggestion={(suggestion) =>
                  stageKaiSuggestion(suggestion, kaiContextDistrict)
                }
                onRevise={reviseKaiTurn}
                onCancel={cancelKaiTurn}
                onClear={clearKaiCommand}
              />
            </AgencyDistrictShell>

            <AgencyDistrictShell
              district={AGENCY_DISTRICTS[6]}
              activeDistrict={activeDistrict}
              journeyActive={journeyCapable}
              kaiAvailable={kaiWorkflowAvailable}
              onNavigate={moveToDistrict}
              onStageKai={stageKaiSuggestion}
            >
              <AgencyScopeBank
                state={fixtureState}
                active={capacity.active}
                limit={capacity.limit}
                portfolioRows={visiblePortfolio.length}
              />
              <AuthorizedSourceMap />
              <footer className={styles.footer}>
                <p>
                  Phase 6.2 is presentation-only. The live <code>/agency</code>{" "}
                  surface and its APIs are unchanged. Returning clears this
                  route-local Kai session.
                </p>
                <nav aria-label="Founder review navigation">
                  <a href="/review" onClick={clearKaiSession}>All rooms</a>
                  <a
                    className={styles.returnThreshold}
                    href="/review/mission-control"
                    onClick={beginMissionControlReturn}
                  >
                    <span>Kai confirms Mission Control handoff · route session clears</span>
                    <strong>Return to Mission Control</strong>
                  </a>
                </nav>
              </footer>
            </AgencyDistrictShell>
          </>
        )}
      </div>
    </main>
  );
}

function FacilityDirectory({
  activeDistrict,
  onNavigate,
}: {
  activeDistrict: AgencyDistrictId | null;
  onNavigate: (districtId: AgencyDistrictId) => void;
}) {
  return (
    <nav className={styles.facilityDirectory} aria-label="Agency Command facility map">
      <div className={styles.directoryAxis}>
        <span>MISSION CONTROL</span>
        <strong>AGENCY COMMAND · 7 DISTRICTS</strong>
      </div>
      <ol>
        {AGENCY_DISTRICTS.map((district) => (
          <li key={district.id} data-current={activeDistrict === district.id ? "true" : "false"}>
            <a
              href={`#${district.id}`}
              aria-current={activeDistrict === district.id ? "location" : undefined}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                event.preventDefault();
                onNavigate(district.id);
              }}
            >
              <span>{district.index}</span>
              <strong>{district.shortName}</strong>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function AgencyDistrictShell({
  district,
  activeDistrict,
  journeyActive,
  kaiAvailable,
  onNavigate,
  onStageKai,
  children,
}: {
  district: AgencyDistrict;
  activeDistrict: AgencyDistrictId;
  journeyActive: boolean;
  kaiAvailable: boolean;
  onNavigate: (districtId: AgencyDistrictId) => void;
  onStageKai: (
    suggestion: string,
    sourceDistrict: AgencyDistrictId
  ) => void;
  children: React.ReactNode;
}) {
  const districtIndex = AGENCY_DISTRICTS.findIndex((item) => item.id === district.id);
  const activeDistrictIndex = AGENCY_DISTRICTS.findIndex(
    (item) => item.id === activeDistrict
  );
  const nextDistrict = AGENCY_DISTRICTS[districtIndex + 1];
  const journeyState = !journeyActive
    ? "static"
    : districtIndex === activeDistrictIndex
      ? "operating"
      : districtIndex > activeDistrictIndex
        ? "queued"
        : "cleared";

  return (
    <section
      id={district.id}
      className={styles.district}
      data-agency-district={district.id}
      data-cxos-district={district.id}
      data-current={journeyActive && activeDistrict === district.id ? "true" : "false"}
      data-journey-state={journeyState}
      aria-labelledby={`${district.id}-heading`}
    >
      <div
        aria-hidden="true"
        className={styles.districtEnvironment}
        data-environment={district.id}
      >
        <span data-plane="depth" />
        <span data-plane="horizon" />
        <span data-plane="signal"><i /><b /><em /></span>
      </div>
      <div aria-hidden="true" className={styles.districtRail}>
        <i />
      </div>
      <div aria-hidden="true" className={styles.districtThreshold}>
        <span>THRESHOLD {district.index}</span>
        <i />
        <strong>
          <span data-threshold-state="static">static</span>
          <span data-threshold-state="queued">queued</span>
          <span data-threshold-state="operating">operating</span>
          <span data-threshold-state="cleared">cleared</span>
        </strong>
      </div>

      <header className={styles.districtHeader}>
        <div>
          <p>DISTRICT {district.index} / 07</p>
          <h2 id={`${district.id}-heading`} tabIndex={-1}>
            {district.name}
          </h2>
        </div>
        <p>{district.purpose}</p>
      </header>

      <div className={styles.districtTruth} role="note">
        <span>TRUTH BOUNDARY</span>
        <p>{district.truthBoundary}</p>
      </div>

      {district.id !== "kai-suite" && (
        <aside className={styles.kaiContext} aria-label={`Kai context for ${district.name}`}>
          <div>
            <span>KAI · CONTEXTUAL CHANNEL</span>
            <p>{district.kaiContext}</p>
          </div>
          {kaiAvailable ? (
            <button
              type="button"
              onClick={() => onStageKai(district.suggestions[0], district.id)}
            >
              Stage with Kai
            </button>
          ) : (
            <span className={styles.kaiBoundary}>
              Kai held · fixture boundary
            </span>
          )}
        </aside>
      )}

      <div className={styles.districtBody}>{children}</div>

      <nav className={styles.districtHandoff} aria-label={`${district.name} facility navigation`}>
        {district.id !== "central-command" && (
          <a
            href="#central-command"
            onClick={(event) => {
              event.preventDefault();
              onNavigate("central-command");
            }}
          >
            Return to Central Command
          </a>
        )}
        {nextDistrict && (
          <a
            href={`#${nextDistrict.id}`}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(nextDistrict.id);
            }}
          >
            Continue to {nextDistrict.name}
          </a>
        )}
      </nav>
    </section>
  );
}

function PersonalizationProjection({
  personalization,
  fixtureState,
}: {
  personalization: (typeof AGENCY_PERSONALIZATIONS)[AgencyOperatingModel];
  fixtureState: AgencyFixtureState;
}) {
  const capacityCondition =
    fixtureState === "loading"
      ? "Unresolved · no occupancy inferred"
      : fixtureState === "empty"
        ? "0 of 15 illustrative positions occupied"
        : fixtureState === "capacity"
          ? "15 of 15 illustrative positions occupied"
          : personalization.capacityCondition;

  return (
    <article className={styles.personalizationProjection} aria-labelledby="personalization-heading">
      <div>
        <p>DETERMINISTIC OPERATOR PROJECTION</p>
        <h3 id="personalization-heading">{personalization.agencyName}</h3>
        <span>SYNTHETIC · NOT AUTH / NOT CUSTOMER DATA</span>
      </div>
      <dl>
        <div>
          <dt>Operator</dt>
          <dd>{personalization.operatorDisplay} · {personalization.operatorRole}</dd>
        </div>
        <div>
          <dt>Agency</dt>
          <dd>{personalization.agencyType}</dd>
        </div>
        <div>
          <dt>Tier</dt>
          <dd>{personalization.agencyTier}</dd>
        </div>
        <div>
          <dt>Capacity</dt>
          <dd>{capacityCondition}</dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>{fixtureState === "loading" ? "Unresolved fixture scope" : personalization.displayedWorkspaces}</dd>
        </div>
        <div>
          <dt>Emphasis</dt>
          <dd>{personalization.recommendedDestination}</dd>
        </div>
      </dl>
    </article>
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
      <h3 id={id}>{title}</h3>
    </div>
  );
}

function ActivationRail({
  state,
  beatOrder,
  recommendedDestination,
}: {
  state: AgencyFixtureState;
  beatOrder: readonly string[];
  recommendedDestination: string;
}) {
  const steps: Record<string, readonly [label: string, detail: string]> =
    state !== "populated" && state !== "capacity"
      ? {
          "mission-control-origin": [
            "Origin acknowledged",
            "Mission Control transfer",
          ],
          "operator-authority": [
            "Authority recognized",
            "Synthetic operator only",
          ],
          "agency-identity": [
            "Agency identity bounded",
            "Synthetic fixture only",
          ],
          "systems-readiness": ["Systems held", "No live state inferred"],
          "kai-recognition": ["Kai channel held", "No action connected"],
          "destination-acquisition": [
            "Destination acquired",
            `${recommendedDestination} available`,
          ],
          "command-settlement": [
            "Command settlement",
            "Complete static state available",
          ],
        }
      : {
          "mission-control-origin": [
            "Origin acknowledged",
            "Mission Control transfer",
          ],
          "operator-authority": [
            "Authority recognized",
            "Synthetic operator only",
          ],
          "agency-identity": ["Agency identified", "Agency scope resolved"],
          "systems-readiness": ["Systems ready", "Fixed horizon and ledgers"],
          "kai-recognition": ["Kai recognized", "Deterministic channel ready"],
          "destination-acquisition": [
            "Destination acquired",
            `${recommendedDestination} next`,
          ],
          "command-settlement": [
            "Command settled",
            "Seven districts available",
          ],
        };

  return (
    <ol
      className={styles.activationRail}
      aria-label="Agency Command arrival sequence"
    >
      {beatOrder.map((beatId, index) => {
        const step = steps[beatId] ?? [
          "Sequence unavailable",
          "Runtime contract failed closed",
        ];
        return (
          <li key={beatId} data-cxos-arrival-beat={beatId}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step[0]}</strong>
            <small>{step[1]}</small>
          </li>
        );
      })}
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
          <h3 id="heartbeat-heading">The agency is breathing</h3>
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

function KaiExecutiveSuite({
  enabled,
  command,
  turns,
  editingTurnId,
  commandReceipt,
  inputRef,
  suggestions,
  onCommandChange,
  onSubmit,
  onSuggestion,
  onRevise,
  onCancel,
  onClear,
}: {
  enabled: boolean;
  command: string;
  turns: KaiConversationTurn[];
  editingTurnId: string | null;
  commandReceipt: string;
  inputRef: React.RefObject<HTMLInputElement>;
  suggestions: readonly string[];
  onCommandChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSuggestion: (suggestion: string) => void;
  onRevise: (turn: KaiConversationTurn) => void;
  onCancel: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <section className={styles.kaiDesk} aria-labelledby="kai-operating-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stationIndex}>KAI EXECUTIVE RUNTIME EXPERIENCE</p>
          <h3 id="kai-operating-heading">One continuous executive channel</h3>
        </div>
        <p>FIXED LOCAL MATCHING · OPERATOR RETAINS CONTROL</p>
      </div>

      <div className={styles.kaiPresenceRail}>
        <span>COMMAND PROCESSING · LOCAL / NO MODEL</span>
        <span>SOURCES · FICTIONAL FIXTURES</span>
        <span>COMMAND DATA PERSISTENCE · OFF</span>
        <span>COMMAND-SURFACE PRODUCTION WRITES · 0</span>
      </div>

      <div className={styles.kaiWorkbenchDisclosure} role="note">
        <strong>SYNTHETIC COMMAND PREVIEW · DETERMINISTIC AND ROUTE-LOCAL</strong>
        <p>
          This command surface matches only a fixed set of fictional fixture
          commands. No live AI or model reads this text. It does not call an
          Agency API, save command text, create notes, reminders, or tasks, write
          a calendar, contact anyone, or change a customer record. Command text
          and previews are discarded on refresh or exit. Do not enter real
          customer information.
        </p>
      </div>

      <form className={styles.kaiCommandForm} onSubmit={onSubmit}>
        <label htmlFor="kai-synthetic-command">
          Type one synthetic fixture command
        </label>
        <span className={styles.kaiCommandMode}>
          FIXED SYNTHETIC EXAMPLES ONLY · NOT OPEN-ENDED AI
        </span>
        <div>
          <input
            ref={inputRef}
            id="kai-synthetic-command"
            type="text"
            value={command}
            maxLength={240}
            autoComplete="off"
            spellCheck={false}
            disabled={!enabled}
            aria-describedby="kai-command-boundary"
            placeholder="Ask Kai to handle something…"
            onChange={(event) => onCommandChange(event.target.value)}
          />
          <button type="submit" disabled={!enabled || command.trim().length === 0}>
            {editingTurnId ? "Prepare revised preview" : "Prepare synthetic preview"}
          </button>
        </div>
        <small id="kai-command-boundary">
          Use only displayed synthetic client labels. Do not enter names, account
          numbers, report text, or real customer information. This fixed parser
          does not understand open-ended requests. {command.length} / 240.
        </small>
        {!enabled && (
          <p className={styles.kaiDisabledBoundary} role="status">
            The command surface is held in this fixture state. Select Populated or
            Capacity reached to review deterministic matching.
          </p>
        )}
      </form>

      <p className={styles.kaiRouteReceipt} role="status">
        {commandReceipt}
      </p>

      <div className={styles.kaiSuggestions}>
        <p>Contextual fixture examples</p>
        <div>
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" disabled={!enabled} onClick={() => onSuggestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.kaiConversation} aria-label="Route-local Kai preview continuity">
        {turns.length === 0 ? (
          <div className={styles.kaiConversationEmpty}>
            <strong>READY · NOTHING PREPARED</strong>
            <p>
              Submit one supported fixture command. No default intent, hidden
              action, model call, or production connection is active.
            </p>
          </div>
        ) : (
          <ol>
            {turns.map((turn) => {
              const district = AGENCY_DISTRICTS.find((item) => item.id === turn.districtId);
              const supported = turn.resolution.status === "supported";
              const noteDraft = turn.resolution.workflowId === "note-taking";
              return (
                <li key={turn.id} data-result={turn.resolution.status}>
                  <div className={styles.kaiOperatorCommand}>
                    <span>OPERATOR · ROUTE-LOCAL INPUT</span>
                    <p>{turn.command}</p>
                    <small>Context · {district?.name ?? "Agency Command"}</small>
                  </div>
                  <article className={styles.kaiResponse}>
                    <p className={styles.workflowClassification}>
                      {supported
                        ? `MATCHED LOCALLY · ${turn.resolution.workflowId?.replaceAll("-", " ").toUpperCase()} · ${turn.resolution.classification}`
                        : `NOT PREPARED · ${turn.resolution.classification}`}
                    </p>
                    <h4>{turn.resolution.headline}</h4>
                    {noteDraft && (
                      <p className={styles.operatorDraftLabel}>
                        OPERATOR DRAFT · USER-ENTERED · NOT VERIFIED BY KAI
                      </p>
                    )}
                    <p>
                      {supported
                        ? "This fixed command matched one fixture intent. No model or external service was used."
                        : "No synthetic artifact was prepared."}
                    </p>
                    <ul>
                      {turn.resolution.responseLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <dl className={styles.workflowSources}>
                      <div>
                        <dt>Fixture sources</dt>
                        <dd>{turn.resolution.sources}</dd>
                      </div>
                      <div>
                        <dt>Authority</dt>
                        <dd>Preview only · operator review and decision required</dd>
                      </div>
                    </dl>
                    <strong className={styles.workflowReceipt}>
                      {supported
                        ? "PREVIEW PREPARED · Matched locally to deterministic fictional fixtures. No live AI/model or external service was used."
                        : "NOT PREPARED · The fixed local parser produced no artifact and used no live AI/model or external service."}{" "}
                      {turn.resolution.receipt} Kai recommends; the operator reviews
                      and decides. Educational information, not legal advice.
                    </strong>
                    <div className={styles.workflowActions}>
                      <button type="button" onClick={() => onRevise(turn)}>
                        Revise command
                      </button>
                      <button type="button" onClick={() => onCancel(turn.id)}>
                        Cancel synthetic preview
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {(turns.length > 0 || command.length > 0) && (
        <button type="button" className={styles.clearKaiSession} onClick={onClear}>
          Clear route-local Kai session
        </button>
      )}
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
      <h3 id="loading-heading">Command ledgers are resolving</h3>
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
      <h3 id="empty-heading">No illustrative work is staged</h3>
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
          <h3 id="queue-heading">Priority work queue</h3>
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
          <h3 id="portfolio-heading">Client portfolio ledger</h3>
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

function TeamOperationsRoom({
  operatingModel,
}: {
  operatingModel: AgencyOperatingModel;
}) {
  return (
    <section
      className={styles.operationsStation}
      aria-labelledby="team-load-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stationIndex}>TEAM COVERAGE HORIZON</p>
          <h3 id="team-load-heading">Roles, workload, and availability</h3>
        </div>
        <p>SOLO TRUTH · TEAM SPECIMEN · NO LIVE PRESENCE</p>
      </div>

      {operatingModel === "solo" ? (
        <div className={styles.unavailablePanel}>
          <strong>NOT CONNECTED IN SOLO AGENCY</strong>
          <p>
            Solo operator projection. No assignment, invitation, team role,
            staff seat, presence, availability, or workload system is connected.
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
    </section>
  );
}

function BusinessSignals() {
  return (
    <article className={styles.businessSignals} aria-labelledby="business-signals-heading">
      <p className={styles.miniEyebrow}>BUSINESS INPUTS</p>
      <h3 id="business-signals-heading">Coverage before claims</h3>
      <dl className={styles.businessList}>
        <div>
          <dt>Client-service revenue</dt>
          <dd>Not instrumented</dd>
        </div>
        <div>
          <dt>Agency billing</dt>
          <dd>Not connected to this review</dd>
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
        Platform revenue is not agency revenue. Missing financial or business
        inputs are never estimated.
      </p>
    </article>
  );
}

function AgencyHealthBank({
  state,
  healthStatus,
}: {
  state: AgencyFixtureState;
  healthStatus: string;
}) {
  return (
    <aside className={styles.healthBank} aria-labelledby="agency-health-heading">
      <InstrumentHeader
        eyebrow="SYNTHETIC QUALITATIVE FIXTURE"
        title="Agency health drivers"
        id="agency-health-heading"
      />
      <p className={styles.healthState}>{healthStatus}</p>
      {state === "loading" ? (
        <StaticSkeleton rows={4} />
      ) : (
        <dl className={styles.driverList}>
          {AGENCY_HEALTH_DRIVERS[state].map((driver) => (
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
        No production scoring formula, financial-health assessment, prediction,
        or compliance certification.
      </p>
    </aside>
  );
}

function AgencyScopeBank({
  state,
  active,
  limit,
  portfolioRows,
}: {
  state: AgencyFixtureState;
  active: number;
  limit: number;
  portfolioRows: number;
}) {
  const coverage =
    state === "unavailable"
      ? "2 of 5 · partial"
      : state === "error"
        ? "2 of 5 · preserved"
        : state === "empty"
          ? "0 of 0 · empty"
          : "5 of 5 · specimen";

  return (
    <aside className={styles.scopeBank} aria-labelledby="portfolio-scope-heading">
      <InstrumentHeader
        eyebrow="GROWTH / CAPACITY THRESHOLD"
        title="Portfolio scope and reserve"
        id="portfolio-scope-heading"
      />
      {state === "loading" ? (
        <StaticSkeleton rows={4} />
      ) : (
        <dl className={styles.scopeList}>
          <div>
            <dt>Aggregate workspaces</dt>
            <dd>{active}</dd>
          </div>
          <div>
            <dt>Portfolio rows shown</dt>
            <dd>{portfolioRows}</dd>
          </div>
          <div>
            <dt>Capacity remaining</dt>
            <dd>{Math.max(0, limit - active)}</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>{coverage}</dd>
          </div>
        </dl>
      )}
      {state === "capacity" && (
        <p className={styles.capacityNotice}>
          Capacity fixture reached. Existing illustrative work remains visible;
          no billing or expansion action is connected.
        </p>
      )}
      <CapacityHorizon active={active} limit={limit} state={state} />
    </aside>
  );
}

function ArchiveBoundaryState({ state }: { state: "loading" | "empty" }) {
  return (
    <div className={styles.archiveBoundary} role="status">
      <strong>{state === "loading" ? "ARCHIVE HELD" : "ARCHIVE EMPTY"}</strong>
      <p>
        {state === "loading"
          ? "Fixture sources are unresolved. No receipt, document state, or history is asserted."
          : "No illustrative portfolio or evidence history is staged in this fixture."}
      </p>
    </div>
  );
}

function EvidenceArchive({ state }: { state: AgencyFixtureState }) {
  const evidence =
    state === "loading" || state === "empty"
      ? []
      : state === "unavailable" || state === "error"
        ? AGENCY_EVIDENCE_FIELD.slice(0, 2)
        : AGENCY_EVIDENCE_FIELD;

  return (
    <section className={styles.archiveLedger} aria-labelledby="archive-ledger-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stationIndex}>EVIDENCE COVERAGE LEDGER</p>
          <h3 id="archive-ledger-heading">Displayed source receipts</h3>
        </div>
        <p>FIXTURE PROJECTION · NOT A PRODUCTION AUDIT TRAIL</p>
      </div>
      {evidence.length === 0 ? (
        <p className={styles.noResults}>No evidence receipt is asserted in this fixture state.</p>
      ) : (
        <ol className={styles.archiveEvidenceList}>
          {evidence.map((item) => (
            <li key={item.id} data-evidence-state={item.state}>
              <span aria-hidden />
              <strong>{item.workspace}</strong>
              <p>{item.state} · {item.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AuthorizedSourceMap() {
  return (
    <section className={styles.sourceMap} aria-labelledby="authorized-source-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stationIndex}>FUTURE AUTHORIZED SOURCES</p>
          <h3 id="authorized-source-heading">Ownership remains distributed</h3>
        </div>
        <p>DOCUMENTED FUTURE CONTRACT · NOTHING CONNECTED</p>
      </div>
      <p>
        A future authorized projection may read from owning systems. Agency
        Command orchestrates their display; it does not take ownership of their
        canonical records. Kai interprets and prepares through authorized owners.
      </p>
      <dl>
        {AGENCY_AUTHORIZED_SOURCES.map((source) => (
          <div key={source.owner}>
            <dt>{source.owner}</dt>
            <dd>
              <strong>{source.futureSource}</strong>
              <span>{source.reviewState}</span>
            </dd>
          </div>
        ))}
      </dl>
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
