// Run: node --import tsx scripts/growth-capability-contract.test.ts
//
// DB-less executable + source guard for Growth Experience Phase 1B-R. It pins
// the literal positive 7 x 10 decision table, authority/status taxonomy,
// semantic separation laws, fail-closed input handling, deterministic Kai
// boundary, reversible browser history, single live region, privacy wording,
// and the absence of participant/economic/runtime authority.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import {
  CAPABILITY_CONTRACT_IDS,
  CAPABILITY_CONTRACT_REJECTION_EXAMPLES,
  CAPABILITY_CONTRACTS,
  CAPABILITY_EVIDENCE_ITEM_IDS,
  CAPABILITY_FIXTURE_DECISIONS,
  CAPABILITY_FIXTURE_IDS,
  CAPABILITY_FIXTURES,
  CAPABILITY_KAI_QUESTION_IDS,
  CAPABILITY_KAI_QUESTIONS,
  CAPABILITY_SEMANTIC_LAWS,
  CGN_ECONOMIC_PHASE_1A_STATUS,
  GROWTH_ACTIVATION_STATUS,
  GROWTH_CAPABILITY_AGENCY_BOUNDARY,
  GROWTH_CAPABILITY_FIXTURE_SOURCE,
  GROWTH_CAPABILITY_INTERNAL_CONTRACT_NOTICE,
  GROWTH_CAPABILITY_KAI_RECEIPT,
  GROWTH_CAPABILITY_REVIEW_DISCLOSURE,
  GROWTH_CAPABILITY_REVIEW_SUMMARY,
  GROWTH_CAPABILITY_UNSUPPORTED_COPY,
  GROWTH_EXPERIENCE_PHASE_1A_STATUS,
  GROWTH_EXPERIENCE_PHASE_1B_CONTRACT_STATUS,
  GROWTH_EXPERIENCE_PHASE_1B_R_STATUS,
  GROWTH_EXPERIENCE_PHASE_1B_WORK_STATUS,
  GROWTH_LIVE_ECONOMICS_STATUS,
  resolveCapabilityKaiExplanation,
  resolveCapabilityReviewRequest,
  type CapabilityContractId,
  type CapabilityFixtureId,
  type CapabilityReviewProjection,
  type CapabilityReviewResultKind,
} from "../lib/growthNetwork/capabilityContract";
import { growthCapabilityContractPreviewEnabled } from "../lib/growthNetwork/capabilityPreviewFlags";
import { growthCenterPreviewEnabled } from "../lib/growthNetwork/previewFlags";
import { reviewServerBuildAllowed } from "../lib/cxos/reviewMode";

