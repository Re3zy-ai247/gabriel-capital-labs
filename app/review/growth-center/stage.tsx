"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useCxosRoomRuntime } from "@/components/cxos/runtime/useCxosRoomRuntime";
import type {
  CxosExperienceProjection,
  CxosRoomRuntimeDefinition,
} from "@/lib/cxos/runtime";
import {
  GROWTH_EXPLANATION_INTENTS,
  GROWTH_CENTER_DISTRICTS,
  GROWTH_CENTER_DISTRICT_IDS,
  GROWTH_CENTER_EXPERIENCE_VERSION,
  GROWTH_CENTER_FIXTURE_SOURCE,
  GROWTH_CENTER_HEARTBEAT,
  GROWTH_CENTER_KAI_DISCLOSURE,
  GROWTH_CENTER_KAI_NO_ACTION_RECEIPT,
  GROWTH_CENTER_LENSES,
  GROWTH_CENTER_REVIEW_DISCLOSURE,
  GROWTH_CENTER_REVIEW_SUMMARY,
  GROWTH_CENTER_VALUES,
  GROWTH_CENTER_VISIT_FIXTURES,
  resolveGrowthExplanationPlan,
  type GrowthExplanationIntentId,
  type GrowthCenterDistrict,
  type GrowthCenterDistrictId,
  type GrowthCenterLensId,
  type GrowthCenterVisitFixture,
} from "@/lib/growthNetwork/experience";
import styles from "./growth-center.module.css";

const GROWTH_CENTER_ARRIVAL_BEATS = [
  "orientation",
  "contribution-principle",
  "network-map",
  "heartbeat",
  "kai-recommendation",
  "district-settlement",
] as const;

const GROWTH_CENTER_MOTION_CHANNELS = [
  "network-breath",
  "contribution-flow",
  "kai-beacon",
] as const;

const GROWTH_CENTER_RUNTIME = {
  roomId: "growth-center",
  districts: GROWTH_CENTER_DISTRICT_IDS,
  initialDistrict: "growth-center",
  arrivalBeats: GROWTH_CENTER_ARRIVAL_BEATS,
  arrivalDurationMs: { A: 1380, B: 680 },
  motionChannels: GROWTH_CENTER_MOTION_CHANNELS,
  departure: { href: "/review", fallbackMs: 760 },
} satisfies CxosRoomRuntimeDefinition<GrowthCenterDistrictId>;

const PLANE_LABELS = {
  protagonist: "Growth Center protagonist",
  "professional-capability": "Professional capability plane",
  "ecosystem-value": "Ecosystem value plane",
  "organization-path": "Optional organization path",
} as const;

const NON_PROTAGONIST_DISTRICTS = GROWTH_CENTER_DISTRICTS.filter(
  (district) => district.id !== "growth-center",
);

