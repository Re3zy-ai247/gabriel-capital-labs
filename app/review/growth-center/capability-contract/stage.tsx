"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useCxosRoomRuntime } from "@/components/cxos/runtime/useCxosRoomRuntime";
import type {
  CxosExperienceProjection,
  CxosRoomRuntimeDefinition,
} from "@/lib/cxos/runtime";
import {
  CAPABILITY_CONTRACT_REJECTION_EXAMPLES,
  CAPABILITY_CONTRACTS,
  CAPABILITY_FIXTURES,
  CAPABILITY_KAI_QUESTIONS,
  CAPABILITY_OWNER_LABELS,
  CGN_ECONOMIC_PHASE_1A_STATUS,
  GROWTH_CAPABILITY_AGENCY_BOUNDARY,
  GROWTH_CAPABILITY_FIXTURE_SOURCE,
  GROWTH_CAPABILITY_INTERNAL_CONTRACT_NOTICE,
  GROWTH_CAPABILITY_KAI_RECEIPT,
  GROWTH_CAPABILITY_REVIEW_DISCLOSURE,
  GROWTH_CAPABILITY_REVIEW_SUMMARY,
  GROWTH_CAPABILITY_UNSUPPORTED_COPY,
  GROWTH_EXPERIENCE_PHASE_1A_STATUS,
  GROWTH_EXPERIENCE_PHASE_1B_STATUS,
  resolveCapabilityKaiExplanation,
  resolveCapabilityReviewRequest,
  type CapabilityContractId,
  type CapabilityFixtureId,
  type CapabilityReviewProjection,
} from "@/lib/growthNetwork/capabilityContract";
import styles from "./capability-contract.module.css";

const CAPABILITY_SECTION_IDS = [
  "contract-map",
  "state-lanes",
  "evidence-boundary",
  "privacy-boundary",
  "correction-appeal",
  "rejection-examples",
  "kai-explanation",
  "review-boundary",
] as const;

type CapabilitySectionId = (typeof CAPABILITY_SECTION_IDS)[number];

const CAPABILITY_RUNTIME = {
  roomId: "growth-capability-contract",
  districts: CAPABILITY_SECTION_IDS,
  initialDistrict: "contract-map",
  arrivalBeats: ["boundary", "contract", "owner", "state", "evidence"],
  arrivalDurationMs: { A: 1040, B: 540 },
  motionChannels: ["contract-pulse", "kai-presence"],
  kaiContextHoldDistricts: ["review-boundary"],
  departure: { href: "/review/growth-center", fallbackMs: 620 },
} satisfies CxosRoomRuntimeDefinition<CapabilitySectionId>;

const PHASE_STATUS_LABELS = [
  CGN_ECONOMIC_PHASE_1A_STATUS,
  GROWTH_EXPERIENCE_PHASE_1A_STATUS,
  GROWTH_EXPERIENCE_PHASE_1B_STATUS,
] as const;

function readProjectionFromLocation(): CapabilityReviewProjection {
  const params = new URLSearchParams(window.location.search);

  for (const key of params.keys()) {
    if (key !== "contract" && key !== "fixture") {
      return resolveCapabilityReviewRequest([], []);
    }
  }

  const contracts = params.getAll("contract");
  const fixtures = params.getAll("fixture");
  const contractInput =
    contracts.length === 0
      ? undefined
      : contracts.length === 1
        ? contracts[0]
        : contracts;
  const fixtureInput =
    fixtures.length === 0
      ? undefined
      : fixtures.length === 1
        ? fixtures[0]
        : fixtures;

  return resolveCapabilityReviewRequest(contractInput, fixtureInput);
}

function replaceReviewLocation(
  contractId: CapabilityContractId,
  fixtureId: CapabilityFixtureId,
  mode: "push" | "replace",
) {
  const params = new URLSearchParams();
  params.set("contract", contractId);
  params.set("fixture", fixtureId);
  const nextLocation = `${window.location.pathname}?${params.toString()}${window.location.hash}`;

  if (mode === "push") {
    window.history.pushState(null, "", nextLocation);
  } else {
    window.history.replaceState(null, "", nextLocation);
  }
}