const ROOT = join(__dirname, "..");
let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${label}`);
  }
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function sourceOrEmpty(path: string): string {
  const absolute = join(ROOT, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function codeOf(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const expectedContractIds = [
  "professional-capability",
  "development-pathway",
  "mentorship",
  "education",
  "operator-contribution",
  "community-contribution",
  "organizational-stewardship",
] as const;
const expectedFixtureIds = [
  "overview",
  "empty",
  "preparing",
  "completed-unreviewed",
  "in-review",
  "changes-requested",
  "source-corrected",
  "appeal-in-review",
  "privacy-restricted",
  "unsupported",
] as const;
const expectedQuestionIds = [
  "explain-capability",
  "explain-owner",
  "explain-evidence",
  "explain-incomplete",
  "explain-correction",
  "explain-appeal",
  "explain-unsupported",
] as const;
const expectedEvidenceItemIds = [
  "professional-purpose",
  "source-owner",
  "subject-scope",
  "evidence-category",
  "occurrence-source-confirmation",
  "reviewer-role",
  "policy-contract-version",
  "visibility",
  "correction-route",
  "appeal-route",
  "expiry-supersession",
] as const;
const expectedLaneIds = [
  "availability",
  "participation",
  "evidence",
  "completion",
  "review",
  "correction",
  "appeal",
  "visibility",
] as const;
const expectedResultKinds = [
  "SUPPORTED_SYNTHETIC_REVIEW",
  "PROPOSED",
  "OWNER_UNRESOLVED",
  "UNSUPPORTED",
  "INVALID",
] as const satisfies readonly CapabilityReviewResultKind[];
const expectedSemanticLaws = [
  "Completion is not approval.",
  "Correction is not appeal.",
  "Submission is not acceptance.",
  "Supported synthetic review is not authorization.",
  "Synthetic is not live.",
  "Visible is not public.",
  "Reviewable is not ratified.",
  "Evidence-present is not verified.",
  "Qualification is not eligibility.",
  "Proposed ownership is not canonical ownership.",
] as const;
const expectedCompatibilityContractKeys = [
  "requiredOwnerState",
  "requiredEvidenceState",
  "allowedPresentationBehavior",
  "prohibitedInference",
  "correctionSemantics",
  "appealSemantics",
  "failClosedResult",
] as const;
const expectedStatuses = [
  "CGN ECONOMIC PHASE 1A — BLOCKED",
  "GROWTH EXPERIENCE PHASE 1A — APPROVED FOUNDER PREVIEW ONLY",
  "GROWTH EXPERIENCE PHASE 1B WORK — AUTHORIZED NON-MONETARY CONTRACT WORK",
  "GROWTH EXPERIENCE PHASE 1B CONTRACT — NOT FOUNDER-RATIFIED",
  "GROWTH EXPERIENCE PHASE 1B-R — REMEDIATION IMPLEMENTATION COMPLETE; FOUNDER_DECISION_PENDING",
  "LIVE ECONOMICS — NO-GO",
  "PUBLIC, PARTICIPANT, PAID, OR PRODUCTION ACTIVATION — NOT AUTHORIZED",
] as const;
const supportedPairAllowlist = new Set([
  "organizational-stewardship/overview",
  "organizational-stewardship/empty",
  "organizational-stewardship/preparing",
  "organizational-stewardship/privacy-restricted",
]);

// -- 1 · exact immutable registries and Founder status taxonomy --------------
check("exact seven contract ids", equal(CAPABILITY_CONTRACT_IDS, expectedContractIds));
check("exact ten fixture ids", equal(CAPABILITY_FIXTURE_IDS, expectedFixtureIds));
check("exact seven fixed Kai questions", equal(CAPABILITY_KAI_QUESTION_IDS, expectedQuestionIds));
check("exact eleven evidence item ids", equal(CAPABILITY_EVIDENCE_ITEM_IDS, expectedEvidenceItemIds));
check("contract and fixture ids are unique", new Set(CAPABILITY_CONTRACT_IDS).size === 7 && new Set(CAPABILITY_FIXTURE_IDS).size === 10);
check("all public registries are frozen", [
  CAPABILITY_CONTRACT_IDS,
  CAPABILITY_FIXTURE_IDS,
  CAPABILITY_EVIDENCE_ITEM_IDS,
  CAPABILITY_KAI_QUESTION_IDS,
  CAPABILITY_CONTRACTS,
  CAPABILITY_FIXTURES,
  CAPABILITY_KAI_QUESTIONS,
  CAPABILITY_CONTRACT_REJECTION_EXAMPLES,
  CAPABILITY_SEMANTIC_LAWS,
  CAPABILITY_FIXTURE_DECISIONS,
].every(Object.isFrozen));
check("contract definitions are exact and deeply frozen",
  equal(CAPABILITY_CONTRACTS.map((contract) => contract.id), expectedContractIds) &&
  CAPABILITY_CONTRACTS.every((contract) => Object.isFrozen(contract)
    && Object.isFrozen(contract.supportingOwners)
    && Object.isFrozen(contract.evidenceRequirements)
    && Object.isFrozen(contract.refusedShortcuts)
    && Object.isFrozen(contract.unsupportedStates)));
check("fixture and Kai registries are exact and deeply frozen",
  equal(CAPABILITY_FIXTURES.map((fixture) => fixture.id), expectedFixtureIds) &&
  CAPABILITY_FIXTURES.every(Object.isFrozen) &&
  equal(CAPABILITY_KAI_QUESTIONS.map((question) => question.id), expectedQuestionIds) &&
  CAPABILITY_KAI_QUESTIONS.every(Object.isFrozen));
check("exact ten semantic separation laws", equal(CAPABILITY_SEMANTIC_LAWS, expectedSemanticLaws));
const mentorshipContract = CAPABILITY_CONTRACTS.find((contract) => contract.id === "mentorship")!;
check("mentorship does not expand Operator Network beyond messaging ownership",
  mentorshipContract.ownerReference === "OWNER_UNRESOLVED"
  && mentorshipContract.ownerMaturity === "OWNER_UNRESOLVED"
  && mentorshipContract.evidenceOwner === "OWNER_UNRESOLVED"
  && mentorshipContract.completionOwner === "OWNER_UNRESOLVED"
  && mentorshipContract.reviewOwner === "OWNER_UNRESOLVED"
  && mentorshipContract.visibilityOwner === "OWNER_UNRESOLVED"
  && mentorshipContract.correctionOwner === "OWNER_UNRESOLVED"
  && mentorshipContract.appealOwner === "OWNER_UNRESOLVED");
check("exact seven controlling statuses", equal([
  CGN_ECONOMIC_PHASE_1A_STATUS,
  GROWTH_EXPERIENCE_PHASE_1A_STATUS,
  GROWTH_EXPERIENCE_PHASE_1B_WORK_STATUS,
  GROWTH_EXPERIENCE_PHASE_1B_CONTRACT_STATUS,
  GROWTH_EXPERIENCE_PHASE_1B_R_STATUS,
  GROWTH_LIVE_ECONOMICS_STATUS,
  GROWTH_ACTIVATION_STATUS,
], expectedStatuses));

// -- 2 · literal positive 7 x 10 decision table ------------------------------
const decisionPairs = CAPABILITY_CONTRACT_IDS.flatMap((contractId) =>
  CAPABILITY_FIXTURE_IDS.map((fixtureId) => {
    const decision = CAPABILITY_FIXTURE_DECISIONS[contractId][fixtureId];
    return { contractId, fixtureId, pair: `${contractId}/${fixtureId}`, decision };
  }),
);
check("decision table covers exactly 70 pairs", decisionPairs.length === 70);
check("all 70 decision-table pairs are unique", new Set(decisionPairs.map((item) => item.pair)).size === 70);
check("decision table has exactly the seven literal contract keys", equal(Object.keys(CAPABILITY_FIXTURE_DECISIONS), expectedContractIds));
for (const contractId of CAPABILITY_CONTRACT_IDS) {
  check(`${contractId} has all ten literal fixture keys`, equal(Object.keys(CAPABILITY_FIXTURE_DECISIONS[contractId]), expectedFixtureIds));
}
check("every pair has an immutable written rationale",
  decisionPairs.every(({ decision }) => Object.isFrozen(decision)
    && decision.rationale.trim().length >= 24));
check("the table's favorable pairs equal the positive allowlist",
  equal(
    decisionPairs
      .filter(({ decision }) => decision.kind === "SUPPORTED_SYNTHETIC_REVIEW")
      .map(({ pair }) => pair)
      .sort(),
    [...supportedPairAllowlist].sort(),
  ));

const observedKinds = new Set<CapabilityReviewResultKind>();
const observedSupportedPairs: string[] = [];
for (const { contractId, fixtureId, pair, decision } of decisionPairs) {
  const first = resolveCapabilityReviewRequest(contractId, fixtureId);
  const second = resolveCapabilityReviewRequest(contractId, fixtureId);
  observedKinds.add(first.kind);
  check(`${pair} resolves deterministically`, equal(first, second));
  check(`${pair} result matches its literal decision`, first.kind === decision.kind);
  check(`${pair} preserves its pair-specific rationale`, first.decisionRationale === decision.rationale);
  check(`${pair} preserves known contract and fixture`, first.contract?.id === contractId && first.fixture.id === fixtureId);
  check(`${pair} exposes eight separate state lanes`, equal(first.lanes.map((lane) => lane.id), expectedLaneIds));
  check(`${pair} result graph is frozen`, Object.isFrozen(first)
    && Object.isFrozen(first.header)
    && Object.isFrozen(first.header.source)
    && Object.isFrozen(first.fixture)
    && Object.isFrozen(first.lanes)
    && first.lanes.every(Object.isFrozen));

  if (first.kind === "SUPPORTED_SYNTHETIC_REVIEW") {
    observedSupportedPairs.push(pair);
    check(`${pair} is explicitly whitelisted`, supportedPairAllowlist.has(pair));
    check(`${pair} has the exact reasoned compatibility contract`,
      decision.kind === "SUPPORTED_SYNTHETIC_REVIEW"
      && equal(Object.keys(decision.compatibility), expectedCompatibilityContractKeys)
      && equal(first.compatibilityContract, decision.compatibility)
      && Object.isFrozen(first.compatibilityContract)
      && Object.values(first.compatibilityContract).every((value) => value.trim().length > 0));
    check(`${pair} uses the fixed fictional source`, first.header.synthetic
      && first.header.source.kind === "SYNTHETIC_FIXTURE"
      && first.header.source.ref === GROWTH_CAPABILITY_FIXTURE_SOURCE);
    check(`${pair} alone exposes the exact evidence contract`,
      first.evidenceContract !== undefined
      && equal(first.evidenceContract.map((item) => item.id), expectedEvidenceItemIds)
      && first.evidenceContract.every((item) => item.owner.length > 0 && item.value.length > 0));
    for (const questionId of CAPABILITY_KAI_QUESTION_IDS) {
      const explanation = resolveCapabilityKaiExplanation(first, questionId);
      check(`${pair}/${questionId} permits only deterministic supported explanation`, explanation.questionId === questionId
        && explanation.fixtureSource === GROWTH_CAPABILITY_FIXTURE_SOURCE
        && explanation.receipt === GROWTH_CAPABILITY_KAI_RECEIPT);
    }
  } else {
    check(`${pair} exposes no favorable evidence contract`, !("evidenceContract" in first));
    check(`${pair} exposes no favorable compatibility contract`, !("compatibilityContract" in first));
    check(`${pair} is not marked registry-resolved active`, first.ownerMaturity !== "RATIFIED_ACTIVE");
    for (const questionId of CAPABILITY_KAI_QUESTION_IDS) {
      const explanation = resolveCapabilityKaiExplanation(first, questionId);
      check(`${pair}/${questionId} fails Kai closed`, explanation.questionId === "unsupported"
        && explanation.evidenceChecklist.length === 0
        && explanation.summary === GROWTH_CAPABILITY_UNSUPPORTED_COPY);
    }
  }
}
check("only four whitelisted pairs resolve supported", equal(observedSupportedPairs.sort(), [...supportedPairAllowlist].sort()));

// -- 3 · malformed, partial, duplicate, conflicting input is INVALID ---------
const rawMarker = "raw-private-marker-<script>alert(1)</script>";
const invalidInputs: readonly [string, unknown, unknown][] = [
  ["partial contract", "organizational-stewardship", undefined],
  ["partial fixture", undefined, "overview"],
  ["duplicate contract", ["organizational-stewardship", "organizational-stewardship"], "overview"],
  ["duplicate fixture", "organizational-stewardship", ["overview", "overview"]],
  ["conflicting contract", ["organizational-stewardship", "mentorship"], "overview"],
  ["conflicting fixture", "organizational-stewardship", ["overview", "empty"]],
  ["singleton array contract", ["organizational-stewardship"], "overview"],
  ["singleton array fixture", "organizational-stewardship", ["overview"]],
  ["empty arrays", [], []],
  ["empty strings", "", ""],
  ["whitespace", " organizational-stewardship", "overview "],
  ["wrong case", "Organizational-Stewardship", "Overview"],
  ["unknown values", rawMarker, `${rawMarker}-fixture`],
  ["object values", { contract: rawMarker }, { fixture: rawMarker }],
];
for (const [label, contractInput, fixtureInput] of invalidInputs) {
  const projection = resolveCapabilityReviewRequest(
    contractInput as never,
    fixtureInput as never,
  );
  observedKinds.add(projection.kind);
  const serialized = JSON.stringify(projection);
  check(`${label} resolves INVALID`, projection.kind === "INVALID");
  check(`${label} has no contract or evidence authority`, projection.contract === null && !("evidenceContract" in projection));
  check(`${label} returns only generic closed lanes`, projection.lanes.every((lane) => /invalid|unsupported|unavailable|no state inferred|owner unresolved/i.test(lane.value)));
  check(`${label} never echoes raw values`, !serialized.includes(rawMarker) && !serialized.includes("<script>"));
}
check("all five result types are exercised", equal([...observedKinds].sort(), [...expectedResultKinds].sort()));

const missingBoth = resolveCapabilityReviewRequest();
check("all-absent query resolves INVALID", missingBoth.kind === "INVALID");
check("all-absent query has no contract authority", missingBoth.contract === null && !("evidenceContract" in missingBoth));
check(
  "all-absent query returns only generic closed lanes",
  missingBoth.lanes.every((lane) => /invalid|unsupported|unavailable|no state inferred|owner unresolved/i.test(lane.value)),
);
const unknownKai = resolveCapabilityKaiExplanation(
  resolveCapabilityReviewRequest("organizational-stewardship", "overview"),
  rawMarker,
);
check("unknown Kai question is generic and never echoes input", unknownKai.questionId === "unsupported"
  && !JSON.stringify(unknownKai).includes(rawMarker));

// -- 4 · exact flags and server gate composition -----------------------------
const mutableEnv = process.env as Record<string, string | undefined>;
const envKeys = [
  "GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED",
  "GROWTH_CENTER_PREVIEW_ENABLED",
  "NODE_ENV",
  "VERCEL",
  "VERCEL_ENV",
  "NEXT_PUBLIC_VERCEL_ENV",
  "NEXT_PUBLIC_CXOS_REVIEW",
] as const;
const priorEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<string, string | undefined>;
try {
  for (const key of envKeys) delete mutableEnv[key];
  check("both subordinate flags default off", !growthCenterPreviewEnabled() && !growthCapabilityContractPreviewEnabled());
  for (const value of ["", "false", "TRUE", "1", " true", "true "]) {
    process.env.GROWTH_CENTER_PREVIEW_ENABLED = value;
    process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED = value;
    check(`subordinate flags reject ${JSON.stringify(value)}`, !growthCenterPreviewEnabled() && !growthCapabilityContractPreviewEnabled());
  }
  process.env.GROWTH_CENTER_PREVIEW_ENABLED = "true";
  process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED = "true";
  mutableEnv.NODE_ENV = "production";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
  process.env.NEXT_PUBLIC_CXOS_REVIEW = "1";
  check("canonical production remains hard-off with all subordinate/public/manual flags true",
    !reviewServerBuildAllowed() && growthCenterPreviewEnabled() && growthCapabilityContractPreviewEnabled());
  process.env.VERCEL_ENV = "preview";
  check("canonical protected Preview accepts the exact subordinate flags",
    reviewServerBuildAllowed() && growthCenterPreviewEnabled() && growthCapabilityContractPreviewEnabled());
} finally {
  for (const key of envKeys) {
    const value = priorEnv[key];
    if (value === undefined) delete mutableEnv[key];
    else mutableEnv[key] = value;
  }
}

// -- 5 · route, UX semantics, privacy, and effect boundary -------------------
const page = source("app/review/growth-center/capability-contract/page.tsx");
const stage = source("app/review/growth-center/capability-contract/stage.tsx");
const css = source("app/review/growth-center/capability-contract/capability-contract.module.css");
const contractSource = source("lib/growthNetwork/capabilityContract.ts");
const contractDocument = source("GROWTH_EXPERIENCE_PHASE_1B_CAPABILITY_CONTRACT.md");
const growthCenterStage = source("app/review/growth-center/stage.tsx");
const flagSource = source("lib/growthNetwork/capabilityPreviewFlags.ts");
const pageCode = codeOf(page);
const stageCode = codeOf(stage);
const protectedCode = codeOf(`${page}\n${stage}\n${contractSource}\n${flagSource}`);

const dynamicImportAt = page.indexOf('await import("./stage")');
const serverGateAt = page.indexOf("reviewServerBuildAllowed()");
const parentFlagAt = page.indexOf("growthCenterPreviewEnabled()");
const contractFlagAt = page.indexOf("growthCapabilityContractPreviewEnabled()");
check("three server controls execute before dynamic stage import",
  serverGateAt >= 0 && parentFlagAt >= 0 && contractFlagAt >= 0
  && dynamicImportAt > serverGateAt && dynamicImportAt > parentFlagAt && dynamicImportAt > contractFlagAt);
check("page is dynamic server code with no static stage import",
  /export const dynamic = "force-dynamic"/.test(page)
  && !/^\s*["']use client["'];/m.test(page)
  && !/^import .*\.\/stage/m.test(page));
check("unknown query keys route to INVALID without echo",
  /key !== "contract" && key !== "fixture"/.test(page)
  && /resolveCapabilityReviewRequest\(\[\], \[\]\)/.test(page));

check("contract and fixture changes both create reversible history entries",
  /window\.history\.pushState/.test(stageCode)
  && !/window\.history\.replaceState/.test(stageCode)
  && /selectContract[\s\S]{0,700}selectedContractId !== contractId[\s\S]{0,120}pushReviewLocation/.test(stageCode)
  && /selectFixture[\s\S]{0,900}selectedFixtureId !== fixtureId[\s\S]{0,120}pushReviewLocation/.test(stageCode));
check("Back and Forward restore the deterministic projection",
  /addEventListener\("popstate"/.test(stageCode)
  && /removeEventListener\("popstate"/.test(stageCode)
  && /readProjectionFromLocation\(\)/.test(stageCode));
check("the stage has exactly one polite live region",
  (stage.match(/aria-live=/g) ?? []).length === 1
  && (stage.match(/role="status"/g) ?? []).length <= 1);
check("the exact ten semantic laws are rendered from the canonical registry",
  stage.includes("CAPABILITY_SEMANTIC_LAWS")
  && /CAPABILITY_SEMANTIC_LAWS\.map/.test(stageCode));
check("the human-comprehension boundary states review-only is not public",
  stage.includes("Founder review only is not public access."));
check("all seven statuses are rendered from canonical constants", [
  "CGN_ECONOMIC_PHASE_1A_STATUS",
  "GROWTH_EXPERIENCE_PHASE_1A_STATUS",
  "GROWTH_EXPERIENCE_PHASE_1B_WORK_STATUS",
  "GROWTH_EXPERIENCE_PHASE_1B_CONTRACT_STATUS",
  "GROWTH_EXPERIENCE_PHASE_1B_R_STATUS",
  "GROWTH_LIVE_ECONOMICS_STATUS",
  "GROWTH_ACTIVATION_STATUS",
].every((symbol) => stage.includes(symbol)));
check("privacy wording is scoped to Growth-owned behavior",
  stage.includes("No Growth Experience-owned cookies, storage, analytics, or telemetry.")
  && stage.includes("Route selectors read only fixed allowlisted review IDs")
  && stage.includes("recorded in the URL and browser history for reversible Back and Forward navigation")
  && stage.includes("but they are not participant facts")
  && !stage.includes("they are not participant facts and are not persisted")
  && stage.includes("No participant, organization, customer, PII, or free-text input is read or saved by Growth Experience.")
  && !stage.includes("user input is read or saved")
  && /inherited application shell/i.test(stage)
  && /auth|session/i.test(stage)
  && /theme|presentation/i.test(stage)
  && !/No cookies\./i.test(stage)
  && !/no storage · no network/i.test(stage)
  && !`${GROWTH_CAPABILITY_REVIEW_DISCLOSURE}\n${contractDocument}\n${growthCenterStage}`.includes("No participant data is read or saved")
  && !/no storage · no network/i.test(growthCenterStage)
  && /inherited shell session\/theme/i.test(growthCenterStage));
check("projection changes deliberately move focus to the rendered result heading",
  stage.includes("focusProjectionAfterUpdateRef.current = true")
  && stage.includes("projectionHeadingRef.current?.focus()")
  && (stage.match(/ref=\{projectionHeadingRef\} tabIndex=\{-1\}/g) ?? []).length === 2
  && stage.includes('window.addEventListener("popstate", synchronizeProjection)'));
check("invalid raw query values are not overclaimed as absent from browser history",
  stage.includes("not echoed, interpreted, or persisted as Growth Experience state")
  && !stage.includes("not echoed, stored, or inferred"));
check("authority copy never promotes the pending contract or proposed owner",
  !/approved (?:contract|synthetic contract)|canonical owner\s*(?:·|:|is|=)|canonicalOwner/i.test(`${stage}\n${contractSource}`));
check("Kai is canonical, route-local, deterministic, and actionless",
  stage.includes("GROWTH_CAPABILITY_KAI_RECEIPT")
  && contractSource.includes("deterministic route-local synthetic explanation mode")
  && !/<input|<textarea|contentEditable/.test(stage));
check("supported UI renders every required compatibility field",
  [
    "Required owner state",
    "Required evidence state",
    "Allowed presentation",
    "Prohibited inference",
    "Correction semantics",
    "Appeal semantics",
    "Fail-closed result",
  ].every((label) => stage.includes(label)));
check("review disclosure and economic boundary remain visible",
  stage.includes("GROWTH_CAPABILITY_REVIEW_DISCLOSURE")
  && stage.includes("GROWTH_CAPABILITY_AGENCY_BOUNDARY")
  && GROWTH_CAPABILITY_REVIEW_SUMMARY.includes("Production hard-off")
  && GROWTH_CAPABILITY_INTERNAL_CONTRACT_NOTICE.includes("not a participant agreement"));
check("the post-evidence UI uses the exact bounded completion status without stale progress copy",
  stage.includes("Work authorized; protected Preview completed; contract ratification pending.")
  && !stage.includes("Protected Preview evidence: NOT RUN")
  && !`${stage}\n${contractSource}`.includes("AUTHORIZED REMEDIATION IN PROGRESS"));
check("main, focus, reduced motion, and target floors remain present",
  /<main[\s\S]*?id="main"[\s\S]*?tabIndex=\{-1\}/.test(stage)
  && /:focus-visible/.test(css)
  && /prefers-reduced-motion:\s*reduce/.test(css)
  && /min-height:\s*44px/.test(css));

for (const [label, pattern] of [
  ["network request", /\b(?:fetch|axios|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/],
  ["browser persistence", /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/],
  ["database", /@prisma\/client|\bprisma\.|\$queryRaw|\$executeRaw/],
  ["authentication", /next-auth|getServerSession|currentUser\s*\(/],
  ["runtime model", /@anthropic-ai|\bopenai\b|\banthropic\b/],
  ["commerce", /\bstripe\.|checkout\s*\(|purchase\s*\(|payout\s*\(/],
  ["nondeterminism", /Math\.random|Date\.now|new Date\s*\(|crypto\.randomUUID/],
] as const) {
  check(`implementation excludes ${label}`, !pattern.test(protectedCode));
}
check("route has no external link or form submission",
  !/href\s*=\s*["']https?:\/\//.test(stageCode)
  && !/<form\b|onSubmit=|["']use server["']/.test(stageCode));

// The annex remains direct-link-only and cannot acquire an API/schema/event or
// product-navigation consumer through this candidate.
const routeDirectory = join(ROOT, "app", "review", "growth-center", "capability-contract");
check("annex route has exactly page, stage, and CSS",
  equal(readdirSync(routeDirectory).sort(), [
    "capability-contract.module.css",
    "page.tsx",
    "stage.tsx",
  ]));
const routePrefix = `${routeDirectory}${sep}`;
const appSources = ["app", "components", "lib"]
  .flatMap((directory) => walk(join(ROOT, directory)))
  .filter((path) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)));
const registrationConsumers = appSources
  .filter((path) => !path.startsWith(routePrefix))
  .filter((path) => readFileSync(path, "utf8").includes("/review/growth-center/capability-contract"))
  .map((path) => relative(ROOT, path));
check("annex remains unregistered outside itself", equal(registrationConsumers, []));
const publicRegistries = [
  "app/sitemap.ts",
  "app/robots.ts",
  "middleware.ts",
  "app/layout.tsx",
  "components/AppShell.tsx",
  "components/Sidebar.tsx",
].map(sourceOrEmpty).join("\n");
check("sitemap, robots, middleware, and product shells do not expose annex",
  !publicRegistries.includes("capability-contract"));
const apiConsumers = walk(join(ROOT, "app", "api"))
  .filter((path) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)))
  .filter((path) => /capabilityContract|GROWTH_CAPABILITY_CONTRACT|capability-contract/.test(readFileSync(path, "utf8")));
check("no API consumes the capability contract", apiConsumers.length === 0);
const prismaSchema = source("prisma/schema.prisma");
check("no Phase 1B schema model exists", [
  "GrowthCapability",
  "CapabilityContract",
  "CapabilityParticipation",
  "GrowthEvidence",
  "GrowthReview",
  "GrowthCorrection",
  "GrowthAppeal",
].every((model) => !new RegExp(`model\\s+${model}\\b`).test(prismaSchema)));

console.log(
  `\ngrowth-capability-contract.test.ts: ${passed} passed, ${failed} failed`,
);
process.exit(failed ? 1 : 0);
