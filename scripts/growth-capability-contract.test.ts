// Run: node --import tsx scripts/growth-capability-contract.test.ts
//
// DB-less executable + source guard for Growth Experience Phase 1B. This proves
// that the Founder Preview remains a pure, deterministic capability-contract
// projection with three pre-import gates, no participant or economic authority,
// and no persistence, model, API, event, analytics, auth, or commerce seam.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import {
  CAPABILITY_CONTRACT_IDS,
  CAPABILITY_CONTRACT_REJECTION_EXAMPLES,
  CAPABILITY_CONTRACTS,
  CAPABILITY_EVIDENCE_ITEM_IDS,
  CAPABILITY_FIXTURE_IDS,
  CAPABILITY_FIXTURES,
  CAPABILITY_KAI_QUESTION_IDS,
  CAPABILITY_KAI_QUESTIONS,
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
  type CapabilityReviewProjection,
} from "../lib/growthNetwork/capabilityContract";
import { growthCapabilityContractPreviewEnabled } from "../lib/growthNetwork/capabilityPreviewFlags";
import { growthCenterPreviewEnabled } from "../lib/growthNetwork/previewFlags";
import { reviewBuildAllowed } from "../lib/cxos/reviewMode";

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

const expectedStatuses = [
  "CGN ECONOMIC PHASE 1A — BLOCKED",
  "GROWTH EXPERIENCE PHASE 1A — APPROVED FOUNDER PREVIEW",
  "GROWTH EXPERIENCE PHASE 1B — AUTHORIZED NON-MONETARY CONTRACT WORK",
] as const;
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
const expectedUnsupportedFixtureIds = {
  "professional-capability": [],
  "development-pathway": [],
  mentorship: ["completed-unreviewed", "appeal-in-review"],
  education: [],
  "operator-contribution": [],
  "community-contribution": [],
  "organizational-stewardship": ["appeal-in-review"],
} as const;

// Exact Founder authorization vocabulary and immutable registries.
check("exact three phase statuses", equal([
  CGN_ECONOMIC_PHASE_1A_STATUS,
  GROWTH_EXPERIENCE_PHASE_1A_STATUS,
  GROWTH_EXPERIENCE_PHASE_1B_STATUS,
], expectedStatuses));
check("exact seven contract IDs", equal(CAPABILITY_CONTRACT_IDS, expectedContractIds));
check("exact ten fixture IDs", equal(CAPABILITY_FIXTURE_IDS, expectedFixtureIds));
check("exact eleven evidence-contract item IDs", equal(
  CAPABILITY_EVIDENCE_ITEM_IDS,
  expectedEvidenceItemIds,
));
check("exact seven Kai question IDs", equal(CAPABILITY_KAI_QUESTION_IDS, expectedQuestionIds));
check("contract IDs are unique", new Set(CAPABILITY_CONTRACT_IDS).size === 7);
check("fixture IDs are unique", new Set(CAPABILITY_FIXTURE_IDS).size === 10);
check("Kai question IDs are unique", new Set(CAPABILITY_KAI_QUESTION_IDS).size === 7);
check("contract ID registry is frozen", Object.isFrozen(CAPABILITY_CONTRACT_IDS));
check("fixture ID registry is frozen", Object.isFrozen(CAPABILITY_FIXTURE_IDS));
check("evidence item ID registry is frozen", Object.isFrozen(CAPABILITY_EVIDENCE_ITEM_IDS));
check("Kai question ID registry is frozen", Object.isFrozen(CAPABILITY_KAI_QUESTION_IDS));
check("contract definitions are exact, ordered, and frozen", Object.isFrozen(CAPABILITY_CONTRACTS)
  && equal(CAPABILITY_CONTRACTS.map((contract) => contract.id), expectedContractIds));
check("every contract and nested contract registry is deeply frozen",
  CAPABILITY_CONTRACTS.every((contract) => Object.isFrozen(contract)
    && Object.isFrozen(contract.supportingOwners)
    && Object.isFrozen(contract.evidenceRequirements)
    && Object.isFrozen(contract.refusedShortcuts)
    && Object.isFrozen(contract.unsupportedStates)
    && Object.isFrozen(contract.unsupportedFixtureIds)));
