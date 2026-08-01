// Run: node --import tsx scripts/growth-network-foundation.test.ts
//
// DB-less guard for the dormant CreditVector Growth Network foundation. It proves the
// package is pure vocabulary with an exact review-only experience consumer boundary,
// no persistence, event, provider, or protected-surface dependency.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import {
  AGENCY_GROWTH_DISTRIBUTION_DAY_OF_MONTH,
  GROWTH_NETWORK_FOUNDATION_VERSION,
  GROWTH_NETWORK_PATHS,
  GROWTH_REVENUE_STREAMS,
  NON_QUALIFYING_GROWTH_SIGNALS,
  scheduledAgencyDistributionDate,
  type GrowthNetworkPath,
  type GrowthRevenueStream,
} from "../lib/growthNetwork";
import {
  growthNetworkEnabled,
  growthPayoutExecutionEnabled,
} from "../lib/growthNetwork/flags";

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

function equal<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function executableSource(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const expectedPaths = ["AGENCY_BUILDER", "PROFESSIONAL_OPERATOR"] as const;
const expectedStreams = [
  "AGENCY_GROWTH_DISTRIBUTION",
  "MARKETPLACE_SALE",
  "COURSE_SALE",
  "EDUCATION_SERVICE",
  "MENTORSHIP",
  "CONSULTING",
  "KAI_ASSET",
  "AFFILIATE_GROWTH",
  "SPONSORSHIP",
  "PARTNERSHIP",
  "ENTERPRISE_PROGRAM",
] as const;
const expectedRefusals = [
  "RAW_RECRUITMENT",
  "OPERATOR_COUNT",
  "PARTICIPANT_ADDITION",
  "INVITE_SENT",
  "REFERRAL_CLICK",
  "UNPAID_SIGNUP",
  "SELF_REFERRAL",
  "DUPLICATE_ACCOUNT",
  "PARTICIPANT_PURCHASE",
  "PAID_RETENTION",
  "DOWNSTREAM_ACTIVITY",
  "POPULARITY",
  "REVIEW_SENTIMENT",
  "FOLLOWER_COUNT",
  "LOGIN",
  "PAGE_OPEN",
  "MESSAGE_COUNT",
  "HOURS_ONLINE",
] as const;

// Compile-time union use plus runtime exactness/freeze.
const pathExample: GrowthNetworkPath = "AGENCY_BUILDER";
const streamExample: GrowthRevenueStream = "AGENCY_GROWTH_DISTRIBUTION";
check("foundation version is 1", GROWTH_NETWORK_FOUNDATION_VERSION === 1);
check("path union is usable", pathExample === expectedPaths[0]);
check("stream union is usable", streamExample === expectedStreams[0]);
check("exact two founder-directed paths", equal(GROWTH_NETWORK_PATHS, expectedPaths));
check("path registry is unique", new Set(GROWTH_NETWORK_PATHS).size === GROWTH_NETWORK_PATHS.length);
check("path registry is frozen at runtime", Object.isFrozen(GROWTH_NETWORK_PATHS));
check("exact eleven partitioned revenue streams", equal(GROWTH_REVENUE_STREAMS, expectedStreams));
check("revenue stream registry is unique", new Set(GROWTH_REVENUE_STREAMS).size === GROWTH_REVENUE_STREAMS.length);
check("revenue stream registry is frozen at runtime", Object.isFrozen(GROWTH_REVENUE_STREAMS));
check("exact refusal registry", equal(NON_QUALIFYING_GROWTH_SIGNALS, expectedRefusals));
check("refusal registry is unique", new Set(NON_QUALIFYING_GROWTH_SIGNALS).size === NON_QUALIFYING_GROWTH_SIGNALS.length);
check("refusal registry is frozen at runtime", Object.isFrozen(NON_QUALIFYING_GROWTH_SIGNALS));
check("no refused signal is a revenue stream", NON_QUALIFYING_GROWTH_SIGNALS.every((signal) => !(GROWTH_REVENUE_STREAMS as readonly string[]).includes(signal)));

// The only ratified schedule value: explicit Agency DISTRIBUTION month -> same month 15.
check("Agency Growth Distribution day is exactly 15", AGENCY_GROWTH_DISTRIBUTION_DAY_OF_MONTH === 15);
for (let month = 1; month <= 12; month += 1) {
  const input = `2026-${String(month).padStart(2, "0")}`;
  check(`${input} maps to its own distribution-month day 15`, scheduledAgencyDistributionDate(input) === `${input}-15`);
}
check("year boundary never infers another month", scheduledAgencyDistributionDate("2026-12") === "2026-12-15");
check("leap-year distribution month remains date-only", scheduledAgencyDistributionDate("2028-02") === "2028-02-15");
for (const invalid of [
  "2026-00", "2026-13", "2026-1", "26-01", "0000-01", " 2026-01", "2026-01 ",
  "２０２６-０１", "2026/01", "observation:2026-01", "", "arbitrary", null, undefined, 202601, {}, [],
]) {
  check(`invalid distribution month fails closed: ${String(invalid)}`, scheduledAgencyDistributionDate(invalid) === null);
}

// Exact-string master flag and unconditional payout sentinel. Always restore env.
const priorMaster = process.env.GROWTH_NETWORK_ENABLED;
const payoutKeys = ["GROWTH_PAYOUT_EXECUTION_ENABLED", "PAYOUTS_ENABLED", "STRIPE_PAYOUTS_ENABLED"] as const;
const priorPayout = payoutKeys.map((key) => [key, process.env[key]] as const);
try {
  delete process.env.GROWTH_NETWORK_ENABLED;
  check("master flag defaults off", !growthNetworkEnabled());
  for (const value of ["", "false", "TRUE", "1", " true", "true "]) {
    process.env.GROWTH_NETWORK_ENABLED = value;
    check(`master flag rejects non-exact value ${JSON.stringify(value)}`, !growthNetworkEnabled());
  }
  process.env.GROWTH_NETWORK_ENABLED = "true";
  check("master flag accepts exact true", growthNetworkEnabled());

  for (const key of payoutKeys) process.env[key] = "true";
  check("payout execution remains hard off under payout-like env values", growthPayoutExecutionEnabled() === false);
} finally {
  if (priorMaster === undefined) delete process.env.GROWTH_NETWORK_ENABLED;
  else process.env.GROWTH_NETWORK_ENABLED = priorMaster;
  for (const [key, value] of priorPayout) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

// Exact package file/import boundary.
const packageDir = join(ROOT, "lib", "growthNetwork");
const packageFiles = walk(packageDir).map((path) => relative(ROOT, path)).sort();
check("Growth package has exactly the seven approved source files", equal(packageFiles, [
  "lib/growthNetwork/capabilityContract.ts",
  "lib/growthNetwork/capabilityPreviewFlags.ts",
  "lib/growthNetwork/experience.ts",
  "lib/growthNetwork/flags.ts",
  "lib/growthNetwork/foundation.ts",
  "lib/growthNetwork/index.ts",
  "lib/growthNetwork/previewFlags.ts",
]));
const foundationSource = source("lib/growthNetwork/foundation.ts");
const capabilityContractSource = source("lib/growthNetwork/capabilityContract.ts");
const capabilityPreviewFlagsSource = source("lib/growthNetwork/capabilityPreviewFlags.ts");
const experienceSource = source("lib/growthNetwork/experience.ts");
const flagsSource = source("lib/growthNetwork/flags.ts");
const indexSource = source("lib/growthNetwork/index.ts");
const previewFlagsSource = source("lib/growthNetwork/previewFlags.ts");
check("foundation has no imports", !/^\s*import\s/m.test(foundationSource));
check("capability contract has no imports", !/^\s*import\s/m.test(capabilityContractSource));
check("capability preview flags have no imports", !/^\s*import\s/m.test(capabilityPreviewFlagsSource));
check("experience projection has no imports", !/^\s*import\s/m.test(experienceSource));
check("flags have no imports", !/^\s*import\s/m.test(flagsSource));
check("preview flags have no imports", !/^\s*import\s/m.test(previewFlagsSource));
check("public barrel imports/exports foundation only", /^export \* from "\.\/foundation";\s*$/m.test(indexSource) && !/flags/.test(executableSource(indexSource)));
check("pure projections and public barrel have no process access", !/\bprocess\s*\./.test(executableSource(foundationSource + capabilityContractSource + experienceSource + indexSource)));
check("package has no dynamic import or require", !/\b(?:import|require)\s*\(/.test(executableSource(foundationSource + capabilityContractSource + capabilityPreviewFlagsSource + experienceSource + flagsSource + indexSource + previewFlagsSource)));
const flagProcessReads = executableSource(flagsSource).match(/process\.env\.[A-Z0-9_]+/g) ?? [];
check("flags read only the one approved master environment key", equal(flagProcessReads, ["process.env.GROWTH_NETWORK_ENABLED"]));
const previewFlagProcessReads = executableSource(previewFlagsSource).match(/process\.env\.[A-Z0-9_]+/g) ?? [];
check("preview flag reads only its exact subordinate review key", equal(previewFlagProcessReads, ["process.env.GROWTH_CENTER_PREVIEW_ENABLED"]));
const capabilityPreviewFlagProcessReads = executableSource(capabilityPreviewFlagsSource).match(/process\.env\.[A-Z0-9_]+/g) ?? [];
check("capability preview flag reads only its exact subordinate review key", equal(capabilityPreviewFlagProcessReads, ["process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED"]));

const executable = executableSource([foundationSource, capabilityContractSource, capabilityPreviewFlagsSource, experienceSource, flagsSource, indexSource, previewFlagsSource].join("\n"));
for (const forbidden of [
  "@prisma/client", "@/lib/prisma", "@/lib/stripe", "@/lib/billing", "stripe",
  "@/lib/eventBus", "@/lib/reputation", "next/headers", "next-auth", "fetch(", "axios",
  "prisma.", "$queryRaw", "$executeRaw", "$transaction", "new Date", "Date.now", "Date.UTC", "Math.random",
  "CREATE TABLE", "ALTER TABLE", "INSERT INTO", "ACH", "PAYPAL", "CRYPTO",
]) {
  check(`executable Growth package excludes ${forbidden}`, !executable.includes(forbidden));
}
for (const forbiddenField of ["amount", "cents", "commissionRate", "balance", "currency", "payoutDestination", "taxForm"]) {
  check(`foundation declares no monetary/provider field ${forbiddenField}`, !new RegExp(`\\b${forbiddenField}\\b`, "i").test(executableSource(foundationSource)));
}

// Exact application consumer boundary. Only the isolated Founder-review route may
// consume the Growth package; the public barrel remains foundation-only.
const productionSources = ["app", "components", "lib"]
  .flatMap((directory) => walk(join(ROOT, directory)))
  .filter((path) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)))
  .filter((path) => !path.startsWith(`${packageDir}${sep}`));
const consumers = productionSources.filter((path) => /growthNetwork|growth-network/i.test(readFileSync(path, "utf8")));
check("Growth package consumers are exactly the two isolated review pages and stages", equal(
  consumers.map((path) => relative(ROOT, path)).sort(),
  [
    "app/review/growth-center/capability-contract/page.tsx",
    "app/review/growth-center/capability-contract/stage.tsx",
    "app/review/growth-center/page.tsx",
    "app/review/growth-center/stage.tsx",
  ],
));
check("Growth package has no consumer outside the review namespace", consumers.every((path) => relative(ROOT, path).startsWith("app/review/growth-center/")));

// No speculative schema, migration, or Event Fabric contract.
const prismaSchema = source("prisma/schema.prisma");
const reservedSchemaModels = [
  "GrowthParticipation", "GrowthPolicyVersion", "QualificationCycle", "QualificationDecision",
  "QualificationEvidenceRef", "AttributionEpisode", "AttributionTouchpoint", "AttributionDisposition",
  "AttributionConsentRef", "ReferralAttribution", "AffiliateCommissionAccrual", "RevenueShareAccrual",
  "GrowthDistributionCycle", "GrowthQualificationSnapshot", "DistributionCase",
  "DistributionQualificationRef", "DistributionHold", "DistributionApproval", "DistributionStatement",
  "EconomicAccount", "EconomicJournalEntry", "EconomicJournalLine", "SettlementReference",
  "IntegrityCase", "IntegritySignal", "IntegrityDecision", "IntegrityAppealRef", "GrowthReviewCase",
  "GrowthAppeal", "PayeeTaxProfile", "PayeeComplianceProfile", "TaxDocumentRef",
  "TaxClassificationDecision", "TaxYearPolicy", "PayoutPreparationBatch", "MarketplaceRevenue",
] as const;
for (const model of reservedSchemaModels) {
  check(`Prisma schema has no dormant-only ${model} model`, !new RegExp(`model\\s+${model}\\b`).test(prismaSchema));
}
const migrationNames = walk(join(ROOT, "prisma", "migrations")).map((path) => relative(ROOT, path).toLowerCase());
check("no Growth/referral/payout migration exists", migrationNames.every((name) => !/growth[_-]?network|growth[_-]?distribution|payout|referral[_-]?attribution/.test(name)));
const eventRegistry = source("lib/eventBus/contracts.ts") + source("lib/eventBus/envelope.ts");
const reservedEventTypes = [
  "QUALIFICATION_CYCLE_SEALED", "GROWTH_QUALIFICATION_DECIDED",
  "ATTRIBUTION_EPISODE_CLASSIFIED", "DISTRIBUTION_CASE_HELD",
  "DISTRIBUTION_CASE_APPROVED", "LEDGER_ENTRY_POSTED",
  "INTEGRITY_CASE_DISPOSITIONED", "TAX_READINESS_CHANGED",
  "MARKETPLACE_ORDER_SEALED", "LEARNING_OUTCOME_VERIFIED",
  "MENTORSHIP_OUTCOME_VERIFIED", "GROWTH_PARTICIPATION_ENROLLED",
  "GROWTH_PARTICIPATION_SUSPENDED", "GROWTH_PARTICIPATION_ENDED",
  "GROWTH_EVIDENCE_ACCEPTED", "GROWTH_EVIDENCE_HELD", "GROWTH_EVIDENCE_REJECTED",
  "GROWTH_EVIDENCE_INVALIDATED", "REFERRAL_ATTRIBUTION_RECORDED",
  "REFERRAL_ATTRIBUTION_QUALIFIED", "REFERRAL_ATTRIBUTION_DISQUALIFIED",
  "AFFILIATE_COMMISSION_ACCRUED", "AFFILIATE_COMMISSION_HELD",
  "AFFILIATE_COMMISSION_REVERSED", "REVENUE_SHARE_ACCRUED", "REVENUE_SHARE_REVERSED",
  "GROWTH_CYCLE_CLOSED", "GROWTH_QUALIFICATION_SNAPSHOT_LOCKED",
  "GROWTH_ALLOCATION_POSTED", "GROWTH_ALLOCATION_HELD", "GROWTH_ALLOCATION_RELEASED",
  "GROWTH_LEDGER_REVERSAL_POSTED", "GROWTH_DISTRIBUTION_DISPUTE_OPENED",
  "GROWTH_DISTRIBUTION_DISPUTE_RESOLVED", "GROWTH_PAYOUT_BATCH_PREPARED",
] as const;
for (const eventType of reservedEventTypes) {
  check(`no speculative ${eventType} Event Fabric contract exists`, !new RegExp(`["']${eventType}(?:["']|@)`).test(eventRegistry));
}

console.log(`\ngrowth-network-foundation.test.ts: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