function isPlainPrimaryClick(event: ReactMouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

interface DistrictSectionProps {
  district: GrowthCenterDistrict;
  index: number;
  active: boolean;
  onNavigate: (
    event: ReactMouseEvent<HTMLAnchorElement>,
    districtId: GrowthCenterDistrictId,
  ) => void;
}

function DistrictSection({
  district,
  index,
  active,
  onNavigate,
}: DistrictSectionProps) {
  const canonicalIndex = GROWTH_CENTER_DISTRICT_IDS.indexOf(district.id);
  const nextId =
    GROWTH_CENTER_DISTRICT_IDS[
      Math.min(canonicalIndex + 1, GROWTH_CENTER_DISTRICT_IDS.length - 1)
    ];
  const nextDistrict = GROWTH_CENTER_DISTRICTS.find(
    (candidate) => candidate.id === nextId,
  );

  return (
    <section
      id={district.id}
      className={styles.district}
      data-cxos-district={district.id}
      data-active={active ? "true" : "false"}
      aria-labelledby={`${district.id}-heading`}
    >
      <div className={styles.districtIndex} aria-hidden="true">
        {String(index + 2).padStart(2, "0")}
      </div>
      <div className={styles.districtBody}>
        <p className={styles.planeLabel}>{PLANE_LABELS[district.plane]}</p>
        <h2 id={`${district.id}-heading`} tabIndex={-1}>
          {district.label}
        </h2>
        <p className={styles.districtPurpose}>{district.purpose}</p>

        <dl className={styles.districtTruth}>
          <div>
            <dt>How can I become more valuable?</dt>
            <dd>{district.opportunity}</dd>
          </div>
          <div>
            <dt>Fictional review source</dt>
            <dd>{district.evidence}</dd>
          </div>
          <div>
            <dt>Review cue</dt>
            <dd>{district.nextAction}</dd>
          </div>
        </dl>

        <p className={styles.unavailable} role="note">
          <span>Unavailable / no live system</span>
          {district.boundary}
        </p>

        {district.id === "agency-builder" ? (
          <p className={styles.distributionRefusal}>
            No live Growth Distribution.
          </p>
        ) : null}

        {nextDistrict && nextDistrict.id !== district.id ? (
          <a
            className={styles.nextDistrict}
            href={`#${nextDistrict.id}`}
            onClick={(event) => onNavigate(event, nextDistrict.id)}
          >
            Next district <span aria-hidden="true">↓</span>
            <strong>{nextDistrict.shortLabel}</strong>
          </a>
        ) : (
          <a
            className={styles.nextDistrict}
            href="#growth-center"
            onClick={(event) => onNavigate(event, "growth-center")}
          >
            Return to <strong>Your Growth Brief</strong>
          </a>
        )}
      </div>
    </section>
  );
}

export function GrowthCenterStage() {
  const [projection, setProjection] =
    useState<CxosExperienceProjection>("auto");
  const [lensId, setLensId] = useState<GrowthCenterLensId>("building");
  const [explanationIntentId, setExplanationIntentId] =
    useState<GrowthExplanationIntentId>("BUILD_NEXT");
  const [visitFixture, setVisitFixture] =
    useState<GrowthCenterVisitFixture>("first");
  const [announcement, setAnnouncement] = useState(
    "Growth Center synthetic Founder review loaded.",
  );

  const roomRootRef = useRef<HTMLElement>(null);
  const roomHeadingRef = useRef<HTMLHeadingElement>(null);

  const resetRouteFixture = useCallback(() => {
    setLensId("building");
    setExplanationIntentId("BUILD_NEXT");
    setVisitFixture("first");
  }, []);

  const runtime = useCxosRoomRuntime({
    definition: GROWTH_CENTER_RUNTIME,
    projection,
    reducedMotionOverride: false,
    roomRootRef,
    roomHeadingRef,
    observerKey: `${lensId}:${visitFixture}`,
    messages: {
      staticArrival:
        "Growth Center is available as a complete static review document.",
      escapeArrival:
        "Growth Center arrival skipped. The complete review is available.",
      departure: "Returning from the Growth Center Founder review.",
    },
    announce: setAnnouncement,
    onRouteReset: resetRouteFixture,
  });
  const moveToDistrict = runtime.moveToDistrict;

  useEffect(() => {
    let frame: number | null = null;
    const synchronizeDistrict = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const requested = window.location.hash.slice(1);
        const isDistrict = (
          GROWTH_CENTER_DISTRICT_IDS as readonly string[]
        ).includes(requested);

        // The runtime owns only district history. Other fragment links, such as
        // the full review boundary, keep native browser scroll and focus.
        if (requested && !isDistrict) return;

        const districtId = requested
          ? (requested as GrowthCenterDistrictId)
          : "growth-center";
        moveToDistrict(districtId);
        setAnnouncement(
          `${GROWTH_CENTER_DISTRICTS.find((district) => district.id === districtId)?.label ?? districtId} restored from browser history.`,
        );
      });
    };

    if (window.location.hash) synchronizeDistrict();
    window.addEventListener("popstate", synchronizeDistrict);
    window.addEventListener("hashchange", synchronizeDistrict);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", synchronizeDistrict);
      window.removeEventListener("hashchange", synchronizeDistrict);
    };
  }, [moveToDistrict]);

  const explanationPlan = useMemo(
    () => resolveGrowthExplanationPlan(lensId, explanationIntentId),
    [explanationIntentId, lensId],
  );
  const activeDistrictDefinition = GROWTH_CENTER_DISTRICTS.find(
    (district) => district.id === runtime.activeDistrict,
  );
  const activeDistrictIndex = GROWTH_CENTER_DISTRICT_IDS.indexOf(
    runtime.activeDistrict,
  );
  const previousDistrict =
    GROWTH_CENTER_DISTRICT_IDS[Math.max(0, activeDistrictIndex - 1)];
  const nextDistrict =
    GROWTH_CENTER_DISTRICT_IDS[
      Math.min(GROWTH_CENTER_DISTRICT_IDS.length - 1, activeDistrictIndex + 1)
    ];

  const navigateToDistrict = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    districtId: GrowthCenterDistrictId,
  ) => {
    if (!isPlainPrimaryClick(event)) return;
    event.preventDefault();
    const nextHash = `#${districtId}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
    moveToDistrict(districtId);
    setAnnouncement(
      `${GROWTH_CENTER_DISTRICTS.find((district) => district.id === districtId)?.label ?? districtId} selected.`,
    );
  };

  const selectVisitFixture = (next: GrowthCenterVisitFixture) => {
    setVisitFixture(next);
    const fixture = GROWTH_CENTER_VISIT_FIXTURES[next];
    const fixtureHash = `#${fixture.districtId}`;

    // Fixture controls replace their route-local starting point because fixture
    // state is intentionally not persisted in browser history. District links
    // remain the only interactions that push navigable district history.
    if (window.location.hash !== fixtureHash) {
      window.history.replaceState(null, "", fixtureHash);
    }
    moveToDistrict(fixture.districtId);

    if (next === "return") {
      runtime.settleArrival({
        focus: { kind: "district", districtId: fixture.districtId },
        announcement:
          "Return visit fixture selected. Continue from Mentorship is ready for review; no visit history was read or saved.",
      });
      return;
    }
    runtime.replayArrival(
      "First visit fixture selected. The deterministic arrival is replaying; no visit history was read or saved.",
    );
  };

  const selectProjection = (next: CxosExperienceProjection) => {
    if (next === "cinematic" && !runtime.resolution.cinematicAvailable) {
      setAnnouncement(
        "Cinematic projection is unavailable under the current conservative capability policy.",
      );
      return;
    }
    if (next === "cinematic" && runtime.capabilities.browserReduced) {
      setProjection("static");
      setAnnouncement(
        "The browser requests reduced motion, so the complete static projection remains active.",
      );
      return;
    }
    setProjection(next);
    setAnnouncement(`${next} experience projection selected.`);
  };

  const rootStyle = {
    "--growth-arrival-duration": `${runtime.arrivalDurationMs}ms`,
  } as CSSProperties;

  return (
    <main
      id="main"
      tabIndex={-1}
      data-growth-room="growth-center-room"
      ref={roomRootRef}
      className={styles.room}
      style={rootStyle}
      {...runtime.attributes}
      onAnimationEnd={runtime.completeDeparture}
    >
      <a className={styles.skipLink} href="#growth-center-heading">
        Skip to Your Growth Brief
      </a>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <div className={styles.ambientField} aria-hidden="true">
        <span className={styles.ambientArcOne} />
        <span className={styles.ambientArcTwo} />
      </div>

      <header className={styles.roomHeader}>
        <div className={styles.identityBlock}>
          <span className={styles.identityMark} aria-hidden="true">
            CG
          </span>
          <div>
            <p>CreditVector Growth Network</p>
            <span>Growth Center Foundation Preview</span>
          </div>
        </div>

        <div className={styles.headerActions}>
          {!runtime.arrivalSettled ? (
            <button
              type="button"
              className={styles.quietButton}
              onClick={() =>
                runtime.settleArrival({
                  focus: { kind: "room" },
                  announcement:
                    "Arrival skipped. The complete Growth Center review is available.",
                })
              }
            >
              Skip arrival
            </button>
          ) : null}
          <a
            className={styles.returnLink}
            href="/review"
            onClick={runtime.beginDeparture}
          >
            Return to Founder Review
          </a>
        </div>
      </header>

      <details className={styles.director}>
        <summary>Director · Review controls</summary>
        <div className={styles.directorPanel}>
          <fieldset>
            <legend>Experience projection</legend>
            <div className={styles.controlRow}>
              {(["auto", "cinematic", "static"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={projection === option}
                  disabled={
                    option === "cinematic" &&
                    !runtime.resolution.cinematicAvailable
                  }
                  onClick={() => selectProjection(option)}
                >
                  {option[0].toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
            <p>
              Tier {runtime.resolution.tier} · {runtime.resolution.reason}
            </p>
          </fieldset>

          <fieldset>
            <legend>Visit fixture — explicit, never detected</legend>
            <div className={styles.controlRow}>
              {(["first", "return"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={visitFixture === option}
                  onClick={() => selectVisitFixture(option)}
                >
                  {GROWTH_CENTER_VISIT_FIXTURES[option].label}
                </button>
              ))}
            </div>
            <p>{GROWTH_CENTER_VISIT_FIXTURES[visitFixture].note}</p>
          </fieldset>

          <fieldset>
            <legend>Synthetic operator lens</legend>
            <div className={styles.controlRow}>
              {Object.entries(GROWTH_CENTER_LENSES).map(([key, lens]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={lensId === key}
                  onClick={() => {
                    setLensId(key as GrowthCenterLensId);
                    setAnnouncement(`${lens.label} synthetic lens selected.`);
                  }}
                >
                  {lens.label}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            className={styles.replayButton}
            onClick={() => selectVisitFixture("first")}
          >
            Replay arrival
          </button>
          <p className={styles.directorTruth}>
            Growth Center fixture only · no Growth-owned data request, storage,
            analytics, telemetry, model, or action · inherited shell session/theme
            behavior may run
          </p>
        </div>
      </details>

      <aside className={styles.reviewBoundary} aria-label="Review boundary">
        <strong>Founder review · Fictional data · No live systems</strong>
        <p>{GROWTH_CENTER_REVIEW_SUMMARY}</p>
        <a href="#full-review-boundary">Read the full review boundary</a>
      </aside>

      <div
        key={runtime.arrivalKey}
        className={styles.arrivalSignal}
        aria-hidden="true"
        onAnimationEnd={() => {
          if (runtime.arrivalSettled) return;
          runtime.settleArrival({
            focus: { kind: "room" },
            announcement:
              "Growth Center arrival complete. Your Growth Brief is ready.",
          });
        }}
      >
        <span />
      </div>

      <section
        id="growth-center"
        className={styles.hero}
        data-cxos-district="growth-center"
        data-active={runtime.activeDistrict === "growth-center" ? "true" : "false"}
        aria-labelledby="growth-center-heading"
      >
        <div className={styles.heroCopy}>
          <div className={styles.heroPrelude}>
            <p className={styles.eyebrow}>
              Growth Center · Your Growth Brief
            </p>
            <a
              className={styles.nextContributionLink}
              href={`#${explanationPlan.districtId}`}
              onClick={(event) =>
                navigateToDistrict(event, explanationPlan.districtId)
              }
            >
              <span>Fixed next contribution</span>
              <strong>{explanationPlan.title}</strong>
            </a>
          </div>
          <h1 id="growth-center-heading" ref={roomHeadingRef} tabIndex={-1}>
            Build the capabilities behind a stronger business.
          </h1>
          <p className={styles.proposition}>
            Explore how CreditVector could support the business you are building
            through professional development, education, mentorship, and useful
            contribution.
          </p>
          <p className={styles.principle}>
            Contribution creates opportunity. <strong>Recruiting is not rewarded.</strong>
          </p>

          {visitFixture === "return" ? (
            <p className={styles.returnFixture}>
              <span>Return visit fixture</span>
              Continue from Mentorship. This cue is fictional and route-instance
              only; no history was read or saved.
            </p>
          ) : null}

        </div>

        <div
          className={styles.contributionCompass}
          role="group"
          aria-labelledby="compass-title"
        >
          <div className={styles.compassCore}>
            <p id="compass-title">Contribution compass</p>
            <strong>Become more useful</strong>
            <span>Growth follows capability, care, and evidence.</span>
          </div>
          <ol>
            {GROWTH_CENTER_VALUES.map((value, index) => {
              const angle = index * 40 - 90;
              return (
              <li
                key={value}
                style={
                  {
                    "--value-angle": `${angle}deg`,
                    "--value-counter-angle": `${angle * -1}deg`,
                  } as CSSProperties
                }
              >
                {value}
              </li>
              );
            })}
          </ol>
          <p className={styles.compassDefinition}>
            Prosper means durable capability, healthy work, and a stronger
            ecosystem—not an earnings claim.
          </p>
        </div>

        <div className={styles.pathPair}>
          <article>
            <p>Path A · Optional organization path</p>
            <h2>Agency Builder</h2>
            <span>
              Steward onboarding, mentorship, operator success, retention quality,
              and ecosystem health. Never recruitment.
            </span>
            <strong>No live Growth Distribution.</strong>
          </article>
          <article>
            <p>Path B · Independent professional path</p>
            <h2>Professional Operator</h2>
            <span>
              Build capability through education, mentorship, useful creations,
              consulting craft, and contribution—without owning an agency.
            </span>
            <strong>No live program or opportunity listing.</strong>
          </article>
        </div>
      </section>

      <section className={styles.heartbeat} aria-labelledby="heartbeat-heading">
        <div className={styles.sectionLead}>
          <p className={styles.eyebrow}>Environmental heartbeat · qualitative fixture</p>
          <h2 id="heartbeat-heading">Growth is a contribution lifecycle.</h2>
          <p>
            This fixed sequence is a design metaphor, not performance,
            eligibility, Growth Reputation, or a program record.
          </p>
        </div>
        <ol>
          {GROWTH_CENTER_HEARTBEAT.map((beat, index) => (
            <li key={beat.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{beat.label}</strong>
              <p>{beat.meaning}</p>
            </li>
          ))}
        </ol>
        <p className={styles.heartbeatEquivalent}>
          Text equivalent: Develop → Mentor or Teach → Contribute → Verify →
          Strengthen Ecosystem.
        </p>
      </section>

      <div className={styles.operatingField}>
        <nav className={styles.districtRail} aria-label="Growth Center districts">
          <p>Connected districts</p>
          <ol>
            {GROWTH_CENTER_DISTRICTS.map((district, index) => (
              <li key={district.id}>
                <a
                  href={`#${district.id}`}
                  aria-current={
                    runtime.activeDistrict === district.id ? "location" : undefined
                  }
                  onClick={(event) => navigateToDistrict(event, district.id)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {district.shortLabel}
                </a>
              </li>
            ))}
          </ol>
          <p className={styles.currentDistrict}>
            Current district
            <strong>{activeDistrictDefinition?.shortLabel}</strong>
          </p>
          <div className={styles.mobileDistrictControls}>
            {activeDistrictIndex === 0 ? (
              <span aria-disabled="true">Previous</span>
            ) : (
              <a
                href={`#${previousDistrict}`}
                onClick={(event) =>
                  navigateToDistrict(event, previousDistrict)
                }
              >
                Previous
              </a>
            )}
            {activeDistrictIndex === GROWTH_CENTER_DISTRICT_IDS.length - 1 ? (
              <span aria-disabled="true">Next</span>
            ) : (
              <a
                href={`#${nextDistrict}`}
                onClick={(event) => navigateToDistrict(event, nextDistrict)}
              >
                Next
              </a>
            )}
          </div>
        </nav>

        <div className={styles.districtSequence}>
          {NON_PROTAGONIST_DISTRICTS.map((district, index) => (
            <DistrictSection
              key={district.id}
              district={district}
              index={index}
              active={runtime.activeDistrict === district.id}
              onNavigate={navigateToDistrict}
            />
          ))}
        </div>
      </div>

      <section className={styles.kaiSuite} aria-labelledby="kai-heading">
        <div className={styles.kaiIdentity}>
          <span className={styles.kaiBeacon} aria-hidden="true" />
          <p>Kai · Credit Intelligence Officer · route-local review mode</p>
          <h2 id="kai-heading">Deterministic Growth Explanation Mode</h2>
          <p>{GROWTH_CENTER_KAI_DISCLOSURE}</p>
        </div>

        <div className={styles.kaiWorkspace}>
          <div
            className={styles.intentList}
            role="group"
            aria-label="Fixed deterministic Growth explanation questions"
          >
            {GROWTH_EXPLANATION_INTENTS.map((intent) => (
              <button
                key={intent.id}
                type="button"
                aria-pressed={explanationIntentId === intent.id}
                onClick={() => {
                  setExplanationIntentId(intent.id);
                  setAnnouncement(
                    `${intent.label}. Fixed synthetic explanation selected.`,
                  );
                }}
              >
                {intent.label}
              </button>
            ))}
          </div>

          <article className={styles.explanationPlan}>
            <p>Fixed synthetic explanation · {GROWTH_CENTER_LENSES[lensId].label}</p>
            <h3>{explanationPlan.title}</h3>
            <p>{explanationPlan.rationale}</p>
            <ol>
              {explanationPlan.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className={styles.fixtureSource}>
              Source: {explanationPlan.source}. Active room context: {runtime.kaiContextDistrict}.
            </p>
            <a
              href={`#${explanationPlan.districtId}`}
              onClick={(event) =>
                navigateToDistrict(event, explanationPlan.districtId)
              }
            >
              Review referenced district <span aria-hidden="true">→</span>
            </a>
          </article>
        </div>
        <p className={styles.noActionReceipt}>{GROWTH_CENTER_KAI_NO_ACTION_RECEIPT}</p>
      </section>

      <aside
        id="full-review-boundary"
        tabIndex={-1}
        className={styles.fullReviewBoundary}
        aria-label="Full review boundary"
      >
        <strong>Full review boundary</strong>
        <p>{GROWTH_CENTER_REVIEW_DISCLOSURE}</p>
      </aside>

      <footer className={styles.roomFooter}>
        <div>
          <p>Growth Center Foundation Preview</p>
          <span>
            Version {GROWTH_CENTER_EXPERIENCE_VERSION} · {GROWTH_CENTER_FIXTURE_SOURCE}
          </span>
        </div>
        <a href="/review" onClick={runtime.beginDeparture}>
          Return to Founder Review
        </a>
      </footer>
    </main>
  );
}