check("contract fixture support matrix is explicit and exact", equal(
  Object.fromEntries(CAPABILITY_CONTRACTS.map((contract) => [
    contract.id,
    contract.unsupportedFixtureIds,
  ])),
  expectedUnsupportedFixtureIds,
));
check("fixture definitions are exact, ordered, and frozen", Object.isFrozen(CAPABILITY_FIXTURES)
  && equal(CAPABILITY_FIXTURES.map((fixture) => fixture.id), expectedFixtureIds)
  && CAPABILITY_FIXTURES.every((fixture) => Object.isFrozen(fixture)));
check("Kai questions are exact, ordered, and frozen", Object.isFrozen(CAPABILITY_KAI_QUESTIONS)
  && equal(CAPABILITY_KAI_QUESTIONS.map((question) => question.id), expectedQuestionIds)
  && CAPABILITY_KAI_QUESTIONS.every((question) => Object.isFrozen(question)));
check("rejection examples are frozen and unique", Object.isFrozen(CAPABILITY_CONTRACT_REJECTION_EXAMPLES)
  && new Set(CAPABILITY_CONTRACT_REJECTION_EXAMPLES).size === CAPABILITY_CONTRACT_REJECTION_EXAMPLES.length);

// Every contract x fixture pair must resolve identically. Explicitly impossible
// combinations fail to the generic unsupported projection; supported pairs
// preserve eight independent owner-qualified state lanes.
for (const contractId of CAPABILITY_CONTRACT_IDS) {
  for (const fixtureId of CAPABILITY_FIXTURE_IDS) {
    const first = resolveCapabilityReviewRequest(contractId, fixtureId);
    const second = resolveCapabilityReviewRequest(contractId, fixtureId);
    const contractDefinition = CAPABILITY_CONTRACTS.find((item) => item.id === contractId)!;
    const combinationUnsupported = (
      contractDefinition.unsupportedFixtureIds as readonly (typeof expectedFixtureIds)[number][]
    ).includes(fixtureId);
    check(`${contractId}/${fixtureId} resolves deterministically`, equal(first, second));
    check(`${contractId}/${fixtureId} deeply freezes the outer projection`, Object.isFrozen(first)
      && Object.isFrozen(first.header)
      && Object.isFrozen(first.header.source)
      && Object.isFrozen(first.fixture)
      && Object.isFrozen(first.lanes)
      && first.lanes.every((lane) => Object.isFrozen(lane)));
    check(`${contractId}/${fixtureId} obeys the explicit support matrix`,
      combinationUnsupported
        ? first.kind === "UNSUPPORTED"
          && first.reason === GROWTH_CAPABILITY_UNSUPPORTED_COPY
          && first.header.canonicalOwner === "OWNER_UNRESOLVED"
          && first.ownerResolved === false
        : first.kind === "SUPPORTED");
    if (first.kind !== "SUPPORTED") continue;
    check(`${contractId}/${fixtureId} preserves requested identifiers`, first.contract.id === contractId
      && first.fixture.id === fixtureId && first.header.contractId === contractId);
    check(`${contractId}/${fixtureId} uses the fixed synthetic source`, first.header.synthetic
      && first.header.source.kind === "SYNTHETIC_FIXTURE"
      && first.header.source.ref === GROWTH_CAPABILITY_FIXTURE_SOURCE);
    check(`${contractId}/${fixtureId} exposes exactly eight separate state lanes`, equal(
      first.lanes.map((lane) => lane.id),
      expectedLaneIds,
    ) && new Set(first.lanes.map((lane) => lane.id)).size === 8);
    check(`${contractId}/${fixtureId} freezes its lane projection`, Object.isFrozen(first.lanes));
    check(`${contractId}/${fixtureId} assigns every lane an explicit owner`, first.lanes.every((lane) =>
      lane.owner.length > 0 && lane.ownerLabel.length > 0 && lane.value.length > 0));
    check(`${contractId}/${fixtureId} exposes the exact eleven-part evidence contract`,
      equal(first.evidenceContract.map((item) => item.id), expectedEvidenceItemIds)
        && new Set(first.evidenceContract.map((item) => item.id)).size === 11
        && first.evidenceContract.every((item) =>
          item.owner.length > 0 && item.ownerLabel.length > 0 && item.value.length > 0));
    check(`${contractId}/${fixtureId} deeply freezes the evidence contract`,
      Object.isFrozen(first.evidenceContract)
        && first.evidenceContract.every((item) => Object.isFrozen(item)));
    check(`${contractId}/${fixtureId} fails evidence authority closed when ownerless`,
      first.ownerResolved
        || first.evidenceContract.every((item) =>
          item.owner === "OWNER_UNRESOLVED"
            && item.value === GROWTH_CAPABILITY_UNSUPPORTED_COPY));
  }
}