interface GrowthCapabilityContractStageProps {
  initialProjection: CapabilityReviewProjection;
}

export function GrowthCapabilityContractStage({
  initialProjection,
}: GrowthCapabilityContractStageProps) {
  const [contractProjection, setContractProjection] =
    useState<CapabilityReviewProjection>(initialProjection);
  const [experienceProjection, setExperienceProjection] =
    useState<CxosExperienceProjection>("auto");
  const [kaiQuestionId, setKaiQuestionId] = useState<string>(
    "explain-capability",
  );
  const [announcement, setAnnouncement] = useState(
    "Growth Experience Phase 1B synthetic contract review loaded.",
  );

  const roomRootRef = useRef<HTMLElement>(null);
  const roomHeadingRef = useRef<HTMLHeadingElement>(null);

  const runtime = useCxosRoomRuntime({
    definition: CAPABILITY_RUNTIME,
    projection: experienceProjection,
    reducedMotionOverride: false,
    roomRootRef,
    roomHeadingRef,
    observerKey:
      contractProjection.kind === "SUPPORTED"
        ? `${contractProjection.contract.id}:${contractProjection.fixture.id}`
        : "unsupported",
    messages: {
      staticArrival:
        "The complete Growth capability-contract review is available as a static document.",
      escapeArrival:
        "Arrival skipped. The complete Growth capability-contract review is available.",
      departure: "Returning to the Growth Center Founder Preview.",
    },
    announce: setAnnouncement,
  });

  useEffect(() => {
    const synchronizeProjection = () => {
      const nextProjection = readProjectionFromLocation();
      setContractProjection(nextProjection);
      setKaiQuestionId("explain-capability");
      setAnnouncement(
        nextProjection.kind === "SUPPORTED"
          ? `${nextProjection.contract.label} restored from browser history.`
          : GROWTH_CAPABILITY_UNSUPPORTED_COPY,
      );
    };

    window.addEventListener("popstate", synchronizeProjection);
    return () => window.removeEventListener("popstate", synchronizeProjection);
  }, []);

  const selectedContractId =
    contractProjection.kind === "SUPPORTED"
      ? contractProjection.contract.id
      : null;
  const selectedFixtureId =
    contractProjection.kind === "SUPPORTED"
      ? contractProjection.fixture.id
      : null;

  const ownerResolved =
    contractProjection.kind === "SUPPORTED" &&
    contractProjection.ownerResolved;
  const contract =
    contractProjection.kind === "SUPPORTED"
      ? contractProjection.contract
      : null;

  const displayedLanes = useMemo(() => {
    if (
      contractProjection.kind !== "SUPPORTED" ||
      contractProjection.ownerResolved
    ) {
      return contractProjection.lanes;
    }

    return contractProjection.lanes.map((lane) => ({
      ...lane,
      owner: "OWNER_UNRESOLVED" as const,
      ownerLabel: CAPABILITY_OWNER_LABELS.OWNER_UNRESOLVED,
      value:
        lane.id === "availability"
          ? "OWNER_UNRESOLVED"
          : GROWTH_CAPABILITY_UNSUPPORTED_COPY,
    }));
  }, [contractProjection]);

  const kaiExplanation = useMemo(
    () =>
      resolveCapabilityKaiExplanation(contractProjection, kaiQuestionId),
    [contractProjection, kaiQuestionId],
  );

  const selectContract = (contractId: CapabilityContractId) => {
    const fixtureId = selectedFixtureId ?? "overview";
    const nextProjection = resolveCapabilityReviewRequest(
      contractId,
      fixtureId,
    );

    if (selectedContractId !== contractId || contractProjection.kind !== "SUPPORTED") {
      replaceReviewLocation(contractId, fixtureId, "push");
    }
    setContractProjection(nextProjection);
    setKaiQuestionId("explain-capability");
    setAnnouncement(
      nextProjection.kind === "SUPPORTED"
        ? `${nextProjection.contract.label} synthetic contract selected.`
        : GROWTH_CAPABILITY_UNSUPPORTED_COPY,
    );
  };

  const selectFixture = (fixtureId: CapabilityFixtureId) => {
    if (!selectedContractId) {
      setAnnouncement(
        "Select a supported contract before choosing a synthetic state fixture.",
      );
      return;
    }

    const contractId = selectedContractId;
    const nextProjection = resolveCapabilityReviewRequest(
      contractId,
      fixtureId,
    );

    replaceReviewLocation(contractId, fixtureId, "replace");
    setContractProjection(nextProjection);
    setKaiQuestionId("explain-capability");
    setAnnouncement(
      nextProjection.kind === "SUPPORTED"
        ? `${nextProjection.fixture.label} synthetic state fixture selected. Browser history was not extended.`
        : GROWTH_CAPABILITY_UNSUPPORTED_COPY,
    );
  };

  const selectExperienceProjection = (next: CxosExperienceProjection) => {
    if (next === "cinematic" && !runtime.resolution.cinematicAvailable) {
      setAnnouncement(
        "Cinematic projection is unavailable under the current conservative capability policy.",
      );
      return;
    }
    if (next === "cinematic" && runtime.capabilities.browserReduced) {
      setExperienceProjection("static");
      setAnnouncement(
        "The browser requests reduced motion, so the complete static projection remains active.",
      );
      return;
    }
    setExperienceProjection(next);
    setAnnouncement(`${next} experience projection selected.`);
  };

  const rootStyle = {
    "--capability-arrival-duration": `${runtime.arrivalDurationMs}ms`,
  } as CSSProperties;

  return (
    <main
      id="main"
      tabIndex={-1}
      ref={roomRootRef}
      className={styles.room}
      style={rootStyle}
      {...runtime.attributes}
      onAnimationEnd={runtime.completeDeparture}
    >
      <a className={styles.skipLink} href="#capability-heading">
        Skip to capability contract
      </a>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <div className={styles.ambientField} aria-hidden="true">
        <span />
        <span />
      </div>

      <header className={styles.roomHeader}>
        <div className={styles.identityBlock}>
          <span className={styles.identityMark} aria-hidden="true">
            CG
          </span>
          <div>
            <p>CreditVector Growth Network</p>
            <span>Capability Contract · Founder Preview</span>
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
                    "Arrival skipped. The complete capability contract is available.",
                })
              }
            >
              Skip arrival
            </button>
          ) : null}
          <a
            className={styles.returnLink}
            href="/review/growth-center"
            onClick={runtime.beginDeparture}
          >
            Back to Growth Center
          </a>
        </div>
      </header>

      <aside className={styles.compactBoundary} aria-label="Review status">
        <div>
          <strong>{GROWTH_CAPABILITY_REVIEW_SUMMARY}</strong>
          <a href="#full-review-boundary">Full boundary</a>
        </div>
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
              "Capability contract arrival complete. The synthetic review is ready.",
          });
        }}
      />

      <section className={styles.hero} aria-labelledby="capability-heading">
        <p className={styles.eyebrow}>Growth Experience Phase 1B</p>
        <h1 id="capability-heading" ref={roomHeadingRef} tabIndex={-1}>
          Build capability people can trust.
        </h1>
        <a className={styles.primaryJump} href="#contract-map">
          Choose a synthetic contract <span aria-hidden="true">↓</span>
        </a>
        <p className={styles.heroLead}>
          A non-monetary contract workbench for defining how future professional
          growth information could be owned, evidenced, reviewed, corrected,
          explained, and refused safely.
        </p>
        <p className={styles.contractNotice}>
          {GROWTH_CAPABILITY_INTERNAL_CONTRACT_NOTICE}
        </p>
        <nav className={styles.shortcutNav} aria-label="Contract review shortcuts">
          <a href="#state-lanes">Eight state lanes</a>
          <a href="#evidence-requirements">Evidence requirements</a>
          <a href="#refused-shortcuts">Refused shortcuts</a>
          <a href="#kai-explanation">Ask fixed Kai</a>
        </nav>
      </section>

      <section
        id="contract-map"
        className={styles.section}
        data-cxos-district="contract-map"
        data-active={runtime.activeDistrict === "contract-map" ? "true" : "false"}
        aria-labelledby="contract-map-heading"
      >
        <div className={styles.sectionLead}>
          <p>01 · Ownership map</p>
          <h2 id="contract-map-heading" tabIndex={-1}>
            Choose a contract boundary.
          </h2>
          <span>
            Contract changes add one browser-history entry. No selection is
            saved, submitted, or connected to a participant.
          </span>
        </div>

        <div className={styles.contractSelector} role="group" aria-label="Synthetic capability contracts">
          {CAPABILITY_CONTRACTS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={selectedContractId === item.id}
              onClick={() => selectContract(item.id)}
            >
              <span>{item.shortLabel}</span>
              <small>{CAPABILITY_OWNER_LABELS[item.canonicalOwner]}</small>
            </button>
          ))}
        </div>

        {contract ? (
          <article
            className={styles.contractSheet}
            data-owner-resolved={ownerResolved ? "true" : "false"}
          >
            <div className={styles.contractHeading}>
              <div>
                <p>Selected internal contract</p>
                <h3>{contract.label}</h3>
              </div>
              <span>
                {ownerResolved
                  ? `Canonical owner · ${CAPABILITY_OWNER_LABELS[contract.canonicalOwner]}`
                  : "OWNER_UNRESOLVED · fail closed"}
              </span>
            </div>
            <p className={styles.contractPurpose}>{contract.purpose}</p>

            {!ownerResolved ? (
              <p className={styles.unsupportedNotice} role="status">
                {GROWTH_CAPABILITY_UNSUPPORTED_COPY} A destination owner must be
                ratified before any favorable state can be represented.
              </p>
            ) : null}

            <dl className={styles.ownerGrid}>
              <div>
                <dt>Source ownership</dt>
                <dd>{contract.ownerExplanation}</dd>
              </div>
              <div>
                <dt>Growth may</dt>
                <dd>{contract.growthMay}</dd>
              </div>
              <div>
                <dt>Growth must not</dt>
                <dd>{contract.growthMustNot}</dd>
              </div>
              <div>
                <dt>Participation boundary</dt>
                <dd>{contract.participationBoundary}</dd>
              </div>
            </dl>

            <div className={styles.supportingOwners}>
              <strong>Supporting owner boundaries</strong>
              <ul>
                {contract.supportingOwners.map((owner) => (
                  <li key={owner}>{owner}</li>
                ))}
              </ul>
            </div>
          </article>
        ) : (
          <article className={styles.unsupportedPanel} role="status">
            <p>Unknown or duplicate review parameter</p>
            <h3>Unsupported state</h3>
            <span>{GROWTH_CAPABILITY_UNSUPPORTED_COPY}</span>
            <small>
              Select an approved contract above to recover. The rejected value
              is not echoed, stored, or inferred.
            </small>
          </article>
        )}

        <aside className={styles.agencyBoundary} aria-label="Agency boundary">
          <strong>Agency Builder boundary</strong>
          <p>{GROWTH_CAPABILITY_AGENCY_BOUNDARY}</p>
        </aside>
      </section>

      <section
        id="state-lanes"
        className={styles.section}
        data-cxos-district="state-lanes"
        data-active={runtime.activeDistrict === "state-lanes" ? "true" : "false"}
        aria-labelledby="state-lanes-heading"
      >
        <div className={styles.sectionLead}>
          <p>02 · State separation</p>
          <h2 id="state-lanes-heading" tabIndex={-1}>
            Eight lanes. No silent inference.
          </h2>
          <span>
            Availability, participation, evidence, completion, review,
            correction, appeal, and visibility remain independent. Completion
            never implies approval, qualification, reputation, or economics.
          </span>
        </div>

        <div className={styles.fixtureSelector} role="group" aria-label="Synthetic state fixtures">
          {CAPABILITY_FIXTURES.map((fixture) => (
            <button
              key={fixture.id}
              type="button"
              aria-pressed={selectedFixtureId === fixture.id}
              disabled={selectedContractId === null}
              onClick={() => selectFixture(fixture.id)}
            >
              {fixture.label}
            </button>
          ))}
        </div>
        <p className={styles.fixtureHistoryNote}>
          Fixture changes replace the current route state. They do not add
          history, detect a visit, or persist a preference. After a refused
          request, select a supported contract first.
        </p>

        <div className={styles.laneGrid}>
          {displayedLanes.map((lane, index) => (
            <article key={lane.id} className={styles.stateLane}>
              <div>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{lane.label}</h3>
              </div>
              <p>{lane.value}</p>
              <small>Owner · {lane.ownerLabel}</small>
            </article>
          ))}
        </div>
        <p className={styles.fixtureDetail}>
          <strong>Fixture explanation</strong>
          {contractProjection.fixture.detail}
        </p>
      </section>

      <section
        id="evidence-boundary"
        className={styles.section}
        data-cxos-district="evidence-boundary"
        data-active={runtime.activeDistrict === "evidence-boundary" ? "true" : "false"}
        aria-labelledby="evidence-boundary-heading"
      >
        <div className={styles.sectionLead}>
          <p>03 · Evidence boundary</p>
          <h2 id="evidence-boundary-heading" tabIndex={-1}>
            Evidence needs provenance, purpose, and an owner.
          </h2>
          <span>
            These are fictional requirement classes, not uploads, submissions,
            assessments, verification, or acceptance.
          </span>
        </div>

        <div className={styles.evidenceColumns}>
          <article id="evidence-requirements">
            <p>Evidence-requirement preview</p>
            <h3>Required before future review</h3>
            {contract && ownerResolved ? (
              <ol>
                {contract.evidenceRequirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ol>
            ) : (
              <p className={styles.closedCopy}>
                Requirements unavailable until a canonical owner is resolved.
                No evidence state is inferred.
              </p>
            )}
          </article>
          <article id="refused-shortcuts">
            <p>Deterministic refusals</p>
            <h3>Signals that cannot stand in for quality</h3>
            {contract && ownerResolved ? (
              <ul>
                {contract.refusedShortcuts.map((shortcut) => (
                  <li key={shortcut}>{shortcut}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.closedCopy}>
                Ownerless evidence is refused. Popularity, volume, recruiting,
                and self-claims never create a favorable state.
              </p>
            )}
          </article>
        </div>
        {contractProjection.kind === "SUPPORTED" && ownerResolved ? (
          <dl
            className={styles.evidenceContract}
            aria-label="Eleven-part synthetic evidence contract"
          >
            {contractProjection.evidenceContract.map((item) => (
              <div key={item.id}>
                <dt>{item.label}</dt>
                <dd>
                  {item.value}
                  <span>Owner · {item.ownerLabel}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <section
        id="privacy-boundary"
        className={styles.section}
        data-cxos-district="privacy-boundary"
        data-active={runtime.activeDistrict === "privacy-boundary" ? "true" : "false"}
        aria-labelledby="privacy-boundary-heading"
      >
        <div className={styles.sectionLead}>
          <p>04 · Privacy and visibility</p>
          <h2 id="privacy-boundary-heading" tabIndex={-1}>
            Hidden unless an owner explicitly permits a summary.
          </h2>
          <span>
            Unknown visibility fails closed. Public, named-peer,
            named-worker, customer, and cross-organization projections are not
            supported in this Preview.
          </span>
        </div>
        <div className={styles.privacyFrame}>
          <div>
            <p>Selected contract</p>
            <strong>
              {contract?.privacyBoundary ??
                "No owner-qualified privacy boundary is available."}
            </strong>
          </div>
          <ul>
            <li>No user, session, organization, customer, or participant data.</li>
            <li>No input, analytics, telemetry, cookies, or browser storage.</li>
            <li>No realistic names, presence, protected attributes, or worker evaluation.</li>
            <li>No private state is placed in the URL.</li>
          </ul>
        </div>
      </section>

      <section
        id="correction-appeal"
        className={styles.section}
        data-cxos-district="correction-appeal"
        data-active={runtime.activeDistrict === "correction-appeal" ? "true" : "false"}
        aria-labelledby="correction-appeal-heading"
      >
        <div className={styles.sectionLead}>
          <p>05 · Human recourse</p>
          <h2 id="correction-appeal-heading" tabIndex={-1}>
            Correction and appeal are different paths.
          </h2>
          <span>
            Both are fictional state previews. There is no case, submission,
            workflow, reviewer, or live decision.
          </span>
        </div>
        <div className={styles.recourseGrid}>
          <article>
            <span>Preview correction path</span>
            <h3>Challenge a source fact.</h3>
            <p>
              A correction would return to the canonical owner of the challenged
              fact. Growth may explain that route but cannot open, store, or
              resolve it.
            </p>
            <dl>
              <div>
                <dt>Conceptual owner</dt>
                <dd>
                  {contract
                    ? CAPABILITY_OWNER_LABELS[contract.correctionOwner]
                    : "Owner unresolved"}
                </dd>
              </div>
              <div>
                <dt>Fixture state</dt>
                <dd>{displayedLanes.find((lane) => lane.id === "correction")?.value}</dd>
              </div>
            </dl>
          </article>
          <article>
            <span>Preview appeal state</span>
            <h3>Challenge a review decision.</h3>
            <p>
              A future appeal requires an underlying decision, policy, and a
              human reviewer distinct from the original reviewer. Growth and Kai
              cannot adjudicate it.
            </p>
            <dl>
              <div>
                <dt>Conceptual owner</dt>
                <dd>
                  {contract
                    ? CAPABILITY_OWNER_LABELS[contract.appealOwner]
                    : "Owner unresolved"}
                </dd>
              </div>
              <div>
                <dt>Fixture state</dt>
                <dd>{displayedLanes.find((lane) => lane.id === "appeal")?.value}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section
        id="rejection-examples"
        className={styles.section}
        data-cxos-district="rejection-examples"
        data-active={runtime.activeDistrict === "rejection-examples" ? "true" : "false"}
        aria-labelledby="rejection-examples-heading"
      >
        <div className={styles.sectionLead}>
          <p>06 · Anti-gaming contract</p>
          <h2 id="rejection-examples-heading" tabIndex={-1}>
            Review shortcuts fail closed.
          </h2>
          <span>
            These are deterministic rejection examples for architecture review,
            not fraud detection, participant findings, or enforcement actions.
          </span>
        </div>
        <ol className={styles.rejectionList}>
          {CAPABILITY_CONTRACT_REJECTION_EXAMPLES.map((example, index) => (
            <li key={example}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{example}</p>
              <strong>Refuse / human policy required</strong>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="kai-explanation"
        className={styles.section}
        data-cxos-district="kai-explanation"
        data-active={runtime.activeDistrict === "kai-explanation" ? "true" : "false"}
        aria-labelledby="kai-explanation-heading"
      >
        <div className={styles.sectionLead}>
          <p>07 · Kai Growth Advisor · deterministic review mode</p>
          <h2 id="kai-explanation-heading" tabIndex={-1}>
            Kai explains the boundary. Kai never decides it.
          </h2>
          <span>
            Choose one fixed question. There is no prompt, personalization,
            model call, live source, memory, submission, or action.
          </span>
        </div>

        <div className={styles.kaiWorkbench}>
          <div className={styles.kaiQuestions} role="group" aria-label="Fixed Kai explanations">
            {CAPABILITY_KAI_QUESTIONS.map((question) => (
              <button
                key={question.id}
                type="button"
                aria-pressed={kaiExplanation.questionId === question.id}
                onClick={() => {
                  setKaiQuestionId(question.id);
                  setAnnouncement(`${question.label} fixed explanation selected.`);
                }}
              >
                {question.label}
              </button>
            ))}
          </div>

          <article className={styles.kaiAnswer} aria-live="polite">
            <div>
              <span className={styles.kaiMark} aria-hidden="true">K</span>
              <p>Kai · fixed synthetic explanation</p>
            </div>
            <h3>{kaiExplanation.title}</h3>
            <p>{kaiExplanation.summary}</p>
            <dl>
              <div>
                <dt>Owner explanation</dt>
                <dd>{kaiExplanation.ownerExplanation}</dd>
              </div>
              <div>
                <dt>Fixture source</dt>
                <dd>{kaiExplanation.fixtureSource}</dd>
              </div>
            </dl>
            {kaiExplanation.evidenceChecklist.length > 0 ? (
              <div className={styles.kaiList}>
                <strong>Evidence checklist</strong>
                <ul>
                  {kaiExplanation.evidenceChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className={styles.kaiList}>
              <strong>Permitted review steps</strong>
              <ul>
                {kaiExplanation.permittedReviewSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.kaiList}>
              <strong>Refusals</strong>
              <ul>
                {kaiExplanation.refusals.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        </div>
        <p className={styles.kaiReceipt}>
          <strong>Deterministic no-action receipt</strong>
          {GROWTH_CAPABILITY_KAI_RECEIPT}
        </p>
      </section>

      <section
        id="review-boundary"
        className={`${styles.section} ${styles.fullBoundary}`}
        data-cxos-district="review-boundary"
        data-active={runtime.activeDistrict === "review-boundary" ? "true" : "false"}
        aria-labelledby="full-review-boundary"
      >
        <div className={styles.sectionLead}>
          <p>08 · Full review boundary</p>
          <h2 id="full-review-boundary" tabIndex={-1}>
            Protected, synthetic, and economically dormant.
          </h2>
        </div>
        <p className={styles.fullDisclosure}>
          {GROWTH_CAPABILITY_REVIEW_DISCLOSURE}
        </p>
        <ul className={styles.fullStatusList}>
          {PHASE_STATUS_LABELS.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
        <dl className={styles.boundaryLedger}>
          <div>
            <dt>Review source</dt>
            <dd>{GROWTH_CAPABILITY_FIXTURE_SOURCE}</dd>
          </div>
          <div>
            <dt>Production safety</dt>
            <dd>
              Production hard-off · no schema · no migrations · no participant
              data · no enrollment · no commerce · no payout · no model
            </dd>
          </div>
          <div>
            <dt>Growth ownership</dt>
            <dd>
              Contract grammar and authorized projection only. Canonical source
              owners remain separate.
            </dd>
          </div>
        </dl>
      </section>

      <details className={styles.director}>
        <summary>Director · Review presentation controls</summary>
        <div className={styles.directorPanel}>
          <fieldset>
            <legend>Experience projection</legend>
            <div className={styles.controlRow}>
              {(["auto", "cinematic", "static"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={experienceProjection === option}
                  disabled={
                    option === "cinematic" &&
                    !runtime.resolution.cinematicAvailable
                  }
                  onClick={() => selectExperienceProjection(option)}
                >
                  {option[0].toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
            <p>
              Tier {runtime.resolution.tier} · {runtime.resolution.reason}
            </p>
          </fieldset>
          <button
            type="button"
            className={styles.replayButton}
            onClick={() =>
              runtime.replayArrival(
                "The deterministic capability-contract arrival is replaying.",
              )
            }
          >
            Replay arrival
          </button>
          <p className={styles.directorTruth}>
            Presentation only · no storage · no network · no model · no action
          </p>
        </div>
      </details>

      <footer className={styles.roomFooter}>
        <div>
          <p>Growth Experience Phase 1B</p>
          <strong>Capability contract · Founder review only</strong>
        </div>
        <a href="/review/growth-center" onClick={runtime.beginDeparture}>
          Return to Growth Center
        </a>
      </footer>
    </main>
  );
}