check("default request is the explicit overview fixture", (() => {
  const projection = resolveCapabilityReviewRequest();
  return projection.kind === "SUPPORTED"
    && projection.contract.id === "professional-capability"
    && projection.fixture.id === "overview";
})());

// Runtime abuse inputs use an unsafe wrapper intentionally: the production
// TypeScript signature is narrow, while the guard proves fail-closed behavior
// for malformed URL values that can still arrive at runtime.
const resolveUnsafe = resolveCapabilityReviewRequest as (
  contract?: unknown,
  fixture?: unknown,
) => CapabilityReviewProjection;
const malformedPairs: readonly (readonly [unknown, unknown])[] = [
  [undefined, "overview"],
  ["professional-capability", undefined],
  ["unknown", "overview"],
  ["professional-capability", "unknown"],
  ["", "overview"],
  [" professional-capability", "overview"],
  ["professional-capability ", "overview"],
  ["PROFESSIONAL-CAPABILITY", "overview"],
  [["professional-capability"], "overview"],
  [["professional-capability", "professional-capability"], "overview"],
  ["professional-capability", ["overview"]],
  ["professional-capability", ["overview", "overview"]],
  [null, "overview"],
  [{}, "overview"],
  [42, "overview"],
];
for (const [contract, fixture] of malformedPairs) {
  const projection = resolveUnsafe(contract, fixture);
  check(`malformed/duplicate request fails unsupported: ${JSON.stringify([contract, fixture])}`,
    projection.kind === "UNSUPPORTED"
      && projection.reason === GROWTH_CAPABILITY_UNSUPPORTED_COPY
      && projection.header.canonicalOwner === "OWNER_UNRESOLVED"
      && projection.header.availability === "UNSUPPORTED_CONTRACT_VERSION"
      && projection.ownerResolved === false);
}

const ownerlessContract = CAPABILITY_CONTRACTS.find((contract) =>
  contract.canonicalOwner === "OWNER_UNRESOLVED");
check("exactly one contract deliberately exposes an unresolved owner", Boolean(ownerlessContract)
  && CAPABILITY_CONTRACTS.filter((contract) => contract.canonicalOwner === "OWNER_UNRESOLVED").length === 1
  && ownerlessContract?.id === "operator-contribution");
if (ownerlessContract) {
  for (const fixtureId of CAPABILITY_FIXTURE_IDS) {
    const projection = resolveCapabilityReviewRequest(ownerlessContract.id, fixtureId);
    check(`ownerless ${fixtureId} never infers favorable availability or authority`,
      projection.kind === "SUPPORTED"
        && projection.ownerResolved === false
        && projection.header.canonicalOwner === "OWNER_UNRESOLVED"
        && projection.header.availability === "OWNER_UNRESOLVED"
        && projection.lanes.filter((lane) => lane.id !== "availability")
          .every((lane) => lane.owner === "OWNER_UNRESOLVED"));
  }
}

// Kai is a fixed explanation projection, not an agent, evaluator, or action
// surface. Exercise every permitted question over all deterministic fixtures.
for (const contractId of CAPABILITY_CONTRACT_IDS) {
  for (const fixtureId of CAPABILITY_FIXTURE_IDS) {
    const projection = resolveCapabilityReviewRequest(contractId, fixtureId);
    for (const questionId of CAPABILITY_KAI_QUESTION_IDS) {
      const first = resolveCapabilityKaiExplanation(projection, questionId);
      const second = resolveCapabilityKaiExplanation(projection, questionId);
      check(`Kai ${contractId}/${fixtureId}/${questionId} is deterministic`, equal(first, second));
      check(`Kai ${contractId}/${fixtureId}/${questionId} is deeply frozen`,
        Object.isFrozen(first)
          && Object.isFrozen(first.evidenceChecklist)
          && Object.isFrozen(first.permittedReviewSteps)
          && Object.isFrozen(first.refusals));
      check(`Kai ${contractId}/${fixtureId}/${questionId} returns the no-action receipt`,
        first.questionId === (
          projection.kind === "SUPPORTED"
            && projection.ownerResolved
            && projection.fixture.id !== "unsupported"
            ? questionId
            : "unsupported"
        )
          && first.fixtureSource === GROWTH_CAPABILITY_FIXTURE_SOURCE
          && first.receipt === GROWTH_CAPABILITY_KAI_RECEIPT);
    }
  }
}
for (const invalidQuestion of ["", "unknown", "EXPLAIN-OWNER", " explain-owner", "explain-owner "]) {
  const projection = resolveCapabilityReviewRequest();
  const explanation = resolveCapabilityKaiExplanation(projection, invalidQuestion);
  check(`Kai rejects unsupported question ${JSON.stringify(invalidQuestion)}`,
    explanation.questionId === "unsupported"
      && explanation.summary === GROWTH_CAPABILITY_UNSUPPORTED_COPY
      && explanation.receipt === GROWTH_CAPABILITY_KAI_RECEIPT);
}
check("Kai receipt is exact and disclaims model, persistence, and action",
  GROWTH_CAPABILITY_KAI_RECEIPT === "Kai is explaining fixed synthetic review fixtures. Kai did not analyze a person, organization, evidence, eligibility, or opportunity. No model was called. Nothing was saved, submitted, reviewed, corrected, appealed, assigned, scheduled, published, enrolled, purchased, or changed.");

// Required persistent copy and separate correction/appeal semantics.
check("persistent disclosure contains every non-live boundary",
  /Founder review/.test(GROWTH_CAPABILITY_REVIEW_DISCLOSURE)
    && /Synthetic capability-contract fixtures/.test(GROWTH_CAPABILITY_REVIEW_DISCLOSURE)
    && /No live Growth program/.test(GROWTH_CAPABILITY_REVIEW_DISCLOSURE)
    && /No participant data is read or saved/.test(GROWTH_CAPABILITY_REVIEW_DISCLOSURE)
    && /no action is taken/i.test(GROWTH_CAPABILITY_REVIEW_DISCLOSURE));
check("summary is exact production-hard-off copy",
  GROWTH_CAPABILITY_REVIEW_SUMMARY === "Founder review · Synthetic · Non-monetary · Production hard-off");
check("internal contract notice refuses agreement, enrollment, credential, entitlement, and offer",
  /not a participant agreement, enrollment, credential, platform entitlement, or offer/.test(
    GROWTH_CAPABILITY_INTERNAL_CONTRACT_NOTICE,
  ));
check("unsupported copy is exact and inference-free",
  GROWTH_CAPABILITY_UNSUPPORTED_COPY === "Unsupported review state · unavailable in this Preview. No status, eligibility, completion, review, or action has been inferred.");
check("Agency boundary is exact and recruiting-free",
  GROWTH_CAPABILITY_AGENCY_BOUNDARY === "No live Growth Distribution. These stewardship examples create no eligibility, allocation, obligation, or payment right. Recruiting is not rewarded.");
check("organizational stewardship always carries the exact Agency boundary",
  CAPABILITY_CONTRACTS.find((contract) => contract.id === "organizational-stewardship")?.economicBoundary
    === GROWTH_CAPABILITY_AGENCY_BOUNDARY);
check("every fixture declares correction and appeal as separate state fields",
  CAPABILITY_FIXTURES.every((fixture) =>
    typeof fixture.correction === "string"
      && fixture.correction.length > 0
      && typeof fixture.appeal === "string"
      && fixture.appeal.length > 0));
check("completion fixture is explicitly fictional and non-consequential", (() => {
  const fixture = CAPABILITY_FIXTURES.find((item) => item.id === "completed-unreviewed");
  return Boolean(fixture)
    && /Fictional source-confirmed-state example/.test(fixture!.completion)
    && /not a credential, certification, eligibility, endorsement, reputation fact, or economic signal/.test(fixture!.detail);
})());
check("correction fixture routes to a source owner without opening a case", (() => {
  const fixture = CAPABILITY_FIXTURES.find((item) => item.id === "changes-requested");
  return Boolean(fixture) && /source fact/.test(fixture!.detail) && /cannot open or resolve/.test(fixture!.detail);
})());
check("appeal fixture requires a human and cannot be adjudicated by Growth or Kai", (() => {
  const fixture = CAPABILITY_FIXTURES.find((item) => item.id === "appeal-in-review");
  return Boolean(fixture) && /Human-review-required example/.test(fixture!.appeal)
    && /Growth and Kai cannot file, adjudicate, resolve, or change/.test(fixture!.detail);
})());

// Pure contract and exact flag source boundaries.
const contractPath = "lib/growthNetwork/capabilityContract.ts";
const flagPath = "lib/growthNetwork/capabilityPreviewFlags.ts";
const contractSource = source(contractPath);
const flagSource = source(flagPath);
const pureCode = codeOf(`${contractSource}\n${flagSource}`);
check("capability contract has no imports", !/^\s*import\s/m.test(contractSource));
check("capability preview flag has no imports", !/^\s*import\s/m.test(flagSource));
check("pure contract has exactly three exported status constants",
  (contractSource.match(/export const [A-Z0-9_]+_STATUS\s*=/g) ?? []).length === 3);
check("pure contract has no process or environment access", !/\bprocess\s*\./.test(codeOf(contractSource)));
const flagReads = codeOf(flagSource).match(/process\.env\.[A-Z0-9_]+/g) ?? [];
check("capability flag reads only the exact Phase 1B key", equal(flagReads, [
  "process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED",
]));
for (const forbiddenEffect of [
  "fetch(", "axios", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon",
  "localStorage", "sessionStorage", "indexedDB", "document.cookie", "navigator.",
  "@prisma/client", "$queryRaw", "$executeRaw", "$transaction", "Math.random",
  "Date.now", "new Date", "crypto.randomUUID", "setTimeout", "setInterval",
]) {
  check(`pure capability source excludes effect ${forbiddenEffect}`, !pureCode.includes(forbiddenEffect));
}
for (const forbiddenField of [
  "amount", "cents", "currency", "balance", "price", "fee", "commissionRate",
  "payoutDate", "payoutAccount", "wallet", "bankAccount", "taxWithholding",
  "revenueShare", "paymentProvider", "stripeCustomerId",
]) {
  check(`contract declares no economic/provider field ${forbiddenField}`,
    !new RegExp(`\\b${forbiddenField}\\s*[?:]`, "i").test(codeOf(contractSource)));
}
for (const forbiddenTrustLabel of [
  "VERIFIED", "APPROVED", "QUALIFIED", "CERTIFIED", "RECOGNIZED", "EXPERT",
  "VERIFIED_MENTOR", "APPROVED_INSTRUCTOR",
]) {
  check(`contract declares no live trust label ${forbiddenTrustLabel}`,
    !new RegExp(`[\\"']${forbiddenTrustLabel}[\\"']`).test(codeOf(contractSource)));
}

// Exact-string subordinate flag, plus the parent Growth flag and build identity,
// form a three-key conjunction. All environment values are restored.
const priorCapability = process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED;
const priorGrowth = process.env.GROWTH_CENTER_PREVIEW_ENABLED;
const priorVercel = process.env.NEXT_PUBLIC_VERCEL_ENV;
const priorCxos = process.env.NEXT_PUBLIC_CXOS_REVIEW;
const priorNode = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;
try {
  delete process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED;
  check("capability preview flag defaults off", !growthCapabilityContractPreviewEnabled());
  for (const value of ["", "false", "TRUE", "1", " true", "true "]) {
    process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED = value;
    check(`capability preview flag rejects ${JSON.stringify(value)}`,
      !growthCapabilityContractPreviewEnabled());
  }
  process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED = "true";
  check("capability preview flag accepts exact true", growthCapabilityContractPreviewEnabled());

  mutableEnv.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
  process.env.NEXT_PUBLIC_CXOS_REVIEW = "1";
  process.env.GROWTH_CENTER_PREVIEW_ENABLED = "true";
  check("production identity defeats both subordinate flags",
    !reviewBuildAllowed() && growthCenterPreviewEnabled() && growthCapabilityContractPreviewEnabled());

  process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
  process.env.GROWTH_CENTER_PREVIEW_ENABLED = "false";
  check("capability flag cannot bypass the parent Growth gate",
    reviewBuildAllowed() && !growthCenterPreviewEnabled() && growthCapabilityContractPreviewEnabled());
  process.env.GROWTH_CENTER_PREVIEW_ENABLED = "true";
  process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED = "false";
  check("parent Growth flag cannot bypass the capability gate",
    reviewBuildAllowed() && growthCenterPreviewEnabled() && !growthCapabilityContractPreviewEnabled());
  process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED = "true";
  check("Vercel Preview accepts only all three gates",
    reviewBuildAllowed() && growthCenterPreviewEnabled() && growthCapabilityContractPreviewEnabled());

  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_CXOS_REVIEW;
  check("unknown production build identity fails closed", !reviewBuildAllowed());
} finally {
  if (priorCapability === undefined) delete process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED;
  else process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED = priorCapability;
  if (priorGrowth === undefined) delete process.env.GROWTH_CENTER_PREVIEW_ENABLED;
  else process.env.GROWTH_CENTER_PREVIEW_ENABLED = priorGrowth;
  if (priorVercel === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  else process.env.NEXT_PUBLIC_VERCEL_ENV = priorVercel;
  if (priorCxos === undefined) delete process.env.NEXT_PUBLIC_CXOS_REVIEW;
  else process.env.NEXT_PUBLIC_CXOS_REVIEW = priorCxos;
  if (priorNode === undefined) delete mutableEnv.NODE_ENV;
  else mutableEnv.NODE_ENV = priorNode;
}

// Route checks are resilient while parallel implementation is in flight: a
// missing file produces explicit failed checks rather than crashing the guard.
const routeRelative = "app/review/growth-center/capability-contract";
const routeDirectory = join(ROOT, routeRelative);
const routeFiles = existsSync(routeDirectory)
  ? readdirSync(routeDirectory).sort()
  : [];
check("capability route exists with only page, stage, and scoped CSS", equal(routeFiles, [
  "capability-contract.module.css",
  "page.tsx",
  "stage.tsx",
]));
const page = sourceOrEmpty(`${routeRelative}/page.tsx`);
const stage = sourceOrEmpty(`${routeRelative}/stage.tsx`);
const css = sourceOrEmpty(`${routeRelative}/capability-contract.module.css`);
const routeCode = codeOf(`${page}\n${stage}`);
const exportedPageAt = page.indexOf("export default");
const dynamicStageAt = page.indexOf('await import("./stage")');
const preImportBody = exportedPageAt >= 0 && dynamicStageAt > exportedPageAt
  ? page.slice(exportedPageAt, dynamicStageAt)
  : "";
const gatedNotFoundConjunction = /if\s*\(\s*!reviewAllowed\s*\|\|\s*!growthCenterAllowed\s*\|\|\s*!capabilityContractAllowed\s*\)\s*\{\s*notFound\(\);\s*\}/.test(
  preImportBody,
);
check("all three gates execute before the stage import",
  dynamicStageAt >= 0
    && /reviewBuildAllowed\(\)/.test(preImportBody)
    && /growthCenterPreviewEnabled\(\)/.test(preImportBody)
    && /growthCapabilityContractPreviewEnabled\(\)/.test(preImportBody)
    && gatedNotFoundConjunction);
check("page has a single gated dynamic stage import",
  equal([...page.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]), ["./stage"]));
check("stage has no dynamic import seam",
  [...stage.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].length === 0);
check("route has no CommonJS import seam", !/\brequire\s*\(/.test(routeCode));
check("page never statically imports its client stage",
  !/^\s*import(?:\s+type)?[\s\S]*?from\s+["']\.\/stage["'];?/m.test(page)
    && !/^\s*import\s*["']\.\/stage["'];?/m.test(page));
check("page remains a dynamic server component", !/^\s*["']use client["'];/m.test(page)
  && /export const dynamic = ["']force-dynamic["']/.test(page));
check("page resolves strict query fixtures without echoing raw values into the stage",
  /resolveCapabilityReviewRequest\(/.test(page)
    && !/searchParams\s*=\s*\{\.\.\./.test(page)
    && !/JSON\.stringify\(\s*searchParams/.test(page));

const staticImports = [
  ...[...routeCode.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]),
  ...[...routeCode.matchAll(/^\s*import\s*["']([^"']+)["'];?/gm)].map((match) => match[1]),
];
const allowedImports = new Set([
  "react",
  "next/navigation",
  "@/lib/cxos/reviewMode",
  "@/lib/cxos/runtime",
  "@/components/cxos/runtime/useCxosRoomRuntime",
  "@/lib/growthNetwork/previewFlags",
  "@/lib/growthNetwork/capabilityPreviewFlags",
  "@/lib/growthNetwork/capabilityContract",
  "./capability-contract.module.css",
]);
check("route imports only pure review and headless Core Runtime seams",
  staticImports.length > 0 && staticImports.every((specifier) => allowedImports.has(specifier)));
for (const forbiddenAuthority of [
  "prisma", "stripe", "billing", "auth", "session", "identity", "organization",
  "membership", "agency", "community", "marketplace", "reputation", "meetings",
  "documents", "eventBus", "analytics", "telemetry", "anthropic", "openai",
]) {
  check(`route imports no ${forbiddenAuthority} authority`, staticImports.every((specifier) =>
    !specifier.toLowerCase().includes(forbiddenAuthority.toLowerCase())));
}
for (const forbiddenEffect of [
  "fetch(", "axios", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon",
  "localStorage", "sessionStorage", "indexedDB", "document.cookie", "navigator.share",
  "<form", "onSubmit", "use server", "server action", "@prisma/client", "$queryRaw",
  "$executeRaw", "Math.random", "Date.now", "new Date", "crypto.randomUUID",
  "dangerouslySetInnerHTML", "<input", "<textarea", "contentEditable",
]) {
  check(`capability route excludes ${forbiddenEffect}`, !routeCode.includes(forbiddenEffect));
}
check("route has no external link or live API path",
  !/href\s*=\s*["']https?:\/\//.test(routeCode) && !/["']\/api\//.test(routeCode));
check("route renders all persistent boundary constants", [
  "GROWTH_CAPABILITY_REVIEW_DISCLOSURE",
  "GROWTH_CAPABILITY_INTERNAL_CONTRACT_NOTICE",
  "GROWTH_CAPABILITY_UNSUPPORTED_COPY",
  "GROWTH_CAPABILITY_AGENCY_BOUNDARY",
  "GROWTH_CAPABILITY_KAI_RECEIPT",
  "CGN_ECONOMIC_PHASE_1A_STATUS",
  "GROWTH_EXPERIENCE_PHASE_1A_STATUS",
  "GROWTH_EXPERIENCE_PHASE_1B_STATUS",
].every((symbol) => stage.includes(symbol)));
check("route labels correction and appeal as previews, never submissions",
  stage.includes("Preview correction path")
    && stage.includes("Preview appeal state")
    && !/>\s*(?:Submit|File appeal|Open case)\s*</i.test(stage));
check("Kai uses fixed questions and never an open prompt",
  stage.includes("CAPABILITY_KAI_QUESTIONS") && !/<input|<textarea|contentEditable/.test(stage));
check("fixture recovery never infers a default contract from an unsupported request",
  /const selectFixture[\s\S]*?if \(!selectedContractId\)\s*\{[\s\S]*?return;[\s\S]*?const contractId = selectedContractId;/.test(stage)
    && !/selectedContractId\s*\?\?\s*["']professional-capability["']/.test(stage)
    && /disabled=\{selectedContractId === null\}/.test(stage));
check("Agency boundary is visible through its canonical constant",
  stage.includes("GROWTH_CAPABILITY_AGENCY_BOUNDARY"));
check("route renders the structured eleven-part evidence contract",
  stage.includes("contractProjection.evidenceContract.map")
    && stage.includes('aria-label="Eleven-part synthetic evidence contract"')
    && css.includes(".evidenceContract"));
check("route preserves a focusable main landmark", /<main[\s\S]*?id=["']main["'][\s\S]*?tabIndex=\{-1\}/.test(stage));
check("CSS keeps keyboard focus, reduced motion, and 44px targets",
  /:focus-visible/.test(css)
    && /prefers-reduced-motion:\s*reduce/.test(css)
    && /min-height:\s*44px/.test(css));

// The nested route is unregistered and cannot be reached through public nav,
// sitemap, auth/session, middleware, or a separate API surface.
const routePrefix = `${routeDirectory}${sep}`;
const appSources = ["app", "components", "lib"]
  .flatMap((directory) => walk(join(ROOT, directory)))
  .filter((path) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)));
const registrationConsumers = appSources
  .filter((path) => !path.startsWith(routePrefix))
  .filter((path) => {
    const contents = readFileSync(path, "utf8");
    return contents.includes("/review/growth-center/capability-contract")
      || /(?:href|to|path|pathname|url|route)\s*(?:=|:)\s*["'`][^"'`]*capability-contract/i.test(contents)
      || /(?:push|replace)\s*\(\s*["'`][^"'`]*capability-contract/i.test(contents);
  })
  .map((path) => relative(ROOT, path));
check("capability route remains unregistered outside its own directory", equal(registrationConsumers, []));
const publicRegistrationSources = [
  "app/sitemap.ts", "app/robots.ts", "middleware.ts", "app/layout.tsx",
  "components/AppShell.tsx", "components/Sidebar.tsx",
].map(sourceOrEmpty).join("\n");
check("sitemap, robots, middleware, shell, and sidebar do not expose the route",
  !publicRegistrationSources.includes("capability-contract"));
const apiCapabilityConsumers = walk(join(ROOT, "app", "api"))
  .filter((path) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)))
  .filter((path) => /capabilityContract|GROWTH_CAPABILITY_CONTRACT|capability-contract/.test(
    readFileSync(path, "utf8"),
  ));
check("no API route consumes the capability contract", apiCapabilityConsumers.length === 0);

// No schema, migration, event, provider, model, auth, storage, analytics,
// commerce, or economic integration may exist anywhere in the implementation.
const prismaSchema = source("prisma/schema.prisma");
for (const model of [
  "GrowthCapability", "CapabilityContract", "CapabilityParticipation",
  "ProfessionalDevelopmentPathway", "MentorshipParticipation",
  "EducationProgram", "LearningArtifact", "OperatorContribution",
  "GrowthEvidence", "GrowthReview", "GrowthCorrection", "GrowthAppeal",
]) {
  check(`Prisma has no Phase 1B model ${model}`,
    !new RegExp(`model\\s+${model}\\b`).test(prismaSchema));
}
const migrationPaths = walk(join(ROOT, "prisma", "migrations"))
  .map((path) => relative(ROOT, path).toLowerCase());
check("no capability/Growth Experience migration exists", migrationPaths.every((path) =>
  !/growth[_-]?(?:experience|capability)|capability[_-]?contract|mentorship[_-]?participation/.test(path)));
const eventSource = sourceOrEmpty("lib/eventBus/contracts.ts")
  + sourceOrEmpty("lib/eventBus/envelope.ts");
check("Event Fabric has no Phase 1B event contract",
  !/(?:GROWTH_CAPABILITY|CAPABILITY_CONTRACT|MENTORSHIP_PARTICIPATION|GROWTH_EVIDENCE|GROWTH_APPEAL)[A-Z0-9_@-]*/.test(
    codeOf(eventSource),
  ));
const protectedSource = `${pureCode}\n${routeCode}`;
for (const forbiddenIntegration of [
  "next-auth", "getServerSession", "currentUser", "cookies(", "headers(",
  "prisma.", "stripe.", "anthropic", "openai", "posthog", "segment", "mixpanel",
  "amplitude", "gtag(", "track(", "capture(", "checkout", "purchase(",
  "enroll(", "publish(", "submit(", "save(", "create(", "update(", "delete(",
]) {
  check(`implementation excludes integration ${forbiddenIntegration}`,
    !protectedSource.toLowerCase().includes(forbiddenIntegration.toLowerCase()));
}

console.log(`\ngrowth-capability-contract.test.ts: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
